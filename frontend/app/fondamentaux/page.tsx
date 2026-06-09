import { createClient } from '@/lib/supabase/server';
import { computeRatios, pickBestFundamental } from '@/lib/fundamentals';
import FundamentalsTable, { type ScreenerRow } from '@/components/fundamentals/FundamentalsTable';
import {
  SectionHeader,
  MetricCard,
  EmptyStatePremium,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyse fondamentale' };

async function getData(): Promise<ScreenerRow[]> {
  const sb = createClient();
  const [{ data: instruments }, { data: funds }, { data: quotes }, { data: divs }] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, shares').eq('type', 'action').eq('actif', true),
    sb.from('fundamentals').select('code, year, revenue, net_income, equity, debt, is_manual').order('year', { ascending: false }),
    sb.from('brvm_actions_daily').select('code, cours_jour, date_marche').order('date_marche', { ascending: false }),
    sb.from('dividends').select('code, montant, ex_date').order('ex_date', { ascending: false }),
  ]);

  const lastCours: Record<string, number | null> = {};
  for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) if (!(q.code in lastCours)) lastCours[q.code] = q.cours_jour;
  type FundDbRow = { code: string; year: number | null; revenue: number | null; net_income: number | null; equity: number | null; debt: number | null; is_manual: boolean | null };
  const byCode: Record<string, FundDbRow[]> = {};
  for (const f of (funds ?? []) as FundDbRow[]) (byCode[f.code] ??= []).push(f);
  const lastFund: Record<string, { revenue: number | null; net_income: number | null; equity: number | null; debt: number | null }> = {};
  for (const [code, list] of Object.entries(byCode)) {
    const best = pickBestFundamental(list);
    if (best) lastFund[code] = { revenue: best.revenue, net_income: best.net_income, equity: best.equity, debt: best.debt ?? null };
  }
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

  const withData = rows.filter((r) => r.per !== null || r.pb !== null || r.roe !== null);
  const withDiv = rows.filter((r) => r.rendementDiv !== null && (r.rendementDiv ?? 0) > 0);
  const avgROE = withData.length > 0
    ? withData.filter((r) => r.roe !== null).reduce((s, r) => s + (r.roe ?? 0), 0) / Math.max(1, withData.filter((r) => r.roe !== null).length)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <SectionHeader
        kicker="BRVM · Ratios fondamentaux"
        title="Analyse fondamentale"
        subtitle="PER, P/B, ROE, marge nette et rendement du dividende pour les actions cotées. Triez et filtrez par secteur."
      />

      {/* Gold rule */}
      <div className="gold-rule" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Actions couvertes"
          value={String(rows.length)}
          unit="titres"
          accent="gold"
        />
        <MetricCard
          label="Avec données fondamentales"
          value={String(withData.length)}
          unit="titres"
          accent="sapphire"
        />
        <MetricCard
          label="Versent un dividende"
          value={String(withDiv.length)}
          unit="titres"
          accent="emerald"
        />
        <MetricCard
          label="ROE moyen (univers)"
          value={avgROE !== null ? `${avgROE.toFixed(1)}%` : '—'}
          accent="neutral"
        />
      </div>

      {/* Table or empty state */}
      {rows.length === 0 ? (
        <EmptyStatePremium
          icon="◈"
          title="Aucune donnée fondamentale"
          hint="Lancez l'ingestion des fondamentaux via le scraper, ou vérifiez la connexion Supabase."
        />
      ) : (
        <div className="rounded-panel border border-border bg-surface shadow-card overflow-hidden">
          <FundamentalsTable rows={rows} />
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-faint italic text-center">
        Données issues des rapports annuels et communiqués officiels BRVM. Les ratios sont calculés sur le dernier exercice disponible.
      </p>
    </div>
  );
}
