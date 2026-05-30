import type { ComparePoint } from './CompareChart';

const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#f44336', '#e6e9f0'];

interface CodeMeta {
  code: string;
  designation?: string | null;
}

interface Props {
  rows: ComparePoint[];
  codes: string[];
  meta?: CodeMeta[];
}

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' Md';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + ' k';
  return v.toFixed(0);
}

interface Stats {
  variation: number | null;
  volatility: number | null;
  // volume data is not in ComparePoint so we skip it for now
}

function computeStats(rows: ComparePoint[], code: string): Stats {
  const values = rows
    .map((r) => r[code])
    .filter((v): v is number => typeof v === 'number');

  if (values.length < 2) return { variation: null, volatility: null };

  const first = values[0]!;
  const last = values[values.length - 1]!;
  const variation = ((last - first) / first) * 100;

  // Daily log returns
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1]! > 0) {
      returns.push(Math.log(values[i]! / values[i - 1]!));
    }
  }
  let volatility: number | null = null;
  if (returns.length >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  return { variation, volatility };
}

export default function CompareStats({ rows, codes, meta = [] }: Props) {
  if (rows.length === 0 || codes.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {codes.map((code, i) => {
        const stats = computeStats(rows, code);
        const name = meta.find((m) => m.code === code)?.designation ?? null;
        const color = COLORS[i % COLORS.length]!;
        const variationPositive = stats.variation !== null && stats.variation >= 0;

        return (
          <div
            key={code}
            className="bg-[#161922] border border-[#232733] rounded-xl p-3 space-y-1.5"
            style={{ borderLeftColor: color, borderLeftWidth: 2 }}
          >
            <div>
              <span className="font-mono font-bold text-sm" style={{ color }}>
                {code}
              </span>
              {name && (
                <p className="text-[10px] text-[#8b93a7] leading-tight truncate" title={name}>
                  {name}
                </p>
              )}
            </div>

            {stats.variation !== null ? (
              <p
                className="text-lg font-semibold tabular"
                style={{ color: variationPositive ? '#00c853' : '#f44336' }}
              >
                {fmtPct(stats.variation)}
              </p>
            ) : (
              <p className="text-lg text-[#8b93a7]">—</p>
            )}

            {stats.volatility !== null && (
              <p className="text-[11px] text-[#8b93a7]">
                σ = {stats.volatility.toFixed(0)}%
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
