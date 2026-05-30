'use client';

import { useCallback } from 'react';
import EChart from './EChart';
import { downloadCSV } from '@/lib/export';

export const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#f44336', '#e6e9f0'];

export type NormMode = 'base100' | 'variation' | 'prix';
export type PeriodKey = '1M' | '3M' | '6M' | '1A' | '2A' | 'MAX';

export interface ComparePoint {
  date: string;
  [code: string]: number | string | null;
}

// -- Transformations --

function rebaseBase100(prices: (number | null)[]): (number | null)[] {
  const first = prices.find((p) => p != null);
  if (first == null) return prices;
  return prices.map((p) => (p != null ? Math.round((p / first) * 1000) / 10 : null));
}

function toVariationPct(prices: (number | null)[]): (number | null)[] {
  const first = prices.find((p) => p != null);
  if (first == null) return prices;
  return prices.map((p) =>
    p != null ? Math.round(((p / first - 1) * 100) * 10) / 10 : null,
  );
}

function rawPrice(prices: (number | null)[]): (number | null)[] {
  return prices;
}

function applyMode(
  prices: (number | null)[],
  mode: NormMode,
): (number | null)[] {
  switch (mode) {
    case 'base100': return rebaseBase100(prices);
    case 'variation': return toVariationPct(prices);
    case 'prix': return rawPrice(prices);
  }
}

// -- Chart --

interface Props {
  data: ComparePoint[];
  codes: string[];
  mode: NormMode;
  period: PeriodKey;
  meta?: Array<{ code: string; designation: string | null }>;
}

export default function CompareChart({ data, codes, mode, period, meta = [] }: Props) {
  const dates = data.map((d) => d.date);

  const yFormatter = useCallback(
    (v: number): string => {
      if (mode === 'base100') return v.toFixed(1);
      if (mode === 'variation') return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
      if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
      return v.toFixed(0) + ' F';
    },
    [mode],
  );

  const tooltipFormatter = useCallback(
    (params: Array<{ seriesName: string; value: number | null; marker: string; axisValue?: string }>): string => {
      let html = `<div style="font-size:11px;color:#8b93a7;margin-bottom:4px">${params[0]?.axisValue ?? ''}</div>`;
      for (const p of params) {
        if (p.value == null) continue;
        const label = meta.find((m) => m.code === p.seriesName)?.designation ?? p.seriesName;
        const formatted =
          mode === 'variation'
            ? (p.value >= 0 ? '+' : '') + p.value.toFixed(2) + '%'
            : mode === 'base100'
            ? p.value.toFixed(2)
            : p.value.toLocaleString('fr-FR') + ' F';
        html += `<div style="display:flex;gap:8px;align-items:center">${p.marker}<span style="color:#e6e9f0">${p.seriesName}</span><span style="color:#8b93a7;font-size:10px">${label !== p.seriesName ? label : ''}</span><span style="margin-left:auto;font-weight:600;color:#e6e9f0">${formatted}</span></div>`;
      }
      return html;
    },
    [mode, meta],
  );

  const handleExport = () => {
    type Row = ComparePoint;
    downloadCSV<Row>({
      filename: `brvm-compare-${period}-${codes.join('_')}.csv`,
      separator: ';',
      columns: [
        { header: 'Date', accessor: (r) => r.date },
        ...codes.map((code) => ({
          header: code,
          accessor: (r: Row) => r[code] as number | null,
        })),
      ],
      rows: data,
    });
  };

  return (
    <div className="bg-[#161922] border border-[#232733] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e6e9f0]">
          {mode === 'base100' && 'Performance comparée (base 100)'}
          {mode === 'variation' && 'Variation cumulée (%)'}
          {mode === 'prix' && 'Prix brut (FCFA)'}
        </h3>
        <button
          type="button"
          onClick={handleExport}
          className="text-xs text-[#8b93a7] hover:text-[#e6e9f0] border border-[#232733] hover:border-[#42a5f5] rounded px-2.5 py-1 transition-colors"
        >
          Exporter CSV
        </button>
      </div>

      <EChart
        height={380}
        option={{
          legend: {
            top: 0,
            left: 0,
            textStyle: { color: '#8b93a7', fontSize: 11 },
            data: codes.map((code, i) => ({
              name: code,
              itemStyle: { color: COLORS[i % COLORS.length] },
            })),
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
          },
          xAxis: {
            type: 'category',
            data: dates,
            boundaryGap: false,
            axisLabel: {
              color: '#8b93a7',
              fontSize: 10,
              interval: Math.max(0, Math.floor(dates.length / 8) - 1),
              rotate: 30,
            },
          },
          yAxis: {
            type: 'value',
            scale: true,
            position: 'right',
            axisLabel: { formatter: yFormatter, color: '#8b93a7', fontSize: 10 },
            splitLine: { lineStyle: { color: '#232733', type: 'dashed' } },
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross', lineStyle: { color: '#4a5268' } },
            formatter: tooltipFormatter as unknown as string,
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            {
              type: 'slider',
              height: 20,
              bottom: 0,
              borderColor: '#232733',
              fillerColor: 'rgba(0,200,83,0.08)',
              handleStyle: { color: '#00c853' },
              textStyle: { color: '#4a5268', fontSize: 9 },
            },
          ],
          grid: { top: 36, right: 60, bottom: 56, left: 16, containLabel: false },
          series: codes.map((code, i) => {
            const prices = data.map((d) => d[code] as number | null);
            const transformed = applyMode(prices, mode);
            return {
              name: code,
              type: 'line' as const,
              data: transformed,
              symbol: 'none',
              lineStyle: { color: COLORS[i % COLORS.length], width: 1.8 },
              itemStyle: { color: COLORS[i % COLORS.length] },
              connectNulls: false,
            };
          }),
        }}
      />
    </div>
  );
}
