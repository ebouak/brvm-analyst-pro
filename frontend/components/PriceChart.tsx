'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  HistogramSeries,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type HistogramData,
  type LineData,
  type HistogramSeriesOptions,
  type AreaSeriesOptions,
  type LineSeriesOptions,
  type DeepPartial,
  type Time,
} from 'lightweight-charts';

export interface PricePoint {
  date: string;
  close: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  volume: number | null;
}

const THEME = {
  bg: '#0f1117',
  surface: '#161922',
  border: '#232733',
  text: '#8b93a7',
  up: '#00c853',
  down: '#f44336',
  warn: '#ffb300',
  purple: '#7e57c2',
  white: '#e6e9f0',
};

function toTime(dateStr: string): Time {
  return dateStr as Time;
}

export default function PriceChart({ data }: { data: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || data.length === 0) return;

    const el = containerRef.current;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: 320,
      layout: {
        background: { color: 'transparent' },
        textColor: THEME.text,
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: THEME.border },
        horzLines: { color: THEME.border },
      },
      crosshair: {
        vertLine: { color: THEME.text, labelBackgroundColor: THEME.surface },
        horzLine: { color: THEME.text, labelBackgroundColor: THEME.surface },
      },
      timeScale: {
        borderColor: THEME.border,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: THEME.border,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    // Volume (histogram, bottom pane via price scale)
    const volSeries: ISeriesApi<'Histogram'> = chart.addSeries(HistogramSeries, {
      color: 'rgba(74,82,104,0.4)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    } as DeepPartial<HistogramSeriesOptions>);
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    const volData: HistogramData[] = data
      .filter((d) => d.volume != null)
      .map((d) => ({ time: toTime(d.date), value: d.volume as number }));
    volSeries.setData(volData);

    // Close price (area)
    const areaSeries: ISeriesApi<'Area'> = chart.addSeries(AreaSeries, {
      lineColor: THEME.white,
      topColor: 'rgba(230,233,240,0.12)',
      bottomColor: 'transparent',
      lineWidth: 2,
      priceScaleId: 'right',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    } as DeepPartial<AreaSeriesOptions>);
    const areaData: AreaData[] = data
      .filter((d) => d.close != null)
      .map((d) => ({ time: toTime(d.date), value: d.close as number }));
    areaSeries.setData(areaData);

    const maBase: DeepPartial<LineSeriesOptions> = {
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    };

    // MA20
    const ma20Series: ISeriesApi<'Line'> = chart.addSeries(LineSeries, { ...maBase, color: THEME.up, lineWidth: 1 });
    const ma20Data: LineData[] = data
      .filter((d) => d.ma20 != null)
      .map((d) => ({ time: toTime(d.date), value: d.ma20 as number }));
    ma20Series.setData(ma20Data);

    // MA50
    const ma50Series: ISeriesApi<'Line'> = chart.addSeries(LineSeries, { ...maBase, color: THEME.warn, lineWidth: 1 });
    const ma50Data: LineData[] = data
      .filter((d) => d.ma50 != null)
      .map((d) => ({ time: toTime(d.date), value: d.ma50 as number }));
    ma50Series.setData(ma50Data);

    // MA200 (dashed)
    const ma200Series: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
      ...maBase, color: THEME.purple, lineWidth: 2, lineStyle: 1,
    });
    const ma200Data: LineData[] = data
      .filter((d) => d.ma200 != null)
      .map((d) => ({ time: toTime(d.date), value: d.ma200 as number }));
    ma200Series.setData(ma200Data);

    // Fit visible range to last ~120 points by default
    const total = areaData.length;
    if (total > 120) {
      chart.timeScale().setVisibleRange({
        from: areaData[total - 120].time,
        to: areaData[total - 1].time,
      });
    } else {
      chart.timeScale().fitContent();
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [mounted, data]);

  if (!mounted) return <div className="bg-surface border border-border rounded-xl p-4" style={{ height: 388 }} />;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">📈 Cours &amp; Moyennes mobiles</h3>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-[#e6e9f0]" />Clôture
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-[#00c853]" />MA20
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-[#ffb300]" />MA50
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-[#7e57c2]" style={{ borderTop: '1px dashed #7e57c2', height: 0 }} />MA200
          </span>
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
