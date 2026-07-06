# Détecteur de red flags — 9e section du Diagnostic IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 9th "RED FLAGS" section to the existing Diagnostic IA report (`/premium/diagnostic/[code]`), with a deterministic 0–10 severity score computed in code (never by the LLM), enriched by internal news veille and an optional Tavily web-search fallback.

**Architecture:** Three new pure/async modules in `frontend/lib/diagnostic/` — `redFlags.ts` (8 deterministic checks + weighted score), `newsSignals.ts` (keyword match against `brvm_news`), `webSearch.ts` (Tavily fallback with 30-day cache) — wired into `app/api/diagnostic/[code]/route.ts` before `buildDiagnosticPrompt`, whose output feeds a new prompt section and is stored in a new `diagnostic_reports.red_flag_score` column.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Supabase (Postgres + RLS), vitest, Tavily REST API.

Reference spec: `docs/superpowers/specs/2026-07-07-diagnostic-red-flags-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0072_diagnostic_red_flags.sql` | New `diagnostic_search_cache` table + `diagnostic_reports.red_flag_score` column, with RLS |
| `frontend/lib/diagnostic/redFlags.ts` | Pure function: 8 deterministic checks + weighted `overallScore` |
| `frontend/lib/diagnostic/redFlags.test.ts` | Unit tests: 1 triggered + 1 non-triggered + 1 dataAvailable:false per check, + score determinism |
| `frontend/lib/diagnostic/newsSignals.ts` | Pure `matchNewsSignals` (keyword matcher) + async `findNewsSignals` (Supabase query wrapper) |
| `frontend/lib/diagnostic/newsSignals.test.ts` | Unit tests on `matchNewsSignals` with fixture rows |
| `frontend/lib/diagnostic/webSearch.ts` | Tavily fallback (conditional on `TAVILY_API_KEY`) + 30-day cache in `diagnostic_search_cache` |
| `frontend/lib/diagnostic/prompt.ts` | Modify: add `redFlags` param + render 9th prompt section |
| `frontend/app/api/diagnostic/[code]/route.ts` | Modify: call the 3 new modules before `buildDiagnosticPrompt`, extend final upsert with `red_flag_score` |

---

## Task 1: Migration — `diagnostic_search_cache` + `red_flag_score`

**Files:**
- Create: `supabase/migrations/0072_diagnostic_red_flags.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 0072_diagnostic_red_flags.sql — Détecteur de red flags (9e section du
-- Diagnostic IA) : score de gravité stocké + cache de recherche web (Tavily).
-- ============================================================================

alter table public.diagnostic_reports
  add column if not exists red_flag_score smallint;

create table if not exists public.diagnostic_search_cache (
  code text not null,
  category text not null check (category in ('litiges', 'insiders', 'concentration_client')),
  results jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (code, category)
);

alter table public.diagnostic_search_cache enable row level security;

drop policy if exists "lecture publique diagnostic_search_cache" on public.diagnostic_search_cache;
create policy "lecture publique diagnostic_search_cache"
  on public.diagnostic_search_cache for select
  using (true);

drop policy if exists "ecriture service_role diagnostic_search_cache" on public.diagnostic_search_cache;
create policy "ecriture service_role diagnostic_search_cache"
  on public.diagnostic_search_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

Notes: `red_flag_score` needs no new RLS policy — it's a column on `diagnostic_reports`, already gated by the premium-only SELECT policy from `0055_diagnostic_premium_rls.sql` (row-level, not column-level). `diagnostic_search_cache` holds only public, non-personal data (news/search results about listed companies), so public read is safe — matches the spec's stated convention.

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP tool (`mcp__supabase__apply_migration`, name `diagnostic_red_flags`, passing the SQL above) or `supabase db push` if working locally with the CLI linked to the project.

- [ ] **Step 3: Verify**

Run (via `mcp__supabase__execute_sql` or the SQL editor):

```sql
select column_name from information_schema.columns
where table_name = 'diagnostic_reports' and column_name = 'red_flag_score';

select tablename from pg_tables where tablename = 'diagnostic_search_cache';
```

Expected: both queries return one row each.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0072_diagnostic_red_flags.sql
git commit -m "feat(db): ajoute diagnostic_search_cache + red_flag_score"
```

---

## Task 2: `redFlags.ts` — 8 checks déterministes

**Files:**
- Create: `frontend/lib/diagnostic/redFlags.ts`
- Test: `frontend/lib/diagnostic/redFlags.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// frontend/lib/diagnostic/redFlags.test.ts
import { describe, it, expect } from 'vitest';
import { computeRedFlags } from './redFlags';
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';

function emptyMetrics(): DiagnosticMetrics {
  return {
    ebitda_n: null, ebitda_n1: null, marge_ebitda_n: null, marge_ebitda_n1: null,
    marge_ebit_n: null, marge_ebit_n1: null, marge_brute_n: null, marge_brute_n1: null,
    marge_nette_n: null, marge_nette_n1: null, roce: null,
    dupont_marge: null, dupont_rotation: null, dupont_levier: null, roe_dupont: null,
    current_ratio: null, quick_ratio: null, cash_ratio: null,
    bfr_n: null, bfr_n1: null, bfr_jours: null,
    net_debt_n: null, net_debt_n1: null, interest_cover: null, debt_ebitda: null,
    fcf_n: null, fcf_n1: null, fcf_yield: null, cf_conversion: null, capex_n: null, capex_ca: null,
    ev_n: null, ev_ebitda: null, ev_ebit: null, ev_ca: null,
    payout_ratio: null, div_cover: null, fcf_div_cover: null,
    altman_z: null,
    cagr_ca: null, cagr_rn: null, cagr_ebitda: null,
  };
}

function baseParams() {
  return {
    inc_n: null as IncomeStatement | null,
    inc_n1: null as IncomeStatement | null,
    bal_n: null as BalanceSheet | null,
    bal_n1: null as BalanceSheet | null,
    cf_n: null as CashFlowStatement | null,
    cf_n1: null as CashFlowStatement | null,
    m: emptyMetrics(),
  };
}

function check(id: string, checks: ReturnType<typeof computeRedFlags>['checks']) {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} not found`);
  return c;
}

describe('computeRedFlags', () => {
  it('effet_ciseaux: déclenché quand CA en hausse et RN en baisse', () => {
    const p = baseParams();
    p.m = { ...p.m, cagr_ca: 8.2, cagr_rn: -14.6 };
    const c = check('effet_ciseaux', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(true);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBeGreaterThan(0);
  });

  it('effet_ciseaux: non déclenché quand CA et RN progressent ensemble', () => {
    const p = baseParams();
    p.m = { ...p.m, cagr_ca: 8.2, cagr_rn: 5.0 };
    const c = check('effet_ciseaux', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(true);
    expect(c.triggered).toBe(false);
    expect(c.severity).toBe(0);
  });

  it('effet_ciseaux: dataAvailable false si croissance non calculable', () => {
    const p = baseParams();
    const c = check('effet_ciseaux', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
    expect(c.triggered).toBe(false);
  });

  it('compression_marges: déclenché quand la marge EBITDA recule', () => {
    const p = baseParams();
    p.m = { ...p.m, marge_ebitda_n: 12, marge_ebitda_n1: 20, marge_brute_n: 40, marge_brute_n1: 40 };
    const c = check('compression_marges', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(8);
  });

  it('compression_marges: non déclenché quand les marges progressent', () => {
    const p = baseParams();
    p.m = { ...p.m, marge_ebitda_n: 22, marge_ebitda_n1: 20, marge_brute_n: 41, marge_brute_n1: 40 };
    const c = check('compression_marges', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('compression_marges: dataAvailable false si aucune marge connue sur les 2 périodes', () => {
    const p = baseParams();
    const c = check('compression_marges', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('divergence_cash: déclenché quand RN positif mais flux d\'exploitation négatif (précédent BNBC)', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), resultat_net: 500_000_000 };
    p.cf_n = { ...({} as CashFlowStatement), flux_exploitation: -200_000_000 };
    p.m = { ...p.m, fcf_n: -300_000_000 };
    const c = check('divergence_cash', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(9);
  });

  it('divergence_cash: non déclenché quand RN et cash sont positifs', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), resultat_net: 500_000_000 };
    p.cf_n = { ...({} as CashFlowStatement), flux_exploitation: 600_000_000 };
    p.m = { ...p.m, fcf_n: 100_000_000 };
    const c = check('divergence_cash', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('divergence_cash: dataAvailable false si résultat net inconnu', () => {
    const p = baseParams();
    const c = check('divergence_cash', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('dette_cachee: déclenché quand le BFR est élevé et la dette LT affichée faible (précédent ONTBF)', () => {
    const p = baseParams();
    p.bal_n = { ...({} as BalanceSheet), dette_long_terme: 100_000_000 };
    p.m = { ...p.m, bfr_jours: 150, bfr_n: 1_000_000_000 };
    const c = check('dette_cachee', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('dette_cachee: non déclenché quand le BFR est faible', () => {
    const p = baseParams();
    p.bal_n = { ...({} as BalanceSheet), dette_long_terme: 100_000_000 };
    p.m = { ...p.m, bfr_jours: 30, bfr_n: 200_000_000 };
    const c = check('dette_cachee', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('dette_cachee: dataAvailable false si BFR non calculable', () => {
    const p = baseParams();
    const c = check('dette_cachee', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('dividende_non_couvert: déclenché quand payout élevé et fcf_div_cover < 1', () => {
    const p = baseParams();
    p.m = { ...p.m, payout_ratio: 80, fcf_div_cover: -0.5 };
    const c = check('dividende_non_couvert', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(9);
  });

  it('dividende_non_couvert: non déclenché quand le FCF couvre largement le dividende', () => {
    const p = baseParams();
    p.m = { ...p.m, payout_ratio: 80, fcf_div_cover: 2.5 };
    const c = check('dividende_non_couvert', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('dividende_non_couvert: dataAvailable false si payout inconnu', () => {
    const p = baseParams();
    const c = check('dividende_non_couvert', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('tension_liquidite: déclenché quand le quick ratio est sous 1', () => {
    const p = baseParams();
    p.m = { ...p.m, quick_ratio: 0.5 };
    const c = check('tension_liquidite', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('tension_liquidite: non déclenché quand le quick ratio est confortable', () => {
    const p = baseParams();
    p.m = { ...p.m, quick_ratio: 1.4 };
    const c = check('tension_liquidite', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('tension_liquidite: dataAvailable false si quick ratio inconnu', () => {
    const p = baseParams();
    const c = check('tension_liquidite', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('detresse_altman: déclenché en zone de détresse (<1.1)', () => {
    const p = baseParams();
    p.m = { ...p.m, altman_z: 0.8 };
    const c = check('detresse_altman', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('detresse_altman: non déclenché en zone saine (>2.6)', () => {
    const p = baseParams();
    p.m = { ...p.m, altman_z: 3.2 };
    const c = check('detresse_altman', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('detresse_altman: dataAvailable false si Altman Z\' inconnu', () => {
    const p = baseParams();
    const c = check('detresse_altman', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('dilution: déclenché quand les actions en circulation augmentent de plus de 2%', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), actions_en_circulation: 1_100_000 };
    p.inc_n1 = { ...({} as IncomeStatement), actions_en_circulation: 1_000_000 };
    const c = check('dilution', computeRedFlags(p).checks);
    expect(c.triggered).toBe(true);
    expect(c.severity).toBe(10);
  });

  it('dilution: non déclenché quand le nombre d\'actions est stable', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), actions_en_circulation: 1_000_500 };
    p.inc_n1 = { ...({} as IncomeStatement), actions_en_circulation: 1_000_000 };
    const c = check('dilution', computeRedFlags(p).checks);
    expect(c.triggered).toBe(false);
  });

  it('dilution: dataAvailable false si le nombre d\'actions en circulation est manquant sur une période (champ nullable)', () => {
    const p = baseParams();
    p.inc_n = { ...({} as IncomeStatement), actions_en_circulation: null };
    p.inc_n1 = { ...({} as IncomeStatement), actions_en_circulation: 1_000_000 };
    const c = check('dilution', computeRedFlags(p).checks);
    expect(c.dataAvailable).toBe(false);
  });

  it('overallScore : déterministe (mêmes entrées → même score)', () => {
    const p = baseParams();
    p.m = { ...p.m, cagr_ca: 8.2, cagr_rn: -14.6, altman_z: 0.8, quick_ratio: 0.5 };
    const r1 = computeRedFlags(p).overallScore;
    const r2 = computeRedFlags(p).overallScore;
    expect(r1).toBe(r2);
    expect(r1).not.toBeNull();
  });

  it('overallScore : null quand aucun check n\'a de données', () => {
    const p = baseParams();
    expect(computeRedFlags(p).overallScore).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/diagnostic/redFlags.test.ts`
Expected: FAIL — `Cannot find module './redFlags'`

- [ ] **Step 3: Write the implementation**

```ts
// frontend/lib/diagnostic/redFlags.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';

export interface RedFlagCheck {
  id: string;
  label: string;
  triggered: boolean;
  severity: number; // 0-10
  evidence: string;
  dataAvailable: boolean;
}

export interface RedFlagsResult {
  checks: RedFlagCheck[];
  overallScore: number | null; // null si aucun check n'a de données
}

const WEIGHTS: Record<string, number> = {
  effet_ciseaux: 1,
  compression_marges: 1,
  divergence_cash: 2,
  dette_cachee: 2,
  dividende_non_couvert: 1,
  tension_liquidite: 1,
  detresse_altman: 1.5,
  dilution: 0.5,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number | null | undefined, decimals = 1): string {
  return n == null ? 'N/D' : n.toFixed(decimals);
}

export function computeRedFlags(params: {
  inc_n: IncomeStatement | null;
  inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null;
  bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  cf_n1: CashFlowStatement | null;
  m: DiagnosticMetrics;
}): RedFlagsResult {
  const { inc_n, inc_n1, bal_n, cf_n, m } = params;
  const checks: RedFlagCheck[] = [];

  // 1. Effet ciseaux : CA en hausse mais RN en baisse.
  {
    const dataAvailable = m.cagr_ca != null && m.cagr_rn != null;
    const triggered = dataAvailable && m.cagr_ca! > 0 && m.cagr_rn! < 0;
    const severity = triggered ? clamp(Math.round(Math.abs(m.cagr_rn!) / 3), 0, 10) : 0;
    checks.push({
      id: 'effet_ciseaux',
      label: 'Effet ciseaux (CA en hausse, RN en baisse)',
      triggered,
      severity,
      evidence: dataAvailable
        ? `CA ${m.cagr_ca! >= 0 ? '+' : ''}${fmt(m.cagr_ca)} %, RN ${m.cagr_rn! >= 0 ? '+' : ''}${fmt(m.cagr_rn)} %`
        : 'Données de croissance CA/RN insuffisantes',
      dataAvailable,
    });
  }

  // 2. Compression des marges : marge brute et/ou EBITDA en recul.
  {
    const dataAvailable = (m.marge_brute_n != null && m.marge_brute_n1 != null)
      || (m.marge_ebitda_n != null && m.marge_ebitda_n1 != null);
    const dropBrute = (m.marge_brute_n != null && m.marge_brute_n1 != null)
      ? m.marge_brute_n1 - m.marge_brute_n : null;
    const dropEbitda = (m.marge_ebitda_n != null && m.marge_ebitda_n1 != null)
      ? m.marge_ebitda_n1 - m.marge_ebitda_n : null;
    const maxDrop = Math.max(dropBrute ?? -Infinity, dropEbitda ?? -Infinity);
    const triggered = dataAvailable && maxDrop > 0;
    const severity = triggered ? clamp(Math.round(maxDrop), 0, 10) : 0;
    checks.push({
      id: 'compression_marges',
      label: 'Compression des marges',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Marge brute ${fmt(m.marge_brute_n)} % (vs ${fmt(m.marge_brute_n1)} %), marge EBITDA ${fmt(m.marge_ebitda_n)} % (vs ${fmt(m.marge_ebitda_n1)} %)`
        : 'Marges non calculables sur les 2 périodes',
      dataAvailable,
    });
  }

  // 3. Divergence RN ↔ cash réel (précédent réel : BNBC 2025).
  {
    const rn = inc_n?.resultat_net ?? null;
    const fluxExploit = cf_n?.flux_exploitation ?? null;
    const dataAvailable = rn != null && (m.fcf_n != null || fluxExploit != null);
    const triggered = dataAvailable && rn! > 0
      && ((fluxExploit != null && fluxExploit < 0) || (m.fcf_n != null && m.fcf_n < 0));
    const severity = triggered ? (fluxExploit != null && fluxExploit < 0 ? 9 : 6) : 0;
    checks.push({
      id: 'divergence_cash',
      label: 'Divergence résultat net ↔ cash réel',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Résultat net ${fmt(rn, 0)}, flux d'exploitation ${fmt(fluxExploit, 0)}, FCF ${fmt(m.fcf_n, 0)}`
        : 'Flux de trésorerie non disponibles',
      dataAvailable,
    });
  }

  // 4. Dette sous-évaluée : BFR élevé (jours de CA) alors que la dette LT affichée est faible
  //    (précédent réel : ONTBF — BFR financé par découverts non visibles en dette LT).
  {
    const dataAvailable = m.bfr_jours != null && bal_n?.dette_long_terme != null && m.bfr_n != null;
    const triggered = dataAvailable && m.bfr_jours! > 90 && bal_n!.dette_long_terme! < m.bfr_n! * 0.5;
    const severity = triggered ? clamp(Math.round(m.bfr_jours! / 15), 0, 10) : 0;
    checks.push({
      id: 'dette_cachee',
      label: 'Dette sous-évaluée (BFR financé hors dette LT affichée)',
      triggered,
      severity,
      evidence: dataAvailable
        ? `BFR ${fmt(m.bfr_jours, 0)} jours de CA, dette LT affichée ${fmt(bal_n?.dette_long_terme, 0)}`
        : 'BFR ou dette long terme non disponibles',
      dataAvailable,
    });
  }

  // 5. Dividende non couvert par le cash.
  {
    const dataAvailable = m.payout_ratio != null && m.fcf_div_cover != null;
    const triggered = dataAvailable && m.payout_ratio! > 60 && m.fcf_div_cover! < 1;
    const severity = triggered
      ? (m.fcf_div_cover! < 0 ? 9 : clamp(Math.round((1 - m.fcf_div_cover!) * 10), 0, 10))
      : 0;
    checks.push({
      id: 'dividende_non_couvert',
      label: 'Dividende non couvert par le cash',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Payout ${fmt(m.payout_ratio)} %, couverture FCF ${fmt(m.fcf_div_cover)}x`
        : 'Payout ou couverture FCF non calculables',
      dataAvailable,
    });
  }

  // 6. Tension de liquidité : quick ratio < 1.
  {
    const dataAvailable = m.quick_ratio != null;
    const triggered = dataAvailable && m.quick_ratio! < 1;
    const severity = triggered ? clamp(Math.round((1 - m.quick_ratio!) * 20), 0, 10) : 0;
    checks.push({
      id: 'tension_liquidite',
      label: 'Tension de liquidité',
      triggered,
      severity,
      evidence: dataAvailable ? `Quick ratio ${fmt(m.quick_ratio, 2)}x` : 'Quick ratio non calculable',
      dataAvailable,
    });
  }

  // 7. Détresse financière (Altman Z') : >2.6 sain, 1.1-2.6 gris, <1.1 détresse.
  {
    const dataAvailable = m.altman_z != null;
    const triggered = dataAvailable && m.altman_z! < 2.6;
    let severity = 0;
    if (triggered) {
      severity = m.altman_z! < 1.1
        ? 10
        : clamp(Math.round(8 - ((m.altman_z! - 1.1) / 1.5) * 4), 0, 10);
    }
    checks.push({
      id: 'detresse_altman',
      label: "Détresse financière (Altman Z')",
      triggered,
      severity,
      evidence: dataAvailable ? `Altman Z' = ${fmt(m.altman_z, 2)}` : "Altman Z' non calculable",
      dataAvailable,
    });
  }

  // 8. Dilution actionnariale : actions_en_circulation n vs n1 (champ nullable).
  {
    const shN = inc_n?.actions_en_circulation ?? null;
    const shN1 = inc_n1?.actions_en_circulation ?? null;
    const dataAvailable = shN != null && shN1 != null && shN1 !== 0;
    const pctChange = dataAvailable ? ((shN! - shN1!) / shN1!) * 100 : null;
    const triggered = dataAvailable && pctChange! > 2;
    const severity = triggered ? clamp(Math.round(pctChange!), 0, 10) : 0;
    checks.push({
      id: 'dilution',
      label: 'Dilution actionnariale',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Actions en circulation ${fmt(shN, 0)} (vs ${fmt(shN1, 0)}), ${pctChange! >= 0 ? '+' : ''}${fmt(pctChange)} %`
        : "Nombre d'actions en circulation non disponible sur les 2 périodes",
      dataAvailable,
    });
  }

  const available = checks.filter((c) => c.dataAvailable);
  const weightSum = available.reduce((sum, c) => sum + (WEIGHTS[c.id] ?? 1), 0);
  const overallScore = weightSum > 0
    ? Math.round(available.reduce((sum, c) => sum + c.severity * (WEIGHTS[c.id] ?? 1), 0) / weightSum)
    : null;

  return { checks, overallScore };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/diagnostic/redFlags.test.ts`
Expected: PASS (25 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/diagnostic/redFlags.ts frontend/lib/diagnostic/redFlags.test.ts
git commit -m "feat(diagnostic): ajoute computeRedFlags (8 checks déterministes pondérés)"
```

---

## Task 3: `newsSignals.ts` — veille interne (gratuit)

**Files:**
- Create: `frontend/lib/diagnostic/newsSignals.ts`
- Test: `frontend/lib/diagnostic/newsSignals.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// frontend/lib/diagnostic/newsSignals.test.ts
import { describe, it, expect } from 'vitest';
import { matchNewsSignals, type NewsRow } from './newsSignals';

function row(overrides: Partial<NewsRow>): NewsRow {
  return {
    titre: '',
    resume: null,
    source_label: null,
    source: 'brvm',
    date_publication: '2026-01-15',
    source_url: 'https://brvm.org/exemple',
    ...overrides,
  };
}

describe('matchNewsSignals', () => {
  it('détecte un litige via mot-clé dans le titre', () => {
    const rows = [row({ titre: 'Litige commercial en cours contre la société' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges).toHaveLength(1);
    expect(result.litiges[0].titre).toBe('Litige commercial en cours contre la société');
  });

  it('détecte un signal insider via mot-clé dans le résumé', () => {
    const rows = [row({ titre: 'Communiqué', resume: 'Démission du directeur général annoncée ce jour' })];
    const result = matchNewsSignals(rows);
    expect(result.insiders).toHaveLength(1);
  });

  it('détecte la concentration client via mot-clé', () => {
    const rows = [row({ titre: 'Perte d\'un client principal impactant le chiffre d\'affaires' })];
    const result = matchNewsSignals(rows);
    expect(result.concentration_client).toHaveLength(1);
  });

  it('ignore un article sans mot-clé pertinent (faux positif évité)', () => {
    const rows = [row({ titre: 'Publication des résultats annuels 2025' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges).toHaveLength(0);
    expect(result.insiders).toHaveLength(0);
    expect(result.concentration_client).toHaveLength(0);
  });

  it('un même article peut alimenter plusieurs catégories', () => {
    const rows = [row({ titre: 'Démission du PDG suite à un contentieux judiciaire' })];
    const result = matchNewsSignals(rows);
    expect(result.insiders).toHaveLength(1);
    expect(result.litiges).toHaveLength(1);
  });

  it('renvoie des listes vides pour une entrée vide', () => {
    const result = matchNewsSignals([]);
    expect(result).toEqual({ litiges: [], insiders: [], concentration_client: [] });
  });

  it('utilise source_label si présent, sinon source', () => {
    const rows = [row({ titre: 'Sanction prononcée par le régulateur', source_label: 'BRVM officiel' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges[0].source).toBe('BRVM officiel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/diagnostic/newsSignals.test.ts`
Expected: FAIL — `Cannot find module './newsSignals'`

- [ ] **Step 3: Write the implementation**

```ts
// frontend/lib/diagnostic/newsSignals.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type NewsCategory = 'litiges' | 'insiders' | 'concentration_client';

export interface NewsSignal {
  titre: string;
  source: string;
  date: string;
  url: string | null;
}

export interface NewsRow {
  titre: string;
  resume: string | null;
  source_label: string | null;
  source: string;
  date_publication: string;
  source_url: string | null;
}

const KEYWORDS: Record<NewsCategory, string[]> = {
  litiges: ['litige', 'poursuite', 'judiciaire', 'tribunal', 'contentieux', 'sanction'],
  insiders: ['démission', 'dirigeant', 'actionnaire majoritaire', 'cession de titres', 'pdg'],
  concentration_client: ['client principal', 'dépendance', 'contrat majeur'],
};

/** Fonction pure : associe chaque ligne de veille à ses catégories de red flag par mot-clé. */
export function matchNewsSignals(rows: NewsRow[]): Record<NewsCategory, NewsSignal[]> {
  const result: Record<NewsCategory, NewsSignal[]> = { litiges: [], insiders: [], concentration_client: [] };
  for (const row of rows) {
    const text = `${row.titre} ${row.resume ?? ''}`.toLowerCase();
    for (const category of Object.keys(KEYWORDS) as NewsCategory[]) {
      if (KEYWORDS[category].some((kw) => text.includes(kw))) {
        result[category].push({
          titre: row.titre,
          source: row.source_label ?? row.source,
          date: row.date_publication,
          url: row.source_url,
        });
      }
    }
  }
  return result;
}

/** Interroge brvm_news pour un code donné (I/O), puis applique matchNewsSignals (pur). */
export async function findNewsSignals(
  sb: SupabaseClient,
  code: string,
): Promise<Record<NewsCategory, NewsSignal[]>> {
  const { data } = await sb
    .from('brvm_news')
    .select('titre, resume, source_label, source, date_publication, source_url')
    .or(`instrument_code.eq.${code},ticker_codes.cs.{${code}}`)
    .order('date_publication', { ascending: false })
    .limit(200);
  return matchNewsSignals((data ?? []) as NewsRow[]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/diagnostic/newsSignals.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/diagnostic/newsSignals.ts frontend/lib/diagnostic/newsSignals.test.ts
git commit -m "feat(diagnostic): ajoute la veille interne brvm_news pour les red flags"
```

---

## Task 4: `webSearch.ts` — repli Tavily conditionnel + cache 30j

**Files:**
- Create: `frontend/lib/diagnostic/webSearch.ts`

No dedicated unit test file (per spec — only `redFlags.test.ts` and `newsSignals.test.ts` are required; this module makes live HTTP calls and Supabase I/O, exercised through the route's manual verification in Task 6).

- [ ] **Step 1: Write the implementation**

```ts
// frontend/lib/diagnostic/webSearch.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewsCategory, NewsSignal } from './newsSignals';

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000; // 30 jours — un litige ou un changement de dirigeant ne se périme pas vite

const CATEGORY_QUERY: Record<NewsCategory, (designation: string) => string> = {
  litiges: (d) => `${d} BRVM litige poursuite judiciaire`,
  insiders: (d) => `${d} BRVM dirigeant démission actionnaire majoritaire`,
  concentration_client: (d) => `${d} BRVM client principal dépendance contrat`,
};

interface TavilyResult {
  title: string;
  url: string;
  published_date?: string;
}

async function tavilySearch(query: string, apiKey: string): Promise<TavilyResult[]> {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 3, search_depth: 'basic' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
  const json = (await resp.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

/**
 * Complète les catégories sans signal de veille interne via Tavily (repli),
 * avec cache 30 jours dans diagnostic_search_cache. No-op silencieux si
 * TAVILY_API_KEY absente. Échec réseau/API traité comme "rien trouvé", jamais bloquant.
 */
export async function findWebSignals(
  sb: SupabaseClient,
  code: string,
  designation: string,
  categoriesSansResultat: NewsCategory[],
): Promise<Partial<Record<NewsCategory, NewsSignal[]>>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || categoriesSansResultat.length === 0) return {};

  const out: Partial<Record<NewsCategory, NewsSignal[]>> = {};

  for (const category of categoriesSansResultat) {
    try {
      const { data: cached } = await sb
        .from('diagnostic_search_cache')
        .select('results, fetched_at')
        .eq('code', code)
        .eq('category', category)
        .maybeSingle();

      if (cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_TTL_MS) {
        out[category] = cached.results as NewsSignal[];
        continue;
      }

      const query = CATEGORY_QUERY[category](designation);
      const results = await tavilySearch(query, apiKey);
      const signals: NewsSignal[] = results.map((r) => ({
        titre: r.title,
        source: new URL(r.url).hostname,
        date: r.published_date ?? new Date().toISOString().slice(0, 10),
        url: r.url,
      }));

      await sb.from('diagnostic_search_cache').upsert(
        { code, category, results: signals, fetched_at: new Date().toISOString() },
        { onConflict: 'code,category' },
      );
      out[category] = signals;
    } catch {
      out[category] = [];
    }
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors involving `webSearch.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/diagnostic/webSearch.ts
git commit -m "feat(diagnostic): ajoute le repli Tavily conditionnel avec cache 30j"
```

---

## Task 5: Intégration au prompt — 9e section RED FLAGS

**Files:**
- Modify: `frontend/lib/diagnostic/prompt.ts`

- [ ] **Step 1: Extend `buildDiagnosticPrompt`'s parameters and body**

In `frontend/lib/diagnostic/prompt.ts`, add the import and the new parameter, then append the 9th section. Replace the full file content with:

```ts
// frontend/lib/diagnostic/prompt.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';
import type { RedFlagsResult } from './redFlags';
import type { NewsCategory, NewsSignal } from './newsSignals';

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return 'N/D';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
}
function pct(n: number | null | undefined): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}%`;
}
function x(n: number | null | undefined): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}x`;
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  litiges: 'Litiges',
  insiders: 'Mouvements dirigeants/actionnaires',
  concentration_client: 'Concentration client',
};

function formatSignals(signals: NewsSignal[] | undefined): string {
  if (!signals || signals.length === 0) return 'non évaluable — aucune source publique trouvée';
  return signals.map((s) => `- ${s.titre} (${s.source}, ${s.date}${s.url ? `, ${s.url}` : ''})`).join('\n');
}

export function buildDiagnosticPrompt(params: {
  code: string;
  designation: string | null;
  secteur: string | null;
  cours: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  inc_n: IncomeStatement | null;
  inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null;
  bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  cf_n1: CashFlowStatement | null;
  m: DiagnosticMetrics;
  periode_n: string;
  periode_n1: string;
  redFlags: RedFlagsResult;
  newsSignals: Record<NewsCategory, NewsSignal[]>;
  webSignals: Partial<Record<NewsCategory, NewsSignal[]>>;
}): string {
  const { code, designation, secteur, cours, cours_bas_52s, cours_haut_52s,
          inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
          periode_n, periode_n1, redFlags, newsSignals, webSignals } = params;

  const redFlagsTable = redFlags.checks.map((c) => {
    if (!c.dataAvailable) return `| ${c.label} | non évaluable | — | ${c.evidence} |`;
    return `| ${c.label} | ${c.triggered ? 'Déclenché' : 'OK'} | ${c.triggered ? c.severity : 0}/10 | ${c.evidence} |`;
  }).join('\n');

  const enrichmentBlocks = (Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((cat) => {
    const internal = newsSignals[cat] ?? [];
    const source = internal.length > 0 ? internal : webSignals[cat];
    return `**${CATEGORY_LABELS[cat]}**\n${formatSignals(source)}`;
  }).join('\n\n');

  return `Tu es un analyste financier senior spécialisé sur les marchés actions africains (BRVM).
Tu vas produire un **diagnostic financier et économique complet** de ${designation ?? code} (${code}).
Ton analyse suit les standards sell-side CFA Level III et s'appuie exclusivement sur les données ci-dessous.
Rédige en français professionnel. Sois rigoureux, nuancé, actionnable. Longueur cible : 1 500–2 500 mots.
Commence directement par le rapport, sans préambule.

---
## DONNÉES FINANCIÈRES (FCFA)

### Compte de résultat
| Indicateur | ${periode_n} | ${periode_n1} | Δ |
|---|---|---|---|
| Revenus totaux | ${fmt(inc_n?.revenu_total)} | ${fmt(inc_n1?.revenu_total)} | ${pct(m.cagr_ca)} |
| Marge brute | ${fmt(inc_n?.marge_brute)} | ${fmt(inc_n1?.marge_brute)} | ${pct(m.marge_brute_n)} vs ${pct(m.marge_brute_n1)} |
| EBITDA | ${fmt(m.ebitda_n)} | ${fmt(m.ebitda_n1)} | ${pct(m.cagr_ebitda)} |
| EBIT | ${fmt(inc_n?.resultat_exploitation)} | ${fmt(inc_n1?.resultat_exploitation)} | |
| Résultat financier | ${fmt(inc_n?.charges_financieres_nettes)} | ${fmt(inc_n1?.charges_financieres_nettes)} | |
| Résultat net | ${fmt(inc_n?.resultat_net)} | ${fmt(inc_n1?.resultat_net)} | ${pct(m.cagr_rn)} |

### Bilan
| Indicateur | ${periode_n} | ${periode_n1} |
|---|---|---|
| Total actif | ${fmt(bal_n?.total_actifs)} | ${fmt(bal_n1?.total_actifs)} |
| Trésorerie | ${fmt(bal_n?.tresorerie_equivalents)} | ${fmt(bal_n1?.tresorerie_equivalents)} |
| Créances clients | ${fmt(bal_n?.creances_clients)} | ${fmt(bal_n1?.creances_clients)} |
| Stocks | ${fmt(bal_n?.stocks)} | ${fmt(bal_n1?.stocks)} |
| Capitaux propres | ${fmt(bal_n?.total_capitaux_propres)} | ${fmt(bal_n1?.total_capitaux_propres)} |
| Dette LT | ${fmt(bal_n?.dette_long_terme)} | ${fmt(bal_n1?.dette_long_terme)} |
| BFR | ${fmt(m.bfr_n)} | ${fmt(m.bfr_n1)} |

### Flux de trésorerie
| Indicateur | ${periode_n} | ${periode_n1} |
|---|---|---|
| Flux opérationnels | ${fmt(cf_n?.flux_exploitation)} | ${fmt(cf_n1?.flux_exploitation)} |
| Capex | ${fmt(m.capex_n)} | |
| Free Cash-Flow | ${fmt(m.fcf_n)} | ${fmt(m.fcf_n1)} |
| Dividendes versés | ${fmt(cf_n?.dividendes_verses)} | ${fmt(cf_n1?.dividendes_verses)} |

---
## RATIOS CALCULÉS

Rentabilité : Marge brute ${pct(m.marge_brute_n)} | Marge EBITDA ${pct(m.marge_ebitda_n)} | Marge EBIT ${pct(m.marge_ebit_n)} | Marge nette ${pct(m.marge_nette_n)} | ROCE ${pct(m.roce)}
DuPont ROE : Marge ${pct(m.dupont_marge)} × Rotation actifs ${x(m.dupont_rotation)} × Levier ${x(m.dupont_levier)} = ROE ${pct(m.roe_dupont)}
Liquidité : Current ratio ${x(m.current_ratio)} | Quick ratio ${x(m.quick_ratio)} | Cash ratio ${x(m.cash_ratio)}
BFR : ${fmt(m.bfr_n)} FCFA (${m.bfr_jours?.toFixed(0) ?? 'N/D'} jours de CA)
Dette : Dette nette ${fmt(m.net_debt_n)} | Couverture intérêts ${x(m.interest_cover)} | Dette nette/EBITDA ${x(m.debt_ebitda)}
Cash-flow : FCF Yield ${pct(m.fcf_yield)} | Conversion cash ${x(m.cf_conversion)} | Capex/CA ${pct(m.capex_ca)}
Valorisation (cours ${cours ?? 'N/D'} FCFA) : PER ${x(inc_n?.benefice_par_action && cours ? cours / inc_n.benefice_par_action : null)} | EV/EBITDA ${x(m.ev_ebitda)} | EV/EBIT ${x(m.ev_ebit)} | EV/CA ${m.ev_ca?.toFixed(2) ?? 'N/D'}x
Dividende : DPA ${inc_n?.dividende_par_action ?? 'N/D'} FCFA | Payout ${pct(m.payout_ratio)} | Couverture FCF ${x(m.fcf_div_cover)}
Altman Z' : ${m.altman_z?.toFixed(2) ?? 'N/D'} [>2.6 sain | 1.1–2.6 gris | <1.1 détresse]
Plage 52s : ${cours_bas_52s ?? 'N/D'} – ${cours_haut_52s ?? 'N/D'} FCFA

---
## RED FLAGS (score de gravité déjà calculé : ${redFlags.overallScore ?? 'non évaluable'}/10)

| Check | État | Sévérité | Preuve |
|---|---|---|---|
${redFlagsTable}

### Signaux de veille/recherche (par catégorie non couverte par les 8 checks ci-dessus)

${enrichmentBlocks}

---
## CONTEXTE
Secteur : ${secteur ?? 'N/D'} | Marché : BRVM/UEMOA | Référentiel : SYSCOA/OHADA | Monnaie : FCFA (1 EUR ≈ 655 FCFA)

---
## STRUCTURE OBLIGATOIRE DU RAPPORT

**1. SYNTHÈSE EXÉCUTIVE** — verdict (ACHAT/CONSERVER/VENDRE) + 4–5 points-clés + objectif de cours 12 mois
**2. ANALYSE DE LA RENTABILITÉ** — drivers des marges, qualité du résultat net, effet ciseaux si CA↑ RN↓
**3. ANALYSE DU BILAN** — structure financement, BFR, solvabilité, DuPont
**4. ANALYSE DES FLUX** — qualité du cash, Capex maintenance vs croissance, FCF, trésorerie nette
**5. VALORISATION** — DCF simplifié (WACC 12–14%, g 3–4%) + multiples relatifs + pairs BRVM
**6. POLITIQUE DE DIVIDENDE** — durabilité, signal marché
**7. RISQUES & CATALYSEURS** — sectoriels, opérationnels, macro UEMOA
**8. CONCLUSION & RECOMMANDATION** — ACHAT/CONSERVER/VENDRE + objectif + horizon + stop suggéré
**9. RED FLAGS** — pour chaque check déclenché ci-dessus, rédige 2–3 phrases de contexte expliquant pourquoi c'est préoccupant. N'invente AUCUN chiffre — utilise uniquement les valeurs fournies dans le tableau. Pour les catégories de veille/recherche : si des signaux sont fournis, cite-les avec leur source et leur date ; sinon écris explicitement « non évaluable — aucune source publique trouvée ». Le score global de gravité (déjà calculé : ${redFlags.overallScore ?? 'non évaluable'}/10) doit être repris tel quel, jamais recalculé ou réinterprété.`;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors only in `app/api/diagnostic/[code]/route.ts` (missing new args to `buildDiagnosticPrompt`) — fixed in Task 6.

- [ ] **Step 3: Commit**

Commit together with Task 6 (the route wiring), since `prompt.ts` alone doesn't typecheck cleanly until the caller is updated — see Task 6 Step 3.

---

## Task 6: Wiring dans la route API

**Files:**
- Modify: `frontend/app/api/diagnostic/[code]/route.ts`

- [ ] **Step 1: Add imports**

In `frontend/app/api/diagnostic/[code]/route.ts`, replace the import block (lines 1–8) with:

```ts
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { computeDiagnosticMetrics } from '@/lib/diagnostic/metrics';
import { buildDiagnosticPrompt } from '@/lib/diagnostic/prompt';
import { computeRedFlags } from '@/lib/diagnostic/redFlags';
import { findNewsSignals, type NewsCategory } from '@/lib/diagnostic/newsSignals';
import { findWebSignals } from '@/lib/diagnostic/webSearch';
```

- [ ] **Step 2: Insert red-flags + veille computation before `buildDiagnosticPrompt`, and pass results into it**

Replace this block (previously lines 89–101):

```ts
  const m = computeDiagnosticMetrics({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation: ratios.capitalisation });

  const prompt = buildDiagnosticPrompt({
    code,
    designation: data.instrument.designation,
    secteur: data.instrument.secteur,
    cours,
    cours_bas_52s: ratios.cours_bas_52s,
    cours_haut_52s: ratios.cours_haut_52s,
    inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
    periode_n: inc_n?.periode ?? 'N',
    periode_n1: inc_n1?.periode ?? 'N-1',
  });
```

with:

```ts
  const m = computeDiagnosticMetrics({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation: ratios.capitalisation });
  const redFlags = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m });

  const newsSignals = await findNewsSignals(admin, code);
  const categoriesSansResultat = (Object.keys(newsSignals) as NewsCategory[])
    .filter((cat) => newsSignals[cat].length === 0);
  const webSignals = await findWebSignals(admin, code, data.instrument.designation ?? code, categoriesSansResultat);

  const prompt = buildDiagnosticPrompt({
    code,
    designation: data.instrument.designation,
    secteur: data.instrument.secteur,
    cours,
    cours_bas_52s: ratios.cours_bas_52s,
    cours_haut_52s: ratios.cours_haut_52s,
    inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
    periode_n: inc_n?.periode ?? 'N',
    periode_n1: inc_n1?.periode ?? 'N-1',
    redFlags, newsSignals, webSignals,
  });
```

- [ ] **Step 3: Extend the final upsert to also write `red_flag_score`**

Replace this block (previously lines 157–161):

```ts
      if (full) {
        await admin.from('diagnostic_reports').upsert(
          { code, markdown_content: full, model_used: usedModel, metrics_snapshot: m as unknown as Record<string, unknown> },
          { onConflict: 'code' },
        );
      } else {
```

with:

```ts
      if (full) {
        await admin.from('diagnostic_reports').upsert(
          { code, markdown_content: full, model_used: usedModel, metrics_snapshot: m as unknown as Record<string, unknown>, red_flag_score: redFlags.overallScore },
          { onConflict: 'code' },
        );
      } else {
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full scraper/frontend test suites**

Run: `cd frontend && npx vitest run`
Expected: all tests pass, including the new `redFlags.test.ts` and `newsSignals.test.ts`.

- [ ] **Step 6: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/diagnostic/prompt.ts frontend/app/api/diagnostic/[code]/route.ts
git commit -m "feat(diagnostic): intègre les red flags dans le prompt et la route API"
```

---

## Task 7: Variable d'environnement `TAVILY_API_KEY`

**Files:**
- Modify: `frontend/.env.example`

- [ ] **Step 1: Document the new optional env var**

In `frontend/.env.example`, add a line near the other optional LLM/API keys:

```
# Optionnelle — recherche web de repli pour le détecteur de red flags (litiges,
# mouvements dirigeants, concentration client) quand la veille interne ne trouve rien.
TAVILY_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add frontend/.env.example
git commit -m "docs(env): documente TAVILY_API_KEY (repli red flags)"
```

Note: the live key itself must be added to Vercel via `npx vercel env add TAVILY_API_KEY production` (or the dashboard) — never committed to git. This is an infra step for the user/operator, not a code change.

---

## Task 8: Vérification manuelle bout-en-bout

**Files:** none (verification only)

- [ ] **Step 1: Run the full verification suite**

```bash
cd frontend && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: all three succeed.

- [ ] **Step 2: Manual smoke test against a real company code**

Start the dev server (`cd frontend && npm run dev`), sign in as the super-admin (`ebouak@gmail.com`), and open `/premium/diagnostic/BNBC` (or another PALC-covered code) with `force: true` in the request body (or clear the cached row for that code first) to force regeneration. Confirm:
- The streamed markdown includes a "9. RED FLAGS" section with real numbers matching the checks table.
- For BNBC specifically, the "Divergence résultat net ↔ cash réel" check should be `triggered: true` if 2025 operating cash flow is negative — matches the known precedent.
- `diagnostic_reports.red_flag_score` for that code is a non-null smallint after generation (verify via `select code, red_flag_score from diagnostic_reports where code = 'BNBC';`).

- [ ] **Step 3: Verify graceful degradation without `TAVILY_API_KEY`**

Confirm the dev server has no `TAVILY_API_KEY` set (default local state) and that the diagnostic still generates successfully, with any "non évaluable" categories showing the exact string "non évaluable — aucune source publique trouvée" in the rendered report — never a fabricated claim.

---

## Self-Review

**Spec coverage:**
- 8 deterministic checks with concrete formulas → Task 2 ✓
- Weighted `overallScore`, weights matching the spec table (2/2/1.5/1/1/1/1/0.5) → Task 2 ✓
- `newsSignals.ts` keyword categories (litiges/insiders/concentration_client) → Task 3 ✓
- `webSearch.ts` Tavily fallback, conditional on `TAVILY_API_KEY`, 30-day cache → Task 4 ✓
- New `diagnostic_search_cache` table + RLS, `red_flag_score` column → Task 1 ✓
- Prompt integration (9th section, exact instruction language, "non évaluable" honesty rule) → Task 5 ✓
- Route wiring: computed before `buildDiagnosticPrompt`, stored in the same upsert → Task 6 ✓
- Tests: `redFlags.test.ts` (1 triggered + 1 non-triggered + 1 dataAvailable:false per check + determinism) and `newsSignals.test.ts` (keyword matching on fixtures) → Tasks 2, 3 ✓
- `TAVILY_API_KEY` env var documented → Task 7 ✓
- Out of scope (UI badge elsewhere, other 4 gaps) — correctly not included in any task ✓

**Placeholder scan:** no TBD/TODO, every step has complete code, every command has an expected result.

**Type consistency:** `RedFlagsResult`, `RedFlagCheck`, `NewsCategory`, `NewsSignal`, `NewsRow` are defined once (Tasks 2–3) and referenced identically in Tasks 5–6. `computeRedFlags` signature (`{ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m }`) matches its call site in Task 6 Step 2. `findNewsSignals(sb, code)` and `findWebSignals(sb, code, designation, categories)` signatures match their call sites.
