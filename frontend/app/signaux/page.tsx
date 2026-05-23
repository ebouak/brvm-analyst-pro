import { createClient } from '@/lib/supabase/server';
import SignalsTable, { type SignalRow } from '@/components/SignalsTable';
import type { ActionDaily, SignalDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getData() {
  const supabase = createClient();
  const { data: lastRow } = await supabase
    .from('signals_daily').select('date_marche')
    .order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as SignalRow[] };

  const [{ data: signals }, { data: actions }] = await Promise.all([
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase.from('brvm_actions_daily').select('code, designation, cours_jour, variation_pct').eq('date_marche', lastDate),
  ]);

  const actMap: Record<string, ActionDaily> = {};
  for (const a of (actions ?? []) as ActionDaily[]) actMap[a.code] = a;

  const rows: SignalRow[] = ((signals ?? []) as SignalDaily[]).map((s) => ({
    ...s,
    designation: actMap[s.code]?.designation ?? null,
    cours_jour: actMap[s.code]?.cours_jour ?? null,
    variation_pct: actMap[s.code]?.variation_pct ?? null,
  }));
  return { lastDate, rows };
}

export default async function SignauxPage() {
  const { lastDate, rows } = await getData();

  if (!lastDate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Signaux</h1>
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucun signal généré. Lancez <code className="text-up">npm run score</code> (ou <code className="text-up">score:mock</code>) côté scraper.
        </div>
      </div>
    );
  }

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.signal] = (acc[r.signal] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Signaux d’investissement</h1>
        <p className="text-xs text-muted">Séance : <span className="tabular">{lastDate}</span></p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-md">
        <Stat label="Achat" value={counts.BUY ?? 0} cls="text-up" />
        <Stat label="Conserver" value={counts.HOLD ?? 0} cls="text-muted" />
        <Stat label="Vendre" value={counts.SELL ?? 0} cls="text-down" />
      </div>

      <SignalsTable rows={rows} />
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-center">
      <div className={`tabular text-2xl ${cls}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
