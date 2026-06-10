import Link from 'next/link';
import { TrendingUp, TrendingDown } from '@/components/icons';
import type { IndiceDaily } from '@/lib/types';

const LABELS: Record<string, string> = {
  BRVMC: 'BRVM Composite',
  BRVM30: 'BRVM 30',
};

/** Bande d'indices BRVM réels (Composite + 30) — valeur + variation du jour. */
export default function IndexStrip({ indices }: { indices: IndiceDaily[] }) {
  const rows = indices
    .filter((i) => i.valeur != null && (i.code === 'BRVMC' || i.code === 'BRVM30'))
    .sort((a) => (a.code === 'BRVMC' ? -1 : 1));

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((i) => {
        const v = i.variation_pct ?? 0;
        const up = v >= 0;
        const Icon = up ? TrendingUp : TrendingDown;
        return (
          <Link
            key={i.code}
            href="/actions"
            className="
              group flex items-center justify-between rounded-panel border border-border bg-surface px-4 py-3
              transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
              hover:border-gold/25 hover:bg-elevated
            "
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-faint">{LABELS[i.code] ?? i.libelle ?? i.code}</div>
              <div className="tabular mt-0.5 text-xl font-bold text-ivory leading-none">
                {(i.valeur as number).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className={`flex items-center gap-1 tabular text-sm font-semibold ${up ? 'text-up' : 'text-down'}`}>
              <Icon size={14} />
              {up ? '+' : ''}{v.toFixed(2)}%
            </div>
          </Link>
        );
      })}
    </div>
  );
}
