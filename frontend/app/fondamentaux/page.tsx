import { createClient } from '@/lib/supabase/server';
import { computeRatios } from '@/lib/fundamentals';
import FundamentalsTable, { type ScreenerRow } from '@/components/fundamentals/FundamentalsTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyse fondamentale' };

async function getData(): Promise<ScreenerRow[]> {
  const sb = createClient();
  const [{ data: instruments }, { data: funds }, { data: quotes }, { data: divs }] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, shares').eq('type', 'action').eq('actif', true),
    sb.from('fundamentals').select('code, year, revenue, net_income, equity, debt, is_manual').order('is_manual', { ascending: false }).order('year', { ascending: false }),
    sb.from('brvm_actions_daily').select('code, cours_jour, date_marche').order('date_marche', { ascending: false }),
    sb.from('dividends').select('code, montant, ex_date').order('ex_date', { ascending: false }),
  ]);

  const lastCours: Record<string, number | null> = {};
  for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) if (!(q.code in lastCours)) lastCours[q.code] = q.cours_jour;
  const lastFund: Record<string, { revenue: number | null; net_income: number | null; equity: number | null; debt: number | null }> = {};
  for (const f of (funds ?? []) as { code: string; revenue: number | null; net_income: number | null; equity: number | null; debt: number | null }[]) if (!(f.code in lastFund)) lastFund[f.code] = f;
  const lastDiv: Record<string, number | null> = {};
  for (const d of (divs ?? []) as { code: string; montant: number | null }[]) if (!(d.code in lastDiv)) lastDiv[d.code] = d.montant;

  return ((instruments ?? []) as { code: string; designation: string | null; secteur: string | null; shares: number | null }[]).map((ins) => {
    const f = lastFund[ins.code] ?? { revenue: null, net_income: null, equity: null, debt: null };
    const r = computeRatios({ cours: lastCours[ins.code] ?? null, shares: ins.shares, revenue: f.revenue, net_income: f.net_income, equity: f.equity, debt: f.debt, dividende: lastDiv[ins.code] ?? null });
    return { code: ins.code, designation: ins.designation, secteur: ins.secteur, per: r.per, pb: r.pb, roe: r.roe, margeNette: r.margeNette, rendementDiv: r.rendementDiv };
  });
}

export default async function FondamentauxPage() {
  const rows = await getData();
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">🏦 Analyse fondamentale</h1>
        <p className="text-sm text-muted">Ratios clés des 48 actions BRVM — triez et filtrez par secteur.</p>
      </div>
      <FundamentalsTable rows={rows} />
    </div>
  );
}
