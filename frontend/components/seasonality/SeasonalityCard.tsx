'use client';

import Link from 'next/link';
import { aggregateSeasonality, type MonthlyReturn } from '@/lib/seasonality/compute';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')}\u00a0%`;

export default function SeasonalityCard({ code, returns }: { code: string; returns: MonthlyReturn[] }) {
  if (returns.length === 0) return null;
  const r = aggregateSeasonality(returns, 10);
  const bias = r.currentMonthBias;

  return (
    <div className="rounded-panel border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-accent-ink">Saisonnalité (10 ans)</p>
        <Link href={`/saisonnalite?code=${code}`} className="text-[11px] text-info hover:underline">Complet →</Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-faint">Habitude du mois</p>
          <p className="font-semibold text-white">{bias && bias.n > 0 ? `${MONTHS[bias.month - 1]} ${pct(bias.medianReturn)}` : '—'}</p>
          {bias && bias.n > 0 && <p className="text-faint">médiane, {bias.n} ans{bias.verdict === 'hasard' ? ', non distinguable du hasard' : ''}</p>}</div>
        <div><p className="text-faint">Mois fort</p>
          <p className={`font-semibold ${r.bestMonth ? 'text-up' : 'text-muted'}`}>{r.bestMonth ? MONTHS[r.bestMonth - 1] : 'aucun'}</p></div>
        <div><p className="text-faint">Mois faible</p>
          <p className={`font-semibold ${r.worstMonth ? 'text-down' : 'text-muted'}`}>{r.worstMonth ? MONTHS[r.worstMonth - 1] : 'aucun'}</p></div>
      </div>
      {!r.bestMonth && !r.worstMonth && <p className="text-[11px] text-faint">Aucun mois ne se détache du hasard.</p>}
      {r.dataQuality === 'insufficient' && <p className="text-[11px] text-down">Historique court : peu fiable.</p>}
    </div>
  );
}
