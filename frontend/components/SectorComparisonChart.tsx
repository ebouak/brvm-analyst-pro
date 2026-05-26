'use client';
import EChart from './EChart';

export interface SectorBar { code: string; perf: number | null }

export default function SectorComparisonChart({ data }: { data: SectorBar[] }) {
  const rows = [...data.filter((d) => d.perf != null)].sort((a, b) => (b.perf ?? 0) - (a.perf ?? 0));

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">📊 Performance par titre (%)</h3>
      <EChart
        height={Math.max(180, rows.length * 28 + 60)}
        option={{
          grid: { top: 8, right: 48, bottom: 8, left: 56, containLabel: true },
          xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${v}%` },
            splitLine: { lineStyle: { color: '#232733', type: 'dashed' } } },
          yAxis: { type: 'category', data: rows.map((r) => r.code),
            axisLabel: { color: '#8b93a7', fontSize: 11 }, inverse: true },
          series: [
            {
              type: 'bar', barMaxWidth: 16,
              data: rows.map((r) => ({
                value: r.perf,
                itemStyle: { color: (r.perf ?? 0) >= 0 ? '#00c853' : '#f44336',
                  borderRadius: (r.perf ?? 0) >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
              })),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label: { show: true, position: ((p: unknown) => ((p as any).value ?? 0) >= 0 ? 'right' : 'left') as any,
                formatter: (p: unknown) => `${((p as { value: number }).value ?? 0).toFixed(1)}%`,
                color: '#8b93a7', fontSize: 10 },
              markLine: { silent: true, data: [{ xAxis: 0 }],
                lineStyle: { color: '#8b93a7', width: 1 }, label: { show: false } },
            },
          ],
        }}
      />
    </div>
  );
}
