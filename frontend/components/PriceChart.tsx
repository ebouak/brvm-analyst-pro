'use client';
import EChart from './EChart';

export interface PricePoint {
  date: string;
  close: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  volume: number | null;
}

export default function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0) return null;

  const dates  = data.map((d) => d.date);
  const closes = data.map((d) => d.close);
  const ma20   = data.map((d) => d.ma20);
  const ma50   = data.map((d) => d.ma50);
  const ma200  = data.map((d) => d.ma200);
  const vols   = data.map((d) => d.volume);

  const maxVol = Math.max(...vols.filter((v): v is number => v != null));

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">📈 Cours & Moyennes mobiles</h3>
      <EChart
        height={360}
        option={{
          legend: {
            top: 0, right: 0,
            textStyle: { color: '#8b93a7', fontSize: 11 },
            itemHeight: 10,
            data: ['Clôture', 'MA20', 'MA50', 'MA200'],
          },
          xAxis: { type: 'category', data: dates,
            axisLabel: { color: '#8b93a7', fontSize: 10, rotate: 30, interval: Math.floor(dates.length / 6) } },
          yAxis: [
            { type: 'value', name: 'FCFA', nameTextStyle: { color: '#4a5268', fontSize: 10 },
              axisLabel: { formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v) },
              scale: true },
            { type: 'value', name: 'Vol', show: false, max: maxVol * 5 },
          ],
          dataZoom: [
            { type: 'inside', start: Math.max(0, 100 - Math.round(12000 / data.length)), end: 100 },
            { type: 'slider', height: 20, bottom: 0, borderColor: '#232733',
              fillerColor: 'rgba(0,200,83,0.08)', handleStyle: { color: '#00c853' },
              textStyle: { color: '#4a5268', fontSize: 9 } },
          ],
          series: [
            {
              name: 'Volume', type: 'bar', yAxisIndex: 1, data: vols,
              itemStyle: { color: 'rgba(35,39,51,0.8)' }, barMaxWidth: 8,
            },
            {
              name: 'Clôture', type: 'line', data: closes,
              smooth: false, symbol: 'none', lineStyle: { color: '#e6e9f0', width: 1.5 },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: 'rgba(230,233,240,0.08)' }, { offset: 1, color: 'transparent' }] } },
            },
            { name: 'MA20',  type: 'line', data: ma20,  smooth: false, symbol: 'none',
              lineStyle: { color: '#00c853', width: 1, type: 'solid' } },
            { name: 'MA50',  type: 'line', data: ma50,  smooth: false, symbol: 'none',
              lineStyle: { color: '#ffb300', width: 1, type: 'solid' } },
            { name: 'MA200', type: 'line', data: ma200, smooth: false, symbol: 'none',
              lineStyle: { color: '#7e57c2', width: 1.5, type: 'dashed' } },
          ],
        }}
      />
    </div>
  );
}
