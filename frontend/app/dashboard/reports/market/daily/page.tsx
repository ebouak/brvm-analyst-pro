import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import EventTimeline from '@/components/EventTimeline';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import type { ActionDaily, IndiceDaily, MarketEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getDaily(date?: string) {
  const supabase = createClient();
  let d = date ?? null;
  if (!d) {
    const { data } = await supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    d = data?.[0]?.date_marche ?? null;
  }
  if (!d) return null;
  const [{ data: actions }, { data: indices }, { data: events }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', d),
    supabase.from('brvm_indices_daily').select('*').eq('date_marche', d),
    supabase.from('market_events').select('*').eq('event_date', d).order('importance_level', { ascending: false }),
  ]);
  return {
    date: d,
    actions: (actions ?? []) as ActionDaily[],
    indices: (indices ?? []) as IndiceDaily[],
    events: (events ?? []) as MarketEvent[],
  };
}

export default async function MarketDailyPage({ searchParams }: { searchParams: { date?: string } }) {
  const data = await getDaily(searchParams.date);
  if (!data) {
    return (
      <div className="p-6">
        <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-8 text-center text-muted">Aucune donnée.</div>
      </div>
    );
  }
  const { date, actions, indices, events } = data;
  const withVar = actions.filter((a) => a.variation_pct != null);
  const vals = withVar.map((a) => a.variation_pct!);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const trend = avg > 0.2 ? 'Haussier' : avg < -0.2 ? 'Baissier' : 'Neutre';
  const trendCls = avg > 0.2 ? 'text-up' : avg < -0.2 ? 'text-down' : 'text-muted';
  const adv = withVar.filter((a) => (a.variation_pct ?? 0) > 0).length;
  const dec = withVar.filter((a) => (a.variation_pct ?? 0) < 0).length;
  const sorted = [...withVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0));
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();
  const active = [...actions].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, 5);

  const Movers = ({ title, rows }: { title: string; rows: ActionDaily[] }) => (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {rows.map((a) => {
        const up = (a.variation_pct ?? 0) >= 0;
        return (
          <div key={a.code} className="flex justify-between py-1 text-sm border-b border-border/40 last:border-0">
            <Link href={`/dashboard/reports/instrument/${a.code}`} className="hover:text-up">{a.code}</Link>
            <span className={`tabular ${up ? 'text-up' : 'text-down'}`}>{up ? '+' : ''}{(a.variation_pct ?? 0).toFixed(2)}%</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
          <h1 className="text-2xl font-semibold mt-1">Rapport marché — {date}</h1>
          <p className="text-sm">État : <span className={trendCls}>{trend}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {indices.map((i) => (
          <div key={i.code} className="bg-surface border border-border rounded-xl p-4">
            <div className="text-xs text-muted">{i.libelle ?? i.code}</div>
            <div className="tabular text-xl">{fmtNumber(i.valeur, 2)}</div>
            <div className={`tabular text-sm ${(i.variation_pct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
              {(i.variation_pct ?? 0) >= 0 ? '+' : ''}{(i.variation_pct ?? 0).toFixed(2)}%
            </div>
          </div>
        ))}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted">Volume / Valeur</div>
          <div className="tabular text-sm mt-1">{fmtFcfa(actions.reduce((s, a) => s + (a.volume ?? 0), 0))}</div>
          <div className="tabular text-sm text-muted">{fmtFcfa(actions.reduce((s, a) => s + (a.valeur_echangee ?? 0), 0))} FCFA</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted">Breadth</div>
          <div className="tabular text-sm mt-1"><span className="text-up">{adv}</span> / <span className="text-down">{dec}</span></div>
          <div className="text-xs text-muted">hausses / baisses</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Movers title="Top 5 hausses" rows={gainers} />
        <Movers title="Top 5 baisses" rows={losers} />
        <Movers title="Plus actifs (valeur)" rows={active} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Événements marquants du jour</h3>
        <EventTimeline events={events} />
      </div>
    </div>
  );
}
