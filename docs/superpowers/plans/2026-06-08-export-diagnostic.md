# Export XLS+PDF & Diagnostic Premium LLM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter l'export XLS et PDF-print des données financières sur la fiche action, et une page Premium `/premium/diagnostic/[code]` qui génère un rapport sell-side complet via Claude API en streaming.

**Architecture:** Module A (export) = boutons client-side sur `/actions/[code]/financials` : XLS via `exceljs` (Blob navigateur), PDF via `window.print()` sur une page dédiée `/actions/[code]/print`. Module B (diagnostic) = route API `POST /api/diagnostic/[code]` qui lit Supabase, calcule les métriques dérivées (port TypeScript du script Python), construit le prompt, stream la réponse Claude, et persiste dans `diagnostic_reports`. Page Premium `/premium/diagnostic/[code]` affiche le rapport en Markdown avec streaming progressif.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, TailwindCSS, `exceljs` (à installer), `@anthropic-ai/sdk` (à installer), Supabase anon (lecture) + service_role (écriture diagnostic_reports), `react-markdown` (déjà présent ou à vérifier).

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `supabase/migrations/0024_diagnostic_reports.sql` | Créer | Table de cache des rapports LLM |
| `frontend/lib/diagnostic/metrics.ts` | Créer | Calcul ratios dérivés (port Python) |
| `frontend/lib/diagnostic/prompt.ts` | Créer | Construction du prompt sell-side |
| `frontend/lib/export/xlsx.ts` | Créer | Génération Blob Excel (exceljs) |
| `frontend/app/actions/[code]/print/page.tsx` | Créer | Page print-optimisée CSS |
| `frontend/components/financials/ExportBar.tsx` | Créer | Boutons XLS + PDF (client) |
| `frontend/app/actions/[code]/financials/page.tsx` | Modifier | Intégrer ExportBar |
| `frontend/app/api/diagnostic/[code]/route.ts` | Créer | Route streaming Claude API |
| `frontend/app/premium/diagnostic/[code]/page.tsx` | Créer | Page Premium diagnostic |
| `frontend/components/premium/DiagnosticClient.tsx` | Créer | UI streaming + rendu Markdown |
| `frontend/.env.example` | Modifier | Ajouter ANTHROPIC_API_KEY |

---

## Task 1 : Migration — table `diagnostic_reports`

**Files:**
- Create: `supabase/migrations/0024_diagnostic_reports.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- supabase/migrations/0024_diagnostic_reports.sql
create table if not exists public.diagnostic_reports (
  id              uuid primary key default gen_random_uuid(),
  code            text not null references public.brvm_instruments(code) on update cascade,
  generated_at    timestamptz not null default now(),
  model_used      text not null default 'claude-sonnet-4-6',
  markdown_content text not null,
  metrics_snapshot jsonb,
  unique (code)   -- un seul rapport par action (le plus récent)
);

alter table public.diagnostic_reports enable row level security;
create policy "lecture publique diagnostic_reports"
  on public.diagnostic_reports for select using (true);
create policy "écriture service_role diagnostic_reports"
  on public.diagnostic_reports for all using (auth.role() = 'service_role');

create index if not exists idx_diagnostic_code on public.diagnostic_reports(code);
```

- [ ] **Step 2 : Appliquer dans Supabase SQL Editor**

Copier-coller le SQL dans Supabase > SQL Editor > Run.
Vérifier : table `diagnostic_reports` apparaît dans Table Editor.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0024_diagnostic_reports.sql
git commit -m "feat(diagnostic): migration table diagnostic_reports"
```

---

## Task 2 : `lib/diagnostic/metrics.ts` — ratios dérivés

**Files:**
- Create: `frontend/lib/diagnostic/metrics.ts`

Port TypeScript de `compute_metrics()` du script Python.
Prend les données Supabase déjà typées dans `lib/financials/types.ts`.

- [ ] **Step 1 : Créer le fichier**

```typescript
// frontend/lib/diagnostic/metrics.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';

export interface DiagnosticMetrics {
  // Rentabilité
  ebitda_n: number | null;
  ebitda_n1: number | null;
  marge_ebitda_n: number | null;
  marge_ebitda_n1: number | null;
  marge_ebit_n: number | null;
  marge_ebit_n1: number | null;
  marge_brute_n: number | null;
  marge_brute_n1: number | null;
  marge_nette_n: number | null;
  marge_nette_n1: number | null;
  roce: number | null;
  // DuPont
  dupont_marge: number | null;
  dupont_rotation: number | null;
  dupont_levier: number | null;
  roe_dupont: number | null;
  // Liquidité
  current_ratio: number | null;
  quick_ratio: number | null;
  cash_ratio: number | null;
  // BFR
  bfr_n: number | null;
  bfr_n1: number | null;
  bfr_jours: number | null;
  // Dette
  net_debt_n: number | null;
  net_debt_n1: number | null;
  interest_cover: number | null;
  debt_ebitda: number | null;
  // Cash-flow
  fcf_n: number | null;
  fcf_n1: number | null;
  fcf_yield: number | null;
  cf_conversion: number | null;
  capex_n: number | null;
  capex_ca: number | null;
  // Valorisation
  ev_n: number | null;
  ev_ebitda: number | null;
  ev_ebit: number | null;
  ev_ca: number | null;
  // Dividende
  payout_ratio: number | null;
  div_cover: number | null;
  fcf_div_cover: number | null;
  // Altman Z'
  altman_z: number | null;
  // Croissance
  cagr_ca: number | null;
  cagr_rn: number | null;
  cagr_ebitda: number | null;
}

function s(a: number | null, b: number | null, fn: (a: number, b: number) => number): number | null {
  if (a == null || b == null || b === 0) return null;
  return fn(a, b);
}

export function computeDiagnosticMetrics(params: {
  inc_n: IncomeStatement | null;
  inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null;
  bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  cf_n1: CashFlowStatement | null;
  cours: number | null;
  capitalisation: number | null;
}): DiagnosticMetrics {
  const { inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation } = params;

  // EBITDA = résultat exploitation + dotations amortissements
  const ebitda_n = (inc_n?.resultat_exploitation != null && cf_n?.depreciation_amortissement != null)
    ? inc_n.resultat_exploitation + cf_n.depreciation_amortissement : null;
  const ebitda_n1 = (inc_n1?.resultat_exploitation != null && cf_n1?.depreciation_amortissement != null)
    ? inc_n1.resultat_exploitation + cf_n1.depreciation_amortissement : null;

  // Marges
  const marge_ebitda_n  = s(ebitda_n, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_ebitda_n1 = s(ebitda_n1, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_ebit_n    = s(inc_n?.resultat_exploitation ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_ebit_n1   = s(inc_n1?.resultat_exploitation ?? null, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_brute_n   = s(inc_n?.marge_brute ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_brute_n1  = s(inc_n1?.marge_brute ?? null, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_nette_n   = s(inc_n?.resultat_net ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const marge_nette_n1  = s(inc_n1?.resultat_net ?? null, inc_n1?.revenu_total ?? null, (a, b) => (a / b) * 100);

  // ROCE = EBIT / (Total actifs - Passif courant)
  const capital_employe_n = (bal_n?.total_actifs != null && bal_n?.passif_courant != null)
    ? bal_n.total_actifs - bal_n.passif_courant : null;
  const roce = s(inc_n?.resultat_exploitation ?? null, capital_employe_n, (a, b) => (a / b) * 100);

  // DuPont
  const actif_moy = (bal_n?.total_actifs != null && bal_n1?.total_actifs != null)
    ? (bal_n.total_actifs + bal_n1.total_actifs) / 2 : bal_n?.total_actifs ?? null;
  const cp_moy = (bal_n?.total_capitaux_propres != null && bal_n1?.total_capitaux_propres != null)
    ? (bal_n.total_capitaux_propres + bal_n1.total_capitaux_propres) / 2 : bal_n?.total_capitaux_propres ?? null;
  const dupont_marge    = s(inc_n?.resultat_net ?? null, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);
  const dupont_rotation = s(inc_n?.revenu_total ?? null, actif_moy, (a, b) => a / b);
  const dupont_levier   = s(actif_moy, cp_moy, (a, b) => a / b);
  const roe_dupont = (dupont_marge != null && dupont_rotation != null && dupont_levier != null)
    ? (dupont_marge / 100) * dupont_rotation * dupont_levier * 100 : null;

  // Liquidité
  const current_ratio = s(bal_n?.total_actif_circulant ?? null, bal_n?.passif_courant ?? null, (a, b) => a / b);
  const quick_ratio = (bal_n?.total_actif_circulant != null && bal_n?.stocks != null && bal_n?.passif_courant != null && bal_n.passif_courant !== 0)
    ? (bal_n.total_actif_circulant - bal_n.stocks) / bal_n.passif_courant : null;
  const cash_ratio = s(bal_n?.tresorerie_equivalents ?? null, bal_n?.passif_courant ?? null, (a, b) => a / b);

  // BFR = stocks + créances - fournisseurs
  const bfr_n = (bal_n?.stocks != null && bal_n?.creances_clients != null && bal_n?.fournisseurs != null)
    ? bal_n.stocks + bal_n.creances_clients - bal_n.fournisseurs : null;
  const bfr_n1 = (bal_n1?.stocks != null && bal_n1?.creances_clients != null && bal_n1?.fournisseurs != null)
    ? bal_n1.stocks + bal_n1.creances_clients - bal_n1.fournisseurs : null;
  const bfr_jours = s(bfr_n, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 365);

  // Dette nette = dettes financières (CT+LT) - trésorerie
  const dette_n = (bal_n?.dette_court_terme != null && bal_n?.dette_long_terme != null)
    ? bal_n.dette_court_terme + bal_n.dette_long_terme
    : bal_n?.dette_long_terme ?? null;
  const dette_n1 = (bal_n1?.dette_court_terme != null && bal_n1?.dette_long_terme != null)
    ? bal_n1.dette_court_terme + bal_n1.dette_long_terme
    : bal_n1?.dette_long_terme ?? null;
  const net_debt_n  = (dette_n != null && bal_n?.tresorerie_equivalents != null) ? dette_n - bal_n.tresorerie_equivalents : null;
  const net_debt_n1 = (dette_n1 != null && bal_n1?.tresorerie_equivalents != null) ? dette_n1 - bal_n1.tresorerie_equivalents : null;
  const interest_cover = (inc_n?.resultat_exploitation != null && inc_n?.charges_financieres_nettes != null && inc_n.charges_financieres_nettes !== 0)
    ? Math.abs(inc_n.resultat_exploitation / inc_n.charges_financieres_nettes) : null;
  const debt_ebitda = s(net_debt_n, ebitda_n, (a, b) => a / b);

  // FCF = flux exploitation + flux investissement
  const fcf_n  = (cf_n?.flux_exploitation != null && cf_n?.flux_investissement != null) ? cf_n.flux_exploitation + cf_n.flux_investissement : null;
  const fcf_n1 = (cf_n1?.flux_exploitation != null && cf_n1?.flux_investissement != null) ? cf_n1.flux_exploitation + cf_n1.flux_investissement : null;
  const fcf_yield   = s(fcf_n, capitalisation, (a, b) => (a / b) * 100);
  const cf_conversion = s(cf_n?.flux_exploitation ?? null, inc_n?.resultat_net ?? null, (a, b) => a / b);

  // Capex = |investissements PPE| + |acquisitions|
  const capex_n = (cf_n?.investissements_ppe != null)
    ? Math.abs(cf_n.investissements_ppe) + Math.abs(cf_n?.acquisitions ?? 0) : null;
  const capex_ca = s(capex_n, inc_n?.revenu_total ?? null, (a, b) => (a / b) * 100);

  // EV
  const ev_n = (capitalisation != null && net_debt_n != null) ? capitalisation + net_debt_n : null;
  const ev_ebitda = s(ev_n, ebitda_n, (a, b) => a / b);
  const ev_ebit   = s(ev_n, inc_n?.resultat_exploitation ?? null, (a, b) => a / b);
  const ev_ca     = s(ev_n, inc_n?.revenu_total ?? null, (a, b) => a / b);

  // Dividende
  const div_total_n = (inc_n?.dividende_par_action != null && inc_n?.actions_en_circulation != null)
    ? inc_n.dividende_par_action * inc_n.actions_en_circulation : null;
  const payout_ratio   = s(div_total_n, inc_n?.resultat_net ?? null, (a, b) => (a / b) * 100);
  const div_cover      = s(inc_n?.resultat_net ?? null, div_total_n, (a, b) => a / b);
  const fcf_div_cover  = s(fcf_n, div_total_n, (a, b) => a / b);

  // Altman Z' (marchés émergents) : Z' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4
  let altman_z: number | null = null;
  if (bal_n?.total_actifs && bal_n.total_actifs !== 0 && bal_n?.total_actif_circulant && bal_n?.passif_courant && bal_n?.total_capitaux_propres && inc_n?.resultat_exploitation) {
    const X1 = (bal_n.total_actif_circulant - bal_n.passif_courant) / bal_n.total_actifs;
    const X2 = (bal_n.reserves_benefices_non_repartis ?? 0) / bal_n.total_actifs;
    const X3 = inc_n.resultat_exploitation / bal_n.total_actifs;
    const dettes_totales = (bal_n.dette_court_terme ?? 0) + (bal_n.dette_long_terme ?? 0);
    const X4 = dettes_totales !== 0 ? bal_n.total_capitaux_propres / dettes_totales : null;
    if (X4 != null) altman_z = 6.56 * X1 + 3.26 * X2 + 6.72 * X3 + 1.05 * X4;
  }

  // Croissance
  const cagr_ca    = s(inc_n?.revenu_total ?? null, inc_n1?.revenu_total ?? null, (a, b) => ((a - b) / Math.abs(b)) * 100);
  const cagr_rn    = s(inc_n?.resultat_net ?? null, inc_n1?.resultat_net ?? null, (a, b) => ((a - b) / Math.abs(b)) * 100);
  const cagr_ebitda = s(ebitda_n, ebitda_n1, (a, b) => ((a - b) / Math.abs(b)) * 100);

  return {
    ebitda_n, ebitda_n1, marge_ebitda_n, marge_ebitda_n1,
    marge_ebit_n, marge_ebit_n1, marge_brute_n, marge_brute_n1,
    marge_nette_n, marge_nette_n1, roce,
    dupont_marge, dupont_rotation, dupont_levier, roe_dupont,
    current_ratio, quick_ratio, cash_ratio,
    bfr_n, bfr_n1, bfr_jours,
    net_debt_n, net_debt_n1, interest_cover, debt_ebitda,
    fcf_n, fcf_n1, fcf_yield, cf_conversion, capex_n, capex_ca,
    ev_n, ev_ebitda, ev_ebit, ev_ca,
    payout_ratio, div_cover, fcf_div_cover,
    altman_z,
    cagr_ca, cagr_rn, cagr_ebitda,
  };
}
```

- [ ] **Step 2 : Commit**

```bash
git add frontend/lib/diagnostic/metrics.ts
git commit -m "feat(diagnostic): calcul ratios dérivés (port Python compute_metrics)"
```

---

## Task 3 : `lib/diagnostic/prompt.ts` — prompt sell-side

**Files:**
- Create: `frontend/lib/diagnostic/prompt.ts`

- [ ] **Step 1 : Créer le fichier**

```typescript
// frontend/lib/diagnostic/prompt.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';

function fmt(n: number | null, decimals = 0): string {
  if (n == null) return 'N/D';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
}
function pct(n: number | null): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}%`;
}
function x(n: number | null): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}x`;
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
}): string {
  const { code, designation, secteur, cours, cours_bas_52s, cours_haut_52s,
          inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
          periode_n, periode_n1 } = params;

  const cap = m.ev_n != null && m.net_debt_n != null ? m.ev_n - m.net_debt_n : null;

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
**8. CONCLUSION & RECOMMANDATION** — ACHAT/CONSERVER/VENDRE + objectif + horizon + stop suggéré`;
}
```

- [ ] **Step 2 : Commit**

```bash
git add frontend/lib/diagnostic/prompt.ts
git commit -m "feat(diagnostic): construction prompt sell-side BRVM"
```

---

## Task 4 : `lib/export/xlsx.ts` — export Excel

**Files:**
- Create: `frontend/lib/export/xlsx.ts`

- [ ] **Step 1 : Installer exceljs**

```bash
cd frontend && npm install exceljs
```

- [ ] **Step 2 : Créer le fichier**

```typescript
// frontend/lib/export/xlsx.ts
// Génération d'un Blob Excel côté navigateur avec exceljs.
// 3 feuilles : Résumé ratios, Compte de résultat, Bilan & Flux.
import ExcelJS from 'exceljs';
import type { IncomeStatement, BalanceSheet, CashFlowStatement, FundamentalRatios } from '@/lib/financials/types';

const UP   = 'FF00C853';
const DOWN = 'FFF44336';
const BG   = 'FF161922';
const HDR  = 'FF0F1117';
const TXT  = 'FFE6E9F0';
const MUT  = 'FF8B93A7';

function head(ws: ExcelJS.Worksheet, cols: string[], rowNum: number) {
  const row = ws.getRow(rowNum);
  cols.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, color: { argb: TXT }, name: 'Calibri', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR } };
    cell.alignment = { horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: '30363D' } } };
  });
}

function dataRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], rowNum: number, isEven: boolean) {
  const row = ws.getRow(rowNum);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v ?? '';
    cell.font = { color: { argb: typeof v === 'number' ? TXT : MUT }, name: 'Calibri', size: 9 };
    if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2030' } };
  });
}

function fcfa(n: number | null) { return n != null ? Math.round(n) : null; }
function pct(n: number | null)  { return n != null ? `${n.toFixed(1)}%` : '—'; }
function ratio(n: number | null){ return n != null ? `${n.toFixed(2)}x` : '—'; }

export async function generateXlsxBlob(params: {
  code: string;
  designation: string | null;
  secteur: string | null;
  ratios: FundamentalRatios;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
}): Promise<Blob> {
  const { code, designation, secteur, ratios, incomeStatements, balanceSheets, cashFlowStatements } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BRVM Analyst Pro';
  wb.created = new Date();

  // ── Feuille 1 : Résumé ──────────────────────────────────────────
  const ws1 = wb.addWorksheet('Résumé');
  ws1.getColumn(1).width = 32;
  ws1.getColumn(2).width = 20;

  ws1.getCell('A1').value = `${code} — ${designation ?? code}`;
  ws1.getCell('A1').font = { bold: true, size: 14, name: 'Calibri' };
  ws1.getCell('A2').value = secteur ?? '';
  ws1.getCell('A2').font = { color: { argb: MUT }, size: 10, name: 'Calibri' };
  ws1.getCell('A3').value = `Généré le ${new Date().toLocaleDateString('fr-FR')} — BRVM Analyst Pro`;
  ws1.getCell('A3').font = { color: { argb: MUT }, size: 9, italics: true, name: 'Calibri' };

  const ratioRows: [string, string][] = [
    ['Cours actuel (FCFA)', ratios.cours_actuel != null ? `${ratios.cours_actuel.toLocaleString('fr-FR')}` : '—'],
    ['52s bas / haut', `${ratios.cours_bas_52s ?? '—'} / ${ratios.cours_haut_52s ?? '—'}`],
    ['Capitalisation (FCFA)', ratios.capitalisation != null ? ratios.capitalisation.toLocaleString('fr-FR') : '—'],
    ['PER', ratio(ratios.per)],
    ['P/Book', ratio(ratios.pb)],
    ['P/CA', ratio(ratios.ps)],
    ['BPA (FCFA/action)', ratios.bpa != null ? ratios.bpa.toFixed(2) : '—'],
    ['Dividende/action (FCFA)', '—'],
    ['Rendement dividende', pct(ratios.rendement_dividende)],
    ['Payout ratio', pct(ratios.payout)],
    ['ROE', pct(ratios.roe)],
    ['Marge nette', pct(ratios.marge_nette)],
    ['Dette / Capitaux propres', ratio(ratios.dette_sur_capitaux_propres)],
    ['Croissance CA (YoY)', pct(ratios.croissance_ca)],
    ['Croissance RN (YoY)', pct(ratios.croissance_rn)],
  ];

  head(ws1, ['Indicateur', 'Valeur'], 5);
  ratioRows.forEach(([label, val], i) => {
    dataRow(ws1, [label, val], 6 + i, i % 2 === 0);
  });

  // ── Feuille 2 : Compte de résultat ──────────────────────────────
  const ws2 = wb.addWorksheet('Compte de résultat');
  ws2.getColumn(1).width = 32;
  incomeStatements.forEach((_, i) => { ws2.getColumn(i + 2).width = 18; });

  const incomeCols = ['Indicateur', ...incomeStatements.map((s) => s.periode)];
  head(ws2, incomeCols, 1);

  const incomeFields: Array<[string, keyof IncomeStatement]> = [
    ['Revenus totaux', 'revenu_total'],
    ['Coût des ventes', 'cout_ventes'],
    ['Marge brute', 'marge_brute'],
    ['Frais généraux', 'frais_generaux_admin'],
    ['Résultat exploitation (EBIT)', 'resultat_exploitation'],
    ['Charges financières nettes', 'charges_financieres_nettes'],
    ['Résultat avant impôts', 'resultat_avant_impots'],
    ['Impôts', 'impots'],
    ['Résultat net', 'resultat_net'],
    ['BPA (FCFA)', 'benefice_par_action'],
    ['Dividende / action (FCFA)', 'dividende_par_action'],
    ['Actions en circulation', 'actions_en_circulation'],
  ];

  incomeFields.forEach(([label, key], ri) => {
    const vals = incomeStatements.map((s) => {
      const v = s[key] as number | null;
      return key === 'benefice_par_action' || key === 'dividende_par_action' ? v : fcfa(v);
    });
    dataRow(ws2, [label, ...vals], 2 + ri, ri % 2 === 0);
  });

  // ── Feuille 3 : Bilan & Flux ─────────────────────────────────────
  const ws3 = wb.addWorksheet('Bilan & Flux');
  ws3.getColumn(1).width = 36;
  balanceSheets.forEach((_, i) => { ws3.getColumn(i + 2).width = 18; });

  const balCols = ['Bilan', ...balanceSheets.map((s) => s.periode)];
  head(ws3, balCols, 1);

  const balFields: Array<[string, keyof BalanceSheet]> = [
    ['Total actifs', 'total_actifs'],
    ['Actif circulant', 'total_actif_circulant'],
    ['  Trésorerie', 'tresorerie_equivalents'],
    ['  Créances clients', 'creances_clients'],
    ['  Stocks', 'stocks'],
    ['Actif non courant', 'total_actif_non_courant'],
    ['  Immobilisations nettes', 'immobilisations_nettes'],
    ['Total capitaux propres', 'total_capitaux_propres'],
    ['  Capital social', 'capital_social'],
    ['  Réserves', 'reserves_benefices_non_repartis'],
    ['Passif courant', 'passif_courant'],
    ['  Dette court terme', 'dette_court_terme'],
    ['Passif non courant', 'passif_non_courant'],
    ['  Dette long terme', 'dette_long_terme'],
  ];

  balFields.forEach(([label, key], ri) => {
    const vals = balanceSheets.map((s) => fcfa(s[key] as number | null));
    dataRow(ws3, [label, ...vals], 2 + ri, ri % 2 === 0);
  });

  // Flux de trésorerie
  const cfRow = balFields.length + 3;
  head(ws3, ['Flux de trésorerie', ...cashFlowStatements.map((s) => s.periode)], cfRow);

  const cfFields: Array<[string, keyof CashFlowStatement]> = [
    ['Flux exploitation (CFO)', 'flux_exploitation'],
    ['  Résultat net', 'resultat_net'],
    ['  Amortissements', 'depreciation_amortissement'],
    ['Flux investissement', 'flux_investissement'],
    ['  Capex (investissements)', 'investissements_ppe'],
    ['Flux financement', 'flux_financement'],
    ['  Dividendes versés', 'dividendes_verses'],
    ['Variation trésorerie', 'variation_tresorerie'],
    ['Free Cash-Flow', 'flux_tresorerie_disponible'],
  ];

  cfFields.forEach(([label, key], ri) => {
    const vals = cashFlowStatements.map((s) => fcfa(s[key] as number | null));
    dataRow(ws3, [label, ...vals], cfRow + 1 + ri, ri % 2 === 0);
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/export/xlsx.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(export): génération Excel 3 feuilles via exceljs"
```

---

## Task 5 : Page print `/actions/[code]/print/page.tsx`

**Files:**
- Create: `frontend/app/actions/[code]/print/page.tsx`

- [ ] **Step 1 : Créer la page**

```typescript
// frontend/app/actions/[code]/print/page.tsx
// Page dédiée à l'impression PDF via window.print().
// CSS @media print masque tout sauf le contenu.
import { notFound } from 'next/navigation';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import PrintTrigger from '@/components/financials/PrintTrigger';

interface Props { params: { code: string } }

export default async function PrintPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const data = await loadCompanyFinancials(code);
  if (!data) notFound();

  const inc_n  = data.incomeStatements[0] ?? null;
  const inc_n1 = data.incomeStatements[1] ?? null;
  const bal_n  = data.balanceSheets[0] ?? null;
  const cf_n   = data.cashFlowStatements[0] ?? null;

  const ratios = calculateFundamentals({
    coursActuel: data.latestDaily?.cours_jour ?? null,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: inc_n,
    incomePrev: inc_n1,
    balance: bal_n,
    cashflow: cf_n,
  });

  const fmtFCFA = (n: number | null) => n != null ? `${n.toLocaleString('fr-FR')} FCFA` : '—';
  const fmtPct  = (n: number | null) => n != null ? `${n.toFixed(1)}%` : '—';
  const fmtX    = (n: number | null) => n != null ? `${n.toFixed(2)}x` : '—';
  const today   = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="bg-white text-black font-sans p-8 max-w-4xl mx-auto print:p-4 print:max-w-none">
      <PrintTrigger />

      {/* Header */}
      <div className="flex items-start justify-between mb-6 border-b pb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">BRVM Analyst Pro</p>
          <h1 className="text-2xl font-bold mt-1">{code} — {data.instrument.designation ?? code}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.instrument.secteur ?? ''}</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Fiche générée le {today}</p>
          <p className="mt-1">Ce document n'est pas un conseil en investissement</p>
        </div>
      </div>

      {/* Cours & 52s */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          ['Cours actuel', fmtFCFA(ratios.cours_actuel)],
          ['52s bas', fmtFCFA(ratios.cours_bas_52s)],
          ['52s haut', fmtFCFA(ratios.cours_haut_52s)],
        ].map(([label, val]) => (
          <div key={label} className="border rounded p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-bold">{val}</p>
          </div>
        ))}
      </div>

      {/* Ratios */}
      <h2 className="text-lg font-semibold mb-3 border-b pb-1">Ratios fondamentaux</h2>
      <table className="w-full text-sm mb-6 border-collapse">
        <tbody>
          {[
            ['Capitalisation', fmtFCFA(ratios.capitalisation)],
            ['PER', fmtX(ratios.per)],
            ['P/Book', fmtX(ratios.pb)],
            ['P/CA', fmtX(ratios.ps)],
            ['BPA', fmtFCFA(ratios.bpa)],
            ['Rendement dividende', fmtPct(ratios.rendement_dividende)],
            ['Payout ratio', fmtPct(ratios.payout)],
            ['ROE', fmtPct(ratios.roe)],
            ['Marge nette', fmtPct(ratios.marge_nette)],
            ['Croissance CA', fmtPct(ratios.croissance_ca)],
            ['Croissance RN', fmtPct(ratios.croissance_rn)],
          ].map(([label, val], i) => (
            <tr key={label} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-1.5 px-3 text-gray-600">{label}</td>
              <td className="py-1.5 px-3 font-medium text-right">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Compte de résultat */}
      {data.incomeStatements.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Compte de résultat (FCFA)</h2>
          <table className="w-full text-sm mb-6 border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="py-1.5 px-3 text-left">Indicateur</th>
                {data.incomeStatements.map((s) => (
                  <th key={s.periode} className="py-1.5 px-3 text-right">{s.periode}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ['Revenus totaux', 'revenu_total'],
                ['Marge brute', 'marge_brute'],
                ['EBIT (Rés. exploitation)', 'resultat_exploitation'],
                ['Résultat net', 'resultat_net'],
                ['BPA (FCFA)', 'benefice_par_action'],
                ['Dividende/action', 'dividende_par_action'],
              ] as Array<[string, keyof typeof inc_n]>).map(([label, key], i) => (
                <tr key={label} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-1.5 px-3 text-gray-600">{label}</td>
                  {data.incomeStatements.map((s) => (
                    <td key={s.periode} className="py-1.5 px-3 text-right font-medium">
                      {s[key as keyof typeof s] != null
                        ? (s[key as keyof typeof s] as number).toLocaleString('fr-FR')
                        : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="text-xs text-gray-400 mt-8 border-t pt-3 italic">
        Source : BRVM Analyst Pro — brvm-analyst-pro.vercel.app · {today}
      </p>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `PrintTrigger` (bouton auto-print)**

```typescript
// frontend/components/financials/PrintTrigger.tsx
'use client';
import { useEffect } from 'react';

export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, []);
  return null;
}
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/actions/[code]/print/page.tsx frontend/components/financials/PrintTrigger.tsx
git commit -m "feat(export): page print PDF optimisée CSS"
```

---

## Task 6 : Boutons export sur la page financials

**Files:**
- Create: `frontend/components/financials/ExportBar.tsx`
- Modify: `frontend/app/actions/[code]/financials/page.tsx`

- [ ] **Step 1 : Créer `ExportBar.tsx`**

```typescript
// frontend/components/financials/ExportBar.tsx
'use client';
import { useState } from 'react';
import { generateXlsxBlob } from '@/lib/export/xlsx';
import type { IncomeStatement, BalanceSheet, CashFlowStatement, FundamentalRatios } from '@/lib/financials/types';

interface Props {
  code: string;
  designation: string | null;
  secteur: string | null;
  ratios: FundamentalRatios;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
}

export default function ExportBar({ code, designation, secteur, ratios, incomeStatements, balanceSheets, cashFlowStatements }: Props) {
  const [loadingXls, setLoadingXls] = useState(false);

  async function handleXls() {
    setLoadingXls(true);
    try {
      const blob = await generateXlsxBlob({ code, designation, secteur, ratios, incomeStatements, balanceSheets, cashFlowStatements });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${code}_financials_${new Date().getFullYear()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingXls(false);
    }
  }

  function handlePdf() {
    window.open(`/actions/${code}/print`, '_blank');
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleXls}
        disabled={loadingXls}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-up/40 transition-all active:scale-95 disabled:opacity-40"
      >
        <span>⬇</span>
        {loadingXls ? 'Génération…' : 'Excel (.xlsx)'}
      </button>
      <button
        type="button"
        onClick={handlePdf}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-up/40 transition-all active:scale-95"
      >
        <span>🖨</span>
        PDF (imprimer)
      </button>
    </div>
  );
}
```

- [ ] **Step 2 : Modifier `financials/page.tsx`**

Ajouter après le breadcrumb, dans le header existant (ligne ~48), un import de `ExportBar` (Server → passe les props au composant client) et intégrer dans le JSX :

```typescript
// Ajouter après les imports existants :
import ExportBar from '@/components/financials/ExportBar';

// Dans le JSX, après le bloc "Page header" (après la balise <div className="space-y-0.5"> fermante) :
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <h1 className="text-xl font-semibold tracking-tight">{code}</h1>
    {data.instrument.designation && (
      <p className="text-sm text-muted">{data.instrument.designation}</p>
    )}
    {data.instrument.secteur && (
      <p className="text-xs text-faint">{data.instrument.secteur}</p>
    )}
  </div>
  <ExportBar
    code={code}
    designation={data.instrument.designation}
    secteur={data.instrument.secteur}
    ratios={ratios}
    incomeStatements={data.incomeStatements}
    balanceSheets={data.balanceSheets}
    cashFlowStatements={data.cashFlowStatements}
  />
</div>
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/financials/ExportBar.tsx frontend/app/actions/[code]/financials/page.tsx
git commit -m "feat(export): boutons XLS + PDF sur page financials"
```

---

## Task 7 : Route API `/api/diagnostic/[code]/route.ts`

**Files:**
- Create: `frontend/app/api/diagnostic/[code]/route.ts`
- Modify: `frontend/.env.example`

- [ ] **Step 1 : Installer @anthropic-ai/sdk**

```bash
cd frontend && npm install @anthropic-ai/sdk
```

- [ ] **Step 2 : Ajouter la variable d'env**

Dans `frontend/.env.example`, ajouter :
```
# Claude API (diagnostic LLM)
ANTHROPIC_API_KEY=
```

Dans `frontend/.env.local`, ajouter votre clé réelle `ANTHROPIC_API_KEY=sk-ant-...`

- [ ] **Step 3 : Créer la route**

```typescript
// frontend/app/api/diagnostic/[code]/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { computeDiagnosticMetrics } from '@/lib/diagnostic/metrics';
import { buildDiagnosticPrompt } from '@/lib/diagnostic/prompt';

const MAX_AGE_DAYS = 7;

export async function POST(req: Request, { params }: { params: { code: string } }) {
  // Auth : premium requis
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: profile } = await supa.from('profiles').select('is_premium').eq('id', user.id).single();
  const isSuperAdmin = user.email === 'ebouak@gmail.com';
  if (!isSuperAdmin && !profile?.is_premium) {
    return NextResponse.json({ error: 'Abonnement Premium requis' }, { status: 403 });
  }

  const code = params.code.toUpperCase();
  const { force = false } = await req.json().catch(() => ({}));

  // Vérifier cache
  const admin = createSbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (!force) {
    const { data: cached } = await admin
      .from('diagnostic_reports')
      .select('markdown_content, generated_at')
      .eq('code', code)
      .single();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.generated_at).getTime();
      if (ageMs < MAX_AGE_DAYS * 24 * 3600 * 1000) {
        return NextResponse.json({ markdown: cached.markdown_content, cached: true, generated_at: cached.generated_at });
      }
    }
  }

  // Charger les données financières
  const data = await loadCompanyFinancials(code);
  if (!data) return NextResponse.json({ error: 'Instrument inconnu' }, { status: 404 });

  const inc_n  = data.incomeStatements[0] ?? null;
  const inc_n1 = data.incomeStatements[1] ?? null;
  const bal_n  = data.balanceSheets[0] ?? null;
  const bal_n1 = data.balanceSheets[1] ?? null;
  const cf_n   = data.cashFlowStatements[0] ?? null;
  const cf_n1  = data.cashFlowStatements[1] ?? null;
  const cours  = data.latestDaily?.cours_jour ?? null;

  const ratios = calculateFundamentals({
    coursActuel: cours,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: inc_n,
    incomePrev: inc_n1,
    balance: bal_n,
    cashflow: cf_n,
  });

  const m = computeDiagnosticMetrics({
    inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1,
    cours,
    capitalisation: ratios.capitalisation,
  });

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

  // Appel Claude avec streaming
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      try {
        const s = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const chunk of s) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            full += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        // Persister en base
        await admin.from('diagnostic_reports').upsert(
          { code, markdown_content: full, model_used: 'claude-sonnet-4-6', metrics_snapshot: m as unknown as Record<string, unknown> },
          { onConflict: 'code' },
        );
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Erreur: ${err instanceof Error ? err.message : 'Inconnue'}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/api/diagnostic/[code]/route.ts frontend/.env.example frontend/package.json frontend/package-lock.json
git commit -m "feat(diagnostic): route API streaming Claude + cache 7 jours"
```

---

## Task 8 : Page Premium + composant client streaming

**Files:**
- Create: `frontend/components/premium/DiagnosticClient.tsx`
- Create: `frontend/app/premium/diagnostic/[code]/page.tsx`

- [ ] **Step 1 : Créer `DiagnosticClient.tsx`**

```typescript
// frontend/components/premium/DiagnosticClient.tsx
'use client';
import { useState } from 'react';

interface Props {
  code: string;
  cachedMarkdown: string | null;
  cachedAt: string | null;
}

export default function DiagnosticClient({ code, cachedMarkdown, cachedAt }: Props) {
  const [markdown, setMarkdown] = useState(cachedMarkdown ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCached = !!cachedMarkdown;

  async function generate(force = false) {
    setLoading(true);
    setError(null);
    setMarkdown('');
    try {
      const res = await fetch(`/api/diagnostic/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j.error as string) ?? `Erreur ${res.status}`);
        return;
      }

      // Rapport en cache (JSON)
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        setMarkdown(j.markdown ?? '');
        return;
      }

      // Streaming
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setMarkdown(buf);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  // Auto-générer si pas de cache
  useState(() => { if (!cachedMarkdown) void generate(false); });

  // Rendu Markdown simplifié (sections H2, paragraphes, listes, tableaux inline)
  function renderMarkdown(md: string) {
    return md.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-white mt-6 mb-2 border-b border-border pb-1">{line.slice(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-white mt-4 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-white mt-3 mb-1">{line.slice(2, -2)}</p>;
      if (line.startsWith('- ')) return <li key={i} className="text-sm text-muted ml-4 list-disc">{line.slice(2)}</li>;
      if (line.startsWith('| ')) return <p key={i} className="text-xs text-muted font-mono">{line}</p>;
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-muted leading-relaxed">{line}</p>;
    });
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between gap-3">
        {isCached && cachedAt && (
          <p className="text-xs text-faint">
            Rapport du {new Date(cachedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          {markdown && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-white hover:border-up/40 transition-all"
            >
              🖨 Exporter PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => void generate(true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg bg-up text-bg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
          >
            {loading ? '⏳ Génération…' : isCached ? '↺ Regénérer' : '✦ Générer le diagnostic'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-surface border border-down/30 rounded-xl p-4 text-sm text-down">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && !markdown && (
        <div className="space-y-3">
          {[80, 60, 90, 70, 50].map((w, i) => (
            <div key={i} className={`animate-pulse h-3 bg-border rounded w-${w === 90 ? 'full' : `${w}/100`}`} style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {/* Rapport */}
      {markdown && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-1 print:bg-white print:text-black print:border-0">
          {renderMarkdown(markdown)}
        </div>
      )}

      {/* Empty */}
      {!loading && !markdown && !error && (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm mb-3">Aucun diagnostic disponible pour {code}.</p>
          <p className="text-faint text-xs">Cliquez sur "Générer le diagnostic" pour lancer l'analyse.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Créer la page Premium**

```typescript
// frontend/app/premium/diagnostic/[code]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DiagnosticClient from '@/components/premium/DiagnosticClient';

interface Props { params: { code: string } }

export default async function DiagnosticPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const supa = createClient();

  // Vérifier que l'instrument existe
  const { data: instrument } = await supa
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('code', code)
    .single();

  if (!instrument) notFound();

  // Rapport en cache
  const { data: cached } = await supa
    .from('diagnostic_reports')
    .select('markdown_content, generated_at')
    .eq('code', code)
    .single();

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/actions" className="text-muted hover:text-white transition-colors">Marché</Link>
          <span className="text-faint">/</span>
          <Link href={`/actions/${code}/financials`} className="text-muted hover:text-white transition-colors">{code}</Link>
          <span className="text-faint">/</span>
          <span className="text-white">Diagnostic</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{code}</h1>
              <span className="px-2 py-0.5 rounded text-xs bg-warn/10 text-warn border border-warn/20 font-medium">★ Premium</span>
            </div>
            {instrument.designation && <p className="text-sm text-muted mt-0.5">{instrument.designation}</p>}
            {instrument.secteur && <p className="text-xs text-faint">{instrument.secteur}</p>}
          </div>
        </div>

        {/* Description */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-sm text-muted">
            Analyse sell-side complète générée par IA : rentabilité, bilan, flux de trésorerie,
            valorisation (DCF + multiples), politique de dividende, risques et recommandation.
            Rapport basé sur les états financiers disponibles dans la base.
          </p>
        </div>

        {/* Diagnostic */}
        <DiagnosticClient
          code={code}
          cachedMarkdown={cached?.markdown_content ?? null}
          cachedAt={cached?.generated_at ?? null}
        />

      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Ajouter le lien depuis la page financials**

Dans `frontend/app/actions/[code]/financials/page.tsx`, ajouter juste avant la div closing `</div>` finale :

```tsx
{/* Lien vers le diagnostic Premium */}
<div className="bg-surface border border-warn/20 rounded-xl p-4 flex items-center justify-between gap-4">
  <div>
    <p className="text-sm font-semibold text-warn">✦ Diagnostic financier & économique</p>
    <p className="text-xs text-muted mt-0.5">Rapport sell-side complet généré par IA — réservé aux membres Premium.</p>
  </div>
  <Link
    href={`/premium/diagnostic/${code}`}
    className="shrink-0 px-3 py-1.5 rounded-lg bg-warn/10 border border-warn/30 text-warn text-xs font-semibold hover:bg-warn/20 transition-all"
  >
    Voir le diagnostic →
  </Link>
</div>
```

- [ ] **Step 4 : Commit final**

```bash
git add frontend/components/premium/DiagnosticClient.tsx \
        frontend/app/premium/diagnostic/ \
        frontend/app/actions/[code]/financials/page.tsx
git commit -m "feat(diagnostic): page Premium + streaming Markdown + lien depuis financials"
```

---

## Task 9 : Build & Deploy Vercel

- [ ] **Step 1 : Typecheck**

```bash
cd frontend && npm run typecheck
```

Corriger toutes les erreurs avant de continuer.

- [ ] **Step 2 : Push et deploy**

```bash
git push origin main
```

Vercel détecte le push et déploie automatiquement. Surveiller le build log sur le dashboard Vercel.

- [ ] **Step 3 : Vérifier en production**

1. Aller sur `/actions/PALC/financials` → vérifier boutons XLS et PDF
2. Aller sur `/actions/PALC/print` → vérifier mise en page impression
3. Aller sur `/premium/diagnostic/PALC` → vérifier génération streaming
4. Télécharger le XLS → ouvrir dans Excel, vérifier les 3 feuilles

---

## Self-Review

**Spec coverage :**
- ✅ Export XLS (exceljs, 3 feuilles) — Task 4 + 6
- ✅ Export PDF (window.print, page dédiée) — Task 5 + 6
- ✅ Diagnostic Premium LLM (Claude API streaming) — Task 7 + 8
- ✅ Cache 7 jours `diagnostic_reports` — Task 1 + 7
- ✅ Gating Premium (is_premium + super admin bypass) — Task 7
- ✅ Port Python compute_metrics → TypeScript — Task 2
- ✅ Prompt sell-side 8 sections — Task 3

**Placeholder scan :** Aucun TBD/TODO.

**Type consistency :** `DiagnosticMetrics` défini Task 2, utilisé Tasks 3, 7. `IncomeStatement`/`BalanceSheet`/`CashFlowStatement` de `lib/financials/types.ts` utilisés partout de façon cohérente.
