'use client';

import { useMemo } from 'react';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { useIndicesSeance } from '@/lib/realtime/useIndicesSeance';
import type { IndiceDirect } from '@/lib/realtime/indices';
import type { PointCourbe } from '@/lib/realtime/courbe';
import { FlashFort } from '@/components/ui/FlashFort';
import { ChiffreRoulant } from '@/components/ui/ChiffreRoulant';
import { EnDirect } from '@/components/ui/EnDirect';
import CourbeDuJour from '@/components/marche/CourbeDuJour';
import { useRejeu } from '@/components/rejeu/RejeuProvider';
import type { Chiffre } from './Ouverture';

const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');
const fmtIndice = (x: number) => fmtNumber(x, 2);

/**
 * Les six mesures de l'ouverture du tableau de bord. Seules celles qui portent
 * un code d'indice (`indice`) suivent la séance en direct ; valeur échangée et
 * capitalisation viennent d'un récapitulatif publié une fois, elles restent
 * telles que le serveur les a rendues.
 *
 * Sous chaque indice, sa courbe du jour (relevés de brvm_indices_snapshots,
 * migration 0256) : absente tant qu'il n'y a pas deux relevés.
 */
export default function ChiffresSeance({ chiffres, indices, dateMarche, courbes = {}, veilles = {} }: {
  chiffres: Chiffre[];
  /** Indices de la MÊME séance que les cours (les autres sont déjà écartés). */
  indices: IndiceDirect[];
  dateMarche: string;
  /** Points du jour par code d'indice. */
  courbes?: Record<string, PointCourbe[]>;
  /** Valeur de la veille par code d'indice (ligne de référence). */
  veilles?: Record<string, number | null>;
}) {
  const base = useMemo(() => indices, [indices]);
  const { indices: direct, flashes, enDirect, derniereMaj } = useIndicesSeance(base, dateMarche);
  const parCode = new Map(direct.map((i) => [i.code, i]));
  const rejeu = useRejeu();

  return (
    <div className="min-w-0">
      <dl className="grid grid-cols-2 overflow-hidden gap-px rounded-lg border border-border bg-border sm:grid-cols-3">
        {chiffres.map((c) => {
          const i = c.indice ? parCode.get(c.indice) : undefined;
          const variation = i ? i.variation_pct : c.variation;
          const pointDirect = i && enDirect && derniereMaj && i.valeur != null ? { t: derniereMaj.getTime(), v: i.valeur } : null;
          return (
            <div key={c.libelle} className="min-w-0 bg-bg px-3.5 py-3">
              <dt className="overline text-faint">{c.libelle}</dt>
              <dd className="tabular mt-1.5 text-[19px] text-ivory">
                {i ? (
                  <FlashFort direction={flashes[i.code]}>
                    <ChiffreRoulant valeur={i.valeur} format={fmtIndice} />
                  </FlashFort>
                ) : c.valeur}
              </dd>
              <dd className={`tabular mt-0.5 text-xs ${ton(variation)}`}>
                {variation != null ? `${fmtPctSigne(variation)}${c.note ? ` ${c.note}` : ''}` : (c.note ?? '—')}
              </dd>
              {c.indice && (
                <dd className="mt-1.5">
                  <CourbeDuJour
                    points={courbes[c.indice] ?? []}
                    reference={veilles[c.indice] ?? null}
                    direct={pointDirect}
                    libelle={c.libelle}
                    decimales={2}
                    largeur={160}
                    hauteur={30}
                    compacte
                  />
                </dd>
              )}
            </div>
          );
        })}
      </dl>
      <EnDirect enDirect={enDirect} derniereMaj={derniereMaj} className="mt-2" />
      {rejeu?.actif && (
        <p className="mt-2 text-xs text-faint">Pendant le rejeu, les indices restent à leur dernière valeur : seuls les cours des actions sont rejoués.</p>
      )}
    </div>
  );
}
