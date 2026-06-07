import type { ChartMarker } from './PriceChart';

const LEGEND_ITEMS: { label: string; color: string; desc: string }[] = [
  { label: 'AG', color: '#42a5f5', desc: 'Assemblée Générale' },
  { label: 'D',  color: '#ffb300', desc: 'Dividende / Ex-date' },
  { label: 'RT', color: '#7e57c2', desc: 'Rapport / Publication' },
  { label: 'A',  color: '#00c853', desc: 'Événement marché' },
];

export default function EventMarkerLegend({ markers }: { markers: ChartMarker[] }) {
  if (markers.length === 0) return null;
  const present = new Set(markers.map((m) => m.label));
  const visible = LEGEND_ITEMS.filter((i) => present.has(i.label));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50 mt-2">
      {visible.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center rounded-full text-[9px] font-bold shrink-0"
            style={{ width: 18, height: 18, background: item.color, color: '#0f1117' }}
          >
            {item.label}
          </span>
          <span className="text-xs text-muted">{item.desc}</span>
        </div>
      ))}
    </div>
  );
}
