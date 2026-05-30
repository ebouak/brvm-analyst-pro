import type { SectorPerf } from '@/lib/sectors';
import { fmtFcfa, fmtNumber } from '@/lib/format';

interface Props {
  perf: SectorPerf;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const W = 120;
  const H = 28;
  const step = W / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = data[data.length - 1] ?? 0;
  const color = last >= 0 ? '#00c853' : '#f44336';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SectorCard({ perf }: Props) {
  const { secteur, count, varDay, volumeDay, sparkline30d } = perf;
  const isUp = (varDay ?? 0) >= 0;
  const varColor = varDay == null ? '#8b93a7' : isUp ? '#00c853' : '#f44336';
  const arrow = varDay == null ? '' : isUp ? '↑' : '↓';
  const varText =
    varDay == null ? '—' : `${arrow} ${Math.abs(varDay).toFixed(2)}%`;

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: '#161922', border: '1px solid #232733' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[#e6e9f0] leading-tight">{secteur}</span>
        <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: varColor }}>
          {varText}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-[#8b93a7]">
          {count} action{count > 1 ? 's' : ''}
        </span>
        <span className="text-xs text-[#8b93a7]">
          Vol. jour :{' '}
          <span className="text-[#e6e9f0]">{fmtFcfa(volumeDay)} FCFA</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8b93a7]">30j</span>
        <Sparkline data={sparkline30d} />
      </div>
    </div>
  );
}
