import { createPublicClient } from '@/lib/supabase/public';
import ObligationsTable, { type ObligationRow } from '@/components/ObligationsTable';
import YieldCurveChart, { type CurvePoint } from '@/components/YieldCurveChart';
import YieldComparison, { type DividendYield } from '@/components/YieldComparison';
import { yieldToMaturity, durations, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import type { ObligationDaily, Dividend } from '@/lib/types';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  EmptyStatePremium,
  StatPill,
} from '@/components/ui/premium';

// Donnees marche publiques (RLS lecture publique), rafraichies toutes les 15 min
// par l'intraday : ISR 5 min (audit 2026-06-12).
export const revalidate = 300;
export const metadata = { title: 'Obligations' };

async function getData() {
  const supabase = createPublicClient();
  const { data: lastRow } = await supabase
    .from('brvm_obligations_daily').select('date_marche')
    .order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as ObligationRow[], dividendYields: [] as DividendYield[], avgBondYtm: null };

  const { data } = await supabase.from('brvm_obligations_daily').select('*').eq('date_marche', lastDate);
  const obls = (data ?? []) as ObligationDaily[];

  const rows: ObligationRow[] = obls.map((o) => {
    // Champs souvent vides en base : on les dérive de la désignation
    // (« ÉMETTEUR coupon% début-fin ») quand ils manquent.
    const parsed = parseObligationDesignation(o.designation);
    const emetteur = o.emetteur ?? parsed.emetteur;
    const tauxPct = o.taux_pct ?? parsed.couponPct;
    const maturite = o.maturite ?? parsed.maturite;

    const years = yearsTo(maturite);
    let ytm: number | null = null;
    let modDur: number | null = null;
    if (o.cours_jour != null && tauxPct != null && years != null) {
      // Le prix est coté en % du pair → base nominale 100 (pas 10 000).
      const inputs = { prix: o.cours_jour, couponRatePct: tauxPct, yearsToMaturity: years, face: 100 };
      ytm = yieldToMaturity(inputs);
      if (ytm != null) {
        const d = durations(inputs, ytm);
        modDur = d?.modified ?? null;
      }
    }
    return {
      code: o.code, designation: o.designation, emetteur,
      taux_pct: tauxPct, maturite, cours_jour: o.cours_jour,
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
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <SectionHeader
          kicker="Instruments de taux"
          title="Marché obligataire"
          subtitle="YTM, duration modifiée et courbe des taux — BRVM"
        />
        <EmptyStatePremium
          icon="◎"
          title="Aucune donnée obligataire"
          hint="Lancez le scraper pour alimenter la base avec les séances récentes."
        />
      </div>
    );
  }

  // Points pour la courbe des taux (YTM vs maturité par émetteur).
  const curve: CurvePoint[] = rows
    .filter((r) => r.ytm != null && r.yearsToMaturity != null)
    .map((r) => ({ emetteur: r.emetteur ?? 'Autre', code: r.code, x: r.yearsToMaturity!, y: r.ytm! }));

  // KPIs de synthèse
  const avgDuration = (() => {
    const durs = rows.map((r) => r.modifiedDuration).filter((d): d is number => d != null);
    return durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null;
  })();
  const minYtm = rows.map((r) => r.ytm).filter((y): y is number => y != null).reduce((a, b) => Math.min(a, b), Infinity);
  const maxYtm = rows.map((r) => r.ytm).filter((y): y is number => y != null).reduce((a, b) => Math.max(a, b), -Infinity);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* En-tête de page */}
      <SectionHeader
        kicker="Instruments de taux"
        title="Marché obligataire"
        subtitle="YTM, duration modifiée et courbe des taux — BRVM"
        actions={
          <div className="flex items-center gap-2">
            <StatPill tone="neutral">
              <span className="tabular">{rows.length}</span>&nbsp;ligne{rows.length !== 1 ? 's' : ''}
            </StatPill>
            <StatPill tone="sapphire">
              Séance <span className="tabular ml-1">{lastDate}</span>
            </StatPill>
          </div>
        }
      />

      {/* Séparateur doré */}
      <div className="h-px bg-gold-line" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="YTM moyen"
          value={avgBondYtm != null ? `${avgBondYtm.toFixed(2)}%` : '—'}
          accent="gold"
        />
        <MetricCard
          label="YTM min"
          value={isFinite(minYtm) ? `${minYtm.toFixed(2)}%` : '—'}
          accent="emerald"
        />
        <MetricCard
          label="YTM max"
          value={isFinite(maxYtm) ? `${maxYtm.toFixed(2)}%` : '—'}
          accent="sapphire"
        />
        <MetricCard
          label="Duration moy."
          value={avgDuration != null ? `${avgDuration.toFixed(2)}` : '—'}
          unit="ans"
          accent="neutral"
        />
      </div>

      {/* Courbe des taux */}
      {curve.length > 0 && (
        <PremiumPanel glow>
          <div className="p-5">
            <p className="overline text-gold/70 mb-4">Courbe des taux</p>
            <YieldCurveChart data={curve} />
          </div>
        </PremiumPanel>
      )}

      {/* Tableau des obligations */}
      <PremiumPanel>
        <div className="p-5">
          <p className="overline text-faint mb-4">Obligations cotées</p>
          <ObligationsTable rows={rows} />
        </div>
      </PremiumPanel>

      {/* Comparatif rendements */}
      <PremiumPanel>
        <div className="p-5">
          <p className="overline text-faint mb-4">Comparatif rendements obligataires vs dividendes</p>
          <YieldComparison avgBondYtm={avgBondYtm} dividendYields={dividendYields} />
        </div>
      </PremiumPanel>

      {/* Note méthodologique */}
      <p className="text-[11px] text-faint leading-relaxed border-l-2 border-border pl-3">
        YTM et duration modifiée calculés sous hypothèses (nominal 10 000 FCFA, coupon annuel) — voir docs/REPORTS.md.
        Le comparatif rendement obligataire vs rendement dividende des actions nécessite l'ingestion des dividendes ;
        les YTM ci-dessus en fournissent le côté obligataire.
      </p>
    </div>
  );
}
