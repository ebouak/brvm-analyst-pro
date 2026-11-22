'use client';

import { useMemo, type ReactNode } from 'react';
import { useCoursSeance } from '@/lib/realtime/useCoursSeance';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { pctFr } from '@/lib/fiche/affichage';
import { FlashValue } from '@/components/ui/FlashValue';
import { EnDirect } from '@/components/ui/EnDirect';

/**
 * Cours d'UNE valeur suivi en direct pendant la séance (fiche action, fiche
 * société). Un seul abonnement par page. Hors séance, ou sans date de séance,
 * le cours rendu par le serveur reste affiché tel quel.
 */
function useCoursValeur(code: string, dateMarche: string | null, cours: number | null, variation: number | null) {
  const base = useMemo(() => [{ code, cours_jour: cours, variation_pct: variation }], [code, cours, variation]);
  const { rows, flashes, enDirect, derniereMaj } = useCoursSeance(base, dateMarche);
  const l = rows[0]!;
  return { cours: l.cours_jour, variation: l.variation_pct, flash: flashes[code], enDirect, derniereMaj };
}

/** Bloc « prix principal » de la fiche action. */
export function PrixFicheAction({ code, dateMarche, cours, variation, coursPrecedent, apres }: {
  code: string;
  dateMarche: string | null;
  cours: number | null;
  variation: number | null;
  /** Clôture de la veille : la variation absolue se recalcule contre elle. */
  coursPrecedent: number | null;
  /** Ligne « Séance du … » et badge de fraîcheur, rendus par le serveur. */
  apres?: ReactNode;
}) {
  const v = useCoursValeur(code, dateMarche, cours, variation);
  const varAbs = coursPrecedent != null && v.cours != null ? v.cours - coursPrecedent : null;
  const up = (v.variation ?? 0) >= 0;
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-1.5">
        <span className="tabular font-mono text-4xl md:text-5xl font-bold tracking-tight text-ivory leading-none">
          <FlashValue direction={v.flash}>{fmtNumber(v.cours)}</FlashValue>
        </span>
        <span className="text-muted text-base mb-1">FCFA</span>
        {varAbs != null && (
          <span className={`tabular font-mono text-base font-semibold mb-1 ${up ? 'text-up' : 'text-down'}`}>
            {up ? '+' : ''}{fmtNumber(varAbs)}{' '}
            <span className="text-sm opacity-80">
              ({pctFr(v.variation ?? 0, 2, true)})
            </span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {apres}
        <EnDirect enDirect={v.enDirect} derniereMaj={v.derniereMaj} />
      </div>
    </>
  );
}

/** Cours et variation en tête de la fiche société. */
export function PrixFicheSociete({ code, dateMarche, cours, variation, seance }: {
  code: string;
  dateMarche: string | null;
  cours: number | null;
  variation: number | null;
  /** « séance du … », mis en forme par le serveur. */
  seance?: ReactNode;
}) {
  const v = useCoursValeur(code, dateMarche, cours, variation);
  const arrondie = v.variation != null ? Number(v.variation.toFixed(2)) : null;
  return (
    <div className="text-right">
      <p className="tabular text-2xl text-ivory">
        <FlashValue direction={v.flash}>{fmtNumber(v.cours)}</FlashValue> <span className="text-sm text-muted">FCFA</span>
      </p>
      <p className="text-sm text-faint">
        {v.variation != null && (
          <span className={`tabular ${arrondie! > 0 ? 'text-up' : arrondie! < 0 ? 'text-down' : 'text-muted'}`}>
            {fmtPctSigne(v.variation)}
          </span>
        )}
        {v.variation != null && seance && ' · '}
        {seance}
      </p>
      <EnDirect enDirect={v.enDirect} derniereMaj={v.derniereMaj} className="mt-1" />
    </div>
  );
}
