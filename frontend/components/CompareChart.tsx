'use client';
import EChart from './EChart';

const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#ef5350', '#26c6da'];

export interface ComparePoint {
  date: string;
  [code: string]: number | string | null;
}

export default function CompareChart({ data, codes }: { data: ComparePoint[]; codes: string[] }) {
  const dates = data.map((d) => d.date);

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">📊 Performance comparée (base 100)</h3>
      <EChart
        height={360}
        option={{
          legend: {
            top: 0, right: 0,
            textStyle: { color: '#8b93a7', fontSize: 11 },
            data: codes,
          },
          xAxis: {
            type: 'category', data: dates, boundaryGap: false,
            axisLabel: { color: '#8b93a7', fontSize: 10,
              interval: Math.floor(dates.length / 6), rotate: 30 },
          },
          yAxis: { type: 'value', scale: true,
            axisLabel: { formatter: (v: number) => v.toFixed(0) } },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', height: 20, bottom: 0, borderColor: '#232733',
              fillerColor: 'rgba(0,200,83,0.08)', handleStyle: { color: '#00c853' },
              textStyle: { color: '#4a5268', fontSize: 9 } },
          ],
          series: codes.map((code, i) => ({
            name: code, type: 'line' as const,
            data: data.map((d) => d[code] as number | null),
            symbol: 'none',
            lineStyle: { color: COLORS[i % COLORS.length], width: 1.5 },
          })),
        }}
      />
    </div>
  );
}
