import type { Quality } from '@/lib/fundamentals';

interface Props {
  label: string;
  value: string;
  quality?: Quality;
  positive?: boolean | null;
}

/** Ligne ratio dans une carte de section (style Trading 212, dark finance). */
export default function RatioCard({ label, value, quality = 'ok', positive }: Props) {
  if (quality === 'missing') {
    return (
      <div className="flex items-center justify-between py-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-muted/60">non disponible</span>
      </div>
    );
  }
  const colorCls = positive == null ? 'text-white' : positive ? 'text-up' : 'text-down';
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tabular ${quality === 'suspect' ? 'text-warn' : colorCls}`}>
        {value}
        {quality === 'suspect' && <span title="Donnée douteuse" className="ml-1">⚠️</span>}
      </span>
    </div>
  );
}
