import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;
import PriceChart, { type PricePoint, type ChartMarker } from '@/components/PriceChart';
import EventMarkerLegend from '@/components/EventMarkerLegend';
import IndicatorCharts, { type IndicatorPoint } from '@/components/IndicatorCharts';
import RsiCursor from '@/components/RsiCursor';
import SignalBadge from '@/components/SignalBadge';
import PublicationsModal, { type Publication } from '@/components/PublicationsModal';
import FundamentalsPanel from '@/components/fundamentals/FundamentalsPanel';
import { pickBestFundamental } from '@/lib/fundamentals';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { smaSeries, rsiSeries, macdSeries, bollingerSeries, detect, stochasticSeries, cciSeries } from '@/lib/indicators';
import { computeTechnicalSummary } from '@/lib/technicalSummary';
import type { TechnicalSummaryResult } from '@/lib/technicalSummary';
import TechnicalSummary from '@/components/TechnicalSummary';
import NotationBadge from '@/components/NotationBadge';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
  EmptyStatePremium,
  PremiumCTA,
  Eyebrow,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';

// 600 séances ≈ 2,3 ans BRVM (260 j/an) — nécessaire pour MA200 + 2 ans de backtest
const HISTORY = 600;

async function getData(code: string, fromDate?: string) {
  const supabase = createClient();

  let histQuery = supabase
    .from('brvm_actions_daily')
    .select('*')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(HISTORY);

  if (fromDate) histQuery = histQuery.gte('date_marche', fromDate);

  const [{ data: hist }, { data: instr }, { data: sig }, { data: divs }, { data: evts }, { data: pubs }, { count: pubCount }, { data: fundsRows }] =
    await Promise.all([
      histQuery,
      supabase.from('brvm_instruments').select('*').eq('code', code).maybeSingle(),
      supabase
        .from('signals_daily')
        .select('*')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(1),
      supabase
        .from('dividends')
        .select('montant, ex_date, payment_date, exercice')
        .eq('code', code)
        .order('ex_date', { ascending: false })
        .limit(1),
      supabase
        .from('market_events')
        .select('id, title, event_date, event_type, sentiment')
        .eq('instrument_code', code)
        .order('event_date', { ascending: false })
        .limit(4),
      supabase
        .from('publications')
        .select('id, date_publication, libelle, type_publication, source_url')
        .eq('code', code)
        .order('date_publication', { ascending: false })
        .limit(50),
      supabase
        .from('publications')
        .select('*', { count: 'exact', head: true })
        .eq('code', code),
      supabase
        .from('fundamentals')
        .select('year, revenue, net_income, equity, cash, debt, bfr, source_file, is_manual')
        .eq('code', code)
        .order('year', { ascending: false })
        .limit(6),
    ]);

  return {
    rows: ((hist ?? []) as ActionDaily[]).reverse(),
    instrument: instr as { designation?: string; secteur?: string; pays?: string; type?: string; shares?: number | null; shares_source?: string | null; flottant?: number | null; vol_moyen_30j?: number | null; notation_json?: {
        agence: string; note: string; perspective: string; date_notation: string; source_url?: string;
        court_terme?: string | null; long_terme?: string | null;
        history?: { note: string; court_terme?: string | null; long_terme?: string | null; perspective: string; date_notation: string }[];
      } | null } | null,
    signal: (sig?.[0] ?? null) as SignalDaily | null,
    dividends: divs ?? [],
    events: evts ?? [],
    publications: (pubs ?? []) as Publication[],
    pubCount: pubCount ?? 0,
    fundamentals: (fundsRows ?? []) as Array<{
      year: number | null; revenue: number | null; net_income: number | null;
      equity: number | null; cash: number | null; debt: number | null; bfr: number | null;
      source_file: string | null; is_manual: boolean | null;
    }>,
  };
}

export default async function InstrumentPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { from?: string };
}) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const fromDate = searchParams.from ?? '';
  const { rows, instrument, signal, dividends, events, publications, pubCount, fundamentals } = await getData(code, fromDate || undefined);

  if (rows.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <Link
          href="/actions"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-gold transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          ← Marché actions
        </Link>
        <EmptyStatePremium
          title={`Aucun historique pour ${code}`}
          hint="Les données seront disponibles après la prochaine collecte."
          icon="◈"
          action={{ href: '/actions', label: 'Retour au marché' }}
        />
      </div>
    );
  }

  // Ne calcule les indicateurs que sur les clôtures valides (jamais avec 0 synthétique)
  const closes = rows.map((r) => r.cours_jour ?? null);
  const validCloses = closes.filter((c): c is number => c != null);
  const ma20  = smaSeries(closes.map((c) => c ?? 0), 20).map((v, i) => closes[i] == null ? null : v);
  const ma50  = smaSeries(closes.map((c) => c ?? 0), 50).map((v, i) => closes[i] == null ? null : v);
  const ma200 = smaSeries(closes.map((c) => c ?? 0), 200).map((v, i) => closes[i] == null ? null : v);
  const rsiS  = rsiSeries(validCloses, 14);
  const macdS = macdSeries(validCloses);
  const det   = detect(validCloses);

  // ── Nouveaux indicateurs pour TechnicalSummary ──────────────────────────
  const stochArr = stochasticSeries(validCloses, 14, 3, 3);
  const lastStochPoint = stochArr[stochArr.length - 1] ?? null;
  const lastStochK = lastStochPoint?.k ?? null;

  const cciArr = cciSeries(validCloses, 20);
  const lastCci = cciArr[cciArr.length - 1] ?? null;

  const bbArr = bollingerSeries(validCloses, 20, 2);
  const lastBbPoint = bbArr[bbArr.length - 1] ?? null;
  const lastBbUpper = lastBbPoint?.upper ?? null;
  const lastBbLower = lastBbPoint?.lower ?? null;

  // Réindexe RSI/MACD (calculés sur validCloses) vers rows
  let validIdx = 0;
  const rsiByRow   = rows.map((r) => r.cours_jour != null ? (rsiS[validIdx++] ?? null) : null);
  validIdx = 0;
  const macdByRow  = rows.map((r) => r.cours_jour != null ? (macdS[validIdx++] ?? null) : null);

  const priceData: PricePoint[] = rows.map((r) => ({
    date: r.date_marche,
    close: r.cours_jour,
    volume: r.volume,
  }));

  // ── Marqueurs d'événements pour le graphique ─────────────────────────────
  const chartMarkers: ChartMarker[] = [];

  for (const d of dividends as { montant: number; ex_date: string | null }[]) {
    if (d.ex_date) {
      chartMarkers.push({ date: d.ex_date, label: 'D', color: '#ffb300', title: `Dividende ${d.montant} FCFA` });
    }
  }

  for (const p of publications.slice(0, 20)) {
    chartMarkers.push({ date: p.date_publication, label: 'RT', color: '#7e57c2', title: p.libelle ?? 'Publication' });
  }

  for (const e of events as { event_date: string; event_type: string; title: string }[]) {
    const t = (e.event_type ?? '').toLowerCase();
    let label = 'A'; let color = '#00c853';
    if (t.includes('assembl')) { label = 'AG'; color = '#42a5f5'; }
    else if (t.includes('result') || t.includes('rapport')) { label = 'RT'; color = '#7e57c2'; }
    else if (t.includes('dividend')) { label = 'D'; color = '#ffb300'; }
    chartMarkers.push({ date: e.event_date, label, color, title: e.title });
  }
  const indicatorData: IndicatorPoint[] = rows.map((r, i) => ({
    date: r.date_marche,
    rsi: rsiByRow[i],
    macd: macdByRow[i]?.macd ?? null,
    signal: macdByRow[i]?.signal ?? null,
    hist: macdByRow[i]?.hist ?? null,
  }));

  const last    = rows[rows.length - 1]!;
  const prev    = rows[rows.length - 2] ?? null;
  const up      = (last.variation_pct ?? 0) >= 0;
  const lastRsi = rsiByRow[rsiByRow.length - 1];
  const lastMacd = macdByRow[macdByRow.length - 1];
  const lastMa20 = ma20[ma20.length - 1] ?? null;
  const technicalSummary: TechnicalSummaryResult = computeTechnicalSummary({
    lastClose: validCloses[validCloses.length - 1] ?? null,
    ma20Last: lastMa20,
    macdVal: lastMacd?.macd ?? null,
    macdSignal: lastMacd?.signal ?? null,
    rsiVal: lastRsi ?? null,
    bbUpper: lastBbUpper,
    bbLower: lastBbLower,
    stochK: lastStochK,
    cci: lastCci,
    dmiPlus: null,
    dmiMinus: null,
  });
  const lastMa50 = ma50[ma50.length - 1] ?? null;
  const lastMa200 = ma200[ma200.length - 1] ?? null;

  // Variation absolue
  const varAbs = last.cours_precedent != null && last.cours_jour != null
    ? last.cours_jour - last.cours_precedent : null;

  // Rendement dividende
  const lastDiv = (dividends as { montant: number; ex_date: string; payment_date?: string }[])[0];
  const divYield = lastDiv && last.cours_jour && last.cours_jour > 0
    ? (lastDiv.montant / last.cours_jour) * 100 : null;

  // Capitalisation boursière = cours × shares (en MFCFA)
  const shares = instrument?.shares ?? null;
  const capitalisation = shares != null && last.cours_jour != null
    ? (last.cours_jour * shares) / 1_000_000 : null;

  // Volume moyen 20j
  const recentVols = rows.slice(-20).map((r) => r.volume).filter((v): v is number => v != null);
  const volMoyen = recentVols.length > 0
    ? Math.round(recentVols.reduce((a, b) => a + b, 0) / recentVols.length) : null;

  const pays = instrument?.pays ?? last.pays ?? null;
  const secteur = instrument?.secteur ?? last.secteur ?? null;

  // Détections sous forme de checklist
  const detections = [
    { label: 'Momentum haussier', ok: up && (last.variation_pct ?? 0) > 1 },
    { label: 'Golden Cross (MA20 > MA50)', ok: det.goldenCross },
    { label: 'Volume > moyenne', ok: last.volume != null && last.cours_precedent != null && last.volume > 0 },
    { label: 'Cassure haussière 20j', ok: det.breakoutUp },
    { label: 'Survente RSI < 30', ok: det.oversold },
    { label: 'Surachat RSI > 70', ok: det.overbought },
    { label: 'Death Cross (baissier)', ok: det.deathCross },
    { label: 'Cassure baissière 20j', ok: det.breakoutDown },
  ].filter((d) => d.ok !== undefined);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6 animate-rise-in">

      {/* ══════════════════════════════════════════════════
          BREADCRUMB + ACTIONS RAPIDES
      ══════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-faint">
          <Link
            href="/actions"
            className="hover:text-gold transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Marché actions
          </Link>
          <span className="text-border-strong">›</span>
          <span className="text-muted">{code}</span>
        </nav>

        {/* Actions header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <PublicationsModal
            code={code}
            designation={instrument?.designation}
            publications={publications}
            count={pubCount}
          />
          <Link
            href="/portefeuille"
            className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-3 py-1 text-muted hover:border-gold/40 hover:text-gold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Watchlist
          </Link>
          <Link
            href="/portefeuille"
            className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-3 py-1 text-muted hover:border-gold/40 hover:text-gold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Alertes
          </Link>
          <Link
            href={`/actions/${code}/financials`}
            className="inline-flex items-center gap-1 text-[11px] border border-gold/30 bg-gold/[0.06] rounded-full px-3 py-1 text-gold hover:bg-gold/10 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Financials →
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          HERO — COTATION PRINCIPALE
      ══════════════════════════════════════════════════ */}
      {/* Outer shell double-bezel */}
      <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
        <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
          {/* Glow atmosphérique */}
          <div
            className={`absolute inset-0 pointer-events-none ${
              up ? 'bg-emerald-veil' : '[background:radial-gradient(120%_60%_at_80%_-10%,rgba(226,75,75,0.06),transparent_55%)]'
            }`}
          />
          <div className="relative px-5 pt-5 pb-6 md:px-7 md:pt-7">
            {/* Logo + identité instrument */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div className="flex items-center gap-3.5 min-w-0">
                {LOGOS[code] ? (
                  /* Double-bezel logo */
                  <div className="rounded-xl border border-border/60 bg-border/40 p-1 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={LOGOS[code]}
                      alt={code}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5"
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl border border-border/60 bg-elevated grid place-items-center shrink-0">
                    <span className="text-gold/60 text-sm font-display font-medium">{code.slice(0, 2)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-faint uppercase tracking-[0.18em] mb-0.5">BRVM · Action</p>
                  <h1 className="font-display text-xl md:text-2xl text-ivory tracking-tight leading-tight">
                    {code}
                  </h1>
                  <p className="text-xs text-muted truncate max-w-xs mt-0.5">
                    {instrument?.designation ?? last.designation ?? ''}
                  </p>
                </div>
              </div>

              {/* Chips méta */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {pays && <StatPill tone="neutral">{pays}</StatPill>}
                {secteur && <StatPill tone="sapphire">{secteur}</StatPill>}
                <StatPill tone="gold">Action</StatPill>
              </div>
            </div>

            {/* Prix principal */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-1.5">
              <span className="tabular font-mono text-4xl md:text-5xl font-bold tracking-tight text-ivory leading-none">
                {fmtNumber(last.cours_jour)}
              </span>
              <span className="text-muted text-base mb-1">FCFA</span>
              {varAbs != null && (
                <span
                  className={`tabular font-mono text-base font-semibold mb-1 ${
                    up ? 'text-up' : 'text-down'
                  }`}
                >
                  {up ? '+' : ''}{fmtNumber(varAbs)}{' '}
                  <span className="text-sm opacity-80">
                    ({up ? '+' : ''}{(last.variation_pct ?? 0).toFixed(2)}%)
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-faint">
              Séance du <span className="text-muted">{last.date_marche}</span>
            </p>

            {/* Séparateur or */}
            <div className="mt-5 h-px bg-gold-line opacity-40" />

            {/* Grille métriques de séance */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4">
              <SessionMetric label="Clôture préc." value={fmtNumber(last.cours_precedent)} unit="FCFA" />
              <SessionMetric label="Volume du jour" value={fmtNumber(last.volume)} unit="titres" />
              <SessionMetric label="Valeur échangée" value={fmtFcfa(last.valeur_echangee)} />
              <SessionMetric label="Transactions" value={fmtNumber(last.nb_transactions)} />
              {volMoyen != null && <SessionMetric label="Vol. moyen 20j" value={fmtNumber(volMoyen)} unit="titres" />}
              {capitalisation != null && <SessionMetric label="Capitalisation" value={fmtNumber(Math.round(capitalisation))} unit="MFCFA" accent />}
              {shares != null && <SessionMetric label="Titres totaux" value={fmtNumber(shares)} />}
              {instrument?.flottant != null && <SessionMetric label="Titres flottant" value={fmtNumber(instrument.flottant)} />}
              {divYield != null && <SessionMetric label="Rdt dividende" value={divYield.toFixed(2)} unit="%" accent />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Notation financière ── */}
      {instrument?.notation_json && (
        <NotationBadge
          notation={instrument.notation_json}
          notationPubs={publications.filter((p) => p.type_publication === 'notation')}
        />
      )}

      {/* ── Bannière données insuffisantes ── */}
      {rows.length < 20 && (
        <div className="border border-warn/20 bg-warn/5 rounded-card px-5 py-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="text-warn text-base leading-none">⚠</span>
            <p className="text-xs text-warn font-medium">
              Données insuffisantes — {rows.length} séance{rows.length > 1 ? 's' : ''} sur 20 requises pour RSI, MACD et moyennes mobiles.
            </p>
          </div>
          <pre className="text-xs font-mono bg-surface border border-border rounded-lg px-4 py-3 text-up select-all overflow-x-auto">
            npm run backfill -- {code} --from=2023-01-01
          </pre>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          GRAPHIQUE COURS
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Cours & Volume</Eyebrow>
        <PremiumPanel className="p-0 overflow-hidden">
          <div className="px-4 py-4 md:px-5">
            <PriceChart
              data={priceData}
              designation={instrument?.designation ?? last.designation ?? code}
              markers={chartMarkers}
            />
          </div>
        </PremiumPanel>
        <div className="mt-2">
          <EventMarkerLegend markers={chartMarkers} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          CONFIGURATION TECHNIQUE (TechnicalSummary)
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Configuration technique</Eyebrow>
        <TechnicalSummary result={technicalSummary} />
      </div>

      {/* ══════════════════════════════════════════════════
          INDICATEURS + DÉTECTIONS (grille 2 col)
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Analyse technique</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── Indicateurs ── */}
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 h-full">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Indicateurs</p>

              {/* RSI */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted">RSI (14)</span>
                  <span
                    className={`tabular font-semibold font-mono ${
                      lastRsi == null ? 'text-faint' :
                      lastRsi < 30 ? 'text-up' :
                      lastRsi > 70 ? 'text-down' : 'text-ivory'
                    }`}
                  >
                    {lastRsi != null ? lastRsi.toFixed(0) : '—'}
                  </span>
                </div>
                {/* Barre RSI premium */}
                <div className="relative h-1.5 rounded-full overflow-hidden bg-border">
                  <div className="absolute left-0 top-0 bottom-0 w-[30%] rounded-l-full bg-gradient-to-r from-up/35 to-up/[0.08]" />
                  <div className="absolute right-0 top-0 bottom-0 w-[30%] rounded-r-full bg-gradient-to-l from-down/35 to-down/[0.08]" />
                  {lastRsi != null && <RsiCursor rsi={lastRsi} />}
                </div>
                <div className="flex justify-between text-[10px] text-faint mt-1.5">
                  <span>Survente &lt;30</span>
                  <span>Équilibre</span>
                  <span>Surachat &gt;70</span>
                </div>
              </div>

              {/* Moyennes mobiles */}
              <div className="border-t border-border/30 pt-4 mb-4">
                <p className="text-[11px] text-faint uppercase tracking-wider mb-3">Moyennes mobiles</p>
                <div className="space-y-2">
                  {[
                    { label: 'MA 20', val: lastMa20 },
                    { label: 'MA 50', val: lastMa50 },
                    { label: 'MA 200', val: lastMa200 },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular font-mono text-ivory">
                          {val != null ? fmtNumber(val) : '—'}
                        </span>
                        {val != null && last.cours_jour != null && (
                          <span className={`text-[10px] ${last.cours_jour >= val ? 'text-up' : 'text-down'}`}>
                            {last.cours_jour >= val ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MACD */}
              {lastMacd && (
                <div className="border-t border-border/30 pt-4">
                  <p className="text-[11px] text-faint uppercase tracking-wider mb-3">MACD</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <MacdCell label="Ligne" value={lastMacd.macd?.toFixed(0) ?? '—'} />
                    <MacdCell label="Signal" value={lastMacd.signal?.toFixed(0) ?? '—'} />
                    <MacdCell
                      label="Histog."
                      value={lastMacd.hist != null
                        ? (lastMacd.hist >= 0 ? '+' : '') + lastMacd.hist.toFixed(0)
                        : '—'}
                      accent={(lastMacd.hist ?? 0) >= 0 ? 'up' : 'down'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Détections ── */}
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 h-full">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Détections actives</p>
              <div className="space-y-2.5">
                {detections.map((d) => (
                  <div
                    key={d.label}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      d.ok
                        ? 'bg-up/5 border border-up/15'
                        : 'border border-transparent'
                    }`}
                  >
                    <span
                      className={`text-[10px] shrink-0 leading-none ${
                        d.ok ? 'text-up' : 'text-border-strong'
                      }`}
                    >
                      {d.ok ? '●' : '○'}
                    </span>
                    <span
                      className={`text-xs ${
                        d.ok ? 'text-ivory' : 'text-faint'
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                ))}
                {detections.every((d) => !d.ok) && (
                  <p className="text-xs text-faint italic mt-2">Aucune détection active.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          SIGNAL DU JOUR
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Signal quantitatif</Eyebrow>
        {signal ? (
          <SignalPanel signal={signal} />
        ) : (
          <div className="rounded-panel border border-border bg-surface shadow-card p-6">
            <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-1.5">Signal du jour</p>
            <p className="text-xs text-faint">Aucun signal calculé pour cette séance.</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          FONDAMENTAUX
      ══════════════════════════════════════════════════ */}
      {fundamentals.length > 0 && (() => {
        const latest = pickBestFundamental(fundamentals)!;
        const closePrices = rows.map((r) => r.cours_jour).filter((c): c is number => c != null);
        const range52 = {
          low: closePrices.length ? Math.min(...closePrices) : null,
          high: closePrices.length ? Math.max(...closePrices) : null,
          current: last.cours_jour ?? null,
        };
        return (
          <div>
            <Eyebrow className="mb-3">Analyse fondamentale</Eyebrow>
            <FundamentalsPanel
              code={code}
              year={latest.year}
              inputs={{
                cours: last.cours_jour ?? null,
                shares: instrument?.shares ?? null,
                revenue: latest.revenue,
                net_income: latest.net_income,
                equity: latest.equity,
                debt: latest.debt,
                dividende: lastDiv?.montant ?? null,
              }}
              sharesSource={instrument?.shares_source ?? null}
              isManual={latest.is_manual ?? false}
              history={fundamentals
                .filter((f) => (f.is_manual ?? false) === (latest.is_manual ?? false))
                .map((f) => ({ year: f.year ?? 0, revenue: f.revenue, net_income: f.net_income }))}
              sourceUrl={null}
              range52={range52}
            />
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════
          DIVIDENDES + ÉVÉNEMENTS
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Corporate & Dividendes</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Dividendes */}
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Dividendes</p>
              {lastDiv ? (
                <div>
                  {/* Rendement en vedette */}
                  {divYield != null && (
                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="tabular font-mono text-3xl font-bold text-up leading-none">
                        {divYield.toFixed(2)}%
                      </span>
                      <span className="text-xs text-muted">rendement estimé</span>
                    </div>
                  )}
                  <div className="space-y-0 border-t border-border/30 pt-3">
                    <DivRow label="Montant" value={fmtNumber(lastDiv.montant) + ' FCFA'} />
                    <DivRow label="Ex-date" value={lastDiv.ex_date ?? '—'} />
                    {lastDiv.payment_date && <DivRow label="Paiement" value={lastDiv.payment_date} />}
                  </div>
                  <p className="text-[10px] text-faint mt-3">Rendement calculé sur le cours actuel</p>
                </div>
              ) : (
                <p className="text-xs text-faint italic">Aucun dividende enregistré.</p>
              )}
            </div>
          </div>

          {/* Événements */}
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Événements récents</p>
              {events.length > 0 ? (
                <div className="space-y-3.5">
                  {(events as { id: string; title: string; event_date: string; event_type: string; sentiment?: string }[]).map((e) => (
                    <div key={e.id} className="border-b border-border/30 pb-3.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-faint tabular">{e.event_date}</span>
                        <span className="text-[10px] border border-border/60 rounded-full px-2 py-px text-faint">
                          {e.event_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mb-1.5">{e.title}</p>
                      <Link
                        href={`/dashboard/reports/events/${e.id}`}
                        className="text-[11px] text-gold/70 hover:text-gold transition-colors duration-300"
                      >
                        Lire l'analyse →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-faint italic">Aucun événement récent.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          GRAPHIQUES INDICATEURS (RSI/MACD historiques)
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Indicateurs historiques</Eyebrow>
        <PremiumPanel className="p-0 overflow-hidden">
          <div className="px-4 py-4 md:px-5">
            <IndicatorCharts data={indicatorData} />
          </div>
        </PremiumPanel>
      </div>

      {/* ══════════════════════════════════════════════════
          ACTIONS RAPIDES
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Actions</Eyebrow>
        <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
          <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { href: '/portefeuille', label: 'Ajouter à la watchlist', icon: '★' },
                { href: '/portefeuille', label: 'Créer une alerte prix', icon: '◎' },
                { href: `/api/export/actions/${code}`, label: 'Exporter CSV', icon: '↓', external: true },
                { href: `/backtest?code=${code}`, label: 'Lancer un backtest', icon: '⌛' },
                { href: `/assistant?symbole=${code}`, label: "Analyser avec l'IA", icon: '◈' },
              ].map(({ href, label, icon, external }) => {
                const cls =
                  'group flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-xs text-muted hover:border-gold/30 hover:text-ivory hover:bg-gold/[0.03] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';
                const inner = (
                  <>
                    <span className="text-gold/50 group-hover:text-gold/80 transition-colors duration-300 text-sm leading-none shrink-0">
                      {icon}
                    </span>
                    <span>{label}</span>
                    <span className="ml-auto text-border-strong group-hover:text-gold/40 transition-colors duration-300">→</span>
                  </>
                );
                return external ? (
                  <a key={label} href={href} className={cls}>{inner}</a>
                ) : (
                  <Link key={label} href={href} className={cls}>{inner}</Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ══════════════════════════════════════════════════════════════════

/** Métrique de séance — affichage compact dans le hero */
function SessionMetric({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="py-0.5">
      <p className="text-[10px] text-faint uppercase tracking-[0.12em] mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`tabular font-mono text-sm font-semibold leading-tight ${accent ? 'text-gold' : 'text-ivory'}`}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-faint">{unit}</span>}
      </div>
    </div>
  );
}

/** Cellule MACD */
function MacdCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'up' | 'down';
}) {
  return (
    <div className="bg-elevated rounded-lg py-2.5 px-2">
      <div className="text-faint text-[10px] mb-1">{label}</div>
      <div
        className={`tabular font-mono text-sm font-semibold ${
          accent === 'up' ? 'text-up' : accent === 'down' ? 'text-down' : 'text-ivory'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/** Ligne dividende */
function DivRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="tabular font-mono text-xs text-ivory">{value}</span>
    </div>
  );
}

/** Panel signal du jour — premium */
function SignalPanel({ signal }: { signal: SignalDaily }) {
  const subScores = (signal as SignalDaily & { inputs?: Record<string, number> | null }).inputs ?? null;

  return (
    <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
      <div
        className={`rounded-[calc(1.125rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 md:p-6 overflow-hidden relative ${
          signal.signal === 'BUY'
            ? 'bg-[linear-gradient(135deg,rgba(22,180,106,0.04)_0%,#0e1014_40%)]'
            : signal.signal === 'SELL'
            ? 'bg-[linear-gradient(135deg,rgba(226,75,75,0.04)_0%,#0e1014_40%)]'
            : 'bg-surface'
        }`}
      >
        {/* Header signal */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em]">Signal du jour</p>
          <SignalBadge signal={signal.signal} confiance={signal.confiance} />
          <span className="ml-auto tabular text-[11px] text-faint font-mono">
            {signal.score_total != null
              ? (signal.score_total >= 0 ? '+' : '') + signal.score_total.toFixed(2)
              : '—'}
            {' / 1.00 · '}{signal.date_marche}
          </span>
        </div>

        <p className="text-sm text-muted mb-5 leading-relaxed">
          {signal.explication ?? 'Signal calculé automatiquement.'}
        </p>

        {/* Sous-scores */}
        {(() => {
          const subScoreRows = [
            { label: 'variation_norm', val: signal.score_variation },
            { label: 'volume_signal', val: signal.score_volume },
            { label: 'rsi_signal', val: signal.score_rsi },
            { label: 'bonus_tendance', val: signal.bonus_tendance },
            { label: 'penalite_liquidite', val: signal.penalite_liquidite != null ? -signal.penalite_liquidite : null },
          ].filter((r) => r.val != null);

          if (subScoreRows.length === 0) return null;
          return (
            <div className="border-t border-border/30 pt-4 mb-4">
              <p className="text-[11px] text-faint uppercase tracking-wider mb-3">Sous-scores</p>
              <div className="space-y-2">
                {subScoreRows.map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{label}</span>
                    <span
                      className={`tabular font-mono font-semibold ${
                        (val as number) >= 0 ? 'text-up' : 'text-down'
                      }`}
                    >
                      {(val as number) >= 0 ? '+' : ''}{(val as number).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {subScores && (() => {
          const entries = Object.entries(subScores).filter(([, v]) => v != null);
          if (entries.length === 0) return null;
          return (
            <div className="border-t border-border/30 pt-4 mb-4">
              <p className="text-[11px] text-faint uppercase tracking-wider mb-3">Indicateurs utilisés</p>
              <div className="space-y-2">
                {entries.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{k}</span>
                    <span className="tabular font-mono text-faint">
                      {typeof v === 'number' ? v.toFixed(3) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="border-t border-border/30 pt-4 flex items-center justify-between">
          <Link
            href="/signaux"
            className="text-xs text-gold/70 hover:text-gold transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Voir tous les signaux →
          </Link>
        </div>
      </div>
    </div>
  );
}
