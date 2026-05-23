import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PriceChart, { type PricePoint } from '@/components/PriceChart';
import IndicatorCharts, { type IndicatorPoint } from '@/components/IndicatorCharts';
import SignalBadge from '@/components/SignalBadge';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { smaSeries, rsiSeries, macdSeries, detect } from '@/lib/indicators';
import type { ActionDaily, SignalDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';

const HISTORY = 250;

async function getInstrument(code: string) {
  const supabase = createClient();
  const [{ data: hist }, { data: instr }, { data: sig }] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('*')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(HISTORY),
    supabase.from('brvm_instruments').select('*').eq('code', code).maybeSingle(),
    supabase
      .from('signals_daily')
      .select('*')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(1),
  ]);

  const rows = ((hist ?? []) as ActionDaily[]).reverse(); // ancien -> récent
  return {
    rows,
    instrument: instr as { designation?: string; secteur?: string; pays?: string } | null,
    signal: (sig?.[0] ?? null) as SignalDaily | null,
  };
}

export default async function InstrumentPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);
  const { rows, instrument, signal } = await getInstrument(code);

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <Link href="/actions" className="text-sm text-up">← Marché actions</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucun historique pour {code}.
        </div>
      </div>
    );
  }

  const closes = rows.map((r) => r.cours_jour ?? 0);
  const ma20 = smaSeries(closes, 20);
  const ma50 = smaSeries(closes, 50);
  const ma200 = smaSeries(closes, 200);
  const rsiS = rsiSeries(closes, 14);
  const macdS = macdSeries(closes);
  const det = detect(closes);

  const priceData: PricePoint[] = rows.map((r, i) => ({
    date: r.date_marche,
    close: r.cours_jour,
    ma20: ma20[i],
    ma50: ma50[i],
    ma200: ma200[i],
    volume: r.volume,
  }));
  const indicatorData: IndicatorPoint[] = rows.map((r, i) => ({
    date: r.date_marche,
    rsi: rsiS[i],
    macd: macdS[i]?.macd ?? null,
    signal: macdS[i]?.signal ?? null,
    hist: macdS[i]?.hist ?? null,
  }));

  const last = rows[rows.length - 1]!;
  const up = (last.variation_pct ?? 0) >= 0;
  const lastRsi = rsiS[rsiS.length - 1];

  const badges: { label: string; cls: string }[] = [];
  if (det.oversold) badges.push({ label: 'Survente (RSI<30)', cls: 'text-up border-up/40 bg-up/10' });
  if (det.overbought) badges.push({ label: 'Surachat (RSI>70)', cls: 'text-down border-down/40 bg-down/10' });
  if (det.goldenCross) badges.push({ label: 'Croisement haussier MA20/MA50', cls: 'text-up border-up/40 bg-up/10' });
  if (det.deathCross) badges.push({ label: 'Croisement baissier MA20/MA50', cls: 'text-down border-down/40 bg-down/10' });
  if (det.breakoutUp) badges.push({ label: 'Cassure haussière (20j)', cls: 'text-up border-up/40 bg-up/10' });
  if (det.breakoutDown) badges.push({ label: 'Cassure baissière (20j)', cls: 'text-down border-down/40 bg-down/10' });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/actions" className="text-xs text-up">← Marché actions</Link>
          <h1 className="text-2xl font-semibold mt-1">
            {code} <span className="text-base text-muted font-normal">{instrument?.designation ?? last.designation}</span>
          </h1>
          <p className="text-xs text-muted">
            {[instrument?.secteur ?? last.secteur, instrument?.pays ?? last.pays].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <div className="tabular text-2xl">{fmtNumber(last.cours_jour)}</div>
          <div className={`tabular text-sm ${up ? 'text-up' : 'text-down'}`}>
            {up ? '+' : ''}{(last.variation_pct ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.label} className={`text-xs border rounded px-2 py-1 ${b.cls}`}>{b.label}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <Metric label="Cours veille" value={fmtNumber(last.cours_precedent)} />
        <Metric label="Volume" value={fmtNumber(last.volume)} />
        <Metric label="Valeur" value={fmtFcfa(last.valeur_echangee) + ' FCFA'} />
        <Metric label="RSI(14)" value={lastRsi != null ? lastRsi.toFixed(0) : '—'} />
        <Metric label="Séances" value={String(rows.length)} />
      </div>

      <PriceChart data={priceData} />
      <IndicatorCharts data={indicatorData} />

      {signal && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-semibold">Pourquoi ce signal ?</h3>
            <SignalBadge signal={signal.signal} confiance={signal.confiance} />
            <span className="text-xs text-muted tabular ml-auto">
              score {signal.score_total?.toFixed(2)} · {signal.date_marche}
            </span>
          </div>
          <p className="text-sm text-muted">{signal.explication ?? 'Pas d’explication enregistrée.'}</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-base mt-0.5">{value}</div>
    </div>
  );
}
