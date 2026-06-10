'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  AreaSeries,
  LineSeries,
  CandlestickSeries,
  type IChartApi,
  type AreaData,
  type HistogramData,
  type LineData,
  type CandlestickData,
  type HistogramSeriesOptions,
  type AreaSeriesOptions,
  type LineSeriesOptions,
  type CandlestickSeriesOptions,
  type DeepPartial,
  type Time,
} from 'lightweight-charts';
import {
  smaSeries,
  emaSeries,
  bollingerSeries,
  donchianSeries,
  rsiSeries,
  macdSeries,
} from '@/lib/indicators';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricePoint {
  date: string;
  close: number | null;
  volume: number | null;
}

export interface ChartMarker {
  date: string;
  label: string;   // 'AG' | 'D' | 'RT' | 'A'
  color: string;
  title: string;
}

interface Props {
  data: PricePoint[];
  designation?: string;
  markers?: ChartMarker[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME = {
  bg: '#0f1117',
  surface: '#161922',
  border: '#232733',
  text: '#8b93a7',
  up: '#00c853',
  down: '#f44336',
  warn: '#ffb300',
  purple: '#7e57c2',
  blue: '#42a5f5',
  white: '#e6e9f0',
} as const;

type IndicatorKey = 'ma20' | 'ma50' | 'ma200' | 'ema9' | 'ema21' | 'bb' | 'donchian' | 'rsi' | 'macd';
type PeriodKey = '1M' | '3M' | '6M' | '1A' | '2A' | 'MAX';
type ResolutionKey = '1J' | '1S';

const DEFAULT_VISIBLE: IndicatorKey[] = ['ma20', 'ma50', 'ma200'];

const PERIOD_BARS: Record<PeriodKey, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 132,
  '1A': 260,
  '2A': 520,
  MAX: Number.POSITIVE_INFINITY,
};

const OVERLAY_INDICATORS: { key: IndicatorKey; label: string }[] = [
  { key: 'ma20', label: 'MA20' },
  { key: 'ma50', label: 'MA50' },
  { key: 'ma200', label: 'MA200' },
  { key: 'ema9', label: 'EMA9' },
  { key: 'ema21', label: 'EMA21' },
  { key: 'bb', label: 'BB(20,2)' },
  { key: 'donchian', label: 'Donchian' },
];

const OSCILLATOR_INDICATORS: { key: IndicatorKey; label: string }[] = [
  { key: 'rsi', label: 'RSI(14)' },
  { key: 'macd', label: 'MACD(12,26,9)' },
];

const PERIODS: PeriodKey[] = ['1M', '3M', '6M', '1A', '2A', 'MAX'];
const RESOLUTIONS: { key: ResolutionKey; label: string }[] = [
  { key: '1J', label: 'Jour' },
  { key: '1S', label: 'Semaine' },
];

/** Agrège des séances journalières en bougies hebdomadaires (lundi ISO). */
function toWeeklyBars(pts: PricePoint[]): PricePoint[] {
  const byWeek = new Map<string, { opens: number[]; highs: number[]; lows: number[]; closes: number[]; volumes: number[] }>();
  for (const p of pts) {
    if (!p.close) continue;
    const d = new Date(p.date);
    // Décalage vers le lundi de la semaine
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    const key = d.toISOString().slice(0, 10);
    if (!byWeek.has(key)) byWeek.set(key, { opens: [], highs: [], lows: [], closes: [], volumes: [] });
    const w = byWeek.get(key)!;
    w.closes.push(p.close);
    w.volumes.push(p.volume ?? 0);
  }
  const result: PricePoint[] = [];
  for (const [date, w] of [...byWeek.entries()].sort()) {
    result.push({
      date,
      close: w.closes[w.closes.length - 1] ?? null,
      volume: w.volumes.reduce((a, b) => a + b, 0),
    });
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTime(dateStr: string): Time {
  return dateStr as Time;
}

function chartOptions(height: number) {
  return {
    width: 0, // set by resize observer
    height,
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
    },
    handleScroll: true,
    handleScale: true,
  };
}

function lineBase(): DeepPartial<LineSeriesOptions> {
  return {
    priceScaleId: 'right',
    crosshairMarkerVisible: false,
    lastValueVisible: false,
    priceLineVisible: false,
  };
}

function toLineData(dates: string[], values: (number | null)[]): LineData[] {
  return dates
    .map((d, i) => ({ time: toTime(d), value: values[i] }))
    .filter((p): p is LineData => p.value != null);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PriceChart({ data, designation, markers = [] }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState<Set<IndicatorKey>>(new Set(DEFAULT_VISIBLE));
  const [period, setPeriod] = useState<PeriodKey>('1A');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [resolution, setResolution] = useState<ResolutionKey>('1J');

  useEffect(() => { setMounted(true); }, []);

  // ── Chart creation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !mainRef.current || data.length === 0) return;

    // Résolution : agrégation hebdomadaire si sélectionnée
    const resolved = resolution === '1S' ? toWeeklyBars(data) : data;

    // Slice data by selected period
    const maxBars = PERIOD_BARS[period];
    const sliced = maxBars === Number.POSITIVE_INFINITY
      ? resolved
      : resolved.slice(Math.max(0, resolved.length - maxBars));

    const dates = sliced.map((d) => d.date);
    // Use 0 only for indicator calc, but track which indices have real close
    const closesRaw = sliced.map((d) => d.close);
    const closesForCalc = closesRaw.map((c) => c ?? 0);

    // Build pseudo-OHLCV: open = prev close, high/low ±0.1%
    const candleData: CandlestickData[] = sliced
      .filter((d) => d.close != null)
      .map((d, i, arr) => {
        const close = d.close as number;
        const open = i > 0 && arr[i - 1]!.close != null ? (arr[i - 1]!.close as number) : close;
        const high = Math.max(open, close) * 1.001;
        const low = Math.min(open, close) * 0.999;
        return { time: toTime(d.date), open, high, low, close };
      });

    // ── Main chart ────────────────────────────────────────────────────────
    const mainEl = mainRef.current;
    const main = createChart(mainEl, {
      ...chartOptions(320),
      width: mainEl.clientWidth,
      rightPriceScale: {
        borderColor: THEME.border,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
    });

    // Volume
    const volSeries = main.addSeries(HistogramSeries, {
      color: 'rgba(74,82,104,0.4)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    } as DeepPartial<HistogramSeriesOptions>);
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
    const volData: HistogramData[] = sliced
      .filter((d) => d.volume != null)
      .map((d) => ({ time: toTime(d.date), value: d.volume as number }));
    volSeries.setData(volData);

    // Price series: area or candlestick
    // Keep a reference to apply markers on
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let priceSeries: ReturnType<typeof main.addSeries<any>> | null = null;

    if (chartType === 'candle') {
      const s = main.addSeries(CandlestickSeries, {
        upColor: THEME.up,
        downColor: THEME.down,
        borderUpColor: THEME.up,
        borderDownColor: THEME.down,
        wickUpColor: THEME.up,
        wickDownColor: THEME.down,
        priceScaleId: 'right',
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
      } as DeepPartial<CandlestickSeriesOptions>);
      s.setData(candleData);
      priceSeries = s;
    } else {
      const s = main.addSeries(AreaSeries, {
        lineColor: THEME.white,
        topColor: 'rgba(230,233,240,0.12)',
        bottomColor: 'transparent',
        lineWidth: 2,
        priceScaleId: 'right',
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
      } as DeepPartial<AreaSeriesOptions>);
      const areaData: AreaData[] = sliced
        .filter((d) => d.close != null)
        .map((d) => ({ time: toTime(d.date), value: d.close as number }));
      s.setData(areaData);
      priceSeries = s;
    }

    // ── Event markers ─────────────────────────────────────────────────────
    if (markers.length > 0 && priceSeries) {
      const sessionDates = dates.slice().sort();
      const dateSet = new Set(dates);

      function nearestSession(markerDate: string): string | null {
        let best: string | null = null;
        for (const d of sessionDates) {
          if (d <= markerDate) best = d;
          else break;
        }
        return best;
      }

      const seriesMarkers = markers
        .map((m) => {
          const t = dateSet.has(m.date) ? m.date : nearestSession(m.date);
          if (!t) return null;
          return {
            time: toTime(t),
            position: 'aboveBar' as const,
            color: m.color,
            shape: 'circle' as const,
            text: m.label,
            size: 1,
            id: `${m.label}-${m.date}`,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));

      if (seriesMarkers.length > 0) {
        createSeriesMarkers(priceSeries, seriesMarkers);
      }
    }

    // ── Overlays ──────────────────────────────────────────────────────────
    function addNull(key: IndicatorKey, values: (number | null)[], opts: DeepPartial<LineSeriesOptions>) {
      if (!visible.has(key)) return;
      const s = main.addSeries(LineSeries, { ...lineBase(), ...opts });
      s.setData(toLineData(dates, values));
    }

    if (visible.has('ma20'))
      addNull('ma20', smaSeries(closesForCalc, 20).map((v, i) => closesRaw[i] == null ? null : v),
        { color: THEME.up, lineWidth: 1 });

    if (visible.has('ma50'))
      addNull('ma50', smaSeries(closesForCalc, 50).map((v, i) => closesRaw[i] == null ? null : v),
        { color: THEME.warn, lineWidth: 1 });

    if (visible.has('ma200'))
      addNull('ma200', smaSeries(closesForCalc, 200).map((v, i) => closesRaw[i] == null ? null : v),
        { color: THEME.purple, lineWidth: 2, lineStyle: 1 });

    if (visible.has('ema9'))
      addNull('ema9', emaSeries(closesForCalc, 9).map((v, i) => closesRaw[i] == null ? null : v),
        { color: THEME.blue, lineWidth: 1 });

    if (visible.has('ema21'))
      addNull('ema21', emaSeries(closesForCalc, 21).map((v, i) => closesRaw[i] == null ? null : v),
        { color: '#69f0ae', lineWidth: 1 });

    if (visible.has('bb')) {
      const bb = bollingerSeries(closesForCalc, 20, 2);
      const upper = bb.map((p, i) => closesRaw[i] == null ? null : p.upper);
      const middle = bb.map((p, i) => closesRaw[i] == null ? null : p.middle);
      const lower = bb.map((p, i) => closesRaw[i] == null ? null : p.lower);
      const bbBase: DeepPartial<LineSeriesOptions> = { ...lineBase(), lineStyle: 2 };
      const sUpper = main.addSeries(LineSeries, { ...bbBase, color: THEME.warn, lineWidth: 1 });
      sUpper.setData(toLineData(dates, upper));
      const sMiddle = main.addSeries(LineSeries, { ...lineBase(), color: 'rgba(255,179,0,0.4)', lineWidth: 1 });
      sMiddle.setData(toLineData(dates, middle));
      const sLower = main.addSeries(LineSeries, { ...bbBase, color: THEME.warn, lineWidth: 1 });
      sLower.setData(toLineData(dates, lower));
    }

    if (visible.has('donchian')) {
      const dc = donchianSeries(closesForCalc, 20);
      const upper = dc.map((p, i) => closesRaw[i] == null ? null : p.upper);
      const middle = dc.map((p, i) => closesRaw[i] == null ? null : p.middle);
      const lower = dc.map((p, i) => closesRaw[i] == null ? null : p.lower);
      const dcBase: DeepPartial<LineSeriesOptions> = { ...lineBase(), lineStyle: 1 };
      const sUpper = main.addSeries(LineSeries, { ...dcBase, color: THEME.purple, lineWidth: 1 });
      sUpper.setData(toLineData(dates, upper));
      const sMiddle = main.addSeries(LineSeries, { ...lineBase(), color: 'rgba(126,87,194,0.4)', lineWidth: 1 });
      sMiddle.setData(toLineData(dates, middle));
      const sLower = main.addSeries(LineSeries, { ...dcBase, color: THEME.purple, lineWidth: 1 });
      sLower.setData(toLineData(dates, lower));
    }

    main.timeScale().fitContent();

    // ── RSI sub-chart ────────────────────────────────────────────────────
    let rsiChart: IChartApi | null = null;
    if (visible.has('rsi') && rsiRef.current) {
      const rsiEl = rsiRef.current;
      rsiChart = createChart(rsiEl, {
        ...chartOptions(100),
        width: rsiEl.clientWidth,
        rightPriceScale: { borderColor: THEME.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      });

      // Valid closes for RSI
      const validCloses = sliced.filter((d) => d.close != null).map((d) => d.close as number);
      const validDates = sliced.filter((d) => d.close != null).map((d) => d.date);
      const rsiVals = rsiSeries(validCloses, 14);

      const rsiLineData: LineData[] = validDates
        .map((d, i) => ({ time: toTime(d), value: rsiVals[i] }))
        .filter((p): p is LineData => p.value != null);

      const rsiLine = rsiChart.addSeries(LineSeries, {
        ...lineBase(),
        color: THEME.blue,
        lineWidth: 1,
        lastValueVisible: true,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      });
      rsiLine.setData(rsiLineData);

      // 30 and 70 reference lines via price lines
      rsiLine.createPriceLine({ price: 30, color: THEME.up, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' });
      rsiLine.createPriceLine({ price: 70, color: THEME.down, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' });

      rsiChart.timeScale().fitContent();
    }

    // ── MACD sub-chart ────────────────────────────────────────────────────
    let macdChart: IChartApi | null = null;
    if (visible.has('macd') && macdRef.current) {
      const macdEl = macdRef.current;
      macdChart = createChart(macdEl, {
        ...chartOptions(120),
        width: macdEl.clientWidth,
        rightPriceScale: { borderColor: THEME.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      });

      const validCloses = sliced.filter((d) => d.close != null).map((d) => d.close as number);
      const validDates = sliced.filter((d) => d.close != null).map((d) => d.date);
      const macdData = macdSeries(validCloses);

      const macdLineData: LineData[] = validDates
        .map((d, i) => ({ time: toTime(d), value: macdData[i]?.macd ?? undefined }))
        .filter((p): p is LineData => p.value != null);
      const signalLineData: LineData[] = validDates
        .map((d, i) => ({ time: toTime(d), value: macdData[i]?.signal ?? undefined }))
        .filter((p): p is LineData => p.value != null);
      const histData: HistogramData[] = validDates
        .flatMap((d, i) => {
          const h = macdData[i]?.hist;
          if (h == null) return [];
          const item: HistogramData = {
            time: toTime(d),
            value: h,
            color: h >= 0 ? 'rgba(0,200,83,0.6)' : 'rgba(244,67,54,0.6)',
          };
          return [item];
        });

      const macdLine = macdChart.addSeries(LineSeries, { ...lineBase(), color: THEME.blue, lineWidth: 1, lastValueVisible: true });
      macdLine.setData(macdLineData);
      const sigLine = macdChart.addSeries(LineSeries, { ...lineBase(), color: THEME.warn, lineWidth: 1, lastValueVisible: true });
      sigLine.setData(signalLineData);
      const histSeries = macdChart.addSeries(HistogramSeries, {
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      } as DeepPartial<HistogramSeriesOptions>);
      histSeries.setData(histData);

      macdChart.timeScale().fitContent();
    }

    // ── Time range sync ───────────────────────────────────────────────────
    main.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range) return;
      rsiChart?.timeScale().setVisibleRange(range);
      macdChart?.timeScale().setVisibleRange(range);
    });

    // ── Resize observer ───────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      main.applyOptions({ width: mainEl.clientWidth });
      if (rsiChart && rsiRef.current) rsiChart.applyOptions({ width: rsiRef.current.clientWidth });
      if (macdChart && macdRef.current) macdChart.applyOptions({ width: macdRef.current.clientWidth });
    });
    ro.observe(mainEl);

    return () => {
      ro.disconnect();
      main.remove();
      rsiChart?.remove();
      macdChart?.remove();
    };
  }, [mounted, data, visible, period, chartType, resolution, markers]);

  // ── Toggle helper ─────────────────────────────────────────────────────────
  function toggle(key: IndicatorKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Derived values for header ─────────────────────────────────────────────
  const lastClose = data.length > 0 ? data[data.length - 1]!.close : null;
  const prevClose = data.length > 1 ? data[data.length - 2]!.close : null;
  const varPct = lastClose != null && prevClose != null && prevClose !== 0
    ? ((lastClose - prevClose) / prevClose) * 100
    : null;

  // ── SSR guard ─────────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 h-[420px] animate-pulse" />
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            Cours{designation ? ` — ${designation}` : ''}
          </span>
          {lastClose != null && (
            <span className="tabular text-sm font-medium">
              {lastClose.toLocaleString('fr-FR')} FCFA
            </span>
          )}
          {varPct != null && (
            <span
              className={`tabular text-xs font-medium ${varPct >= 0 ? 'text-up' : 'text-down'}`}
            >
              {varPct >= 0 ? '+' : ''}{varPct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Controls: resolution + chart type + period */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Résolution temporelle */}
          <div className="flex gap-0.5 border border-border rounded overflow-hidden">
            {RESOLUTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setResolution(key)}
                className={`text-xs px-2.5 py-0.5 transition ${
                  resolution === key
                    ? 'bg-cyan/20 text-cyan'
                    : 'text-muted hover:text-cyan'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Type de graphique */}
          <div className="flex gap-0.5 border border-border rounded overflow-hidden">
            {(['line', 'candle'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                className={`text-xs px-2.5 py-0.5 transition ${
                  chartType === t
                    ? 'bg-up/20 text-up'
                    : 'text-muted hover:text-up'
                }`}
              >
                {t === 'line' ? 'Ligne' : 'Bougies'}
              </button>
            ))}
          </div>
          {/* Période */}
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`text-xs px-2 py-0.5 rounded border transition focus:outline-none focus:ring-2 focus:ring-up/50 ${
                  period === p
                    ? 'bg-up text-bg border-up'
                    : 'border-border text-muted hover:border-up/40 hover:text-up'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Indicator toggles ── */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-muted uppercase tracking-wide mr-1">Overlays</span>
          {OVERLAY_INDICATORS.map(({ key, label }) => {
            const active = visible.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`text-xs px-2 py-0.5 rounded border transition focus:outline-none focus:ring-2 focus:ring-up/50 ${
                  active
                    ? 'bg-up/15 text-up border-up/40'
                    : 'border-border text-muted hover:border-up/40 hover:text-up'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-muted uppercase tracking-wide mr-1">Oscillateurs</span>
          {OSCILLATOR_INDICATORS.map(({ key, label }) => {
            const active = visible.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`text-xs px-2 py-0.5 rounded border transition focus:outline-none focus:ring-2 focus:ring-up/50 ${
                  active
                    ? 'bg-up/15 text-up border-up/40'
                    : 'border-border text-muted hover:border-up/40 hover:text-up'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main chart ── */}
      <div ref={mainRef} />

      {/* ── RSI sub-chart ── */}
      {visible.has('rsi') && (
        <div>
          <div className="text-[10px] text-muted mb-0.5 pl-1">RSI (14)</div>
          <div ref={rsiRef} />
        </div>
      )}

      {/* ── MACD sub-chart ── */}
      {visible.has('macd') && (
        <div>
          <div className="text-[10px] text-muted mb-0.5 pl-1">MACD (12, 26, 9)</div>
          <div ref={macdRef} />
        </div>
      )}
    </div>
  );
}
