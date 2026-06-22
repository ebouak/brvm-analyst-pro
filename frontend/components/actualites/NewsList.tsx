'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';

export interface NewsItem {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_url: string | null;
  resume: string | null;
  instrument_code: string | null;
  image_url?: string | null;
}

const SOURCE_LABELS: Record<string, string> = { brvm: 'BRVM', cosumaf: 'COSUMAF', autre: 'Autre' };
type Period = 'all' | '7' | '30' | '90';

/** Temps de lecture estimé (≈200 mots/min) à partir du titre + résumé. */
function readingTime(item: NewsItem): number {
  const words = `${item.titre} ${item.resume ?? ''}`.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function NewsList({ items }: { items: NewsItem[] }) {
  const [source, setSource] = useState('');
  const [period, setPeriod] = useState<Period>('all');

  const sources = useMemo(
    () => [...new Set(items.map((i) => i.source))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const maxAge = period === 'all' ? Infinity : Number(period) * 86_400_000;
    return items.filter((i) => {
      if (source && i.source !== source) return false;
      if (maxAge !== Infinity) {
        const age = now - new Date(i.date_publication).getTime();
        if (age > maxAge) return false;
      }
      return true;
    });
  }, [items, source, period]);

  const selCls = 'bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory focus:outline-none focus:border-accent/40';

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selCls} aria-label="Filtrer par source">
          <option value="">Toutes sources</option>
          {sources.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selCls} aria-label="Filtrer par période">
          <option value="all">Toute période</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
        </select>
        <span className="ml-auto text-xs text-faint tabular">
          <span className="text-ivory font-medium">{filtered.length}</span> article{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Aucune actualité ne correspond aux filtres.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="flex gap-3 bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors">
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" className="hidden sm:block h-16 w-24 shrink-0 rounded-lg object-cover border border-border/60" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-accent/30 text-accent bg-accent/10 font-semibold">
                    {SOURCE_LABELS[item.source] ?? item.source}
                  </span>
                  <span className="text-xs text-faint tabular">{fmtDateFR(item.date_publication)}</span>
                  <span className="text-[10px] text-faint">· {readingTime(item)} min de lecture</span>
                  {item.instrument_code && (
                    <Link href={`/actions/${item.instrument_code}`} className="text-xs text-accent hover:underline">
                      {item.instrument_code}
                    </Link>
                  )}
                </div>
                {item.source_url ? (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                    className="block text-sm font-semibold text-ivory hover:text-accent transition-colors line-clamp-2">
                    {item.titre}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-ivory line-clamp-2">{item.titre}</p>
                )}
                {item.resume && <p className="text-xs text-muted line-clamp-2">{item.resume}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
