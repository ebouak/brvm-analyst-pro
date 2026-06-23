'use client';

import Link from 'next/link';
import { aggregateSeasonality, type MonthlyReturn } from '@/lib/seasonality/compute';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export default function SeasonalityCard({ code, returns }: { code: string; returns: MonthlyReturn[] }) {
  if (returns.length === 0) return null;
  const r = aggregateSeasonality(returns, 10);
  const bias = r.currentMonthBias;

  return (
    <div className="rounded-panel border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em]">Saisonnalité (10 ans)</p>
        <Link href={`/saisonnalite?code=${code}`} className="text-[11px] text-info hover:underline">Complet →</Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-faint">Mois en cours</p>
          <p className="font-semibold text-white">{bias && bias.n > 0 ? `${MONTHS[bias.month - 1]} ${pct(bias.avgReturn)}` : '—'}</p></div>
        <div><p className="text-faint">Meilleur</p>
          <p className="font-semibold text-up">{r.bestMonth ? MONTHS[r.bestMonth - 1] : '—'}</p></div>
        <div><p className="text-faint">Pire</p>
          <p className="font-semibold text-down">{r.worstMonth ? MONTHS[r.worstMonth - 1] : '—'}</p></div>
      </div>
      {r.dataQuality === 'insufficient' && <p className="text-[10px] text-down">Historique court — peu fiable.</p>}
    </div>
  );
}
