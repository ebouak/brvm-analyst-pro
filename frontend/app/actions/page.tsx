import { createClient } from '@/lib/supabase/server';
import ActionsTable from '@/components/ActionsTable';
import type { ActionDaily, SignalDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getData() {
  const supabase = createClient();
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, actions: [], signals: {} as Record<string, SignalDaily> };

  const [{ data: actions }, { data: signals }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
  ]);

  const sigMap: Record<string, SignalDaily> = {};
  for (const s of (signals ?? []) as SignalDaily[]) sigMap[s.code] = s;

  return {
    lastDate,
    actions: (actions ?? []) as ActionDaily[],
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
