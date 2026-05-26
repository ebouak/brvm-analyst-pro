'use client';
import EChart from './EChart';

export interface IndicatorPoint {
  date: string;
  rsi: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

export default function IndicatorCharts({ data }: { data: IndicatorPoint[] }) {
  const dates = data.map((d) => d.date);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* RSI */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">RSI (14)</h3>
        <EChart
          height={180}
          option={{
            grid: { top: 12, right: 12, bottom: 32, left: 40 },
            xAxis: { type: 'category', data: dates, boundaryGap: false,
              axisLabel: { color: '#8b93a7', fontSize: 9, interval: Math.floor(dates.length / 4) } },
            yAxis: { type: 'value', min: 0, max: 100,
              axisLabel: { color: '#8b93a7', fontSize: 10 },
              splitLine: { lineStyle: { color: '#232733', type: 'dashed' } } },
            series: [
              {
                name: 'RSI', type: 'line', data: data.map((d) => d.rsi),
                symbol: 'none', lineStyle: { color: '#42a5f5', width: 1.5 },
                markLine: {
                  silent: true,
                  lineStyle: { type: 'dashed', width: 1 },
                  data: [
                    { yAxis: 70, lineStyle: { color: '#f44336' } },
                    { yAxis: 30, lineStyle: { color: '#00c853' } },
                  ],
                  label: { formatter: (p: unknown) => String((p as { value: number }).value), color: '#8b93a7', fontSize: 9 },
                },
              },
            ],
          }}
        />
      </div>

      {/* MACD */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">MACD (12, 26, 9)</h3>
        <EChart
          height={180}
          option={{
            grid: { top: 12, right: 12, bottom: 32, left: 40 },
            xAxis: { type: 'category', data: dates, boundaryGap: false,
              axisLabel: { color: '#8b93a7', fontSize: 9, interval: Math.floor(dates.length / 4) } },
            yAxis: { type: 'value', scale: true,
              axisLabel: { color: '#8b93a7', fontSize: 9 },
              splitLine: { lineStyle: { color: '#232733', type: 'dashed' } } },
            series: [
              {
                name: 'Histogramme', type: 'bar',
                data: data.map((d) => ({
                  value: d.hist,
                  itemStyle: { color: (d.hist ?? 0) >= 0 ? '#00c853' : '#f44336' },
                })),
                barMaxWidth: 6,
              },
              {
                name: 'MACD', type: 'line',
                data: data.map((d) => d.macd),
                symbol: 'none', lineStyle: { color: '#42a5f5', width: 1 },
              },
              {
                name: 'Signal', type: 'line',
                data: data.map((d) => d.signal),
                symbol: 'none', lineStyle: { color: '#ffb300', width: 1, type: 'dashed' },
              },
            ],
          }}
        />
      </div>
    </div>
  );
}
