'use client';

import { useMemo, type ReactNode } from 'react';
import { useCoursSeance } from '@/lib/realtime/useCoursSeance';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { pctFr } from '@/lib/fiche/affichage';
import type { PointCourbe } from '@/lib/realtime/courbe';
import { FlashFort } from '@/components/ui/FlashFort';
import { ChiffreRoulant } from '@/components/ui/ChiffreRoulant';
import { EnDirect } from '@/components/ui/EnDirect';
import CourbeDuJour from '@/components/marche/CourbeDuJour';

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

/** Bloc « prix principal » de la fiche action, avec la courbe du jour. */
export function PrixFicheAction({ code, dateMarche, cours, variation, coursPrecedent, apres, courbe = [] }: {
  code: string;
  dateMarche: string | null;
  cours: number | null;
  variation: number | null;
  /** Clôture de la veille : la variation absolue se recalcule contre elle. */
  coursPrecedent: number | null;
  /** Ligne « Séance du … » et badge de fraîcheur, rendus par le serveur. */
  apres?: ReactNode;
  /** Relevés de la séance (brvm_intraday_snapshots), déjà réduits en points. */
  courbe?: PointCourbe[];
}) {
  const v = useCoursValeur(code, dateMarche, cours, variation);
  const varAbs = coursPrecedent != null && v.cours != null ? v.cours - coursPrecedent : null;
  const up = (v.variation ?? 0) >= 0;
  // Un cours reçu en direct prolonge la courbe ; jamais hors séance.
  const direct = useMemo(
    () => (v.enDirect && v.derniereMaj && v.cours != null ? { t: v.derniereMaj.getTime(), v: v.cours } : null),
    [v.enDirect, v.derniereMaj, v.cours],
  );
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-1.5">
        <span className="tabular font-mono text-4xl md:text-5xl font-bold tracking-tight text-ivory leading-none">
          <FlashFort direction={v.flash}>
            <ChiffreRoulant valeur={v.cours} format={(x) => fmtNumber(x)} />
          </FlashFort>
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
        {/* La pastille de fraîcheur (`apres`) dit déjà l'heure du relevé sur cette ligne. */}
        <EnDirect enDirect={v.enDirect} derniereMaj={v.derniereMaj} heure={false} />
      </div>
      <CourbeDuJour
        points={courbe}
        reference={coursPrecedent}
        libelleReference="clôture veille"
        direct={direct}
        libelle={`Cours de ${code}`}
        unite="FCFA"
        className="mt-3 max-w-md"
      />
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
        <FlashFort direction={v.flash}>
          <ChiffreRoulant valeur={v.cours} format={(x) => fmtNumber(x)} />
        </FlashFort>{' '}
        <span className="text-sm text-muted">FCFA</span>
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
