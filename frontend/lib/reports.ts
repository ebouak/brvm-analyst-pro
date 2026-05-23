// Constructeurs de rapports (§11/§12). Réutilisés par l'API et les pages.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionDaily, SignalDaily, MarketEvent, Period } from './types';
import { PERIOD_DAYS } from './types';
import { smaSeries, rsiSeries, macdSeries, rsi, sma, detect } from './indicators';
import { eventStudy, type DatedClose } from './eventStudy';
import { instrumentHeadline, whyBullets, eventHeadline, type InstrumentMetrics } from './narrative';

const PERIOD_LABEL: Record<string, string> = {
  '1S': '1 semaine', '1M': '1 mois', '3M': '3 mois', '6M': '6 mois', '1A': '1 an', max: 'la période',
};

function cutByPeriod(rows: ActionDaily[], period: Period): ActionDaily[] {
  const days = PERIOD_DAYS[period] ?? 31;
  if (days >= 100000) return rows;
  const last = rows[rows.length - 1]?.date_marche;
  if (!last) return rows;
  const cutoff = new Date(last);
  cutoff.setDate(cutoff.getDate() - days);
  const c = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date_marche >= c);
}

export interface InstrumentReport {
  reportType: 'instrument';
  instrument: { code: string; designation: string | null; secteur: string | null; pays: string | null };
  period: Period;
  timeseries: { date: string; close: number | null; volume: number | null; ma20: number | null; ma50: number | null; ma200: number | null; rsi: number | null }[];
  technicalIndicators: { rsi: number | null; ma20: number | null; ma50: number | null; ma200: number | null; macd: number | null; signalLine: number | null; detection: ReturnType<typeof detect> };
  events: MarketEvent[];
  signals: SignalDaily[];
  summary: { performancePct: number | null; trend: 'bullish' | 'neutral' | 'bearish'; volatility: number | null; volumeRatio: number | null };
  explanation: { headline: string; why: string[] };
}

export async function buildInstrumentReport(
  supabase: SupabaseClient,
  code: string,
  period: Period,
): Promise<InstrumentReport | null> {
  const [{ data: hist }, { data: instr }, { data: sigs }, { data: evts }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('code', code).order('date_marche', { ascending: true }).limit(2000),
    supabase.from('brvm_instruments').select('*').eq('code', code).maybeSingle(),
    supabase.from('signals_daily').select('*').eq('code', code).order('date_marche', { ascending: false }).limit(20),
    supabase.from('market_events').select('*').eq('instrument_code', code).order('event_date', { ascending: false }).limit(50),
  ]);

  const allRows = (hist ?? []) as ActionDaily[];
  if (allRows.length === 0) return null;
  const rows = cutByPeriod(allRows, period);

  // Indicateurs calculés sur l'historique complet pour fiabilité, puis tranchés.
  const closesAll = allRows.map((r) => r.cours_jour ?? 0);
  const ma20A = smaSeries(closesAll, 20);
  const ma50A = smaSeries(closesAll, 50);
  const ma200A = smaSeries(closesAll, 200);
  const rsiA = rsiSeries(closesAll, 14);
  const offset = allRows.length - rows.length;

  const timeseries = rows.map((r, i) => {
    const gi = offset + i;
    return {
      date: r.date_marche, close: r.cours_jour, volume: r.volume,
      ma20: ma20A[gi] ?? null, ma50: ma50A[gi] ?? null, ma200: ma200A[gi] ?? null, rsi: rsiA[gi] ?? null,
    };
  });

  const closesPeriod = rows.map((r) => r.cours_jour ?? 0);
  const first = closesPeriod.find((c) => c > 0) ?? null;
  const last = closesPeriod[closesPeriod.length - 1] ?? null;
  const performancePct = first && last ? ((last - first) / first) * 100 : null;

  // Volatilité = écart-type des rendements quotidiens sur la période (%).
  const rets: number[] = [];
  for (let i = 1; i < closesPeriod.length; i++) {
    const a = closesPeriod[i - 1], b = closesPeriod[i];
    if (a && b) rets.push((b - a) / a);
  }
  const mean = rets.length ? rets.reduce((x, y) => x + y, 0) / rets.length : 0;
  const variance = rets.length ? rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length : 0;
  const volatility = rets.length ? Math.sqrt(variance) : null;

  const lastRsi = rsi(closesAll, 14);
  const ma20 = sma(closesAll, 20);
  const ma50 = sma(closesAll, 50);
  const macdLast = macdSeries(closesAll).slice(-1)[0] ?? { macd: null, signal: null, hist: null };
  const det = detect(closesAll);

  const lastVol = rows[rows.length - 1]?.volume ?? null;
  const recentAvgVol = (() => {
    const v = allRows.slice(-30).map((r) => r.volume).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  })();
  const volumeRatio = lastVol != null && recentAvgVol && recentAvgVol > 0 ? lastVol / recentAvgVol : null;

  const trend: 'bullish' | 'neutral' | 'bearish' =
    ma20 != null && ma50 != null ? (ma20 > ma50 ? 'bullish' : ma20 < ma50 ? 'bearish' : 'neutral') : 'neutral';

  const metrics: InstrumentMetrics = {
    code, performancePct, rsi: lastRsi, volumeRatio, trend, periodLabel: PERIOD_LABEL[period] ?? 'la période',
  };

  return {
    reportType: 'instrument',
    instrument: {
      code,
      designation: (instr as { designation?: string } | null)?.designation ?? null,
      secteur: (instr as { secteur?: string } | null)?.secteur ?? null,
      pays: (instr as { pays?: string } | null)?.pays ?? null,
    },
    period,
    timeseries,
    technicalIndicators: { rsi: lastRsi, ma20, ma50, ma200: sma(closesAll, 200), macd: macdLast.macd, signalLine: macdLast.signal, detection: det },
    events: (evts ?? []) as MarketEvent[],
    signals: (sigs ?? []) as SignalDaily[],
    summary: { performancePct, trend, volatility, volumeRatio },
    explanation: { headline: instrumentHeadline(metrics), why: whyBullets(metrics) },
  };
}

export interface EventReport {
  reportType: 'event';
  event: MarketEvent;
  relatedCodes: string[];
  impact: Record<string, ReturnType<typeof eventStudy>>;
  explanation: { headline: string };
}

export async function buildEventReport(
  supabase: SupabaseClient,
  id: string,
  window = 5,
): Promise<EventReport | null> {
  const { data: ev } = await supabase.from('market_events').select('*').eq('id', id).maybeSingle();
  if (!ev) return null;
  const event = ev as MarketEvent;

  const { data: pivot } = await supabase
    .from('market_event_instruments').select('instrument_code').eq('event_id', id);
  const codes = new Set<string>((pivot ?? []).map((p) => p.instrument_code as string));
  if (event.instrument_code) codes.add(event.instrument_code);
  const relatedCodes = [...codes];

  // Indice BRVM Composite pour le rendement de référence.
  const { data: idx } = await supabase
    .from('brvm_indices_daily').select('date_marche, valeur').eq('code', 'BRVMC')
    .order('date_marche', { ascending: true }).limit(2000);
  const indexSeries: DatedClose[] = (idx ?? []).map((r) => ({ date: r.date_marche as string, close: r.valeur as number | null }));

  const impact: Record<string, ReturnType<typeof eventStudy>> = {};
  for (const code of relatedCodes) {
    const { data: hist } = await supabase
      .from('brvm_actions_daily').select('date_marche, cours_jour, volume').eq('code', code)
      .order('date_marche', { ascending: true }).limit(2000);
    const rows = (hist ?? []) as { date_marche: string; cours_jour: number | null; volume: number | null }[];
    const series: DatedClose[] = rows.map((r) => ({ date: r.date_marche, close: r.cours_jour }));
    const vols = rows.map((r) => r.volume);
    impact[code] = eventStudy(series, vols, indexSeries, event.event_date, window);
  }

  const firstCode = relatedCodes[0];
  const ar = firstCode ? impact[firstCode]?.abnormalReturnPost ?? null : null;
  const reaction = firstCode ? impact[firstCode]?.reaction ?? 'neutral' : 'neutral';
  const headline = firstCode
    ? eventHeadline({ eventDate: event.event_date, code: firstCode, abnormalReturnPost: ar, reaction, window })
    : `Événement du ${event.event_date} — aucun titre rattaché pour mesurer l'impact.`;

  return { reportType: 'event', event, relatedCodes, impact, explanation: { headline } };
}

// --- Rapport secteur (§4.2 / §5) -------------------------------------------
export interface SectorTitlePerf {
  code: string;
  designation: string | null;
  performancePct: number | null;
  lastClose: number | null;
}

export interface SectorReport {
  reportType: 'sector';
  sector: string;
  period: Period;
  titles: SectorTitlePerf[];
  best: SectorTitlePerf[];
  worst: SectorTitlePerf[];
  dispersion: number | null; // écart-type des perfs (%)
  averagePerf: number | null;
  events: MarketEvent[];
  explanation: { headline: string };
}

export async function buildSectorReport(
  supabase: SupabaseClient,
  sector: string,
  period: Period,
): Promise<SectorReport | null> {
  // Titres du secteur.
  const { data: instr } = await supabase
    .from('brvm_instruments').select('code, designation').eq('secteur', sector).eq('type', 'action');
  const codes = (instr ?? []).map((r) => r.code as string);
  if (codes.length === 0) return null;
  const nameMap: Record<string, string | null> = {};
  for (const r of instr ?? []) nameMap[r.code as string] = (r.designation as string) ?? null;

  const days = PERIOD_DAYS[period] ?? 31;
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche as string | undefined;

  const titles: SectorTitlePerf[] = [];
  for (const code of codes) {
    const { data: hist } = await supabase
      .from('brvm_actions_daily').select('date_marche, cours_jour').eq('code', code)
      .order('date_marche', { ascending: false }).limit(days >= 100000 ? 2000 : days + 5);
    const rows = ((hist ?? []) as { date_marche: string; cours_jour: number | null }[]);
    const last = rows[0]?.cours_jour ?? null;
    const first = rows[rows.length - 1]?.cours_jour ?? null;
    const performancePct = first && last ? ((last - first) / first) * 100 : null;
    titles.push({ code, designation: nameMap[code] ?? null, performancePct, lastClose: last });
  }

  const perfs = titles.map((t) => t.performancePct).filter((p): p is number => p != null);
  const averagePerf = perfs.length ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null;
  const dispersion = perfs.length
    ? Math.sqrt(perfs.reduce((s, p) => s + (p - (averagePerf ?? 0)) ** 2, 0) / perfs.length)
    : null;

  const sorted = [...titles].filter((t) => t.performancePct != null)
    .sort((a, b) => (b.performancePct ?? 0) - (a.performancePct ?? 0));
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  const { data: evts } = await supabase
    .from('market_events').select('*').eq('sector', sector)
    .order('event_date', { ascending: false }).limit(20);

  const dir = averagePerf == null ? '' : averagePerf >= 0 ? `progresse de ${averagePerf.toFixed(1)}%` : `recule de ${Math.abs(averagePerf).toFixed(1)}%`;
  const headline = averagePerf == null
    ? `Secteur ${sector} : données insuffisantes sur la période.`
    : `Le secteur ${sector} ${dir} en moyenne sur ${PERIOD_LABEL[period] ?? 'la période'} (${titles.length} titres, dispersion ${dispersion?.toFixed(1)}%).`;

  return {
    reportType: 'sector', sector, period, titles, best, worst,
    dispersion, averagePerf, events: (evts ?? []) as MarketEvent[],
    explanation: { headline },
  };
}
