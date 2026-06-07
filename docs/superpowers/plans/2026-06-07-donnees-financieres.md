# Données Financières + Analyse Fondamentale — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un module "Données Financières + Analyse Fondamentale" style Trading 212 à la fiche action BRVM : barre 52 semaines, 5 blocs de KPIs, 3 onglets (Compte de résultat | Bilan | Flux de trésorerie) accessibles depuis `/actions/[code]/financials`.

**Architecture:** Migration `0018_financial_statements.sql` ajoute 2 colonnes nullable à `brvm_actions_daily` + crée 3 nouvelles tables référençant `code TEXT`. Logique pure dans `frontend/lib/financials/` (types, formatters, fundamentals, queries). Composants décomposés : WeekRange52 (barre 52s), FundamentalAnalysis (5 blocs KPIs), FinancialTabs (onglets client), 3 tableaux. Page `/actions/[code]/financials` Server Component. Lien ajouté dans la fiche action existante. Aucune table ni fichier existant modifié de façon destructive.

**Tech Stack:** TypeScript strict, Next.js 14 App Router, TailwindCSS dark finance, Recharts. Clé anon Supabase côté frontend.

---

## Structure des fichiers

| Fichier | Action |
|---|---|
| `supabase/migrations/0018_financial_statements.sql` | Créer |
| `frontend/lib/financials/types.ts` | Créer |
| `frontend/lib/financials/formatters.ts` | Créer |
| `frontend/lib/financials/fundamentals.ts` | Créer |
| `frontend/lib/financials/queries.ts` | Créer |
| `frontend/components/financials/WeekRange52.tsx` | Créer |
| `frontend/components/financials/FundamentalAnalysis.tsx` | Créer |
| `frontend/components/financials/IncomeStatement.tsx` | Créer |
| `frontend/components/financials/BalanceSheet.tsx` | Créer |
| `frontend/components/financials/CashFlowStatement.tsx` | Créer |
| `frontend/components/financials/FinancialTabs.tsx` | Créer |
| `frontend/app/actions/[code]/financials/page.tsx` | Créer |
| `frontend/app/actions/[code]/page.tsx` | Modifier — ajouter lien "Données financières" |

---

## Task 1 : Migration SQL

**Files:**
- Create: `supabase/migrations/0018_financial_statements.sql`

- [ ] **Step 1 : Créer `supabase/migrations/0018_financial_statements.sql`**

```sql
-- ============================================================================
-- BRVM Analyst Pro — États financiers détaillés (IFRS/SYSCOHADA).
-- Référence code TEXT (brvm_instruments) — pas d'UUID séparé.
-- Colonnes 52 semaines ajoutées nullable à brvm_actions_daily.
-- ============================================================================

-- 52 semaines sur brvm_actions_daily (nullable, non destructif)
alter table public.brvm_actions_daily
  add column if not exists cours_bas_52s  numeric(18,4),
  add column if not exists cours_haut_52s numeric(18,4);

-- Compte de résultat détaillé
create table if not exists public.income_statements (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null references public.brvm_instruments(code) on update cascade,
  periode                     varchar(10) not null,
  type_periode                varchar(10) not null default 'annuel',
  revenu_total                bigint,
  cout_ventes                 bigint,
  marge_brute                 bigint,
  depenses_exploitation       bigint,
  frais_generaux_admin        bigint,
  depenses_rd                 bigint,
  autres_depenses             bigint,
  resultat_exploitation       bigint,
  charges_financieres_nettes  bigint,
  resultat_avant_impots       bigint,
  impots                      bigint,
  resultat_net                bigint,
  benefice_par_action         numeric(12,2),
  benefice_par_action_dilue   numeric(12,2),
  actions_en_circulation      bigint,
  actions_diluees             bigint,
  dividende_par_action        numeric(12,2),
  created_at                  timestamptz not null default now(),
  unique (code, periode, type_periode)
);
create index if not exists idx_income_code_periode
  on public.income_statements (code, type_periode, periode desc);

-- Bilan détaillé
create table if not exists public.balance_sheets (
  id                              uuid primary key default gen_random_uuid(),
  code                            text not null references public.brvm_instruments(code) on update cascade,
  periode                         varchar(10) not null,
  type_periode                    varchar(10) not null default 'annuel',
  total_actifs                    bigint,
  total_actif_circulant           bigint,
  tresorerie_equivalents          bigint,
  investissements_court_terme     bigint,
  creances_clients                bigint,
  stocks                          bigint,
  autres_actifs_courants          bigint,
  total_actif_non_courant         bigint,
  immobilisations_nettes          bigint,
  goodwill                        bigint,
  actifs_incorporels              bigint,
  investissements_long_terme      bigint,
  autres_actifs_financiers        bigint,
  total_passif                    bigint,
  passif_courant                  bigint,
  fournisseurs                    bigint,
  dette_court_terme               bigint,
  revenus_differes_courants       bigint,
  autres_passifs_courants         bigint,
  passif_non_courant              bigint,
  dette_long_terme                bigint,
  autres_passifs_non_courants     bigint,
  impots_differes_passifs         bigint,
  total_capitaux_propres          bigint,
  capital_social                  bigint,
  reserves_benefices_non_repartis bigint,
  autres_capitaux_propres         bigint,
  interets_minoritaires           bigint,
  created_at                      timestamptz not null default now(),
  unique (code, periode, type_periode)
);
create index if not exists idx_balance_code_periode
  on public.balance_sheets (code, type_periode, periode desc);

-- Flux de trésorerie
create table if not exists public.cash_flow_statements (
  id                              uuid primary key default gen_random_uuid(),
  code                            text not null references public.brvm_instruments(code) on update cascade,
  periode                         varchar(10) not null,
  type_periode                    varchar(10) not null default 'annuel',
  flux_exploitation               bigint,
  resultat_net                    bigint,
  depreciation_amortissement      bigint,
  impots_reportes                 bigint,
  remuneration_actions            bigint,
  variation_bfr                   bigint,
  autres_elements_hors_caisse     bigint,
  flux_investissement             bigint,
  investissements_ppe             bigint,
  acquisitions                    bigint,
  achats_placements               bigint,
  ventes_placements               bigint,
  autres_activites_investissement bigint,
  flux_financement                bigint,
  remboursement_dette             bigint,
  dividendes_verses               bigint,
  rachats_actions                 bigint,
  emissions_actions               bigint,
  autres_activites_financement    bigint,
  effet_forex_tresorerie          bigint,
  variation_tresorerie            bigint,
  tresorerie_debut_periode        bigint,
  tresorerie_fin_periode          bigint,
  depenses_capital                bigint,
  flux_tresorerie_disponible      bigint,
  created_at                      timestamptz not null default now(),
  unique (code, periode, type_periode)
);
create index if not exists idx_cashflow_code_periode
  on public.cash_flow_statements (code, type_periode, periode desc);

-- RLS lecture publique
alter table public.income_statements    enable row level security;
alter table public.balance_sheets       enable row level security;
alter table public.cash_flow_statements enable row level security;

create policy "lecture publique income_statements"
  on public.income_statements for select using (true);
create policy "lecture publique balance_sheets"
  on public.balance_sheets for select using (true);
create policy "lecture publique cash_flow_statements"
  on public.cash_flow_statements for select using (true);
```

- [ ] **Step 2 : Appliquer en base Supabase**

Via l'éditeur SQL Supabase ou `supabase db push`. Vérifier que les 3 tables apparaissent dans le dashboard.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0018_financial_statements.sql
git commit -m "feat(db): income_statements + balance_sheets + cash_flow_statements + 52s sur brvm_actions_daily"
```

---

## Task 2 : Types + Formatters + Fundamentals (lib/financials/)

**Files:**
- Create: `frontend/lib/financials/types.ts`
- Create: `frontend/lib/financials/formatters.ts`
- Create: `frontend/lib/financials/fundamentals.ts`

- [ ] **Step 1 : Créer `frontend/lib/financials/types.ts`**

```ts
export interface IncomeStatement {
  periode: string;
  type_periode: string;
  revenu_total: number | null;
  cout_ventes: number | null;
  marge_brute: number | null;
  depenses_exploitation: number | null;
  frais_generaux_admin: number | null;
  depenses_rd: number | null;
  autres_depenses: number | null;
  resultat_exploitation: number | null;
  charges_financieres_nettes: number | null;
  resultat_avant_impots: number | null;
  impots: number | null;
  resultat_net: number | null;
  benefice_par_action: number | null;
  benefice_par_action_dilue: number | null;
  actions_en_circulation: number | null;
  actions_diluees: number | null;
  dividende_par_action: number | null;
}

export interface BalanceSheet {
  periode: string;
  type_periode: string;
  total_actifs: number | null;
  total_actif_circulant: number | null;
  tresorerie_equivalents: number | null;
  investissements_court_terme: number | null;
  creances_clients: number | null;
  stocks: number | null;
  autres_actifs_courants: number | null;
  total_actif_non_courant: number | null;
  immobilisations_nettes: number | null;
  goodwill: number | null;
  actifs_incorporels: number | null;
  investissements_long_terme: number | null;
  autres_actifs_financiers: number | null;
  total_passif: number | null;
  passif_courant: number | null;
  fournisseurs: number | null;
  dette_court_terme: number | null;
  revenus_differes_courants: number | null;
  autres_passifs_courants: number | null;
  passif_non_courant: number | null;
  dette_long_terme: number | null;
  autres_passifs_non_courants: number | null;
  impots_differes_passifs: number | null;
  total_capitaux_propres: number | null;
  capital_social: number | null;
  reserves_benefices_non_repartis: number | null;
  autres_capitaux_propres: number | null;
  interets_minoritaires: number | null;
}

export interface CashFlowStatement {
  periode: string;
  type_periode: string;
  flux_exploitation: number | null;
  resultat_net: number | null;
  depreciation_amortissement: number | null;
  impots_reportes: number | null;
  remuneration_actions: number | null;
  variation_bfr: number | null;
  autres_elements_hors_caisse: number | null;
  flux_investissement: number | null;
  investissements_ppe: number | null;
  acquisitions: number | null;
  achats_placements: number | null;
  ventes_placements: number | null;
  autres_activites_investissement: number | null;
  flux_financement: number | null;
  remboursement_dette: number | null;
  dividendes_verses: number | null;
  rachats_actions: number | null;
  emissions_actions: number | null;
  autres_activites_financement: number | null;
  effet_forex_tresorerie: number | null;
  variation_tresorerie: number | null;
  tresorerie_debut_periode: number | null;
  tresorerie_fin_periode: number | null;
  depenses_capital: number | null;
  flux_tresorerie_disponible: number | null;
}

export interface FundamentalRatios {
  capitalisation: number | null;
  bpa: number | null;
  rendement_dividende: number | null;
  per: number | null;
  pb: number | null;
  ps: number | null;
  roe: number | null;
  marge_nette: number | null;
  dette_sur_capitaux_propres: number | null;
  payout: number | null;
  croissance_ca: number | null;
  croissance_rn: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  cours_actuel: number | null;
}

export interface FinancialsData {
  code: string;
  designation: string;
  cours_actuel: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  shares: number | null;
  incomes: IncomeStatement[];
  balances: BalanceSheet[];
  cashflows: CashFlowStatement[];
}
```

- [ ] **Step 2 : Créer `frontend/lib/financials/formatters.ts`**

```ts
/** Formate un montant en XOF (Franc CFA UEMOA). */
export function formatXOF(value: number | null | undefined): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(2)} Bn FCFA`;
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)} Md FCFA`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)} M FCFA`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)} K FCFA`;
  return `${sign}${abs.toLocaleString('fr-FR')} FCFA`;
}

/** Pour les cours de bourse — espace milliers FR, 0-2 décimales. */
export function formatCours(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Pourcentage avec décimales (défaut 1). "non disponible" si null. */
export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return 'non disponible';
  return `${value.toFixed(decimals)} %`;
}

/** Ratio (PER, P/B, P/S) — 2 décimales. */
export function formatRatio(value: number | null | undefined): string {
  if (value == null) return 'non disponible';
  return value.toFixed(2);
}

/** Croissance avec signe explicite. */
export function formatGrowth(value: number | null | undefined): string {
  if (value == null) return 'non disponible';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)} %`;
}

/**
 * Couleur Tailwind selon valeur.
 * @param inverse true = positif → rouge (ex: dettes, coûts)
 */
export function colorClass(
  value: number | null | undefined,
  options?: { inverse?: boolean; threshold?: number },
): string {
  if (value == null) return 'text-gray-400';
  const thr = options?.threshold ?? 0;
  const isPositive = options?.inverse ? value < thr : value > thr;
  if (isPositive) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-white';
}
```

- [ ] **Step 3 : Créer `frontend/lib/financials/fundamentals.ts`**

```ts
import type { FundamentalRatios, IncomeStatement, BalanceSheet } from './types';

interface FundamentalsParams {
  cours_actuel: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  shares: number | null;
  incomeLast: IncomeStatement | null;
  incomePrev: IncomeStatement | null;
  balanceLast: BalanceSheet | null;
}

function safe(n: number, d: number | null | undefined): number | null {
  if (d == null || d === 0) return null;
  return n / d;
}

function pct(n: number | null | undefined, d: number | null | undefined): number | null {
  if (n == null || d == null || d === 0) return null;
  return (n / d) * 100;
}

function growth(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function calculateFundamentals(p: FundamentalsParams): FundamentalRatios {
  const { cours_actuel, shares, incomeLast, incomePrev, balanceLast } = p;

  const capitalisation = cours_actuel != null && shares != null ? cours_actuel * shares : null;
  const bpa = incomeLast?.benefice_par_action ?? null;
  const dpa = incomeLast?.dividende_par_action ?? null;

  const rendement_dividende = dpa != null && cours_actuel != null && cours_actuel > 0
    ? (dpa / cours_actuel) * 100
    : null;

  const per = cours_actuel != null && bpa != null ? safe(cours_actuel, bpa) : null;
  const pb = capitalisation != null ? safe(capitalisation, balanceLast?.total_capitaux_propres ?? null) : null;
  const ps = capitalisation != null ? safe(capitalisation, incomeLast?.revenu_total ?? null) : null;

  const roe = pct(incomeLast?.resultat_net, balanceLast?.total_capitaux_propres);
  const marge_nette = pct(incomeLast?.resultat_net, incomeLast?.revenu_total);

  const dette_totale =
    (balanceLast?.dette_court_terme ?? 0) + (balanceLast?.dette_long_terme ?? 0);
  const dette_sur_capitaux_propres = safe(dette_totale, balanceLast?.total_capitaux_propres ?? null);

  const actionsCirc = incomeLast?.actions_en_circulation ?? null;
  const payout =
    dpa != null && actionsCirc != null && incomeLast?.resultat_net != null && incomeLast.resultat_net > 0
      ? ((dpa * actionsCirc) / incomeLast.resultat_net) * 100
      : null;

  return {
    capitalisation,
    bpa,
    rendement_dividende,
    per,
    pb,
    ps,
    roe,
    marge_nette,
    dette_sur_capitaux_propres,
    payout,
    croissance_ca: growth(incomeLast?.revenu_total, incomePrev?.revenu_total),
    croissance_rn: growth(incomeLast?.resultat_net, incomePrev?.resultat_net),
    cours_bas_52s: p.cours_bas_52s,
    cours_haut_52s: p.cours_haut_52s,
    cours_actuel,
  };
}
```

- [ ] **Step 4 : Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | tail -5
```
Attendu : 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/financials/
git commit -m "feat(financials): types + formatters + calculateFundamentals"
```

---

## Task 3 : Requêtes Supabase (`lib/financials/queries.ts`)

**Files:**
- Create: `frontend/lib/financials/queries.ts`

- [ ] **Step 1 : Créer `frontend/lib/financials/queries.ts`**

```ts
import { createClient } from '@/lib/supabase/server';
import type { FinancialsData } from './types';

export async function loadCompanyFinancials(code: string): Promise<FinancialsData | null> {
  const supabase = createClient();
  const upperCode = code.toUpperCase();

  // Étape 1 : vérifier l'existence de l'instrument + récupérer shares
  const { data: instr, error: instrErr } = await supabase
    .from('brvm_instruments')
    .select('code, designation, shares')
    .eq('code', upperCode)
    .maybeSingle();

  if (instrErr || !instr) return null;

  // Étape 2 : charger cours + états financiers en parallèle
  const [
    { data: lastRow },
    { data: incomes },
    { data: balances },
    { data: cashflows },
  ] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('cours_jour, cours_bas_52s, cours_haut_52s')
      .eq('code', upperCode)
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('income_statements')
      .select('*')
      .eq('code', upperCode)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(10),
    supabase
      .from('balance_sheets')
      .select('*')
      .eq('code', upperCode)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(10),
    supabase
      .from('cash_flow_statements')
      .select('*')
      .eq('code', upperCode)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(10),
  ]);

  return {
    code: instr.code,
    designation: instr.designation,
    cours_actuel: lastRow?.cours_jour ?? null,
    cours_bas_52s: lastRow?.cours_bas_52s ?? null,
    cours_haut_52s: lastRow?.cours_haut_52s ?? null,
    shares: (instr as { shares?: number | null }).shares ?? null,
    incomes: (incomes ?? []) as FinancialsData['incomes'],
    balances: (balances ?? []) as FinancialsData['balances'],
    cashflows: (cashflows ?? []) as FinancialsData['cashflows'],
  };
}
```

- [ ] **Step 2 : Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | tail -5
```
Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/financials/queries.ts
git commit -m "feat(financials): loadCompanyFinancials query"
```

---

## Task 4 : Composants WeekRange52 + FundamentalAnalysis

**Files:**
- Create: `frontend/components/financials/WeekRange52.tsx`
- Create: `frontend/components/financials/FundamentalAnalysis.tsx`

- [ ] **Step 1 : Créer `frontend/components/financials/WeekRange52.tsx`**

```tsx
import { formatCours } from '@/lib/financials/formatters';

interface Props {
  bas: number | null;
  haut: number | null;
  actuel: number | null;
}

export default function WeekRange52({ bas, haut, actuel }: Props) {
  const hasData = bas != null && haut != null && actuel != null && haut > bas;
  const position = hasData ? Math.min(100, Math.max(0, ((actuel! - bas!) / (haut! - bas!)) * 100)) : null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-muted font-medium mb-3">52 SEMAINES</p>
      <div className="relative">
        {/* Track */}
        <div className="h-2 rounded-full bg-border relative">
          {/* Curseur */}
          {position != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-400 shadow"
              style={{ left: `calc(${position}% - 6px)` }}
            />
          )}
        </div>
        {/* Labels */}
        <div className="flex justify-between mt-2 text-xs text-muted">
          <span>Bas : <span className="text-white tabular">{formatCours(bas)}</span></span>
          <span>Haut : <span className="text-white tabular">{formatCours(haut)}</span></span>
        </div>
      </div>
      {!hasData && (
        <p className="text-xs text-gray-400 italic mt-1">Données 52 semaines non disponibles</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Créer `frontend/components/financials/FundamentalAnalysis.tsx`**

```tsx
import type { FundamentalRatios } from '@/lib/financials/types';
import {
  formatXOF, formatPct, formatRatio, formatGrowth, colorClass,
} from '@/lib/financials/formatters';

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-medium tabular ${className ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function FundamentalAnalysis({ r }: { r: FundamentalRatios }) {
  const payoutClass = r.payout != null && r.payout > 100 ? 'text-orange-400' : colorClass(r.payout);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Générales */}
      <Block title="Générales">
        <Row label="Capitalisation" value={formatXOF(r.capitalisation)} />
        <Row label="BPA" value={r.bpa != null ? `${r.bpa.toFixed(0)} FCFA` : 'non disponible'} className={colorClass(r.bpa)} />
        <Row label="Rdt dividende" value={formatPct(r.rendement_dividende)} className={colorClass(r.rendement_dividende)} />
      </Block>

      {/* Évaluation */}
      <Block title="Évaluation">
        <Row label="PER (P/E)" value={formatRatio(r.per)} />
        <Row label="P/B" value={formatRatio(r.pb)} />
        <Row label="P/S" value={formatRatio(r.ps)} />
      </Block>

      {/* Rentabilité */}
      <Block title="Rentabilité">
        <Row label="ROE" value={formatPct(r.roe)} className={colorClass(r.roe)} />
        <Row label="Marge nette" value={formatPct(r.marge_nette)} className={colorClass(r.marge_nette)} />
      </Block>

      {/* Effet de levier */}
      <Block title="Effet de levier">
        <Row label="Dette / Cap. propres" value={formatRatio(r.dette_sur_capitaux_propres)} />
        <Row label="Payout (distrib.)" value={formatPct(r.payout)} className={payoutClass} />
      </Block>

      {/* Croissance */}
      <Block title="Croissance (YoY)">
        <Row label="Croissance CA" value={formatGrowth(r.croissance_ca)} className={r.croissance_ca != null ? colorClass(r.croissance_ca) : 'text-gray-400'} />
        <Row label="Croissance RN" value={formatGrowth(r.croissance_rn)} className={r.croissance_rn != null ? colorClass(r.croissance_rn) : 'text-gray-400'} />
      </Block>
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | tail -5
```
Attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/financials/WeekRange52.tsx frontend/components/financials/FundamentalAnalysis.tsx
git commit -m "feat(financials): WeekRange52 + FundamentalAnalysis (5 blocs KPIs)"
```

---

## Task 5 : Tableaux financiers + FinancialTabs

**Files:**
- Create: `frontend/components/financials/IncomeStatement.tsx`
- Create: `frontend/components/financials/BalanceSheet.tsx`
- Create: `frontend/components/financials/CashFlowStatement.tsx`
- Create: `frontend/components/financials/FinancialTabs.tsx`

- [ ] **Step 1 : Créer `frontend/components/financials/IncomeStatement.tsx`**

```tsx
import type { IncomeStatement } from '@/lib/financials/types';
import { formatXOF } from '@/lib/financials/formatters';

interface Props { rows: IncomeStatement[] }

const LINES: { label: string; key: keyof IncomeStatement; bold?: boolean }[] = [
  { label: 'Revenu total', key: 'revenu_total', bold: true },
  { label: 'Coût des ventes', key: 'cout_ventes' },
  { label: 'Marge brute', key: 'marge_brute', bold: true },
  { label: 'Dépenses exploitation', key: 'depenses_exploitation' },
  { label: 'Frais généraux & admin', key: 'frais_generaux_admin' },
  { label: 'R&D', key: 'depenses_rd' },
  { label: 'Autres dépenses', key: 'autres_depenses' },
  { label: 'Résultat exploitation', key: 'resultat_exploitation', bold: true },
  { label: 'Charges financières nettes', key: 'charges_financieres_nettes' },
  { label: 'Résultat avant impôts', key: 'resultat_avant_impots', bold: true },
  { label: 'Impôts', key: 'impots' },
  { label: 'Résultat net', key: 'resultat_net', bold: true },
  { label: 'BPA', key: 'benefice_par_action' },
  { label: 'BPA dilué', key: 'benefice_par_action_dilue' },
  { label: 'Dividende par action', key: 'dividende_par_action' },
];

export default function IncomeStatementTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted italic p-4">Aucune donnée disponible.</p>;
  }
  const periods = rows.map((r) => r.periode);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted font-medium w-48">Poste</th>
            {periods.map((p) => (
              <th key={p} className="text-right py-2 px-3 text-muted font-medium">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map(({ label, key, bold }) => (
            <tr key={key} className="border-b border-border/20 hover:bg-white/5">
              <td className={`py-2 pr-4 ${bold ? 'font-semibold text-white' : 'text-muted'}`}>{label}</td>
              {rows.map((r) => {
                const val = r[key] as number | null;
                return (
                  <td key={r.periode} className={`py-2 px-3 text-right tabular ${bold ? 'font-semibold text-white' : 'text-white/70'}`}>
                    {key === 'benefice_par_action' || key === 'benefice_par_action_dilue' || key === 'dividende_par_action'
                      ? val != null ? `${val.toFixed(2)} FCFA` : '—'
                      : formatXOF(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `frontend/components/financials/BalanceSheet.tsx`**

```tsx
import type { BalanceSheet } from '@/lib/financials/types';
import { formatXOF } from '@/lib/financials/formatters';

interface Props { rows: BalanceSheet[] }

const LINES: { label: string; key: keyof BalanceSheet; bold?: boolean; section?: boolean }[] = [
  { label: 'ACTIF', key: 'total_actifs', section: true },
  { label: 'Total actifs', key: 'total_actifs', bold: true },
  { label: 'Actif circulant', key: 'total_actif_circulant', bold: true },
  { label: 'Trésorerie & équivalents', key: 'tresorerie_equivalents' },
  { label: 'Placements court terme', key: 'investissements_court_terme' },
  { label: 'Créances clients', key: 'creances_clients' },
  { label: 'Stocks', key: 'stocks' },
  { label: 'Autres actifs courants', key: 'autres_actifs_courants' },
  { label: 'Actif non courant', key: 'total_actif_non_courant', bold: true },
  { label: 'Immobilisations nettes', key: 'immobilisations_nettes' },
  { label: 'Goodwill', key: 'goodwill' },
  { label: 'Actifs incorporels', key: 'actifs_incorporels' },
  { label: 'PASSIF', key: 'total_passif', section: true },
  { label: 'Total passif', key: 'total_passif', bold: true },
  { label: 'Passif courant', key: 'passif_courant', bold: true },
  { label: 'Fournisseurs', key: 'fournisseurs' },
  { label: 'Dette court terme', key: 'dette_court_terme' },
  { label: 'Passif non courant', key: 'passif_non_courant', bold: true },
  { label: 'Dette long terme', key: 'dette_long_terme' },
  { label: 'CAPITAUX PROPRES', key: 'total_capitaux_propres', section: true },
  { label: 'Total capitaux propres', key: 'total_capitaux_propres', bold: true },
  { label: 'Capital social', key: 'capital_social' },
  { label: 'Réserves & RAN', key: 'reserves_benefices_non_repartis' },
];

export default function BalanceSheetTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted italic p-4">Aucune donnée disponible.</p>;
  }
  const periods = rows.map((r) => r.periode);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted font-medium w-48">Poste</th>
            {periods.map((p) => (
              <th key={p} className="text-right py-2 px-3 text-muted font-medium">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map(({ label, key, bold, section }) => (
            <tr key={`${key}-${label}`} className={`border-b ${section ? 'border-border bg-white/5' : 'border-border/20 hover:bg-white/5'}`}>
              <td className={`py-2 pr-4 ${section ? 'font-bold text-muted uppercase text-[10px] tracking-wider' : bold ? 'font-semibold text-white' : 'text-muted'}`}>
                {section ? label : label}
              </td>
              {section ? (
                <td colSpan={periods.length} />
              ) : (
                rows.map((r) => (
                  <td key={r.periode} className={`py-2 px-3 text-right tabular ${bold ? 'font-semibold text-white' : 'text-white/70'}`}>
                    {formatXOF(r[key] as number | null)}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3 : Créer `frontend/components/financials/CashFlowStatement.tsx`**

```tsx
import type { CashFlowStatement } from '@/lib/financials/types';
import { formatXOF } from '@/lib/financials/formatters';

interface Props { rows: CashFlowStatement[] }

const LINES: { label: string; key: keyof CashFlowStatement; bold?: boolean }[] = [
  { label: 'Flux exploitation', key: 'flux_exploitation', bold: true },
  { label: 'Résultat net', key: 'resultat_net' },
  { label: 'Dépréciation & amortissement', key: 'depreciation_amortissement' },
  { label: 'Variation BFR', key: 'variation_bfr' },
  { label: 'Autres éléments hors caisse', key: 'autres_elements_hors_caisse' },
  { label: 'Flux investissement', key: 'flux_investissement', bold: true },
  { label: 'Investissements PPE', key: 'investissements_ppe' },
  { label: 'Acquisitions', key: 'acquisitions' },
  { label: 'Flux financement', key: 'flux_financement', bold: true },
  { label: 'Remboursement dette', key: 'remboursement_dette' },
  { label: 'Dividendes versés', key: 'dividendes_verses' },
  { label: 'Rachat d\'actions', key: 'rachats_actions' },
  { label: 'Variation trésorerie', key: 'variation_tresorerie', bold: true },
  { label: 'Trésorerie fin période', key: 'tresorerie_fin_periode', bold: true },
  { label: 'Dépenses capital (CapEx)', key: 'depenses_capital' },
  { label: 'Flux trésorerie disponible (FCF)', key: 'flux_tresorerie_disponible', bold: true },
];

export default function CashFlowStatementTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted italic p-4">Aucune donnée disponible.</p>;
  }
  const periods = rows.map((r) => r.periode);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted font-medium w-48">Poste</th>
            {periods.map((p) => (
              <th key={p} className="text-right py-2 px-3 text-muted font-medium">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map(({ label, key, bold }) => (
            <tr key={key} className="border-b border-border/20 hover:bg-white/5">
              <td className={`py-2 pr-4 ${bold ? 'font-semibold text-white' : 'text-muted'}`}>{label}</td>
              {rows.map((r) => (
                <td key={r.periode} className={`py-2 px-3 text-right tabular ${bold ? 'font-semibold text-white' : 'text-white/70'}`}>
                  {formatXOF(r[key] as number | null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4 : Créer `frontend/components/financials/FinancialTabs.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import IncomeStatementTable from './IncomeStatement';
import BalanceSheetTable from './BalanceSheet';
import CashFlowStatementTable from './CashFlowStatement';

type Tab = 'income' | 'balance' | 'cashflow';
type Period = 'annuel' | 'trimestriel';

interface Props {
  incomes: IncomeStatement[];
  balances: BalanceSheet[];
  cashflows: CashFlowStatement[];
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'income', label: 'Compte de résultat' },
  { id: 'balance', label: 'Bilan' },
  { id: 'cashflow', label: 'Liquidités' },
];

export default function FinancialTabs({ incomes, balances, cashflows }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('income');
  const [period, setPeriod] = useState<Period>('annuel');

  const filter = <T extends { type_periode: string }>(rows: T[]) =>
    rows.filter((r) => r.type_periode === period);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      {/* Onglets */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                activeTab === id
                  ? 'bg-up/20 text-up font-semibold'
                  : 'text-muted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Toggle période */}
        <div className="flex gap-1 border border-border rounded-lg p-0.5">
          {(['annuel', 'trimestriel'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-1 rounded transition ${
                period === p ? 'bg-border text-white' : 'text-muted hover:text-white'
              }`}
            >
              {p === 'annuel' ? 'Annuel' : 'Trimestriel'}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {activeTab === 'income' && <IncomeStatementTable rows={filter(incomes)} />}
      {activeTab === 'balance' && <BalanceSheetTable rows={filter(balances)} />}
      {activeTab === 'cashflow' && <CashFlowStatementTable rows={filter(cashflows)} />}
    </div>
  );
}
```

- [ ] **Step 5 : Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | tail -5
```
Attendu : 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add frontend/components/financials/
git commit -m "feat(financials): tableaux IncomeStatement + BalanceSheet + CashFlow + FinancialTabs"
```

---

## Task 6 : Page `/actions/[code]/financials` + lien navigation

**Files:**
- Create: `frontend/app/actions/[code]/financials/page.tsx`
- Modify: `frontend/app/actions/[code]/page.tsx` — ajouter lien "Données financières"

- [ ] **Step 1 : Créer `frontend/app/actions/[code]/financials/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import WeekRange52 from '@/components/financials/WeekRange52';
import FundamentalAnalysis from '@/components/financials/FundamentalAnalysis';
import FinancialTabs from '@/components/financials/FinancialTabs';

export const dynamic = 'force-dynamic';

export default async function FinancialsPage({
  params,
}: {
  params: { code: string };
}) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const data = await loadCompanyFinancials(code);

  if (!data) notFound();

  const { designation, cours_actuel, cours_bas_52s, cours_haut_52s, shares, incomes, balances, cashflows } = data;

  const incomeLast = incomes[0] ?? null;
  const incomePrev = incomes[1] ?? null;
  const balanceLast = balances[0] ?? null;

  const ratios = calculateFundamentals({
    cours_actuel,
    cours_bas_52s,
    cours_haut_52s,
    shares,
    incomeLast,
    incomePrev,
    balanceLast,
  });

  return (
    <div className="p-5 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/actions/${code}`} className="text-muted hover:text-up text-sm">
          ← {code}
        </Link>
        <span className="text-muted text-sm">•</span>
        <h1 className="text-lg font-bold">Données financières</h1>
        <span className="text-xs text-muted">{designation}</span>
      </div>

      {/* Barre 52 semaines */}
      <WeekRange52 bas={cours_bas_52s} haut={cours_haut_52s} actuel={cours_actuel} />

      {/* Analyse fondamentale — 5 blocs */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Analyse Fondamentale</h2>
        <FundamentalAnalysis r={ratios} />
      </div>

      {/* Données financières — 3 onglets */}
      <div>
        <h2 className="text-sm font-semibold mb-3">États Financiers</h2>
        <FinancialTabs incomes={incomes} balances={balances} cashflows={cashflows} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Ajouter le lien dans la fiche action existante**

Dans `frontend/app/actions/[code]/page.tsx`, trouver le bloc des boutons dans le header (≈ ligne 218) :

```tsx
        <div className="flex gap-2">
          <PublicationsModal ... />
          <Link href="/portefeuille" ...>🔖 Watchlist</Link>
          <Link href="/portefeuille" ...>⚙️ Alertes</Link>
        </div>
```

Ajouter **avant** le lien Watchlist :

```tsx
          <Link href={`/actions/${code}/financials`} className="text-xs border border-border rounded px-2 py-1 hover:border-up/40 hover:text-up transition">
            📊 Financières
          </Link>
```

- [ ] **Step 3 : Typecheck complet**

```bash
cd frontend && npm run typecheck 2>&1 | tail -10
```
Attendu : 0 erreur.

- [ ] **Step 4 : Commit + push**

```bash
git add frontend/app/actions/
git commit -m "feat(financials): page /actions/[code]/financials + lien navigation"
git push origin main
```

---

## Vérification post-implémentation

1. `npm run dev` — ouvrir `/actions/SNTS/financials`
2. Section barre 52 semaines visible (ou message "non disponible" si colonnes vides)
3. 5 blocs KPIs affichés (valeurs "non disponible" en gris si tables vides)
4. 3 onglets naviguent correctement entre les tableaux
5. Lien "📊 Financières" dans la fiche action `/actions/SNTS` pointe correctement
6. typecheck : 0 erreur
