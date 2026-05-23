import { createClient } from '@/lib/supabase/server';
import KpiCard from '@/components/KpiCard';
import TopMovers from '@/components/TopMovers';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import type { ActionDaily, IndiceDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

async function getData() {
  const supabase = createClient();

  // Dernière date de marché disponible.
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;

  if (!lastDate) {
    return { lastDate: null, actions: [], indices: [] as IndiceDaily[] };
  }

  const [{ data: actions }, { data: indices }] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('*')
      .eq('date_marche', lastDate),
    supabase
      .from('brvm_indices_daily')
      .select('*')
      .eq('date_marche', lastDate),
  ]);

  return {
    lastDate,
    actions: (actions ?? []) as ActionDaily[],
    indices: (indices ?? []) as IndiceDaily[],
  };
}

function marketState(actions: ActionDaily[]): {
  label: string;
  color: string;
} {
  const vals = actions
    .map((a) => a.variation_pct)
    .filter((v): v is number => v != null);
  if (vals.length === 0) return { label: 'Indéterminé', color: 'text-muted' };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg > 0.2) return { label: 'Haussier', color: 'text-up' };
  if (avg < -0.2) return { label: 'Baissier', color: 'text-down' };
  return { label: 'Neutre', color: 'text-muted' };
}

export default async function Dashboard() {
  const { lastDate, actions, indices } = await getData();

  if (!lastDate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucune donnée de marché pour le moment. Lancez le scraper
          (<code className="text-up">npm run scrape:daily</code> ou{' '}
          <code className="text-up">--mock</code>) pour alimenter la base.
        </div>
      </div>
    );
  }

  const withVar = actions.filter((a) => a.variation_pct != null);
  const gainers = [...withVar]
    .sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0))
    .slice(0, 5);
  const losers = [...withVar]
    .sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0))
    .slice(0, 5);

  const volumeTotal = actions.reduce((s, a) => s + (a.volume ?? 0), 0);
  const valeurTotale = actions.reduce((s, a) => s + (a.valeur_echangee ?? 0), 0);
  const txTotal = actions.reduce((s, a) => s + (a.nb_transactions ?? 0), 0);

  const brvm30 = indices.find((i) => i.code === 'BRVM30');
  const brvmc = indices.find((i) => i.code === 'BRVMC');
  const state = marketState(actions);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">
            État du marché :{' '}
            <span className={state.color}>{state.label}</span>
          </p>
        </div>
        <p className="text-xs text-muted">
          Dernière mise à jour : <span className="tabular">{lastDate}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="BRVM 30"
          value={fmtNumber(brvm30?.valeur ?? null, 2)}
          delta={brvm30?.variation_pct ?? null}
        />
        <KpiCard
          label="BRVM Composite"
          value={fmtNumber(brvmc?.valeur ?? null, 2)}
          delta={brvmc?.variation_pct ?? null}
        />
        {/* UX fix: suffix "FCFA" supprimé — fmtFcfa abrège déjà sans unité (12,3 M). */}
        <KpiCard label="Valeur échangée" value={fmtFcfa(valeurTotale)} />
        {/* UX fix: volume en titres (entiers), pas en FCFA — label et format corrigés. */}
        <KpiCard label="Volume (titres)" value={fmtNumber(volumeTotal)} />
        <KpiCard label="Transactions" value={fmtNumber(txTotal)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TopMovers title="Top 5 hausses" rows={gainers} />
        <TopMovers title="Top 5 baisses" rows={losers} />
      </div>
    </div>
  );
}
