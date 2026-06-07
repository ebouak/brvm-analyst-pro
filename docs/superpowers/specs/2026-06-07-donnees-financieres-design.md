# Données Financières + Analyse Fondamentale — Design

> **Pour les agents:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un module complet "Données Financières + Analyse Fondamentale" style Trading 212 à la fiche action BRVM Analyst Pro : barre 52 semaines, 5 blocs de KPIs calculés automatiquement, et 3 onglets (Compte de résultat | Bilan | Flux de trésorerie).

**Architecture:** Adaptation Option A — réutilise `brvm_instruments` (code TEXT) et `brvm_actions_daily` comme base. Deux migrations légères. Trois nouvelles tables détaillées (`income_statements`, `balance_sheets`, `cash_flow_statements`) référençant `code TEXT`. Page distincte `/actions/[code]/financials` — ne touche pas à la fiche action existante. Logique pure dans `frontend/lib/financials/`.

**Tech Stack:** TypeScript strict, Next.js 14 App Router, TailwindCSS dark finance, Recharts. Devise XOF — affichage en Md / M / K FCFA.

---

## 1. Migrations SQL

### `0018_financial_statements.sql`

```sql
-- 52 semaines sur brvm_actions_daily (colonnes optionnelles)
alter table public.brvm_actions_daily
  add column if not exists cours_bas_52s  numeric(18,4),
  add column if not exists cours_haut_52s numeric(18,4);

-- Compte de résultat détaillé
create table if not exists public.income_statements (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null references public.brvm_instruments(code) on update cascade,
  periode                     varchar(10) not null,           -- '2024', 'Q1 2024'
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
  -- ACTIF
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
  -- PASSIF
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
  -- CAPITAUX PROPRES
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
  -- Exploitation
  flux_exploitation               bigint,
  resultat_net                    bigint,
  depreciation_amortissement      bigint,
  impots_reportes                 bigint,
  remuneration_actions            bigint,
  variation_bfr                   bigint,
  autres_elements_hors_caisse     bigint,
  -- Investissement
  flux_investissement             bigint,
  investissements_ppe             bigint,
  acquisitions                    bigint,
  achats_placements               bigint,
  ventes_placements               bigint,
  autres_activites_investissement bigint,
  -- Financement
  flux_financement                bigint,
  remboursement_dette             bigint,
  dividendes_verses               bigint,
  rachats_actions                 bigint,
  emissions_actions               bigint,
  autres_activites_financement    bigint,
  -- Récapitulatif
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

create policy "lecture publique income_statements"    on public.income_statements    for select using (true);
create policy "lecture publique balance_sheets"       on public.balance_sheets       for select using (true);
create policy "lecture publique cash_flow_statements" on public.cash_flow_statements for select using (true);
```

---

## 2. Structure des fichiers frontend

```
frontend/
├── app/actions/[code]/financials/
│   └── page.tsx                         ← Server Component (charge données + calcule ratios)
├── components/financials/
│   ├── WeekRange52.tsx                  ← Barre 52 semaines (visuel non interactif)
│   ├── FundamentalAnalysis.tsx          ← 5 blocs KPIs Trading 212
│   ├── FinancialTabs.tsx                ← Onglets Résultat | Bilan | Liquidités
│   ├── IncomeStatement.tsx              ← Tableau compte de résultat
│   ├── BalanceSheet.tsx                 ← Tableau bilan
│   └── CashFlowStatement.tsx           ← Tableau flux de trésorerie
└── lib/financials/
    ├── types.ts                         ← Types partagés
    ├── queries.ts                       ← Requêtes Supabase (code TEXT, pas UUID)
    ├── formatters.ts                    ← formatXOF, formatPct, formatRatio, formatGrowth, colorClass
    └── fundamentals.ts                  ← calculateFundamentals (logique pure)
```

---

## 3. Types (`frontend/lib/financials/types.ts`)

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
  // Bloc 1 — Générales
  capitalisation: number | null;
  bpa: number | null;
  rendement_dividende: number | null;
  // Bloc 2 — Évaluation
  per: number | null;
  pb: number | null;
  ps: number | null;
  // Bloc 3 — Rentabilité
  roe: number | null;
  marge_nette: number | null;
  // Bloc 4 — Effet de levier
  dette_sur_capitaux_propres: number | null;
  payout: number | null;
  // Bloc 5 — Croissance
  croissance_ca: number | null;
  croissance_rn: number | null;
  // 52 semaines
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  cours_actuel: number | null;
}
```

---

## 4. Requêtes (`frontend/lib/financials/queries.ts`)

Utilise `code TEXT` (pas UUID). Deux étapes séquentielles : d'abord vérifier que l'instrument existe, puis charger les données en parallèle.

```ts
export async function loadCompanyFinancials(code: string): Promise<FinancialsData | null>
```

- Étape 1 : `brvm_instruments` WHERE code = $1 (vérifie existence)
- Étape 2 (parallèle) :
  - `brvm_actions_daily` ORDER BY date_marche DESC LIMIT 1 (cours actuel + 52s si dispo)
  - `income_statements` WHERE code = $1 AND type_periode = 'annuel' ORDER BY periode DESC LIMIT 10
  - `balance_sheets` idem
  - `cash_flow_statements` idem
- Si instrument non trouvé → return null

---

## 5. Calculs fondamentaux (`frontend/lib/financials/fundamentals.ts`)

Logique pure (aucun import React, aucun fetch). Prend les données brutes, retourne `FundamentalRatios`.

**Sources des données de marché :** `brvm_actions_daily` fournit `cours_jour` (cours actuel) et les nouvelles colonnes `cours_bas_52s` / `cours_haut_52s`. La capitalisation est calculée si absente : `cours_jour × shares` (depuis `brvm_instruments.shares`).

**Calculs :**
- `rendement_dividende` = `(dividende_par_action / cours_actuel) × 100`
- `per` = `cours_actuel / benefice_par_action`
- `pb` = `(cours_actuel × shares) / total_capitaux_propres`
- `ps` = `(cours_actuel × shares) / revenu_total`
- `roe` = `(resultat_net / total_capitaux_propres) × 100`
- `marge_nette` = `(resultat_net / revenu_total) × 100`
- `dette_totale` = `dette_court_terme + dette_long_terme`
- `dette_sur_capitaux_propres` = `dette_totale / total_capitaux_propres`
- `payout` = `(dividende_par_action × actions_en_circulation) / resultat_net × 100`
- `croissance_ca` = `(revenu_N - revenu_N1) / |revenu_N1| × 100`
- `croissance_rn` = `(rn_N - rn_N1) / |rn_N1| × 100`
- Division par zéro → null

---

## 6. Formatters (`frontend/lib/financials/formatters.ts`)

```ts
formatXOF(value)    // → "532,80 Md FCFA" | "45,2 M FCFA" | "—"
formatCours(value)  // → "3 300" (espace milliers FR, 0-2 décimales)
formatPct(value)    // → "28,4 %" | "non disponible"
formatRatio(value)  // → "16,63" | "non disponible"
formatGrowth(value) // → "+12,3 %" | "-5,1 %" | "non disponible"
colorClass(value)   // → "text-green-400" | "text-red-400" | "text-white" | "text-gray-400"
```

Seuils `colorClass` :
- null → `text-gray-400`
- > 0 → `text-green-400`
- < 0 → `text-red-400`
- option `inverse: true` → couleurs inversées (pour dettes)
- option `threshold` → seuil custom

---

## 7. Composants UI

### `WeekRange52.tsx`
Slider visuel non interactif. Position curseur = `((cours_actuel - bas) / (haut - bas)) × 100`. Curseur vert `#4ade80` sur track grise. Labels `Bas: X` et `Haut: Y` en FCFA formatés. Si bas == haut ou données manquantes → barre complète grise sans curseur.

### `FundamentalAnalysis.tsx`
5 blocs en grille 2 colonnes (Générales, Évaluation, Rentabilité, Effet de levier, Croissance). Chaque ligne : label gris `text-muted` à gauche, valeur colorée à droite. Règles de couleur :
- BPA et rendement dividende positifs → `text-green-400`
- ROE et marge nette → colorés selon signe
- Payout > 100% → `text-orange-400`
- Croissance → `text-green-400` / `text-red-400` avec préfixe `+`/`-`
- Ratios (PER, P/B, P/S) → `text-white`
- null → `text-gray-400` + "non disponible" en italique

### `FinancialTabs.tsx`
Client component (`'use client'`). 3 onglets : "Compte de résultat" | "Bilan" | "Liquidités". Données passées en props depuis le Server Component parent. Toggle Annuel / Trimestriel (filtre local sur `type_periode`).

### `IncomeStatement.tsx`, `BalanceSheet.tsx`, `CashFlowStatement.tsx`
Tableaux avec colonnes = périodes (années). Lignes = postes financiers. Valeurs formatées `formatXOF`. Lignes de sous-total en gras.

### `page.tsx` (Server Component)
Route : `/actions/[code]/financials`. Charge données via `loadCompanyFinancials`, calcule `FundamentalRatios` via `calculateFundamentals`, passe tout aux composants. Lien retour vers `/actions/[code]`. Si `loadCompanyFinancials` retourne null → `notFound()`.

---

## 8. Navigation

Ajouter un lien "📊 Données financières" dans la fiche action existante (`/actions/[code]/page.tsx`) pointant vers `/actions/[code]/financials`. Placement : dans la barre de boutons en haut (à côté de "Publications", "Watchlist").

---

## 9. Aucune table existante modifiée (sauf colonnes optionnelles)

- `brvm_instruments` : inchangée
- `brvm_actions_daily` : 2 colonnes NULLABLE ajoutées (`cours_bas_52s`, `cours_haut_52s`)
- `fundamentals` : inchangée (coexiste avec les nouvelles tables détaillées)
- Nouvelles tables : `income_statements`, `balance_sheets`, `cash_flow_statements` (toutes référencent `code TEXT`)

---

## 10. Tests

Fichier `frontend/lib/financials/fundamentals.test.ts` (si vitest configuré) ou vérification via typecheck :
- `calculateFundamentals` : données complètes → tous ratios non-null
- `calculateFundamentals` : résultat net = 0 → per null, marge null
- `calculateFundamentals` : income_prev null → croissance null
- `formatXOF` : 1_500_000_000 → "1,50 Md FCFA"
- `colorClass` : null → "text-gray-400", 5 → "text-green-400", -3 → "text-red-400"
