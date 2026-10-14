'use client';

import { useEffect, useState } from 'react';
import { computeMarketPhase, type MarketPhase } from '@/components/landing/MarketSessionBanner';

/** Pastille compacte d'état de séance (spec §9 : remplace les quatre cartes). */
export default function PastilleSeance() {
  const [phase, setPhase] = useState<MarketPhase | null>(null);
  useEffect(() => {
    const maj = () => setPhase(computeMarketPhase(new Date()));
    maj();
    const t = setInterval(maj, 30_000);
    return () => clearInterval(t);
  }, []);
  // Premier rendu identique serveur/client (pas d'heure) : aucun écart d'hydratation.
  if (!phase) return <span className="inline-flex h-7 w-40 rounded-full border border-border" aria-hidden />;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ivory" title={phase.sessionDetail}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${phase.open ? 'animate-pulse bg-up' : 'bg-muted'}`} />
      {phase.marketLabel} · {phase.sessionLabel}
    </span>
  );
}
