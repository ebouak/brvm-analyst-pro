'use client';
import { useEffect, useState } from 'react';
import { chartTheme } from '@/lib/chartTheme';
import EChart from './EChart';
import { moisAnnee } from '@/lib/fiche/affichage';

export interface IndicatorPoint {
  date: string;
  rsi: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

export default function IndicatorCharts({ data }: { data: IndicatorPoint[] }) {
  const T = chartTheme();
  const dates = data.map((d) => d.date);
  // Sous 640 px, moins de graduations : les dates ne se chevauchent plus.
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const maj = () => setMobile(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  const axeX = {
    type: 'category' as const, data: dates, boundaryGap: false,
    axisLabel: {
      color: T.muted, fontSize: 11, hideOverlap: true,
      interval: Math.max(0, Math.floor(dates.length / (mobile ? 2 : 4))),
      formatter: (v: string) => (mobile ? moisAnnee(v) : `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`),
    },
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* RSI */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">RSI (14)</h3>
        <EChart
          height={180}
          option={{
            grid: { top: 12, right: 28, bottom: 32, left: 40 },
            xAxis: axeX,
            yAxis: { type: 'value', min: 0, max: 100,
              axisLabel: { color: T.muted, fontSize: 11 },
              splitLine: { lineStyle: { color: T.border, type: 'dashed' } } },
            series: [
              {
                name: 'RSI', type: 'line', data: data.map((d) => d.rsi),
                symbol: 'none', lineStyle: { color: T.accent, width: 1.5 },
                markLine: {
                  silent: true,
                  lineStyle: { type: 'dashed', width: 1 },
                  data: [
                    { yAxis: 70, lineStyle: { color: T.down } },
                    { yAxis: 30, lineStyle: { color: T.up } },
                  ],
                  label: { formatter: (p: unknown) => String((p as { value: number }).value), color: T.muted, fontSize: 11 },
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
            xAxis: axeX,
            yAxis: { type: 'value', scale: true,
              axisLabel: { color: T.muted, fontSize: 11 },
              splitLine: { lineStyle: { color: T.border, type: 'dashed' } } },
            series: [
              {
                name: 'Histogramme', type: 'bar',
                data: data.map((d) => ({
                  value: d.hist,
                  itemStyle: { color: (d.hist ?? 0) >= 0 ? T.up : T.down },
                })),
                barMaxWidth: 6,
              },
              {
                name: 'MACD', type: 'line',
                data: data.map((d) => d.macd),
                symbol: 'none', lineStyle: { color: T.accent, width: 1 },
              },
              {
                name: 'Signal', type: 'line',
                data: data.map((d) => d.signal),
                symbol: 'none', lineStyle: { color: T.warn, width: 1, type: 'dashed' },
              },
            ],
          }}
        />
      </div>
    </div>
  );
}
