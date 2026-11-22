'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useCoursSeance } from '@/lib/realtime/useCoursSeance';
import type { FlashDirection } from '@/lib/realtime/mergeActions';
import { valoriser, type PositionValorisable } from '@/lib/portfolio/valoriserDirect';
import { fmtNumber, fmtFcfa, fmtDateCourte } from '@/lib/format';
import { FlashFort } from '@/components/ui/FlashFort';
import { EnDirect } from '@/components/ui/EnDirect';
import { MetricCard } from '@/components/ui/premium';

/**
 * Cours en direct du portefeuille. La page reste rendue côté serveur ; seules
 * les cellules qui dépendent d'un cours (cours, valorisation, plus-value, date
 * du cours, deux indicateurs du haut) lisent ce fournisseur. Un seul
 * abonnement pour toute la page.
 */
interface Etat {
  prix: Record<string, number | null>;
  flashes: Record<string, FlashDirection>;
  /** Codes dont le cours a été reçu en direct (leur date est alors la séance). */
  recus: Set<string>;
  enDirect: boolean;
  derniereMaj: Date | null;
  dateMarche: string | null;
}

const Ctx = createContext<Etat | null>(null);

export interface CoursDepart {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  /** Clôture de la veille : référence de la courbe « aujourd'hui ». */
  cours_precedent?: number | null;
}

export function CoursDirectProvider({ cours, dateMarche, children }: {
  cours: CoursDepart[];
  /** Séance la plus récente : la seule écoutée. */
  dateMarche: string | null;
  children: ReactNode;
}) {
  const base = useMemo(() => cours, [cours]);
  const { rows, flashes, enDirect, derniereMaj } = useCoursSeance(base, dateMarche);
  const etat = useMemo<Etat>(() => {
    const prix: Record<string, number | null> = {};
    const recus = new Set<string>();
    rows.forEach((r, i) => {
      prix[r.code] = r.cours_jour;
      // `recomposer` garde la référence d'une ligne inchangée.
      if (r !== base[i]) recus.add(r.code);
    });
    return { prix, flashes, recus, enDirect, derniereMaj, dateMarche };
  }, [rows, base, flashes, enDirect, derniereMaj, dateMarche]);
  return <Ctx.Provider value={etat}>{children}</Ctx.Provider>;
}

const VIDE: Etat = { prix: {}, flashes: {}, recus: new Set(), enDirect: false, derniereMaj: null, dateMarche: null };
const useEtat = () => useContext(Ctx) ?? VIDE;
/** Cours en direct du portefeuille, pour les blocs qui en dérivent (courbe du jour). */
export const useCoursDirect = useEtat;

export function CoursPosition({ code }: { code: string }) {
  const { prix, flashes } = useEtat();
  return <FlashFort direction={flashes[code]}>{fmtNumber(prix[code] ?? null)}</FlashFort>;
}

export function DateCoursPosition({ code, dateServeur }: { code: string; dateServeur: string | null }) {
  const { recus, dateMarche } = useEtat();
  return <>{fmtDateCourte(recus.has(code) ? dateMarche : dateServeur)}</>;
}

export function ValeurPosition({ position }: { position: PositionValorisable }) {
  const { prix } = useEtat();
  const l = valoriser([position], prix, null).lignes[0]!;
  return <>{l.value != null ? fmtFcfa(l.value) : '—'}</>;
}

export function PnlPosition({ position }: { position: PositionValorisable }) {
  const { prix } = useEtat();
  const l = valoriser([position], prix, null).lignes[0]!;
  return (
    <span className={l.pnl == null ? 'text-faint' : l.pnl >= 0 ? 'text-up' : 'text-down'}>
      {l.pnl != null ? `${l.pnl >= 0 ? '+' : ''}${fmtFcfa(l.pnl)} (${l.pnlPct?.toFixed(1)}%)` : '—'}
    </span>
  );
}

export function KpiValorisation({ positions, liquidites }: { positions: PositionValorisable[]; liquidites: number | null }) {
  const { prix } = useEtat();
  const v = valoriser(positions, prix, liquidites);
  return (
    <MetricCard
      label="Valorisation totale"
      value={fmtFcfa(v.totalValue)}
      unit="FCFA"
      delta={liquidites != null ? `dont ${fmtFcfa(liquidites)} cash` : 'actions uniquement'}
      deltaDir="flat"
      accent="gold"
    />
  );
}

export function KpiPnl({ positions }: { positions: PositionValorisable[] }) {
  const { prix } = useEtat();
  const v = valoriser(positions, prix, null);
  const dir: 'up' | 'down' | 'flat' = v.totalPnl > 0 ? 'up' : v.totalPnl < 0 ? 'down' : 'flat';
  return (
    <MetricCard
      label="P&L latent"
      value={`${v.totalPnl >= 0 ? '+' : ''}${fmtFcfa(v.totalPnl)}`}
      unit="FCFA"
      delta={v.totalPnlPct != null ? `${v.totalPnlPct >= 0 ? '+' : ''}${(v.totalPnlPct * 100).toFixed(1)}% / coût` : undefined}
      deltaDir={dir}
      accent={dir === 'up' ? 'emerald' : 'neutral'}
    />
  );
}

/** Ligne « Total portefeuille » du tableau des positions. */
export function TotalValeur({ positions, liquidites }: { positions: PositionValorisable[]; liquidites: number | null }) {
  const { prix } = useEtat();
  return <>{fmtFcfa(valoriser(positions, prix, liquidites).totalValue)}</>;
}

export function TotalPnl({ positions }: { positions: PositionValorisable[] }) {
  const { prix } = useEtat();
  const { totalPnl } = valoriser(positions, prix, null);
  return (
    <span className={totalPnl >= 0 ? 'text-up' : 'text-down'}>
      {totalPnl >= 0 ? '+' : ''}{fmtFcfa(totalPnl)}
    </span>
  );
}

export function EnDirectPortefeuille({ className = '' }: { className?: string }) {
  const { enDirect, derniereMaj } = useEtat();
  return <EnDirect enDirect={enDirect} derniereMaj={derniereMaj} className={className} />;
}
