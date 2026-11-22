'use client';

import { useMemo } from 'react';
import { construireRejeu, type Releve } from '@/lib/realtime/rejeu';
import { valeurPortefeuilleDuJour } from '@/lib/realtime/courbe';
import { fmtFcfa, fmtPctSigne } from '@/lib/format';
import { ChiffreRoulant } from '@/components/ui/ChiffreRoulant';
import CourbeDuJour from '@/components/marche/CourbeDuJour';
import { useCoursDirect } from './CoursDirect';

/**
 * « Votre portefeuille aujourd'hui » : variation du jour de vos positions en
 * actions (liquidités exclues) par rapport à la clôture de la veille, et sa
 * courbe sur les relevés réels de la séance. Pendant la séance, chaque cours
 * reçu met le chiffre à jour et prolonge la courbe.
 *
 * Seules comptent les positions dont la clôture de la veille est connue :
 * sans elle, aucune variation du jour ne peut être affirmée.
 */
export default function PortefeuilleDuJour({ positions, releves, veilles }: {
  positions: { code: string; quantite: number }[];
  /** Relevés de la séance pour les valeurs détenues (brvm_intraday_snapshots). */
  releves: Releve[];
  /** Clôture de la veille par code. */
  veilles: Record<string, number | null>;
}) {
  const { prix, enDirect, derniereMaj } = useCoursDirect();
  const images = useMemo(() => construireRejeu(releves), [releves]);
  const { reference, points } = useMemo(() => valeurPortefeuilleDuJour(positions, images, veilles), [positions, images, veilles]);

  // Valeur au dernier cours connu (direct compris), mêmes positions retenues.
  const valeur = useMemo(() => {
    if (reference == null) return null;
    return positions
      .filter((p) => veilles[p.code] != null && p.quantite > 0)
      .reduce((s, p) => s + p.quantite * (prix[p.code] ?? (veilles[p.code] as number)), 0);
  }, [positions, veilles, prix, reference]);

  const direct = useMemo(
    () => (enDirect && derniereMaj && valeur != null ? { t: derniereMaj.getTime(), v: valeur } : null),
    [enDirect, derniereMaj, valeur],
  );

  if (reference == null || valeur == null) return null;
  const ecart = valeur - reference;
  const pct = reference > 0 ? (ecart / reference) * 100 : null;
  const tonEcart = ecart > 0 ? 'text-up' : ecart < 0 ? 'text-down' : 'text-muted';

  return (
    <section aria-labelledby="pf-jour" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="pf-jour" className="text-sm font-semibold text-ivory">Votre portefeuille aujourd’hui</h2>
          <p className="text-[11px] text-faint">Positions en actions, par rapport à la clôture d’hier</p>
        </div>
        <p className={`tabular text-2xl font-semibold ${tonEcart}`}>
          <ChiffreRoulant valeur={ecart} format={(x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmtFcfa(Math.abs(x))}`} />
          <span className="ml-1 text-sm font-normal text-muted">FCFA</span>
          {pct != null && <span className="ml-2 text-sm">{fmtPctSigne(pct)}</span>}
        </p>
      </div>
      <CourbeDuJour
        points={points}
        reference={reference}
        libelleReference="clôture d’hier"
        direct={direct}
        libelle="Valeur de vos positions en actions"
        unite="FCFA"
        largeur={640}
        hauteur={90}
        className="mt-3"
      />
    </section>
  );
}
