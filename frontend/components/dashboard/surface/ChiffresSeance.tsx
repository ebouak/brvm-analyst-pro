'use client';

import { useMemo } from 'react';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { useIndicesSeance } from '@/lib/realtime/useIndicesSeance';
import type { IndiceDirect } from '@/lib/realtime/indices';
import { FlashValue } from '@/components/ui/FlashValue';
import { EnDirect } from '@/components/ui/EnDirect';
import type { Chiffre } from './Ouverture';

const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/**
 * Les six mesures de l'ouverture du tableau de bord. Seules celles qui portent
 * un code d'indice (`indice`) suivent la séance en direct ; valeur échangée et
 * capitalisation viennent d'un récapitulatif publié une fois, elles restent
 * telles que le serveur les a rendues.
 */
export default function ChiffresSeance({ chiffres, indices, dateMarche }: {
  chiffres: Chiffre[];
  /** Indices de la MÊME séance que les cours (les autres sont déjà écartés). */
  indices: IndiceDirect[];
  dateMarche: string;
}) {
  const base = useMemo(() => indices, [indices]);
  const { indices: direct, flashes, enDirect, derniereMaj } = useIndicesSeance(base, dateMarche);
  const parCode = new Map(direct.map((i) => [i.code, i]));

  return (
    <div className="min-w-0">
      <dl className="grid grid-cols-2 overflow-hidden gap-px rounded-lg border border-border bg-border sm:grid-cols-3">
        {chiffres.map((c) => {
          const i = c.indice ? parCode.get(c.indice) : undefined;
          const valeur = i ? (i.valeur == null ? '—' : fmtNumber(i.valeur, 2)) : c.valeur;
          const variation = i ? i.variation_pct : c.variation;
          return (
            <div key={c.libelle} className="min-w-0 bg-bg px-3.5 py-3">
              <dt className="overline text-faint">{c.libelle}</dt>
              <dd className="tabular mt-1.5 text-[19px] text-ivory">
                {i ? <FlashValue direction={flashes[i.code]}>{valeur}</FlashValue> : valeur}
              </dd>
              <dd className={`tabular mt-0.5 text-xs ${ton(variation)}`}>
                {variation != null ? `${fmtPctSigne(variation)}${c.note ? ` ${c.note}` : ''}` : (c.note ?? '—')}
              </dd>
            </div>
          );
        })}
      </dl>
      <EnDirect enDirect={enDirect} derniereMaj={derniereMaj} className="mt-2" />
    </div>
  );
}
