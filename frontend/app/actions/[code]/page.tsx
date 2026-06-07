import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;
import PriceChart, { type PricePoint } from '@/components/PriceChart';
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
    instrument: instr as { designation?: string; secteur?: string; pays?: string; type?: string; shares?: number | null; shares_source?: string | null; notation_json?: { agence: string; note: string; perspective: string; date_notation: string; source_url?: string } | null } | null,
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
      <div className="p-6">
        <Link href="/actions" className="text-xs text-up">← Marché actions</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-10 text-center text-muted">
          Aucun historique pour {code}.
        </div>
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
    <div className="px-4 py-6 space-y-5 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/actions" className="text-faint hover:text-muted text-sm shrink-0">← Marché</Link>
          <span className="text-faint text-sm">·</span>
          {LOGOS[code] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={LOGOS[code]} alt={code} width={32} height={32} className="rounded-lg object-contain shrink-0 bg-white p-0.5" style={{ width: 32, height: 32 }} />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight leading-tight">{code}</h1>
            <p className="text-xs text-muted truncate">{instrument?.designation ?? last.designation ?? ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <PublicationsModal
            code={code}
            designation={instrument?.designation}
            publications={publications}
            count={pubCount}
          />
          <Link href="/portefeuille" className="text-xs border border-border rounded-chip px-2.5 py-1 text-muted hover:border-up/40 hover:text-up transition-colors">
            Watchlist
          </Link>
          <Link href="/portefeuille" className="text-xs border border-border rounded-chip px-2.5 py-1 text-muted hover:border-up/40 hover:text-up transition-colors">
            Alertes
          </Link>
          <Link
            href={`/actions/${code}/financials`}
            className="text-xs border border-border rounded-chip px-2.5 py-1 text-muted hover:border-up/40 hover:text-up transition-colors"
          >
            Financials →
          </Link>
        </div>
      </div>

      {/* ── Cotation + méta ── */}
      <div className="bg-surface border border-border rounded-xl p-5">
        {/* Méta chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {pays && <span className="text-[11px] border border-border rounded-chip px-2 py-0.5 text-faint">{pays}</span>}
          {secteur && <span className="text-[11px] border border-border rounded-chip px-2 py-0.5 text-faint">{secteur}</span>}
          <span className="text-[11px] border border-border rounded-chip px-2 py-0.5 text-faint">Action</span>
        </div>

        {/* Prix principal */}
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-4xl font-bold tracking-tight tabular">{fmtNumber(last.cours_jour)}</span>
          <span className="text-muted text-sm">FCFA</span>
          {varAbs != null && (
            <span className={`font-mono text-sm font-semibold tabular ${up ? 'text-up' : 'text-down'}`}>
              {up ? '+' : ''}{fmtNumber(varAbs)} ({up ? '+' : ''}{(last.variation_pct ?? 0).toFixed(2)}%)
            </span>
          )}
        </div>
        <p className="text-[11px] text-faint mb-4">Séance du {last.date_marche}</p>

        {/* Métriques de séance */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-border/40 pt-4">
          <Metric label="Volume" value={fmtNumber(last.volume) + ' titres'} />
          <Metric label="Valeur échangée" value={fmtFcfa(last.valeur_echangee)} />
          <Metric label="Transactions" value={fmtNumber(last.nb_transactions)} />
          <Metric label="Clôture préc." value={fmtNumber(last.cours_precedent) + ' FCFA'} />
        </div>
      </div>

      {/* ── Notation financière ── */}
      {instrument?.notation_json && (
        <NotationBadge notation={instrument.notation_json} />
      )}

      {/* ── Bannière données insuffisantes ── */}
      {rows.length < 20 && (
        <div className="border border-warn/20 bg-warn/5 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs text-warn font-medium">
            Données insuffisantes — {rows.length} séance{rows.length > 1 ? 's' : ''} sur 20 requises pour RSI, MACD et moyennes mobiles.
          </p>
          <pre className="text-xs font-mono bg-surface border border-border rounded px-3 py-2 text-up select-all overflow-x-auto">
            npm run backfill -- {code} --from=2023-01-01
          </pre>
        </div>
      )}

      {/* ── Graphique ── */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <span className="text-xs text-muted uppercase tracking-widest">
            Cours ({rows.length} séance{rows.length > 1 ? 's' : ''})
          </span>
          <div className="flex gap-1">
            {([
              { label: '3M', from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) },
              { label: '6M', from: new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10) },
              { label: '1A', from: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10) },
              { label: '2A', from: new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10) },
              { label: 'Max', from: '' },
            ] as { label: string; from: string }[]).map(({ label, from }) => {
              const active = from === fromDate || (label === 'Max' && !fromDate);
              return (
                <a
                  key={label}
                  href={from ? `?from=${from}` : `?`}
                  className={`text-xs px-2.5 py-1 rounded-chip border transition-colors ${
                    active
                      ? 'border-up/60 text-up bg-up/10'
                      : 'border-border text-faint hover:border-border hover:text-muted'
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
        <PriceChart data={priceData} designation={instrument?.designation ?? last.designation ?? code} />
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/30">
          {[
            { label: 'MA20', val: lastMa20, color: 'text-warn' },
            { label: 'MA50', val: lastMa50, color: 'text-blue' },
            { label: 'MA200', val: lastMa200, color: 'text-purple' },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center">
              <div className={`text-[11px] font-medium ${color} mb-0.5`}>{label}</div>
              <div className="tabular text-sm font-medium">{val != null ? fmtNumber(val) : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Configuration technique ── */}
      <TechnicalSummary result={technicalSummary} />

      {/* ── Indicateurs + Détections ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Indicateurs */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-widest mb-4">Indicateurs</p>
          {/* RSI */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted">RSI (14)</span>
              <span className={`tabular font-semibold font-mono ${
                lastRsi == null ? 'text-faint' :
                lastRsi < 30 ? 'text-up' :
                lastRsi > 70 ? 'text-down' : 'text-white'
              }`}>
                {lastRsi != null ? lastRsi.toFixed(0) : '—'}
              </span>
            </div>
            <div className="relative h-1.5 bg-border rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-up/20" />
              <div className="absolute right-0 top-0 bottom-0 w-[30%] bg-down/20" />
              {lastRsi != null && (
                <RsiCursor rsi={lastRsi} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-faint mt-1">
              <span>Survente &lt;30</span><span>Surachat &gt;70</span>
            </div>
          </div>
          {/* MACD */}
          {lastMacd && (
            <div className="border-t border-border/30 pt-4">
              <p className="text-xs text-muted mb-2">MACD</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div>
                  <div className="text-faint text-[11px] mb-0.5">Ligne</div>
                  <div className="tabular font-mono">{lastMacd.macd?.toFixed(0) ?? '—'}</div>
                </div>
                <div>
                  <div className="text-faint text-[11px] mb-0.5">Signal</div>
                  <div className="tabular font-mono">{lastMacd.signal?.toFixed(0) ?? '—'}</div>
                </div>
                <div>
                  <div className="text-faint text-[11px] mb-0.5">Histog.</div>
                  <div className={`tabular font-mono font-semibold ${(lastMacd.hist ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                    {lastMacd.hist != null ? (lastMacd.hist >= 0 ? '+' : '') + lastMacd.hist.toFixed(0) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Détections */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-widest mb-4">Détections actives</p>
          <div className="space-y-2">
            {detections.map((d) => (
              <div key={d.label} className="flex items-center gap-2.5 text-xs">
                <span className={`text-[10px] font-bold w-3 text-center shrink-0 ${d.ok ? 'text-up' : 'text-faint'}`}>
                  {d.ok ? '●' : '○'}
                </span>
                <span className={d.ok ? 'text-white' : 'text-faint'}>{d.label}</span>
              </div>
            ))}
            {detections.every((d) => !d.ok) && (
              <p className="text-xs text-faint italic">Aucune détection active.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Signal du jour ── */}
      {signal ? (
        <SignalPanel signal={signal} />
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">Signal du jour</p>
          <p className="text-xs text-faint">Aucun signal calculé pour cette séance.</p>
        </div>
      )}

      {/* ── Fondamentaux (analyse complète style T212) ── */}
      {fundamentals.length > 0 && (() => {
        // Meilleur exercice : le plus récent dont les données sont plausibles.
        const latest = pickBestFundamental(fundamentals)!;
        const closes = rows.map((r) => r.cours_jour).filter((c): c is number => c != null);
        const range52 = {
          low: closes.length ? Math.min(...closes) : null,
          high: closes.length ? Math.max(...closes) : null,
          current: last.cours_jour ?? null,
        };
        return (
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
              // Croissance : ne comparer que des exercices de même source (manuel vs auto).
              .filter((f) => (f.is_manual ?? false) === (latest.is_manual ?? false))
              .map((f) => ({ year: f.year ?? 0, revenue: f.revenue, net_income: f.net_income }))}
            sourceUrl={null}
            range52={range52}
          />
        );
      })()}

      {/* ── Dividendes + Événements ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dividendes */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-widest mb-4">Dividendes</p>
          {lastDiv ? (
            <div className="space-y-0">
              <Row label="Rendement estimé" value={divYield != null ? divYield.toFixed(2) + ' %' : '—'} highlight />
              <Row label="Montant" value={fmtNumber(lastDiv.montant) + ' FCFA'} />
              <Row label="Ex-date" value={lastDiv.ex_date ?? '—'} />
              {lastDiv.payment_date && <Row label="Paiement" value={lastDiv.payment_date} />}
              <p className="text-[10px] text-faint pt-2">Rendement calculé sur le cours actuel</p>
            </div>
          ) : (
            <p className="text-xs text-faint italic">Aucun dividende enregistré.</p>
          )}
        </div>

        {/* Événements */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-widest mb-4">Événements récents</p>
          {events.length > 0 ? (
            <div className="space-y-3">
              {(events as { id: string; title: string; event_date: string; event_type: string; sentiment?: string }[]).map((e) => (
                <div key={e.id} className="border-b border-border/30 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-faint">{e.event_date}</span>
                    <span className="text-[10px] border border-border/60 rounded px-1.5 py-px text-faint">{e.event_type}</span>
                  </div>
                  <p className="text-xs text-white/80 line-clamp-2 mb-1">{e.title}</p>
                  <Link href={`/dashboard/reports/events/${e.id}`} className="text-[11px] text-up hover:underline">Lire →</Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-faint italic">Aucun événement récent.</p>
          )}
        </div>
      </div>

      {/* ── Graphiques indicateurs ── */}
      <IndicatorCharts data={indicatorData} />

      {/* ── Actions rapides ── */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs text-muted uppercase tracking-widest mb-4">Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: '/portefeuille', label: 'Ajouter à la watchlist' },
            { href: '/portefeuille', label: 'Créer une alerte prix' },
            { href: `/api/export/actions/${code}`, label: 'Exporter CSV', external: true },
            { href: `/backtest?code=${code}`, label: 'Lancer un backtest' },
          ].map(({ href, label, external }) =>
            external ? (
              <a key={label} href={href} className="text-xs border border-border rounded-lg px-3 py-2.5 text-muted hover:border-border hover:text-white transition-colors">
                {label}
              </a>
            ) : (
              <Link key={label} href={href} className="text-xs border border-border rounded-lg px-3 py-2.5 text-muted hover:border-border hover:text-white transition-colors">
                {label}
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <div className="text-[11px] text-faint mb-0.5">{label}</div>
      <div className="tabular text-sm font-medium font-mono">{value}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`tabular text-xs font-mono ${highlight ? 'text-up font-semibold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function SignalPanel({ signal }: { signal: SignalDaily }) {
  const subScores = (signal as SignalDaily & { inputs?: Record<string, number> | null }).inputs ?? null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-xs text-muted uppercase tracking-widest">Signal du jour</p>
        <SignalBadge signal={signal.signal} confiance={signal.confiance} />
        <span className="ml-auto tabular text-[11px] text-faint font-mono">
          {signal.score_total != null ? (signal.score_total >= 0 ? '+' : '') + signal.score_total.toFixed(2) : '—'} / 1.00
          {' · '}{signal.date_marche}
        </span>
      </div>

      <p className="text-sm text-muted mb-4 leading-relaxed">{signal.explication ?? 'Signal calculé automatiquement.'}</p>

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
            <p className="text-[11px] text-faint uppercase tracking-wider mb-2">Sous-scores</p>
            <div className="space-y-1.5">
              {subScoreRows.map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-muted font-mono">{label}</span>
                  <span className={`tabular font-mono font-semibold ${(val as number) >= 0 ? 'text-up' : 'text-down'}`}>
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
            <p className="text-[11px] text-faint uppercase tracking-wider mb-2">Indicateurs utilisés</p>
            <div className="space-y-1.5">
              {entries.slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-muted font-mono">{k}</span>
                  <span className="tabular font-mono text-faint">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <Link href="/signaux" className="text-xs text-up hover:underline transition-opacity opacity-80 hover:opacity-100">
        Voir tous les signaux →
      </Link>
    </div>
  );
}
