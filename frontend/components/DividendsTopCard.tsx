import type { ReactNode } from 'react';

export interface TopEntry {
  code: string;
  label: string;
  value: string;
  sub?: string;
}

interface Props {
  title: string;
  icon: ReactNode;
  entries: TopEntry[];
}

export default function DividendsTopCard({ title, icon, entries }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-up">{icon}</span>
        {title}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">Aucune donnée disponible.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => (
            <li key={`${e.code}-${i}`} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium text-white truncate">{e.code}</span>
                {e.label && (
                  <span className="text-xs text-muted ml-1 truncate">{e.label}</span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs tabular text-up font-semibold">{e.value}</span>
                {e.sub && <span className="text-xs text-muted ml-1">{e.sub}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
