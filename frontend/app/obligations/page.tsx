import { createClient } from '@/lib/supabase/server';
import ObligationsTable, { type ObligationRow } from '@/components/ObligationsTable';
import YieldCurveChart, { type CurvePoint } from '@/components/YieldCurveChart';
import YieldComparison, { type DividendYield } from '@/components/YieldComparison';
import { yieldToMaturity, durations, yearsTo } from '@/lib/bonds';
import type { ObligationDaily, Dividend } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Obligations' };

async function getData() {
  const supabase = createClient();
  const { data: lastRow } = await supabase
    .from('brvm_obligations_daily').select('date_marche')
    .order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as ObligationRow[], dividendYields: [] as DividendYield[], avgBondYtm: null };

  const { data } = await supabase.from('brvm_obligations_daily').select('*').eq('date_marche', lastDate);
  const obls = (data ?? []) as ObligationDaily[];

  const rows: ObligationRow[] = obls.map((o) => {
    const years = yearsTo(o.maturite);
    let ytm: number | null = null;
    let modDur: number | null = null;
    if (o.cours_jour != null && o.taux_pct != null && years != null) {
      ytm = yieldToMaturity({ prix: o.cours_jour, couponRatePct: o.taux_pct, yearsToMaturity: years });
      if (ytm != null) {
        const d = durations({ prix: o.cours_jour, couponRatePct: o.taux_pct, yearsToMaturity: years }, ytm);
        modDur = d?.modified ?? null;
      }
    }
    return {
      code: o.code, designation: o.designation, emetteur: o.emetteur,
      taux_pct: o.taux_pct, maturite: o.maturite, cours_jour: o.cours_jour,
      volume: o.volume, yearsToMaturity: years, ytm, modifiedDuration: modDur,
    };
  });
  // Rendement dividende des actions (dernier dividende connu / cours actuel).
  const { data: divData } = await supabase
    .from('dividends').select('code, montant, exercice').order('exercice', { ascending: false });
  const divByCode: Record<string, number> = {};
  for (const d of (divData ?? []) as { code: string; montant: number }[]) {
    if (!(d.code in divByCode)) divByCode[d.code] = d.montant; // le plus récent
  }
  const divCodes = Object.keys(divByCode);
  const dividendYields: DividendYield[] = [];
  if (divCodes.length > 0) {
    const { data: lastActRow } = await supabase
      .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const actDate = lastActRow?.[0]?.date_marche ?? null;
    if (actDate) {
      const { data: acts } = await supabase
        .from('brvm_actions_daily').select('code, designation, cours_jour').eq('date_marche', actDate).in('code', divCodes);
      for (const a of (acts ?? []) as { code: string; designation: string | null; cours_jour: number | null }[]) {
        const montant = divByCode[a.code]!;
        const rendementPct = a.cours_jour && a.cours_jour > 0 ? (montant / a.cours_jour) * 100 : null;
        dividendYields.push({ code: a.code, designation: a.designation, montant, cours: a.cours_jour, rendementPct });
      }
    }
  }

  const ytms = rows.map((r) => r.ytm).filter((y): y is number => y != null);
  const avgBondYtm = ytms.length ? ytms.reduce((x, y) => x + y, 0) / ytms.length : null;

  return { lastDate, rows, dividendYields, avgBondYtm };
}

export default async function ObligationsPage() {
  const { lastDate, rows, dividendYields, avgBondYtm } = await getData();

  if (!lastDate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Marché obligataire</h1>
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucune donnée obligataire. Lancez le scraper pour alimenter la base.
        </div>
      </div>
    );
  }

  // Points pour la courbe des taux (YTM vs maturité par émetteur).
  const curve: CurvePoint[] = rows
    .filter((r) => r.ytm != null && r.yearsToMaturity != null)
    .map((r) => ({ emetteur: r.emetteur ?? 'Autre', code: r.code, x: r.yearsToMaturity!, y: r.ytm! }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Marché obligataire</h1>
        <p className="text-xs text-muted">Séance : <span className="tabular">{lastDate}</span> · {rows.length} lignes</p>
      </div>

      {curve.length > 0 && <YieldCurveChart data={curve} />}

      <ObligationsTable rows={rows} />

      <YieldComparison avgBondYtm={avgBondYtm} dividendYields={dividendYields} />

      <p className="text-[11px] text-muted">
        YTM et duration modifiée calculés sous hypothèses (nominal 10 000 FCFA, coupon annuel) — voir docs/REPORTS.md.
        Le comparatif rendement obligataire vs rendement dividende des actions nécessite l’ingestion des dividendes
        (brique future §6.8) ; les YTM ci-dessus en fournissent déjà le côté obligataire.
      </p>
    </div>
  );
}
