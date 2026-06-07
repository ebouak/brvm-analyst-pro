import { createClient } from '@/lib/supabase/server';
import ActionsTable from '@/components/ActionsTable';
import type { ActionDaily, SignalDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marché Actions' };

async function getData() {
  const supabase = createClient();
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, actions: [], signals: {} as Record<string, SignalDaily> };

  const [{ data: actions }, { data: signals }, { data: instruments }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase.from('brvm_instruments').select('code, secteur, pays').eq('type', 'action'),
  ]);

  // Enrichit chaque ligne daily avec le secteur/pays de brvm_instruments (source de vérité)
  const instrMap: Record<string, { secteur: string | null; pays: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null; pays: string | null }[]) {
    instrMap[i.code] = { secteur: i.secteur, pays: i.pays };
  }
  const enrichedActions = ((actions ?? []) as ActionDaily[]).map((a) => ({
    ...a,
    secteur: instrMap[a.code]?.secteur ?? a.secteur ?? null,
    pays: instrMap[a.code]?.pays ?? a.pays ?? null,
  }));

  const sigMap: Record<string, SignalDaily> = {};
  for (const s of (signals ?? []) as SignalDaily[]) sigMap[s.code] = s;

  return {
    lastDate,
    actions: enrichedActions,
    signals: sigMap,
  };
}

export default async function ActionsPage() {
  const { lastDate, actions, signals } = await getData();

  if (!lastDate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Marché actions</h1>
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucune donnée. Lancez le scraper pour alimenter la base.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Marché actions</h1>
        <div className="flex items-center gap-3">
          <a href="/actions/compare" className="text-xs text-up hover:underline">
            Comparer des titres →
          </a>
          <p className="text-xs text-muted">
            Séance : <span className="tabular">{lastDate}</span> ·{' '}
            {actions.length} titres
          </p>
        </div>
      </div>
      <ActionsTable actions={actions} signals={signals} />
    </div>
  );
}
