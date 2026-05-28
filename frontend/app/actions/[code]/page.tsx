import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PriceChart, { type PricePoint } from '@/components/PriceChart';
import IndicatorCharts, { type IndicatorPoint } from '@/components/IndicatorCharts';
import RsiCursor from '@/components/RsiCursor';
import SignalBadge from '@/components/SignalBadge';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { smaSeries, rsiSeries, macdSeries, detect } from '@/lib/indicators';
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

  const [{ data: hist }, { data: instr }, { data: sig }, { data: divs }, { data: evts }] =
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
    ]);

  return {
    rows: ((hist ?? []) as ActionDaily[]).reverse(),
    instrument: instr as { designation?: string; secteur?: string; pays?: string; type?: string } | null,
    signal: (sig?.[0] ?? null) as SignalDaily | null,
    dividends: divs ?? [],
    events: evts ?? [],
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
  const { rows, instrument, signal, dividends, events } = await getData(code, fromDate || undefined);

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
    <div className="p-5 space-y-4 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/actions" className="text-muted hover:text-up text-sm">← Retour</Link>
          <span className="text-muted text-sm">•</span>
          <h1 className="text-xl font-bold">{code}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/portefeuille" className="text-xs border border-border rounded px-2 py-1 hover:border-up/40 hover:text-up transition">
            🔖 Watchlist
          </Link>
          <Link href="/portefeuille" className="text-xs border border-border rounded px-2 py-1 hover:border-up/40 hover:text-up transition">
            ⚙️ Alertes
          </Link>
        </div>
      </div>

      {/* ── Info société ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="font-semibold">{instrument?.designation ?? last.designation ?? code}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {pays && <span className="text-xs border border-border rounded-full px-2 py-0.5 text-muted">{pays}</span>}
          {secteur && <span className="text-xs border border-border rounded-full px-2 py-0.5 text-muted">📡 {secteur}</span>}
          <span className="text-xs border border-border rounded-full px-2 py-0.5 text-muted">📈 Action</span>
        </div>
      </div>

      {/* ── Cotation ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-xs text-muted mb-2">💰 Cotation du {last.date_marche}</div>
        <div className="flex items-end gap-3 mb-3">
          <span className="tabular text-3xl font-bold">{fmtNumber(last.cours_jour)} FCFA</span>
          {varAbs != null && (
            <span className={`tabular text-base font-medium pb-0.5 ${up ? 'text-up' : 'text-down'}`}>
              {up ? '▲' : '▼'} {up ? '+' : ''}{fmtNumber(varAbs)} FCFA ({up ? '+' : ''}{(last.variation_pct ?? 0).toFixed(2)}%)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t border-border/50 pt-3">
          <Metric label="Volume" value={fmtNumber(last.volume) + ' titres'} />
          <Metric label="Valeur échangée" value={fmtFcfa(last.valeur_echangee) + ' FCFA'} />
          <Metric label="Transactions" value={fmtNumber(last.nb_transactions)} />
          <Metric label="Clôture préc." value={fmtNumber(last.cours_precedent) + ' FCFA'} />
        </div>
      </div>

      {/* ── Bannière données insuffisantes ── */}
      {rows.length < 20 && (
        <div className="border border-warn/30 bg-warn/5 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs text-warn">
            ⚠️ Seulement {rows.length} séance{rows.length > 1 ? 's' : ''} disponible{rows.length > 1 ? 's' : ''} —
            RSI, MACD et moyennes mobiles nécessitent au minimum 20 séances.
          </p>
          <p className="text-xs text-muted">Pour enrichir l&apos;historique, lancez dans <code className="font-mono bg-surface px-1 rounded">scraper/</code> :</p>
          <pre className="text-xs font-mono bg-surface border border-border rounded px-3 py-2 text-up select-all overflow-x-auto">
            npm run backfill -- {code} --from=2023-01-01
          </pre>
        </div>
      )}

      {/* ── Graphique ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">
            📈 Graphique ({rows.length} séance{rows.length > 1 ? 's' : ''})
          </h3>
          {/* Filtres période rapides */}
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
                  className={`text-xs px-2 py-0.5 rounded border transition ${
                    active
                      ? 'border-up text-up'
                      : 'border-border text-muted hover:border-up/40 hover:text-up'
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
        <PriceChart data={priceData} designation={instrument?.designation ?? last.designation ?? code} />
        {/* Légende MA */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-border/50">
          {[
            { label: 'MA20', val: lastMa20, color: 'text-yellow-400' },
            { label: 'MA50', val: lastMa50, color: 'text-blue-400' },
            { label: 'MA200', val: lastMa200, color: 'text-purple-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center">
              <div className={`text-xs font-medium ${color}`}>{label}</div>
              <div className="tabular text-sm">{val != null ? fmtNumber(val) : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Indicateurs + Détections ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Indicateurs */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">🎯 Indicateurs</h3>
          {/* RSI */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted">RSI (14)</span>
              <span className={`tabular font-medium ${
                lastRsi == null ? 'text-muted' :
                lastRsi < 30 ? 'text-up' :
                lastRsi > 70 ? 'text-down' : 'text-white'
              }`}>
                {lastRsi != null ? lastRsi.toFixed(0) : '—'}
              </span>
            </div>
            <div className="relative h-2 bg-border rounded-full overflow-hidden">
              {/* Zones survente (30% gauche) et surachat (30% droite) — largeurs fixes */}
              <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-up/30 rounded-full" />
              <div className="absolute right-0 top-0 bottom-0 w-[30%] bg-down/30 rounded-full" />
              {/* Curseur RSI — position dynamique, inline style inévitable */}
              {lastRsi != null && (
                <RsiCursor rsi={lastRsi} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-0.5">
              <span>Survente 30</span><span>Surachat 70</span>
            </div>
          </div>
          {/* MACD */}
          {lastMacd && (
            <div className="border-t border-border/50 pt-3">
              <div className="text-xs text-muted mb-1">MACD</div>
              <div className="grid grid-cols-3 gap-1 text-xs text-center">
                <div>
                  <div className="text-muted">Ligne</div>
                  <div className="tabular">{lastMacd.macd?.toFixed(0) ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted">Signal</div>
                  <div className="tabular">{lastMacd.signal?.toFixed(0) ?? '—'}</div>
                </div>
                <div>
                  <div className="text-muted">Hist.</div>
                  <div className={`tabular ${(lastMacd.hist ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                    {lastMacd.hist != null ? (lastMacd.hist >= 0 ? '+' : '') + lastMacd.hist.toFixed(0) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Détections */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">🔍 Détections</h3>
          <div className="space-y-1.5">
            {detections.map((d) => (
              <div key={d.label} className="flex items-center gap-2 text-xs">
                <span className={d.ok ? 'text-up' : 'text-muted'}>
                  {d.ok ? '✓' : '○'}
                </span>
                <span className={d.ok ? 'text-white' : 'text-muted'}>{d.label}</span>
              </div>
            ))}
            {detections.every((d) => !d.ok) && (
              <p className="text-xs text-muted">Aucune détection technique active.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Signal du jour ── */}
      {signal ? (
        <SignalPanel signal={signal} />
      ) : (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-1">🎯 Signal du jour</h3>
          <p className="text-xs text-muted">Aucun signal calculé pour cette séance.</p>
        </div>
      )}

      {/* ── Dividendes + Événements ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Dividendes */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">📊 Dividendes</h3>
          {lastDiv ? (
            <div className="space-y-1 text-sm">
              <Row label="Rendement" value={divYield != null ? divYield.toFixed(2) + '%*' : '—'} highlight />
              <Row label="Montant" value={fmtNumber(lastDiv.montant) + ' FCFA'} />
              <Row label="Ex-date" value={lastDiv.ex_date ?? '—'} />
              {lastDiv.payment_date && <Row label="Paiement" value={lastDiv.payment_date} />}
              <p className="text-[10px] text-muted mt-2">*Estimé sur la base du cours actuel</p>
            </div>
          ) : (
            <p className="text-xs text-muted">Aucun dividende enregistré.</p>
          )}
        </div>

        {/* Événements */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">📰 Événements</h3>
          {events.length > 0 ? (
            <div className="space-y-2">
              {(events as { id: string; title: string; event_date: string; event_type: string; sentiment?: string }[]).map((e) => (
                <div key={e.id} className="text-xs border-b border-border/40 pb-2 last:border-0">
                  <span className="text-muted">{e.event_date}</span>
                  <span className="text-[10px] border border-border rounded px-1 py-0.5 ml-2 text-muted">{e.event_type}</span>
                  <p className="text-white/80 mt-0.5 line-clamp-2">{e.title}</p>
                  <Link href={`/dashboard/reports/events/${e.id}`} className="text-up hover:underline">📄 Lire →</Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Aucun événement récent.</p>
          )}
        </div>
      </div>

      {/* ── Graphiques indicateurs ── */}
      <IndicatorCharts data={indicatorData} />

      {/* ── Actions rapides ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">⚡ Actions rapides</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/portefeuille" className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:border-up/40 hover:text-up transition">
            🔖 Ajouter à la watchlist
          </Link>
          <Link href="/portefeuille" className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:border-up/40 hover:text-up transition">
            🔔 Créer une alerte prix
          </Link>
          <a
            href={`/api/export/actions/${code}`}
            className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:border-up/40 hover:text-up transition"
          >
            📥 Exporter les données (CSV)
          </a>
          <Link href={`/backtest?code=${code}`} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:border-up/40 hover:text-up transition">
            🧪 Lancer un backtest
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`tabular text-xs ${highlight ? 'text-up font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

function SignalPanel({ signal }: { signal: SignalDaily }) {
  const subScores = (signal as SignalDaily & { inputs?: Record<string, number> | null }).inputs ?? null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold">🎯 Signal du jour</h3>
        <SignalBadge signal={signal.signal} confiance={signal.confiance} />
        <span className="ml-auto tabular text-xs text-muted">
          Score {signal.score_total != null ? (signal.score_total >= 0 ? '+' : '') + signal.score_total.toFixed(2) : '—'} / 1.00
          {' · '}{signal.date_marche}
        </span>
      </div>

      {/* Explication */}
      <div className="border border-border/60 rounded-lg p-3 mb-3">
        <p className="text-sm text-muted mb-2">{signal.explication ?? 'Signal calculé automatiquement.'}</p>

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
            <div className="border-t border-border/50 pt-2 mt-2">
              <p className="text-xs text-muted mb-1.5">Sous-scores :</p>
              <div className="space-y-1">
                {subScoreRows.map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{label}</span>
                    <span className={`tabular font-mono ${(val as number) >= 0 ? 'text-up' : 'text-down'}`}>
                      {(val as number) >= 0 ? '+' : ''}{(val as number).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* Indicateurs bruts (inputs JSON) — seulement les valeurs non-null */}
        {subScores && (() => {
          const entries = Object.entries(subScores).filter(([, v]) => v != null);
          if (entries.length === 0) return null;
          return (
            <div className="border-t border-border/50 pt-2 mt-2">
              <p className="text-xs text-muted mb-1.5">Indicateurs utilisés :</p>
              <div className="space-y-1">
                {entries.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{k}</span>
                    <span className="tabular text-white/60">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      <Link href="/signaux" className="text-xs text-up hover:underline">
        ❓ Voir tous les signaux →
      </Link>
    </div>
  );
}
