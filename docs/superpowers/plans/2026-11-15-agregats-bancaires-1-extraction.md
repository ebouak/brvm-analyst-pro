# Agrégats bancaires — 1. Extraction sourcée, contrôles, sélection, relecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lire les agrégats bancaires (PNB, marge d'intérêts, coût du risque, encours, solvabilité…) dans les PDF publiés des 16 banques, les contrôler, retenir les valeurs concordantes dans `lignes_specifiques` (avec leur source dans `sources_specifiques`), et envoyer tout le douteux dans une file de relecture admin — sans rien publier de douteux.

**Architecture:** Une observation par valeur et par document dans `indicateur_source` (0147, étendue par la migration 0245). Gemini lit le PDF entier (fonction existante `jsonDepuisPdf`), sortie validée par zod, normalisée en FCFA par une fonction pure, soumise à cinq contrôles purs, puis la règle de sélection de 0147 (étendue aux montants et à l'état de contrôle) écrit la valeur retenue. Une reprise de l'historique tourne À BLANC et produit un rapport ; l'écriture réelle ne relit pas les PDF, elle insère les observations du rapport approuvé.

**Tech Stack:** Node 22 / TypeScript ESM (scraper), zod, @supabase/supabase-js, vitest ; Next.js 15 App Router (page admin) ; Supabase Postgres (RLS).

Spécification : `docs/superpowers/specs/2026-11-15-agregats-bancaires-design.md` (§3, §4, §6, §7 points 1 et 3). Le plan 2 (`2026-11-15-agregats-bancaires-2-affichage.md`) lit ce que ce plan écrit.

---

## Conventions à respecter (lire avant de commencer)

- Tests scraper : lancer vitest depuis un chemin `C:` en MAJUSCULE, sinon les alias de chemins échouent sous Windows :
  `cd C:\tmp\wt-banques\scraper; npx vitest run tests/<fichier>.test.ts`
- Imports scraper relatifs AVEC l'extension `.js` (`import { x } from './indicateurs.js'`).
- Aucun chiffre deviné : une valeur absente est `non_trouve`, jamais 0.
- Un ratio n'est jamais extrait ni écrit par ce plan (coefficient d'exploitation, coût du risque relatif, crédits ÷ dépôts, ROE sont CALCULÉS par le plan 2). Les ratios PRUDENTIELS publiés (solvabilité, CET1, Tier 1, taux et couverture des créances en souffrance) sont des indicateurs de 0147, définitions inchangées.
- Numéro de migration : `0245` (0243 et 0244 sont réservés à d'autres PR). Vérifier avant d'écrire : `git -C C:\tmp\wt-banques ls-tree --name-only origin/main supabase/migrations/ | Select-Object -Last 5`. Si `0245` est pris, prendre le premier libre au-dessus et renommer partout dans ce plan.

## Avenant du 2026-11-15 — décisions de l'exploitant (PRIMENT sur le reste du plan)

Là où une tâche ci-dessous contredit cet avenant, l'avenant l'emporte. Worktree
d'exécution : `C:\tmp\wt-banq-extr` (lire ce chemin à la place de
`C:\tmp\wt-banques` dans toutes les commandes).

**D1 — ETIT publie en USD : extrait et affiché EN USD, sans conversion.**
- Task 6 (`normaliser`) : devise FCFA (ou absente) → `unite = 'fcfa'` ; devise
  USD → `unite = 'usd'`, statut `publie`, valeur = nombre × unité imprimée,
  AUCUN taux de change. Toute autre devise reste `publie_non_exploitable`
  (`definition_incompatible`). Le test « ETIT » attend `publie` + `usd`. La
  colonne `unite` de 0147 accepte déjà `usd` : rien à changer en base.
- Task 7 (`controler`) : une observation en USD n'est jamais rapprochée d'une
  référence de la base (les comptes ETIT en base sont CONVERTIS en FCFA,
  migrations 0115/0116 : comparer exigerait un taux, interdit). Unité plausible
  contre le total du bilan DU MÊME DOCUMENT et de la même unité seulement ;
  sans lui, bornes absolues du total du bilan [0,1 ; 100] Md USD. Égalités
  comptables : uniquement entre valeurs de même unité. Variation N−1 : clé
  `indicateur|perimetre|unite`.
- Task 9 (`selectionnerExercice`, montants) : deux montants d'unités
  différentes (USD et FCFA) ne se rapprochent pas → `conflit` (relecture).
- Task 10 (`ecritures`) : `sources_specifiques[clé]` porte `unite`
  (`fcfa` | `usd` | `pct`) ; c'est par elle que l'affichage (plan 2) écrit
  « USD ». Les ratios se calculent sans conversion (numérateur et dénominateur
  dans la même unité).
- Task 15 : la file affiche l'unité réelle (USD / FCFA / %) ; une correction
  garde l'unité de l'observation (`usd` pour un document en USD).
- Procédure PR 3 : ETIT n'est plus « tout non exploitable » ; ses agrégats
  sortent en USD.

**D2 — Une décision de relecture s'applique IMMÉDIATEMENT.**
- La route `POST /api/admin/agregats/relecture/[id]` (Task 15), après avoir
  changé l'état des observations et clos l'élément, REJOUE la sélection pour
  cette banque seule et écrit la valeur retenue (lignes_specifiques,
  sources_specifiques, trace `correction_champ` `corrige_par =
  'relecture-agregats'`, nouveaux éléments de relecture éventuels), sans
  attendre le cron. Un échec de cette application renvoie 500 avec un message
  explicite (la décision reste enregistrée ; le cron la réappliquera) — jamais
  un succès silencieux.
- Pour cela le frontend porte une COPIE des modules purs de sélection
  (`frontend/lib/agregats/pure/`, chemins relatifs identiques au scraper :
  `agregats/{indicateurs,dates,nombres,ecritures}.ts`,
  `prudentiel/{rapprochement,montants,selection}.ts`), générée par
  `frontend/scripts/copier-agregats-purs.mjs` et vérifiée par
  `frontend/lib/agregats/pure/copie.test.ts` (contenu identique au scraper,
  aux seules extensions `.js` d'import près). Toute correction se fait côté
  scraper, puis on relance le script.
- Pour que la copie soit fermée, Task 3 sépare les dates (`CodePeriode`,
  `dateArreteDe`, `moisDe`, `periodeDeDate`) dans `scraper/src/agregats/dates.ts`
  (sans dépendance), `periode.ts` les réexporte et garde `periodeDuDocument`.
- I/O frontend : `frontend/lib/admin/rejouerSelection.ts` (miroir de
  `runSelectionAgregats.ts`, une banque). Test scraper ajouté (Task 10) :
  après validation (une observation `valide`, l'autre `rejete`), la valeur est
  retenue et aucune relecture n'est rouverte.

**D3 — Le `coefficient_exploitation` déjà stocké est CONSERVÉ comme recoupement.**
- Task 7 : `Reference.coefficientBase` (= `lignes_specifiques.coefficient_exploitation`
  de la même période, en %). Si PNB et charges d'exploitation sont publiés dans
  le même document, à la même date, même périmètre et même unité, le
  coefficient recalculé (|charges| ÷ PNB × 100) est comparé au stocké : écart
  > `TOLERANCE_COEFFICIENT` (1 point) → PNB et charges d'exploitation
  `a_relire`, motif chiffré. Le coefficient n'est jamais extrait ni écrit.
- Task 12 : `reference()` lit ce coefficient.
- Affichage : il n'est PLUS affiché (le plan 2 affiche le coefficient
  recalculé) — note reportée dans le plan 2.

**D4 — Exécution tâche par tâche, test d'abord, un commit par tâche.**

**Limites de cette exécution** : la migration 0245 est ÉCRITE, pas appliquée ;
Task 16 Steps 1-3 (application, RLS à la clé publique, `get_advisors`) restent
à faire par l'exploitant APRÈS le déploiement de Task 1 Step 2. Aucune
écriture en production, aucun message réel. Comme 0245 n'est pas appliquée, la
reprise à blanc tolère l'absence des colonnes de 0245 (lecture en repli,
signalée dans le rapport) pour pouvoir produire rapport et fixtures avant
l'application.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0245_agregats_bancaires.sql` | indicateurs étendus, colonnes période/extrait/publication/unité source/contrôle, table `indicateur_relecture`, colonne `sources_specifiques`, RLS fermée |
| `frontend/app/actions/[code]/financials/page.tsx` (modif.) | lit `indicateur_source` avec le client service_role (la lecture publique disparaît) |
| `scraper/src/agregats/indicateurs.ts` | catalogue des indicateurs : nature, table, clé `lignes_specifiques` |
| `scraper/src/agregats/periode.ts` | période d'un document (libellé) et d'une date d'arrêté |
| `scraper/src/agregats/schema.ts` | schéma zod de la réponse Gemini + prompt |
| `scraper/src/agregats/nombres.ts` | lecture d'un nombre imprimé, granularité |
| `scraper/src/agregats/normaliser.ts` | réponse Gemini → observations FCFA |
| `scraper/src/agregats/controles.ts` | les cinq contrôles purs |
| `scraper/src/prudentiel/montants.ts` | rapprochement de deux montants à la granularité publiée |
| `scraper/src/prudentiel/selection.ts` (modif.) | état de contrôle, montants, décision `a_relire` |
| `scraper/src/prudentiel/runSelection.ts` (modif.) | lit les nouvelles colonnes |
| `scraper/src/agregats/ecritures.ts` | décisions → mises à jour de lignes + éléments de relecture (pur) |
| `scraper/src/agregats/rapport.ts` | rapport de reprise (pur) |
| `scraper/src/agregats/alerte.ts` | message Telegram exploitant (pur) |
| `scraper/src/agregats/runExtraction.ts` | I/O : publications → Gemini → observations contrôlées |
| `scraper/src/agregats/runSelectionAgregats.ts` | I/O : sélection, écriture, file de relecture |
| `scraper/src/agregats/runAgregats.ts` | orchestration cron + reprise |
| `scraper/src/index.ts` (modif.) | commandes `agregats:bancaires`, `agregats:reprise` |
| `scraper/package.json` (modif.) | scripts npm |
| `.github/workflows/interim.yml` (modif.) | étape après les intermédiaires, secrets Telegram |
| `frontend/lib/admin/relecture.ts` | actions de relecture (pur) + libellés |
| `frontend/lib/admin/relectureServeur.ts` | chargement de la file (service_role) |
| `frontend/app/api/admin/agregats/relecture/[id]/route.ts` | valider / corriger / rejeter + audit |
| `frontend/app/admin/agregats/page.tsx`, `RelectureActions.tsx` | page de relecture |
| `frontend/lib/admin-nav.ts` (modif.) | entrée de menu |
| `scraper/tests/agregats*.test.ts`, `scraper/tests/selectionPrudentielle.test.ts` (modif.) | tests |
| `scraper/tests/fixtures/agregats/*.json` | réponses Gemini gelées (SIBC, SGBC, CBIBF, un scan) |

Correspondance indicateur → clé `lignes_specifiques` (source unique : `indicateurs.ts`, Task 2). Les clés existantes sont reprises telles quelles (`produit_interets`, `ratio_solvabilite`…) pour que `frontend/lib/bank/kpis.ts` continue de les lire.

---

### Task 1: Migration 0245 et lecture service_role de la page financials

**Files:**
- Create: `supabase/migrations/0245_agregats_bancaires.sql`
- Modify: `frontend/app/actions/[code]/financials/page.tsx:33` (import) et `:179-184` (lecture)

- [ ] **Step 1: Écrire la migration**

```sql
-- 0245 — Agrégats bancaires : observations sourcées étendues, file de relecture.
-- Spec : docs/superpowers/specs/2026-11-15-agregats-bancaires-design.md (§4).
--
-- indicateur_source (0147) reçoit les agrégats du compte de résultat et du
-- bilan bancaire. Une ligne = une valeur (ou une absence constatée) dans UN
-- document. Les montants sont stockés en FCFA (unite = 'fcfa') ; l'unité
-- imprimée est gardée dans unite_source pour comparer deux documents à la
-- précision la moins fine.
--
-- AUCUNE LECTURE PUBLIQUE (changement par rapport à 0147) : extraits et pages
-- servent la relecture, le site lit la valeur retenue dans lignes_specifiques
-- et sa source dans sources_specifiques. Écriture service_role seule.
-- Aucune donnée personnelle : données de marché et documents publiés.

-- 1. Indicateurs autorisés (contrainte de colonne nommée par Postgres).
alter table public.indicateur_source drop constraint if exists indicateur_source_indicateur_check;
alter table public.indicateur_source add constraint indicateur_source_indicateur_check check (indicateur in (
  -- 0147, inchangés
  'solvabilite_total', 'ratio_cet1', 'ratio_tier1', 'ratio_levier', 'ratio_liquidite',
  'creances_souffrance_brutes', 'taux_creances_souffrance', 'couverture_creances_souffrance',
  'taux_creances_restructurees', 'taux_sinistralite',
  -- compte de résultat (flux cumulés depuis le début de l'exercice)
  'pnb', 'produits_interets', 'charges_interets', 'marge_interets', 'commissions_nettes',
  'charges_exploitation', 'resultat_brut_exploitation', 'cout_du_risque', 'resultat_net',
  -- bilan (encours à la date d'arrêté)
  'total_bilan', 'credits_clientele', 'depots_clientele', 'fonds_propres'));

-- 2. Période, extrait, document, unité imprimée, état de contrôle.
alter table public.indicateur_source
  add column if not exists periode text not null default 'exercice'
    check (periode in ('exercice', 'S1', 'T1', 'T3')),
  add column if not exists extrait text check (extrait is null or length(extrait) <= 600),
  add column if not exists publication_id uuid references public.publications(id) on delete set null,
  add column if not exists unite_source text
    check (unite_source in ('unites', 'milliers', 'millions', 'milliards', 'pct')),
  add column if not exists devise_source text,
  add column if not exists controle text not null default 'ok'
    check (controle in ('ok', 'a_relire', 'valide', 'rejete')),
  add column if not exists controle_motif text;

comment on column public.indicateur_source.periode is
  'exercice = 12 mois au 31/12 ; S1, T1, T3 = cumul depuis le début de l''exercice (date_arrete au 30/06, 31/03, 30/09).';
comment on column public.indicateur_source.controle is
  'ok = contrôles passés ; a_relire = un contrôle a échoué, rien n''est retenu ; valide = confirmé en relecture ; rejete = écarté en relecture.';
comment on column public.indicateur_source.extrait is
  'Passage du document où la valeur a été lue (600 caractères au plus), pour la relecture.';

create index if not exists idx_indicateur_source_document on public.indicateur_source (document_url);
create index if not exists idx_indicateur_source_controle on public.indicateur_source (controle) where controle = 'a_relire';

-- 3. File de relecture : une ligne par (valeur, période, périmètre) bloquée.
create table if not exists public.indicateur_relecture (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  indicateur      text not null,
  periode         text not null check (periode in ('exercice', 'S1', 'T1', 'T3')),
  date_arrete     date not null,
  perimetre       text not null check (perimetre in ('individuel', 'consolide', 'non_precise')),
  raison          text not null check (raison in ('contradiction', 'controle')),
  detail          text not null,
  observations    uuid[] not null,
  statut          text not null default 'ouverte' check (statut in ('ouverte', 'validee', 'corrigee', 'rejetee')),
  valeur_corrigee numeric,
  traite_le       timestamptz,
  cree_le         timestamptz not null default now()
);
comment on table public.indicateur_relecture is
  'Agrégats bancaires bloqués (contradiction entre documents ou contrôle en échec). Traités dans /admin/agregats ; l''auteur est journalisé dans admin_audit_logs, pas ici.';
create unique index if not exists indicateur_relecture_ouverte
  on public.indicateur_relecture (code, indicateur, date_arrete, perimetre) where statut = 'ouverte';

-- 4. Source de chaque valeur retenue, à côté de lignes_specifiques.
--    { "<clé>": { "document_url", "document_libelle", "page", "perimetre", "observation" } }
alter table public.income_statements add column if not exists sources_specifiques jsonb;
alter table public.balance_sheets   add column if not exists sources_specifiques jsonb;
comment on column public.income_statements.sources_specifiques is
  'Document, page et périmètre de chaque clé de lignes_specifiques retenue par la sélection des agrégats bancaires.';
comment on column public.balance_sheets.sources_specifiques is
  'Document, page et périmètre de chaque clé de lignes_specifiques retenue par la sélection des agrégats bancaires.';

-- 5. RLS : fermer la lecture publique, service_role seul.
alter table public.indicateur_source enable row level security;
drop policy if exists "indicateur_source lecture publique" on public.indicateur_source;
-- PUBLIC seul ne suffit pas : Supabase pose des grants nominatifs (leçon de 0093).
revoke all on public.indicateur_source from public, anon, authenticated;

alter table public.indicateur_relecture enable row level security;
revoke all on public.indicateur_relecture from public, anon, authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Basculer la seule lecture anonyme existante sur service_role**

Dans `frontend/app/actions/[code]/financials/page.tsx`, ajouter l'import après la ligne `import { createClient } from '@/lib/supabase/server';` :

```ts
import { getServiceClient } from '@/lib/billing/serviceClient';
```

Remplacer le bloc :

```ts
  // Pourquoi la solvabilité manque, s'il manque : ce que disent les documents
  // consultés pour l'exercice du bilan affiché (indicateur_source, lecture publique).
  const obsPrudentielles: ObsIndicateur[] = data.instrument.famille_comptable === 'banque'
    ? ((await createClient().from('indicateur_source')
```

par :

```ts
  // Pourquoi la solvabilité manque, s'il manque : ce que disent les documents
  // consultés pour l'exercice du bilan affiché. indicateur_source n'est plus
  // lisible publiquement (migration 0245) : lecture serveur en service_role.
  const obsPrudentielles: ObsIndicateur[] = data.instrument.famille_comptable === 'banque'
    ? ((await getServiceClient().from('indicateur_source')
```

Les autres lecteurs (`app/api/diagnostic/[code]/route.ts`, `components/diagnostic/GraphiquesDiagnostic.tsx`) utilisent déjà un client service_role : vérifier avec
`rg -n "from\('indicateur_source'\)" C:\tmp\wt-banques\frontend C:\tmp\wt-banques\video` — chaque résultat doit passer par `admin`, `createSbAdmin` ou `getServiceClient`.

- [ ] **Step 3: Typecheck frontend**

Run: `cd C:\tmp\wt-banques\frontend; npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git -C C:\tmp\wt-banques add supabase/migrations/0245_agregats_bancaires.sql "frontend/app/actions/[code]/financials/page.tsx"
git -C C:\tmp\wt-banques commit -m "feat(banques): migration 0245, observations d'agrégats et file de relecture"
```

> La migration n'est appliquée qu'APRÈS le déploiement du Step 2 en production (sinon la page financials perd ses libellés d'absence pendant l'intervalle). Application et tests RLS : Task 16.

---

### Task 2: Catalogue des indicateurs

**Files:**
- Create: `scraper/src/agregats/indicateurs.ts`
- Test: `scraper/tests/agregatsIndicateurs.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { AGREGATS, INDICATEURS_AGREGATS, defDe } from '../src/agregats/indicateurs.js';

describe('catalogue des agrégats bancaires', () => {
  it('chaque indicateur est unique', () => {
    expect(new Set(INDICATEURS_AGREGATS).size).toBe(INDICATEURS_AGREGATS.length);
  });

  it('reprend les clés existantes de lignes_specifiques lues par lib/bank/kpis.ts', () => {
    expect(defDe('produits_interets')).toMatchObject({ table: 'income_statements', cle: 'produit_interets' });
    expect(defDe('solvabilite_total')).toMatchObject({ table: 'balance_sheets', cle: 'ratio_solvabilite', nature: 'ratio' });
    expect(defDe('credits_clientele')).toMatchObject({ table: 'balance_sheets', cle: 'credits_clientele', nature: 'encours' });
  });

  it('le résultat net est lu pour le recoupement seulement : aucune clé écrite', () => {
    expect(defDe('resultat_net')).toMatchObject({ nature: 'flux', cle: null });
  });

  it('aucun ratio calculé n’est un indicateur extrait', () => {
    for (const r of ['coefficient_exploitation', 'cout_du_risque_relatif', 'credits_sur_depots', 'roe']) {
      expect(INDICATEURS_AGREGATS).not.toContain(r);
    }
  });

  it('les flux vont au compte de résultat, les encours et ratios au bilan', () => {
    for (const a of AGREGATS) {
      expect(a.table).toBe(a.nature === 'flux' ? 'income_statements' : 'balance_sheets');
    }
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsIndicateurs.test.ts`
Expected: FAIL — `Cannot find module '../src/agregats/indicateurs.js'`.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Catalogue des agrégats bancaires extraits des documents publiés — PUR.
 * Spec 2026-11-15 §3. Source unique de la correspondance indicateur →
 * (table, clé de lignes_specifiques). Un ratio CALCULÉ n'apparaît jamais ici :
 * il est dérivé à l'affichage (frontend/lib/bank/lecture.ts).
 *
 * Signes : charges d'intérêts, charges d'exploitation et coût du risque sont
 * stockés POSITIFS quand ce sont des charges ; un coût du risque négatif est
 * une reprise nette (même convention que src/annuel/complement.ts).
 */
export type Nature = 'flux' | 'encours' | 'ratio';
export type TableCible = 'income_statements' | 'balance_sheets';

export interface DefIndicateur {
  indicateur: string;
  libelle: string;
  nature: Nature;
  table: TableCible;
  /** Clé de lignes_specifiques ; null = lu pour recoupement seulement. */
  cle: string | null;
}

export const AGREGATS: readonly DefIndicateur[] = [
  { indicateur: 'pnb', libelle: 'Produit net bancaire', nature: 'flux', table: 'income_statements', cle: 'pnb' },
  { indicateur: 'produits_interets', libelle: 'Intérêts et produits assimilés', nature: 'flux', table: 'income_statements', cle: 'produit_interets' },
  { indicateur: 'charges_interets', libelle: 'Intérêts et charges assimilées', nature: 'flux', table: 'income_statements', cle: 'charges_interets' },
  { indicateur: 'marge_interets', libelle: 'Marge d’intérêts', nature: 'flux', table: 'income_statements', cle: 'marge_interets' },
  { indicateur: 'commissions_nettes', libelle: 'Commissions nettes', nature: 'flux', table: 'income_statements', cle: 'commissions_nettes' },
  { indicateur: 'charges_exploitation', libelle: 'Charges d’exploitation', nature: 'flux', table: 'income_statements', cle: 'charges_exploitation' },
  { indicateur: 'resultat_brut_exploitation', libelle: 'Résultat brut d’exploitation', nature: 'flux', table: 'income_statements', cle: 'resultat_brut_exploitation' },
  { indicateur: 'cout_du_risque', libelle: 'Coût du risque', nature: 'flux', table: 'income_statements', cle: 'cout_du_risque' },
  { indicateur: 'resultat_net', libelle: 'Résultat net', nature: 'flux', table: 'income_statements', cle: null },
  { indicateur: 'total_bilan', libelle: 'Total du bilan', nature: 'encours', table: 'balance_sheets', cle: 'total_bilan' },
  { indicateur: 'credits_clientele', libelle: 'Crédits à la clientèle', nature: 'encours', table: 'balance_sheets', cle: 'credits_clientele' },
  { indicateur: 'depots_clientele', libelle: 'Dépôts de la clientèle', nature: 'encours', table: 'balance_sheets', cle: 'depots_clientele' },
  { indicateur: 'fonds_propres', libelle: 'Fonds propres', nature: 'encours', table: 'balance_sheets', cle: 'fonds_propres' },
  { indicateur: 'creances_souffrance_brutes', libelle: 'Créances en souffrance brutes', nature: 'encours', table: 'balance_sheets', cle: 'creances_souffrance_brutes' },
  { indicateur: 'taux_creances_souffrance', libelle: 'Taux de créances en souffrance', nature: 'ratio', table: 'balance_sheets', cle: 'taux_creances_souffrance' },
  { indicateur: 'couverture_creances_souffrance', libelle: 'Couverture des créances en souffrance', nature: 'ratio', table: 'balance_sheets', cle: 'couverture_creances_souffrance' },
  { indicateur: 'solvabilite_total', libelle: 'Solvabilité totale', nature: 'ratio', table: 'balance_sheets', cle: 'ratio_solvabilite' },
  { indicateur: 'ratio_cet1', libelle: 'Ratio CET1', nature: 'ratio', table: 'balance_sheets', cle: 'ratio_cet1' },
  { indicateur: 'ratio_tier1', libelle: 'Ratio Tier 1', nature: 'ratio', table: 'balance_sheets', cle: 'ratio_tier1' },
];

export const INDICATEURS_AGREGATS: string[] = AGREGATS.map((a) => a.indicateur);

const PAR_INDICATEUR = new Map(AGREGATS.map((a) => [a.indicateur, a]));

export function defDe(indicateur: string): DefIndicateur | null {
  return PAR_INDICATEUR.get(indicateur) ?? null;
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsIndicateurs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/indicateurs.ts scraper/tests/agregatsIndicateurs.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): catalogue des agrégats bancaires extraits"
```

---

### Task 3: Période d'un document et d'une date d'arrêté

**Files:**
- Create: `scraper/src/agregats/periode.ts`
- Test: `scraper/tests/agregatsPeriode.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { periodeDuDocument, periodeDeDate, dateArreteDe, moisDe } from '../src/agregats/periode.js';

describe('periodeDuDocument', () => {
  it.each([
    ['Rapport d\'activités - 1er semestre 2026 - SOCIETE GENERALE CI', 'rapport', { annee: 2026, code: 'S1', dateArrete: '2026-06-30' }],
    ['Etats financiers - 1er semestre 2026 - BOA BF', 'etats_financiers', { annee: 2026, code: 'S1', dateArrete: '2026-06-30' }],
    ['Rapport d\'activités - 3ème trimestre 2026 - SIB CI', 'rapport', { annee: 2026, code: 'T3', dateArrete: '2026-09-30' }],
    ['Etats financiers annuels 2025 - CORIS BANK INTERNATIONAL BF', 'etats_financiers', { annee: 2025, code: 'exercice', dateArrete: '2025-12-31' }],
    ['Rapport annuel 2024 - SGBCI', 'rapport', { annee: 2024, code: 'exercice', dateArrete: '2024-12-31' }],
    ['Bilan au 31 décembre 2025 - BICICI', 'bilan', { annee: 2025, code: 'exercice', dateArrete: '2025-12-31' }],
    ['Communiqué sur les résultats annuels 2025 - SIB', 'autre', { annee: 2025, code: 'exercice', dateArrete: '2025-12-31' }],
  ])('%s', (libelle, type, attendu) => {
    expect(periodeDuDocument(libelle, type)).toEqual(attendu);
  });

  it.each([
    ['Avis de convocation à l\'assemblée générale 2026', 'ag'],
    ['Bilan semestriel du contrat de liquidité - 1er semestre 2026', 'bilan'],
    ['Etats financiers 2024 et 2025 - XYZ', 'etats_financiers'], // deux années : ambigu
    ['Communiqué de notation 2026', 'notation'],
  ])('écarte « %s »', (libelle, type) => {
    expect(periodeDuDocument(libelle, type)).toBeNull();
  });
});

describe('dates d’arrêté', () => {
  it('date → période', () => {
    expect(periodeDeDate('2026-06-30')).toBe('S1');
    expect(periodeDeDate('2025-12-31')).toBe('exercice');
    expect(periodeDeDate('2026-03-31')).toBe('T1');
    expect(periodeDeDate('2026-09-30')).toBe('T3');
    expect(periodeDeDate('2026-05-31')).toBeNull();
  });
  it('période → date et mois', () => {
    expect(dateArreteDe(2026, 'S1')).toBe('2026-06-30');
    expect(moisDe('T3')).toBe(9);
    expect(moisDe('exercice')).toBe(12);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsPeriode.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Période des agrégats bancaires — PUR. Les intermédiaires réutilisent la
 * règle de src/interim/periode.ts (cumul depuis le début de l'exercice, un
 * « 2e trimestre » vaut S1, un libellé à deux périodes est ambigu). Un
 * document annuel est reconnu par son libellé et une SEULE année.
 */
import { periodeDuLibelle } from '../interim/periode.js';

export type CodePeriode = 'exercice' | 'S1' | 'T1' | 'T3';

export interface PeriodeDoc {
  annee: number;
  code: CodePeriode;
  dateArrete: string;
}

const FIN: Record<CodePeriode, string> = { T1: '03-31', S1: '06-30', T3: '09-30', exercice: '12-31' };
const MOIS: Record<CodePeriode, number> = { T1: 3, S1: 6, T3: 9, exercice: 12 };

export const dateArreteDe = (annee: number, code: CodePeriode): string => `${annee}-${FIN[code]}`;
export const moisDe = (code: CodePeriode): number => MOIS[code];

export function periodeDeDate(date: string): CodePeriode | null {
  const fin = date.slice(5);
  const trouve = (Object.entries(FIN) as [CodePeriode, string][]).find(([, f]) => f === fin);
  return trouve ? trouve[0] : null;
}

const SANS_COMPTES = /contrat\s+de\s+liquidit|convocation|assembl[ée]e|notation|dividende/i;
const ANNUEL = /(annuel|exercice|31\s*d[ée]cembre|[ée]tats\s+financiers|bilan)/i;

export function periodeDuDocument(libelle: string | null | undefined, type: string | null | undefined): PeriodeDoc | null {
  if (!libelle || SANS_COMPTES.test(libelle)) return null;
  if (type === 'ag' || type === 'notation' || type === 'avis') return null;
  const inter = periodeDuLibelle(libelle);
  if (inter) return { annee: inter.annee, code: inter.code, dateArrete: dateArreteDe(inter.annee, inter.code) };
  // Un libellé intermédiaire non retenu (S2, deux périodes) n'est pas un annuel.
  if (/trimestre|semestre/i.test(libelle)) return null;
  if (!ANNUEL.test(libelle)) return null;
  const annees = [...new Set(libelle.match(/20\d{2}/g) ?? [])];
  if (annees.length !== 1) return null;
  const annee = Number(annees[0]);
  return { annee, code: 'exercice', dateArrete: dateArreteDe(annee, 'exercice') };
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsPeriode.test.ts`
Expected: PASS. Si « 3ème trimestre » échoue, vérifier que `periodeDuLibelle` normalise les accents (`3eme`) : c'est le cas (`normalize('NFD')`).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/periode.ts scraper/tests/agregatsPeriode.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): période d'un document bancaire"
```

---

### Task 4: Schéma zod et prompt de lecture Gemini

**Files:**
- Create: `scraper/src/agregats/schema.ts`
- Test: `scraper/tests/agregatsSchema.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { schemaLecture, promptAgregats } from '../src/agregats/schema.js';

const valide = {
  devise: 'FCFA',
  date_arrete: '2026-06-30',
  date_arrete_comparative: '2025-06-30',
  cumul_depuis_debut_exercice: true,
  provisoire: false,
  valeurs: [
    { indicateur: 'pnb', trouve: true, texte: '152 345', unite: 'millions', perimetre: 'individuel', page: 3,
      libelle_exact: 'Produit net bancaire', extrait: 'Produit net bancaire 152 345 138 210', colonne: 'courante' },
    { indicateur: 'cout_du_risque', trouve: false, texte: null, unite: null, perimetre: 'non_precise', page: null,
      libelle_exact: null, extrait: null },
  ],
};

describe('schemaLecture', () => {
  it('accepte une réponse conforme et pose les défauts', () => {
    const r = schemaLecture.parse(valide);
    expect(r.valeurs[1]).toMatchObject({ colonne: 'courante', comparateur: '=', approximation: false });
  });
  it('refuse un indicateur inconnu (un ratio calculé, par exemple)', () => {
    const r = schemaLecture.safeParse({ ...valide, valeurs: [{ ...valide.valeurs[0], indicateur: 'coefficient_exploitation' }] });
    expect(r.success).toBe(false);
  });
  it('refuse une date mal formée', () => {
    expect(schemaLecture.safeParse({ ...valide, date_arrete: '30/06/2026' }).success).toBe(false);
  });
});

describe('promptAgregats', () => {
  it('nomme chaque indicateur et interdit tout calcul', () => {
    const { systeme, consigne } = promptAgregats('SGBC', 'Rapport d’activités - 1er semestre 2026');
    expect(systeme).toContain('marge_interets');
    expect(systeme).toContain('ratio_tier1');
    expect(systeme).toMatch(/ne calcule jamais/i);
    expect(systeme).toMatch(/islamique/i);
    expect(consigne).toContain('SGBC');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsSchema.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Lecture structurée des agrégats bancaires par Gemini — schéma zod et prompt.
 * PUR. Le modèle RECOPIE ce qui est imprimé (texte + unité + page + extrait) ;
 * la conversion en FCFA et tous les contrôles se font ensuite, en code testé.
 */
import { z } from 'zod';
import { AGREGATS, INDICATEURS_AGREGATS } from './indicateurs.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v ?? null);

export const schemaValeurLue = z.object({
  indicateur: z.enum(INDICATEURS_AGREGATS as [string, ...string[]]),
  trouve: z.boolean(),
  texte: z.string().max(40).nullable().optional().transform((v) => v ?? null),
  unite: z.enum(['unites', 'milliers', 'millions', 'milliards', 'pct']).nullable().optional().transform((v) => v ?? null),
  perimetre: z.enum(['individuel', 'consolide', 'non_precise']).default('non_precise'),
  page: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
  libelle_exact: z.string().max(200).nullable().optional().transform((v) => v ?? null),
  extrait: z.string().max(600).nullable().optional().transform((v) => v ?? null),
  colonne: z.enum(['courante', 'comparative']).default('courante'),
  comparateur: z.enum(['=', '>', '>=', '<', '<=']).default('='),
  approximation: z.boolean().default(false),
});
export type ValeurLue = z.infer<typeof schemaValeurLue>;

export const schemaLecture = z.object({
  devise: z.string().max(20).nullable().optional().transform((v) => v ?? null),
  date_arrete: date,
  date_arrete_comparative: date,
  cumul_depuis_debut_exercice: z.boolean().nullable().optional().transform((v) => v ?? null),
  provisoire: z.boolean().default(false),
  valeurs: z.array(schemaValeurLue).max(120),
});
export type Lecture = z.infer<typeof schemaLecture>;

export function promptAgregats(code: string, libelle: string): { systeme: string; consigne: string } {
  const liste = AGREGATS.map((a) => `  - ${a.indicateur} : ${a.libelle}`).join('\n');
  const systeme = [
    'Tu lis un document publié par une BANQUE cotée à la BRVM (rapport d’activités, états financiers, bilan, communiqué).',
    'Tu RECOPIES des valeurs imprimées. Tu ne calcules JAMAIS rien : ni somme, ni différence, ni ratio, ni conversion d’unité.',
    'Réponds UNIQUEMENT en JSON strict :',
    '{ "devise": "FCFA"|"USD"|…, "date_arrete": "AAAA-MM-JJ"|null, "date_arrete_comparative": "AAAA-MM-JJ"|null,',
    '  "cumul_depuis_debut_exercice": true|false|null, "provisoire": true|false,',
    '  "valeurs": [ { "indicateur": …, "trouve": true|false, "texte": "152 345,6"|null, "unite": "unites"|"milliers"|"millions"|"milliards"|"pct"|null,',
    '                 "perimetre": "individuel"|"consolide"|"non_precise", "page": 3|null, "libelle_exact": …|null, "extrait": …|null,',
    '                 "colonne": "courante"|"comparative", "comparateur": "="|">"|">="|"<"|"<=", "approximation": true|false } ] }',
    '',
    'Indicateurs (une entrée "courante" par indicateur, trouvé ou non ; une entrée "comparative" seulement si la colonne de l’année précédente figure) :',
    liste,
    '',
    'RÈGLES IMPÉRATIVES :',
    '1. texte = le nombre EXACTEMENT comme imprimé, sans l’unité (garde espaces, virgule, parenthèses, signe). Introuvable ou illisible → trouve=false, texte=null.',
    '2. unite = l’unité de l’EN-TÊTE du tableau (« en millions de FCFA » → millions). Les ratios en pourcentage → pct.',
    '3. perimetre = individuel (comptes sociaux / de la banque) ou consolide (comptes du groupe) SEULEMENT si le document l’écrit ; sinon non_precise. Ne mélange jamais les deux.',
    '4. Une valeur propre à une branche, une fenêtre ou une filiale (ex. « fenêtre islamique », « branche islamique ») N’EST PAS la valeur de la banque : ne la recopie pas (trouve=false), sauf si le libellé l’indique — alors recopie-la et garde ce libellé dans libelle_exact.',
    '5. Une borne (« supérieur à 14 % ») : comparateur ">" et le nombre. « environ », « près de » → approximation=true.',
    '6. charges_interets, charges_exploitation, cout_du_risque : recopie le nombre imprimé, signe compris ; ne change jamais un signe.',
    '7. charges_exploitation = frais généraux + dotations aux amortissements, UNIQUEMENT si une ligne imprimée porte ce total (« charges générales d’exploitation et dotations », « total charges d’exploitation ») ; sinon trouve=false.',
    '8. resultat_brut_exploitation, marge_interets, commissions_nettes : uniquement s’ils figurent TELS QUELS ; jamais déduits d’autres lignes.',
    '9. Encours (crédits, dépôts, total du bilan, fonds propres, créances en souffrance) : à la date d’arrêté, pas une moyenne.',
    '10. extrait = la ligne ou la phrase du document où tu lis la valeur (600 caractères au plus) ; page = numéro de page du PDF.',
    '11. provisoire=true si le document dit que les chiffres sont provisoires ou non audités « sous réserve ».',
  ].join('\n');
  const consigne = `Banque BRVM : ${code}. Publication : ${libelle}. Le PDF est joint (il peut être scanné). Réponds uniquement par le JSON demandé.`;
  return { systeme, consigne };
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsSchema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/schema.ts scraper/tests/agregatsSchema.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): schéma et prompt de lecture des agrégats"
```

---

### Task 5: Lecture d'un nombre imprimé et granularité

**Files:**
- Create: `scraper/src/agregats/nombres.ts`
- Test: `scraper/tests/agregatsNombres.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { lireNombre, facteur, granularite } from '../src/agregats/nombres.js';

describe('lireNombre', () => {
  it.each([
    ['152 345', 152345, 0],
    ['152 345,6', 152345.6, 1],
    ['152 345', 152345, 0],
    ['1.234.567', 1234567, 0],
    ['12.5', 12.5, 1],
    ['(1 234)', -1234, 0],
    ['−3 210,25', -3210.25, 2],
    ['16,19 %', 16.19, 2],
  ])('« %s »', (t, v, d) => {
    expect(lireNombre(t)).toEqual({ valeur: v, decimales: d });
  });
  it.each(['n.d.', '', '12,3,4', 'abc'])('illisible « %s »', (t) => {
    expect(lireNombre(t)).toBeNull();
  });
});

describe('granularité', () => {
  it('unité imprimée × dernière décimale', () => {
    expect(facteur('millions')).toBe(1e6);
    expect(granularite({ unite_source: 'millions', decimales: 1 })).toBeCloseTo(1e5);
    expect(granularite({ unite_source: 'unites', decimales: 0 })).toBe(1);
    expect(granularite({ unite_source: null, decimales: null })).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsNombres.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Nombres imprimés dans les documents bancaires — PUR.
 * Virgule décimale française ; espaces (y compris insécables) et points en
 * séparateurs de milliers ; parenthèses ou signe moins = négatif.
 */
export type UniteSource = 'unites' | 'milliers' | 'millions' | 'milliards' | 'pct';

const FACTEURS: Record<UniteSource, number> = { unites: 1, milliers: 1e3, millions: 1e6, milliards: 1e9, pct: 1 };

export const facteur = (u: UniteSource | null | undefined): number => FACTEURS[u ?? 'unites'];

/** Plus petit écart que l'impression permet de distinguer, en unité stockée. */
export function granularite(o: { unite_source: UniteSource | null | undefined; decimales: number | null | undefined }): number {
  return facteur(o.unite_source) * 10 ** -(o.decimales ?? 0);
}

export function lireNombre(texte: string): { valeur: number; decimales: number } | null {
  let t = texte.trim().replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(/%$/, '');
  if (!t) return null;
  let negatif = false;
  const par = /^\((.*)\)$/.exec(t);
  if (par) {
    negatif = true;
    t = par[1]!;
  }
  if (t.startsWith('-')) {
    negatif = !negatif;
    t = t.slice(1);
  }
  let decimales = 0;
  if (t.includes(',')) {
    const morceaux = t.split(',');
    if (morceaux.length !== 2) return null;
    const [ent, dec] = morceaux as [string, string];
    decimales = dec.length;
    t = `${ent.replace(/\./g, '')}.${dec}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (/^\d+\.\d+$/.test(t)) {
    decimales = t.split('.')[1]!.length;
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return { valeur: negatif ? -v : v, decimales };
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsNombres.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/nombres.ts scraper/tests/agregatsNombres.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): lecture des nombres imprimés et granularité"
```

---

### Task 6: Normalisation de la réponse Gemini en observations

**Files:**
- Create: `scraper/src/agregats/normaliser.ts`
- Test: `scraper/tests/agregatsNormaliser.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { normaliser, type DocumentLu } from '../src/agregats/normaliser.js';
import type { Lecture } from '../src/agregats/schema.js';

let n = 0;
const id = () => `id${++n}`;
const doc: DocumentLu = {
  code: 'SGBC', url: 'https://x/sgbc-s1-2026.pdf', libelle: 'Rapport d’activités - 1er semestre 2026',
  date: '2026-07-30', publication_id: 'pub1', periode: { annee: 2026, code: 'S1', dateArrete: '2026-06-30' }, modele: 'gemini:test',
};
const v = (p: Partial<Lecture['valeurs'][number]>): Lecture['valeurs'][number] => ({
  indicateur: 'pnb', trouve: true, texte: '152 345', unite: 'millions', perimetre: 'individuel', page: 3,
  libelle_exact: 'Produit net bancaire', extrait: 'Produit net bancaire 152 345', colonne: 'courante', comparateur: '=', approximation: false, ...p,
});
const lecture = (valeurs: Lecture['valeurs'], extra: Partial<Lecture> = {}): Lecture => ({
  devise: 'FCFA', date_arrete: '2026-06-30', date_arrete_comparative: '2025-06-30', cumul_depuis_debut_exercice: true, provisoire: false, valeurs, ...extra,
});
const de = (obs: ReturnType<typeof normaliser>, indicateur: string, date = '2026-06-30') =>
  obs.filter((o) => o.indicateur === indicateur && o.date_arrete === date);

describe('normaliser', () => {
  it('convertit en FCFA, garde texte, unité imprimée, page et extrait', () => {
    const [o] = de(normaliser(lecture([v({})]), doc, id), 'pnb');
    expect(o).toMatchObject({
      statut: 'publie', valeur: 152345e6, unite: 'fcfa', unite_source: 'millions', texte_original: '152 345', decimales: 0,
      periode: 'S1', perimetre: 'individuel', page: 3, publication_id: 'pub1', methode: 'gemini-agregats', controle: 'ok',
    });
  });

  it('chaque indicateur absent de la réponse devient « non_trouve », jamais 0', () => {
    const obs = normaliser(lecture([v({})]), doc, id);
    const cdr = de(obs, 'cout_du_risque');
    expect(cdr).toHaveLength(1);
    expect(cdr[0]).toMatchObject({ statut: 'non_trouve', valeur: null });
  });

  it('colonne comparative : observation datée de l’année précédente, période tirée de la date', () => {
    const obs = normaliser(lecture([v({ colonne: 'comparative', texte: '138 210' })]), doc, id);
    expect(de(obs, 'pnb', '2025-06-30')[0]).toMatchObject({ valeur: 138210e6, periode: 'S1' });
  });

  it('un encours comparé au 31 décembre est rangé en « exercice »', () => {
    const obs = normaliser(
      lecture([v({ indicateur: 'credits_clientele', colonne: 'comparative', texte: '2 100 000' })], { date_arrete_comparative: '2025-12-31' }),
      doc, id,
    );
    expect(de(obs, 'credits_clientele', '2025-12-31')[0]).toMatchObject({ periode: 'exercice', valeur: 2_100_000e6 });
  });

  it('un ratio exige « pct », un montant l’interdit', () => {
    const obs = normaliser(lecture([v({ indicateur: 'solvabilite_total', texte: '14,39', unite: 'millions' }), v({ texte: '12', unite: 'pct' })]), doc, id);
    expect(de(obs, 'solvabilite_total')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible', valeur: null });
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible' });
  });

  it('valeur propre à la branche islamique : non exploitable (Coris)', () => {
    const obs = normaliser(lecture([v({ indicateur: 'creances_souffrance_brutes', libelle_exact: 'Créances en souffrance — branche islamique', texte: '4 512' })]), doc, id);
    expect(de(obs, 'creances_souffrance_brutes')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible' });
  });

  it('document hors FCFA : rien d’exploitable (ETIT publie en USD)', () => {
    const obs = normaliser(lecture([v({})], { devise: 'USD' }), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible', devise_source: 'USD' });
  });

  it('texte illisible → « illisible » ; « environ » → approximation', () => {
    const obs = normaliser(lecture([v({ texte: 'n.d.' }), v({ indicateur: 'depots_clientele', texte: '3 000 000', approximation: true })]), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'illisible' });
    expect(de(obs, 'depots_clientele')[0]).toMatchObject({ statut: 'publie', motif: 'approximation' });
  });

  it('deux valeurs différentes pour la même case du même document : conflit déclaré', () => {
    const obs = normaliser(lecture([v({ texte: '152 345' }), v({ texte: '152 999' })]), doc, id);
    const pnb = de(obs, 'pnb');
    expect(pnb).toHaveLength(1);
    expect(pnb[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'source_conflict' });
    expect(pnb[0]!.controle_motif).toContain('152 999');
  });

  it('une date d’arrêté lue différente de la période du libellé : tout est à relire', () => {
    const obs = normaliser(lecture([v({})], { date_arrete: '2026-03-31' }), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ controle: 'a_relire' });
    expect(de(obs, 'pnb')[0]!.controle_motif).toMatch(/date d’arrêté/);
  });

  it('les observations sont triées et identifiées de façon stable', () => {
    const obs = normaliser(lecture([v({})]), doc, () => 'fixe');
    expect(obs.every((o) => o.id === 'fixe')).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsNormaliser.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Réponse Gemini (validée par zod) → observations prêtes pour
 * indicateur_source. PUR : la génération d'identifiant est injectée.
 *
 * Règles (spec §3-§4) : montants en FCFA ; une observation par indicateur pour
 * la colonne courante, « non_trouve » s'il manque ; colonne comparative
 * seulement si lue ; un périmètre n'est jamais deviné ; une valeur de branche
 * (fenêtre islamique) ou un document hors FCFA ne sont pas exploitables.
 */
import { randomUUID } from 'node:crypto';
import { AGREGATS, defDe } from './indicateurs.js';
import { lireNombre, facteur, type UniteSource } from './nombres.js';
import { periodeDeDate, type CodePeriode, type PeriodeDoc } from './periode.js';
import type { Lecture, ValeurLue } from './schema.js';
import type { Comparateur, Motif, Perimetre } from '../prudentiel/selection.js';

export interface DocumentLu {
  code: string;
  url: string;
  libelle: string;
  date: string | null;
  publication_id: string | null;
  periode: PeriodeDoc;
  modele: string;
}

export type Statut = 'publie' | 'non_applicable' | 'non_trouve' | 'publie_non_exploitable';
export type Controle = 'ok' | 'a_relire' | 'valide' | 'rejete';

/** Une ligne d'indicateur_source, colonnes de 0147, 0148, 0149 et 0245. */
export interface ObservationNouvelle {
  id: string;
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  perimetre: Perimetre;
  statut: Statut;
  valeur: number | null;
  comparateur: Comparateur;
  unite: 'fcfa' | 'pct' | null;
  unite_source: UniteSource | null;
  devise_source: string | null;
  texte_original: string | null;
  decimales: number | null;
  motif: Motif | null;
  document_url: string;
  document_libelle: string;
  document_date: string | null;
  publication_id: string | null;
  page: number | null;
  libelle_exact: string | null;
  extrait: string | null;
  methode: 'gemini-agregats';
  modele: string;
  nature_source: 'emetteur';
  provisoire: boolean;
  controle: Controle;
  controle_motif: string | null;
}

const BRANCHE = /islam|fen[eê]tre|branche/i;
const FCFA = /^(f\s*\.?\s*cfa|fcfa|xof|cfa)$/i;

function base(doc: DocumentLu, lecture: Lecture, indicateur: string, date: string, periode: CodePeriode, perimetre: Perimetre, id: string): ObservationNouvelle {
  return {
    id, code: doc.code, indicateur, periode, date_arrete: date, perimetre,
    statut: 'non_trouve', valeur: null, comparateur: '=', unite: null, unite_source: null,
    devise_source: lecture.devise, texte_original: null, decimales: null, motif: null,
    document_url: doc.url, document_libelle: doc.libelle, document_date: doc.date, publication_id: doc.publication_id,
    page: null, libelle_exact: null, extrait: null, methode: 'gemini-agregats', modele: doc.modele,
    nature_source: 'emetteur', provisoire: lecture.provisoire, controle: 'ok', controle_motif: null,
  };
}

function nonExploitable(o: ObservationNouvelle, motif: Motif, pourquoi: string): ObservationNouvelle {
  return { ...o, statut: 'publie_non_exploitable', valeur: null, unite: null, motif, controle_motif: pourquoi };
}

function depuisValeur(o: ObservationNouvelle, v: ValeurLue, deviseOk: boolean): ObservationNouvelle {
  const def = defDe(v.indicateur)!;
  const lu: ObservationNouvelle = {
    ...o, page: v.page, libelle_exact: v.libelle_exact, extrait: v.extrait, texte_original: v.texte, unite_source: v.unite, comparateur: v.comparateur,
  };
  if (!deviseOk) return nonExploitable(lu, 'definition_incompatible', `devise ${o.devise_source ?? 'inconnue'}`);
  if (BRANCHE.test(`${v.libelle_exact ?? ''} ${v.extrait ?? ''}`)) return nonExploitable(lu, 'definition_incompatible', 'valeur propre à une branche ou une fenêtre');
  const nombre = v.texte ? lireNombre(v.texte) : null;
  if (!nombre) return nonExploitable(lu, 'illisible', 'nombre illisible');
  const estRatio = def.nature === 'ratio';
  if (v.unite == null || (estRatio !== (v.unite === 'pct'))) return nonExploitable(lu, 'definition_incompatible', `unité ${v.unite ?? 'absente'} incompatible`);
  const valeur = estRatio ? nombre.valeur : Math.round(nombre.valeur * facteur(v.unite));
  return {
    ...lu, statut: 'publie', valeur, unite: estRatio ? 'pct' : 'fcfa', decimales: nombre.decimales,
    motif: v.approximation ? 'approximation' : null,
  };
}

export function normaliser(lecture: Lecture, doc: DocumentLu, nouvelId: () => string = randomUUID): ObservationNouvelle[] {
  const deviseOk = lecture.devise == null || FCFA.test(lecture.devise.trim());
  const dateCourante = doc.periode.dateArrete;
  const dateComparative = lecture.date_arrete_comparative;
  const periodeComparative = dateComparative ? periodeDeDate(dateComparative) : null;
  const dateIncoherente = lecture.date_arrete != null && lecture.date_arrete !== dateCourante;

  // Regroupe par (indicateur, colonne, périmètre) : deux textes différents = conflit déclaré.
  const groupes = new Map<string, ValeurLue[]>();
  for (const v of lecture.valeurs) {
    if (!v.trouve) continue;
    const cle = `${v.indicateur}|${v.colonne}|${v.perimetre}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), v]);
  }

  const sortie: ObservationNouvelle[] = [];
  for (const def of AGREGATS) {
    const courants = [...groupes.entries()].filter(([k]) => k.startsWith(`${def.indicateur}|courante|`));
    if (courants.length === 0) {
      sortie.push(base(doc, lecture, def.indicateur, dateCourante, doc.periode.code, 'non_precise', nouvelId()));
    }
    for (const [cle, vals] of [...groupes.entries()].filter(([k]) => k.startsWith(`${def.indicateur}|`))) {
      const [, colonne, perimetre] = cle.split('|') as [string, 'courante' | 'comparative', Perimetre];
      const date = colonne === 'courante' ? dateCourante : dateComparative;
      const periode = colonne === 'courante' ? doc.periode.code : periodeComparative;
      if (!date || !periode) continue; // comparatif sans date lisible : ignoré, jamais deviné
      const o = base(doc, lecture, def.indicateur, date, periode, perimetre, nouvelId());
      const textes = [...new Set(vals.map((x) => x.texte ?? ''))];
      sortie.push(
        textes.length > 1
          ? nonExploitable({ ...o, texte_original: textes[0] ?? null, page: vals[0]!.page, extrait: vals[0]!.extrait }, 'source_conflict', `deux valeurs dans le même document : ${textes.join(' / ')}`)
          : depuisValeur(o, vals[0]!, deviseOk),
      );
    }
  }

  return dateIncoherente
    ? sortie.map((o) => ({ ...o, controle: 'a_relire' as const, controle_motif: [o.controle_motif, `date d’arrêté lue ${lecture.date_arrete} ≠ période du libellé ${dateCourante}`].filter(Boolean).join(' ; ') }))
    : sortie;
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsNormaliser.test.ts`
Expected: PASS (10 tests). Le test « deux valeurs différentes » suppose que `controle_motif` contient les deux textes : c'est le cas.

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/normaliser.ts scraper/tests/agregatsNormaliser.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): normalisation des lectures Gemini en observations FCFA"
```

---

### Task 7: Les cinq contrôles purs

**Files:**
- Create: `scraper/src/agregats/controles.ts`
- Test: `scraper/tests/agregatsControles.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { controler, type Reference } from '../src/agregats/controles.js';
import type { ObservationNouvelle } from '../src/agregats/normaliser.js';

let n = 0;
const o = (p: Partial<ObservationNouvelle>): ObservationNouvelle => ({
  id: `o${++n}`, code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel',
  statut: 'publie', valeur: 150e9, comparateur: '=', unite: 'fcfa', unite_source: 'millions', devise_source: 'FCFA',
  texte_original: '150 000', decimales: 0, motif: null, document_url: 'd1', document_libelle: 'S1 2026', document_date: null,
  publication_id: null, page: 1, libelle_exact: null, extrait: null, methode: 'gemini-agregats', modele: 'm',
  nature_source: 'emetteur', provisoire: false, controle: 'ok', controle_motif: null, ...p,
});
const ref = (p: Partial<Reference> = {}): Reference => ({
  totalBilanAnnuel: 5_000e9, resultatNetBase: null, totalActifsBase: null, fondsPropresBase: null, valeursNm1: {}, ...p,
});
const etat = (obs: ObservationNouvelle[], indicateur: string) => obs.find((x) => x.indicateur === indicateur)!;

describe('1. unité plausible', () => {
  it('un PNB de semestre lu en milliers au lieu de millions (×1 000 trop petit) est à relire', () => {
    const r = controler([o({ valeur: 150e6 })], ref());
    expect(etat(r, 'pnb')).toMatchObject({ controle: 'a_relire' });
    expect(etat(r, 'pnb').controle_motif).toMatch(/unité/);
  });
  it('un PNB plausible passe', () => {
    expect(etat(controler([o({})], ref()), 'pnb').controle).toBe('ok');
  });
  it('des crédits supérieurs au total du bilan sont à relire', () => {
    const r = controler([o({ indicateur: 'credits_clientele', valeur: 6_000e9 })], ref());
    expect(etat(r, 'credits_clientele').controle).toBe('a_relire');
  });
  it('un ratio de solvabilité hors ]0 ; 100] est à relire', () => {
    const r = controler([o({ indicateur: 'solvabilite_total', valeur: 1439, unite: 'pct', unite_source: 'pct' })], ref());
    expect(etat(r, 'solvabilite_total').controle).toBe('a_relire');
  });
  it('sans total de bilan connu, un total lu hors [50 Md ; 50 000 Md] est à relire', () => {
    const r = controler([o({ indicateur: 'total_bilan', periode: 'S1', valeur: 5e9 })], ref({ totalBilanAnnuel: null }));
    expect(etat(r, 'total_bilan').controle).toBe('a_relire');
  });
});

describe('2. égalités comptables', () => {
  it('RBE = PNB − charges d’exploitation à l’arrondi près : passe', () => {
    const r = controler([o({ valeur: 150e9 }), o({ indicateur: 'charges_exploitation', valeur: 80e9 }), o({ indicateur: 'resultat_brut_exploitation', valeur: 70e9 })], ref());
    expect(r.every((x) => x.controle === 'ok')).toBe(true);
  });
  it('RBE incohérent : les trois valeurs sont à relire', () => {
    const r = controler([o({ valeur: 150e9 }), o({ indicateur: 'charges_exploitation', valeur: 80e9 }), o({ indicateur: 'resultat_brut_exploitation', valeur: 75e9 })], ref());
    expect(r.filter((x) => x.controle === 'a_relire')).toHaveLength(3);
    expect(etat(r, 'pnb').controle_motif).toMatch(/RBE/);
  });
  it('marge d’intérêts = produits − charges ; périmètres différents ne se comparent pas', () => {
    const ok = controler([
      o({ indicateur: 'produits_interets', valeur: 200e9 }), o({ indicateur: 'charges_interets', valeur: 90e9 }), o({ indicateur: 'marge_interets', valeur: 110e9 }),
    ], ref());
    expect(ok.every((x) => x.controle === 'ok')).toBe(true);
    const autres = controler([
      o({ indicateur: 'produits_interets', valeur: 200e9 }), o({ indicateur: 'charges_interets', valeur: 90e9 }), o({ indicateur: 'marge_interets', valeur: 150e9, perimetre: 'consolide' }),
    ], ref());
    expect(autres.every((x) => x.controle === 'ok')).toBe(true);
  });
});

describe('3. recoupements avec la base', () => {
  it('résultat net lu ≠ base au-delà de 0,5 % : à relire', () => {
    const r = controler([o({ indicateur: 'resultat_net', valeur: 40e9 })], ref({ resultatNetBase: 42e9 }));
    expect(etat(r, 'resultat_net').controle).toBe('a_relire');
  });
  it('résultat net concordant à l’arrondi publié : passe', () => {
    const r = controler([o({ indicateur: 'resultat_net', valeur: 42_000e6 })], ref({ resultatNetBase: 42_000_400_000 }));
    expect(etat(r, 'resultat_net').controle).toBe('ok');
  });
});

describe('4. variation extrême', () => {
  it('PNB doublé d’un semestre à l’autre : relecture, pas rejet', () => {
    const r = controler([o({ valeur: 320e9 })], ref({ valeursNm1: { 'pnb|individuel': 150e9 } }));
    expect(etat(r, 'pnb')).toMatchObject({ controle: 'a_relire', statut: 'publie', valeur: 320e9 });
  });
  it('variation ordinaire : passe', () => {
    expect(etat(controler([o({ valeur: 165e9 })], ref({ valeursNm1: { 'pnb|individuel': 150e9 } })), 'pnb').controle).toBe('ok');
  });
  it('un N−1 d’un autre périmètre ne sert pas de référence', () => {
    expect(etat(controler([o({ valeur: 320e9 })], ref({ valeursNm1: { 'pnb|consolide': 150e9 } })), 'pnb').controle).toBe('ok');
  });
});

it('une observation non publiée n’est jamais contrôlée', () => {
  const r = controler([o({ statut: 'non_trouve', valeur: null })], ref());
  expect(r[0]!.controle).toBe('ok');
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsControles.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Contrôles des agrégats bancaires avant toute valeur retenue — PUR.
 * Spec §4 « Contrôles ». Un contrôle en échec ne supprime rien : l'observation
 * passe en controle = 'a_relire' avec son motif, la sélection n'en retient
 * rien, et la file de relecture la présente à l'exploitant.
 *
 *   1. unité plausible pour la taille de la banque (confusion milliers/millions) ;
 *   2. égalités comptables à l'arrondi (RBE, marge d'intérêts), même document,
 *      même date, même périmètre ;
 *   3. recoupement avec la base (résultat net, total du bilan, fonds propres) ;
 *   4. variation extrême contre la même période N−1, même périmètre ;
 *   5. périmètre : aucune comparaison entre périmètres différents (les
 *      contrôles 2 et 4 ne rapprochent que des valeurs de même périmètre ; la
 *      substitution est interdite par la sélection, prudentiel/selection.ts).
 */
import { defDe } from './indicateurs.js';
import { granularite } from './nombres.js';
import { moisDe } from './periode.js';
import type { ObservationNouvelle } from './normaliser.js';

export interface Reference {
  /** Total du bilan du dernier exercice annuel en base, ou null. */
  totalBilanAnnuel: number | null;
  /** Résultat net de la même période en base (income_statements), ou null. */
  resultatNetBase: number | null;
  totalActifsBase: number | null;
  fondsPropresBase: number | null;
  /** Valeurs retenues de la même période N−1, clé « indicateur|perimetre ». */
  valeursNm1: Record<string, number>;
}

const TB_MIN = 50e9;
const TB_MAX = 50_000e9;

function plausible(o: ObservationNouvelle, tbRef: number | null): string | null {
  const def = defDe(o.indicateur);
  if (!def || o.valeur == null) return null;
  const v = o.valeur;
  if (def.nature === 'ratio') {
    const max = o.indicateur === 'couverture_creances_souffrance' ? 300 : 100;
    const minExclu = ['solvabilite_total', 'ratio_cet1', 'ratio_tier1'].includes(o.indicateur);
    return (minExclu ? v <= 0 : v < 0) || v > max ? `ratio ${v} hors des bornes [0 ; ${max}] %` : null;
  }
  if (o.indicateur === 'total_bilan' && tbRef == null) {
    return v < TB_MIN || v > TB_MAX ? 'unité : total du bilan hors [50 ; 50 000] Md FCFA' : null;
  }
  if (tbRef == null) return null;
  const part = moisDe(o.periode) / 12;
  if (def.nature === 'flux') {
    if (Math.abs(v) > 0.45 * tbRef * part) return 'unité : flux supérieur à 45 % du total du bilan annualisé';
    if (o.indicateur === 'pnb' && v < 0.002 * tbRef * part) return 'unité : PNB inférieur à 0,2 % du total du bilan annualisé';
    return null;
  }
  if (o.indicateur === 'total_bilan') return v < 0.4 * tbRef || v > 2.5 * tbRef ? 'unité : total du bilan hors [0,4 ; 2,5] × le dernier annuel' : null;
  if (v > 1.1 * tbRef) return 'unité : encours supérieur au total du bilan';
  if (['credits_clientele', 'depots_clientele', 'fonds_propres'].includes(o.indicateur) && v < 0.01 * tbRef) {
    return 'unité : encours inférieur à 1 % du total du bilan';
  }
  return null;
}

function marquer(obs: ObservationNouvelle[], ids: Set<string>, motif: string): void {
  for (const o of obs) {
    if (!ids.has(o.id)) continue;
    o.controle = 'a_relire';
    o.controle_motif = [o.controle_motif, motif].filter(Boolean).join(' ; ');
  }
}

function egalite(groupe: ObservationNouvelle[], total: string, a: string, b: string, nom: string): [Set<string>, string] | null {
  const t = groupe.find((x) => x.indicateur === total);
  const x = groupe.find((y) => y.indicateur === a);
  const y = groupe.find((z) => z.indicateur === b);
  if (!t || !x || !y || t.valeur == null || x.valeur == null || y.valeur == null) return null;
  const tol = granularite(t) + granularite(x) + granularite(y);
  const ecart = Math.abs(t.valeur - (x.valeur - Math.abs(y.valeur)));
  return ecart > tol ? [new Set([t.id, x.id, y.id]), `${nom} : écart de ${Math.round(ecart)} FCFA au-delà de l’arrondi`] : null;
}

function recoupe(o: ObservationNouvelle | undefined, base: number | null, nom: string): [Set<string>, string] | null {
  if (!o || o.valeur == null || base == null) return null;
  const tol = Math.max(granularite(o), 0.005 * Math.abs(base));
  return Math.abs(o.valeur - base) > tol ? [new Set([o.id]), `${nom} lu différent de la base (${base})`] : null;
}

export function controler(entree: ObservationNouvelle[], ref: Reference): ObservationNouvelle[] {
  const obs = entree.map((o) => ({ ...o }));
  const publiees = obs.filter((o) => o.statut === 'publie' && o.valeur != null);

  // 1. Unité. Le total du bilan lu dans le même document sert de repère à défaut de la base.
  const tbDoc = publiees.find((o) => o.indicateur === 'total_bilan')?.valeur ?? null;
  for (const o of publiees) {
    const m = plausible(o, o.indicateur === 'total_bilan' ? ref.totalBilanAnnuel : ref.totalBilanAnnuel ?? tbDoc);
    if (m) marquer(obs, new Set([o.id]), m);
  }

  // 2. Égalités, par (document, date, périmètre).
  const groupes = new Map<string, ObservationNouvelle[]>();
  for (const o of publiees) {
    const k = `${o.document_url}|${o.date_arrete}|${o.perimetre}`;
    groupes.set(k, [...(groupes.get(k) ?? []), o]);
  }
  for (const g of groupes.values()) {
    for (const e of [
      egalite(g, 'resultat_brut_exploitation', 'pnb', 'charges_exploitation', 'RBE ≠ PNB − charges d’exploitation'),
      egalite(g, 'marge_interets', 'produits_interets', 'charges_interets', 'marge d’intérêts ≠ produits − charges d’intérêts'),
    ]) if (e) marquer(obs, e[0], e[1]);
  }

  // 3. Recoupements (colonne de la période du document seulement : la plus récente date).
  const dateCourante = publiees.map((o) => o.date_arrete).sort().at(-1);
  const courante = (ind: string) => publiees.find((o) => o.indicateur === ind && o.date_arrete === dateCourante);
  for (const r of [
    recoupe(courante('resultat_net'), ref.resultatNetBase, 'résultat net'),
    recoupe(courante('total_bilan'), ref.totalActifsBase, 'total du bilan'),
    recoupe(courante('fonds_propres'), ref.fondsPropresBase, 'fonds propres'),
  ]) if (r) marquer(obs, r[0], r[1]);

  // 4. Variation extrême contre la même période N−1, même périmètre.
  for (const o of publiees.filter((x) => x.date_arrete === dateCourante)) {
    const def = defDe(o.indicateur);
    const prec = ref.valeursNm1[`${o.indicateur}|${o.perimetre}`];
    if (!def || def.nature === 'ratio' || prec == null || prec === 0) continue;
    const variation = (o.valeur! - prec) / Math.abs(prec);
    const seuil = def.nature === 'flux' ? 1 : 0.6;
    const signeChange = ['pnb', 'charges_exploitation', 'credits_clientele', 'depots_clientele'].includes(o.indicateur) && Math.sign(o.valeur!) !== Math.sign(prec);
    if (Math.abs(variation) > seuil || signeChange) {
      marquer(obs, new Set([o.id]), `variation extrême : ${Math.round(variation * 100)} % contre la même période N−1`);
    }
  }
  return obs;
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsControles.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/controles.ts scraper/tests/agregatsControles.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): contrôles purs des agrégats (unité, égalités, recoupements, variations)"
```

---

### Task 8: Rapprochement des montants

**Files:**
- Create: `scraper/src/prudentiel/montants.ts`
- Test: `scraper/tests/rapprochementMontants.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { rapprocherMontants } from '../src/prudentiel/montants.js';

describe('rapprocherMontants', () => {
  it('une seule valeur : unique', () => {
    expect(rapprocherMontants([{ id: 'a', valeur: 1e9, unite_source: 'millions', decimales: 0 }])).toEqual({ classe: 'unique', retenue: 'a', conflits: [] });
  });
  it('152 345 millions et 152 345 210 milliers concordent : la plus fine est retenue', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 152_345e6, unite_source: 'millions', decimales: 0 },
      { id: 'b', valeur: 152_345_210e3, unite_source: 'milliers', decimales: 0 },
    ]);
    expect(r).toEqual({ classe: 'rounding_compatible', retenue: 'b', conflits: [] });
  });
  it('deux montants au même arrondi qui diffèrent : conflit', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 152_345e6, unite_source: 'millions', decimales: 0 },
      { id: 'b', valeur: 152_399e6, unite_source: 'millions', decimales: 0 },
    ]);
    expect(r.classe).toBe('source_conflict');
    expect(r.conflits).toEqual([['a', 'b']]);
  });
  it('un montant grossier ne réconcilie pas deux montants précis contradictoires', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 152_345_100e3, unite_source: 'milliers', decimales: 0 },
      { id: 'b', valeur: 152_345_900e3, unite_source: 'milliers', decimales: 0 },
      { id: 'c', valeur: 152e9, unite_source: 'milliards', decimales: 0 },
    ]);
    expect(r.classe).toBe('source_conflict');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/rapprochementMontants.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Rapprochement de montants publiés (FCFA) — PUR. Même règle que
 * rapprochement.ts pour les pourcentages, transposée aux montants : deux
 * valeurs concordent si leur écart tient dans la demi-somme de leurs
 * granularités imprimées (unité de l'en-tête × dernière décimale). Une paire
 * incompatible suffit à déclarer le conflit : une valeur grossière ne
 * réconcilie jamais deux valeurs précises.
 */
import { granularite, type UniteSource } from '../agregats/nombres.js';

export interface ObsMontant {
  id: string;
  valeur: number;
  unite_source: UniteSource | null;
  decimales: number | null;
}

export interface RapprochementMontants {
  classe: 'unique' | 'rounding_compatible' | 'source_conflict';
  retenue: string | null;
  conflits: [string, string][];
}

export function rapprocherMontants(obs: ObsMontant[]): RapprochementMontants {
  if (obs.length === 1) return { classe: 'unique', retenue: obs[0]!.id, conflits: [] };
  const conflits: [string, string][] = [];
  for (let i = 0; i < obs.length; i++) {
    for (let j = i + 1; j < obs.length; j++) {
      const a = obs[i]!, b = obs[j]!;
      const tolerance = (granularite(a) + granularite(b)) / 2 + 1; // +1 FCFA : marge de virgule flottante
      if (Math.abs(a.valeur - b.valeur) > tolerance) conflits.push([a.id, b.id]);
    }
  }
  if (conflits.length) return { classe: 'source_conflict', retenue: null, conflits };
  const plusFine = [...obs].sort((a, b) => granularite(a) - granularite(b))[0]!;
  const toutesEgales = obs.every((o) => o.valeur === obs[0]!.valeur && granularite(o) === granularite(obs[0]!));
  return { classe: toutesEgales ? 'unique' : 'rounding_compatible', retenue: plusFine.id, conflits: [] };
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/rapprochementMontants.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/prudentiel/montants.ts scraper/tests/rapprochementMontants.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): rapprochement des montants à la granularité publiée"
```

---

### Task 9: Sélection étendue (état de contrôle, montants, `a_relire`)

**Files:**
- Modify: `scraper/src/prudentiel/selection.ts`
- Modify: `scraper/src/prudentiel/runSelection.ts:96-98` (colonnes lues) et `:116` (décision `a_relire` sans écriture)
- Test: `scraper/tests/selectionPrudentielle.test.ts` (ajout d'un `describe`)

- [ ] **Step 1: Ajouter les tests (à la fin de `selectionPrudentielle.test.ts`)**

```ts
describe('sélection étendue — contrôle et montants (0245)', () => {
  const D = '2026-06-30';
  it('une observation « a_relire » bloque le périmètre : rien n’est retenu', () => {
    const a = o({ date_arrete: D, valeur: 19.6, texte_original: '19,6 %', controle: 'a_relire' });
    expect(selectionnerExercice([a], D)).toEqual({ etat: 'a_relire', observations: [a.id] });
  });

  it('une observation « rejete » est ignorée', () => {
    const a = o({ date_arrete: D, valeur: 19.6, texte_original: '19,6 %', controle: 'rejete' });
    const b = o({ date_arrete: D, valeur: 18.2, texte_original: '18,2 %' });
    expect(selectionnerExercice([a, b], D)).toMatchObject({ etat: 'retenue', valeur: 18.2 });
  });

  it('une observation « valide » l’emporte sur les autres exactes du même périmètre', () => {
    const a = o({ date_arrete: D, valeur: 19.6, texte_original: '19,6 %', controle: 'valide' });
    const b = o({ date_arrete: D, valeur: 18.2, texte_original: '18,2 %' });
    expect(selectionnerExercice([a, b], D)).toMatchObject({ etat: 'retenue', valeur: 19.6, observation: a.id });
  });

  it('montants : deux documents concordants à l’arrondi → la valeur la plus fine', () => {
    const a = o({ date_arrete: D, valeur: 152_345e6, texte_original: '152 345', unite_source: 'millions', decimales: 0 });
    const b = o({ date_arrete: D, valeur: 152_345_210e3, texte_original: '152 345 210', unite_source: 'milliers', decimales: 0 });
    expect(selectionnerExercice([a, b], D, 'montant')).toMatchObject({ etat: 'retenue', valeur: 152_345_210e3, classe: 'rounding_compatible' });
  });

  it('montants : contradiction → conflit, aucune valeur', () => {
    const a = o({ date_arrete: D, valeur: 152_345e6, unite_source: 'millions', decimales: 0 });
    const b = o({ date_arrete: D, valeur: 160_000e6, unite_source: 'millions', decimales: 0 });
    expect(selectionnerExercice([a, b], D, 'montant')).toMatchObject({ etat: 'conflit' });
  });

  it('jamais de substitution : un conflit en individuel ne se répare pas avec le consolidé', () => {
    const a = o({ date_arrete: D, perimetre: 'individuel', valeur: 1e9, unite_source: 'unites', decimales: 0 });
    const b = o({ date_arrete: D, perimetre: 'individuel', valeur: 2e9, unite_source: 'unites', decimales: 0 });
    const c = o({ date_arrete: D, perimetre: 'consolide', valeur: 3e9, unite_source: 'unites', decimales: 0 });
    expect(selectionnerExercice([a, b, c], D, 'montant')).toMatchObject({ etat: 'conflit' });
  });
});
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/selectionPrudentielle.test.ts`
Expected: FAIL — `controle` / `unite_source` inconnus du type, troisième argument refusé, état `a_relire` absent.

- [ ] **Step 3: Modifier `selection.ts`**

1. Ajouter l'import en tête (après `import { rapprocher } from './rapprochement.js';`) :

```ts
import { rapprocherMontants } from './montants.js';
import type { UniteSource } from '../agregats/nombres.js';
```

2. Dans `interface ObsPrudentielle`, après `provisoire?: boolean;`, ajouter :

```ts
  /** État de contrôle (0245). Absent = 'ok'. */
  controle?: 'ok' | 'a_relire' | 'valide' | 'rejete';
  /** Unité imprimée et décimales (montants), pour le rapprochement à la granularité publiée. */
  unite_source?: UniteSource | null;
  decimales?: number | null;
```

3. Dans `type Decision`, ajouter après la ligne `| { etat: 'conflit'; observations: string[] }` :

```ts
  /** Un contrôle a échoué sur une observation du périmètre décisif : rien n'est retenu avant relecture. */
  | { etat: 'a_relire'; observations: string[] }
```

4. Remplacer la signature et le début de `selectionnerExercice` :

```ts
export function selectionnerExercice(obs: ObsPrudentielle[], dateArrete: string, nature: 'pct' | 'montant' = 'pct'): Decision {
  // Les sources secondaires et les observations rejetées en relecture sont
  // écartées AVANT tout : elles ne doivent ni décider, ni contredire.
  const exercice = obs.filter((o) => o.date_arrete === dateArrete && o.nature_source !== 'secondaire' && o.controle !== 'rejete');
```

5. Juste après `const lignes = publiees(perimetre);`, insérer :

```ts
  const aRelire = lignes.filter((o) => o.controle === 'a_relire');
  if (aRelire.length) return { etat: 'a_relire', observations: aRelire.map((o) => o.id) };
```

6. Remplacer le bloc `const exactes = …` jusqu'à la fin du `if (exactes.length) { … }` par :

```ts
  const exactesToutes = utilisables.filter((o) => o.comparateur === '=');
  // Une valeur confirmée en relecture l'emporte : une personne a tranché.
  const valides = exactesToutes.filter((o) => o.controle === 'valide');
  const exactes = valides.length ? valides : exactesToutes;
  const bornes = utilisables.filter((o) => o.comparateur !== '=') as (ObsPrudentielle & { comparateur: Exclude<Comparateur, '='>; valeur: number })[];

  if (exactes.length) {
    const r = nature === 'montant'
      ? rapprocherMontants(exactes.map((o) => ({ id: o.id, valeur: o.valeur!, unite_source: o.unite_source ?? null, decimales: o.decimales ?? null })))
      : rapprocher(exactes.map((o) => ({ id: o.id, texte: texte(o) })));
    if (r.classe === 'source_conflict') return { etat: 'conflit', observations: [...new Set(r.conflits.flat())] };
    if (r.classe === 'illisible' || r.retenue == null) {
      return { etat: 'non_exploitable', motif: 'illisible', observations: exactes.map((o) => o.id) };
    }
    const retenue = exactes.find((o) => o.id === r.retenue)!;
    const contredite = bornes.filter((b) => !respecte(retenue.valeur!, b.comparateur, b.valeur));
    if (contredite.length) return { etat: 'conflit', observations: [retenue.id, ...contredite.map((b) => b.id)] };
    return {
      etat: 'retenue',
      valeur: retenue.valeur!,
      observation: retenue.id,
      perimetre,
      classe: r.classe === 'unique' ? 'unique' : 'rounding_compatible',
      reserve: exactes.some((o) => o.motif === 'controle_en_cours')
        ? 'controle_en_cours'
        : retenue.provisoire ? 'provisoire' : null,
    };
  }
```

Note : `rapprocherMontants` renvoie `'unique' | 'rounding_compatible' | 'source_conflict'` — la branche `'illisible'` ne concerne que `rapprocher` ; TypeScript l'accepte car `r.classe` est l'union des deux types.

7. Mettre à jour le commentaire d'en-tête : ajouter à la fin du bloc de règles

```ts
 * Règle (2026-11-15, migration 0245) : une observation rejetée en relecture
 * est ignorée ; une observation « a_relire » dans le périmètre décisif bloque
 * toute valeur ; une observation « valide » l'emporte. Les montants (FCFA) se
 * rapprochent à leur granularité imprimée (montants.ts).
```

- [ ] **Step 4: Modifier `runSelection.ts`**

Dans la requête, remplacer la chaîne `select(...)` par :

```ts
    .select('id,code,indicateur,date_arrete,perimetre,statut,valeur,comparateur,texte_original,motif,document_url,document_libelle,page,nature_source,provisoire,controle,unite_source,decimales')
```

La ligne `else if (d.etat === 'conflit' || …) apres = null;` reste inchangée : `a_relire` ne figure pas dans la liste, donc la valeur en base n'est pas touchée (une observation à relire ne prouve pas que la valeur en base soit fausse).

- [ ] **Step 5: Lancer tous les tests de sélection et le typecheck**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/selectionPrudentielle.test.ts tests/rapprochement.test.ts; npx tsc -p tsconfig.json --noEmit`
Expected: PASS (anciens et nouveaux tests), aucune erreur de type.

- [ ] **Step 6: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/prudentiel/selection.ts scraper/src/prudentiel/runSelection.ts scraper/tests/selectionPrudentielle.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): sélection étendue aux montants et à l'état de relecture"
```

---

### Task 10: Plan d'écriture des valeurs retenues (pur)

**Files:**
- Create: `scraper/src/agregats/ecritures.ts`
- Test: `scraper/tests/agregatsEcritures.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { planifierEcritures, periodeDeLigne, type ObsLue, type LigneComptes } from '../src/agregats/ecritures.js';

let n = 0;
const o = (p: Partial<ObsLue>): ObsLue => ({
  id: `o${++n}`, code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel',
  statut: 'publie', valeur: 150e9, comparateur: '=', texte_original: '150 000', motif: null, document_url: 'https://x/s1.pdf',
  document_libelle: 'Rapport S1 2026', page: 3, nature_source: 'emetteur', provisoire: false, controle: 'ok', unite_source: 'millions', decimales: 0, ...p,
});
const ligne = (p: Partial<LigneComptes>): LigneComptes => ({
  table: 'income_statements', code: 'SGBC', periode: '2026-S1', type_periode: 'semestriel', lignes_specifiques: null, sources_specifiques: null, ...p,
});

describe('periodeDeLigne', () => {
  it('lit les formats de période en base', () => {
    expect(periodeDeLigne('2026-S1')).toEqual({ code: 'S1', dateArrete: '2026-06-30' });
    expect(periodeDeLigne('2025')).toEqual({ code: 'exercice', dateArrete: '2025-12-31' });
    expect(periodeDeLigne('2025-12-31')).toEqual({ code: 'exercice', dateArrete: '2025-12-31' });
    expect(periodeDeLigne('2026-S2')).toBeNull();
  });
});

describe('planifierEcritures', () => {
  it('écrit la valeur retenue dans lignes_specifiques et sa source dans sources_specifiques', () => {
    const p = planifierEcritures([o({})], [ligne({ lignes_specifiques: { pnb: 140e9, autre: 1 } })]);
    expect(p.misesAJour).toHaveLength(1);
    const m = p.misesAJour[0]!;
    expect(m.lignes_specifiques).toEqual({ pnb: 150e9, autre: 1 });
    expect(m.sources_specifiques).toEqual({ pnb: { document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1 2026', page: 3, perimetre: 'individuel', observation: expect.any(String) } });
    expect(m.traces[0]).toMatchObject({ champ: 'lignes_specifiques.pnb', avant: 140e9, apres: 150e9 });
  });

  it('aucun changement → aucune mise à jour', () => {
    const p = planifierEcritures([o({})], [ligne({ lignes_specifiques: { pnb: 150e9 }, sources_specifiques: { pnb: { document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1 2026', page: 3, perimetre: 'individuel', observation: 'x' } } })]);
    expect(p.misesAJour).toHaveLength(0);
  });

  it('contradiction : valeur retirée et élément de relecture ouvert', () => {
    const a = o({ document_url: 'd1', valeur: 150e9 });
    const b = o({ document_url: 'd2', valeur: 170e9 });
    const p = planifierEcritures([a, b], [ligne({ lignes_specifiques: { pnb: 150e9 } })]);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ pnb: null });
    expect(p.relectures).toEqual([expect.objectContaining({ code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel', raison: 'contradiction', observations: [a.id, b.id] })]);
  });

  it('à relire : valeur en base intacte, élément de relecture avec le motif', () => {
    const a = o({ controle: 'a_relire', controle_motif: 'variation extrême : 113 %' });
    const p = planifierEcritures([a], [ligne({ lignes_specifiques: { pnb: 140e9 } })]);
    expect(p.misesAJour).toHaveLength(0);
    expect(p.relectures[0]).toMatchObject({ raison: 'controle', detail: expect.stringContaining('variation extrême') });
  });

  it('le résultat net n’est jamais écrit (recoupement seul) ; un encours va au bilan', () => {
    const p = planifierEcritures(
      [o({ indicateur: 'resultat_net', valeur: 40e9 }), o({ indicateur: 'credits_clientele', valeur: 2_000e9 })],
      [ligne({}), ligne({ table: 'balance_sheets' })],
    );
    expect(p.misesAJour.map((m) => m.table)).toEqual(['balance_sheets']);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ credits_clientele: 2_000e9 });
  });

  it('observations d’une période sans ligne de comptes : signalées, jamais créées', () => {
    const p = planifierEcritures([o({ date_arrete: '2026-03-31', periode: 'T1' })], [ligne({})]);
    expect(p.misesAJour).toHaveLength(0);
    expect(p.orphelins).toEqual(['SGBC|income_statements|T1|2026-03-31']);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsEcritures.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Des observations aux écritures — PUR. Pour chaque ligne de comptes en base
 * (income_statements / balance_sheets, annuelle ou intermédiaire) et chaque
 * indicateur du catalogue, applique selectionnerExercice et décide :
 *   - retenue ≠ base → écrire la valeur et sa source ;
 *   - conflit, borne, non exploitable, non applicable → retirer la valeur ;
 *   - a_relire → ne rien toucher ;
 *   - conflit ou a_relire → ouvrir un élément de relecture.
 * Aucune ligne de comptes n'est créée (règle de 0147).
 */
import { AGREGATS, type TableCible } from './indicateurs.js';
import { dateArreteDe, type CodePeriode } from './periode.js';
import { selectionnerExercice, type Decision, type ObsPrudentielle, type Perimetre } from '../prudentiel/selection.js';

export interface ObsLue extends ObsPrudentielle {
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  document_libelle: string | null;
  page: number | null;
  controle_motif?: string | null;
  methode?: string;
}

export interface SourceRetenue {
  document_url: string;
  document_libelle: string | null;
  page: number | null;
  perimetre: Perimetre;
  observation: string;
}

export interface LigneComptes {
  table: TableCible;
  code: string;
  periode: string;
  type_periode: string;
  lignes_specifiques: Record<string, unknown> | null;
  sources_specifiques: Record<string, SourceRetenue> | null;
}

export interface Trace {
  champ: string;
  avant: number | null;
  apres: number | null;
  motif: string;
  source: string | null;
}

export interface MiseAJour {
  table: TableCible;
  code: string;
  periode: string;
  type_periode: string;
  lignes_specifiques: Record<string, unknown>;
  sources_specifiques: Record<string, SourceRetenue>;
  traces: Trace[];
}

export interface ElementRelecture {
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  perimetre: Perimetre;
  raison: 'contradiction' | 'controle';
  detail: string;
  observations: string[];
}

export interface DecisionAgregat {
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  decision: Decision['etat'];
  avant: number | null;
  apres: number | null;
}

export interface PlanEcritures {
  misesAJour: MiseAJour[];
  relectures: ElementRelecture[];
  decisions: DecisionAgregat[];
  orphelins: string[];
}

export function periodeDeLigne(periode: string): { code: CodePeriode; dateArrete: string } | null {
  if (/^\d{4}$/.test(periode)) return { code: 'exercice', dateArrete: dateArreteDe(Number(periode), 'exercice') };
  if (/^\d{4}-12-31$/.test(periode)) return { code: 'exercice', dateArrete: periode };
  const m = /^(\d{4})-(T1|S1|T3)$/.exec(periode);
  return m ? { code: m[2] as CodePeriode, dateArrete: dateArreteDe(Number(m[1]), m[2] as CodePeriode) } : null;
}

const RETIRE: ReadonlySet<Decision['etat']> = new Set(['conflit', 'borne', 'non_exploitable', 'non_applicable']);

function motifDe(d: Decision): string {
  switch (d.etat) {
    case 'retenue': return `Agrégat retenu depuis indicateur_source (${d.classe === 'unique' ? 'source unique' : 'concordant à l’arrondi, le plus précis'}, périmètre ${d.perimetre})${d.reserve === 'provisoire' ? ' — chiffre déclaré provisoire' : ''}.`;
    case 'conflit': return 'Retiré : documents contradictoires, en relecture.';
    case 'borne': return `Retiré : seule une borne est publiée (${d.comparateur} ${d.valeur}).`;
    case 'non_exploitable': return `Retiré : publié mais non exploitable (${d.motif ?? 'motif non précisé'}).`;
    case 'non_applicable': return 'Retiré : non applicable à cet émetteur.';
    default: return '';
  }
}

export function planifierEcritures(obs: ObsLue[], lignes: LigneComptes[]): PlanEcritures {
  const plan: PlanEcritures = { misesAJour: [], relectures: [], decisions: [], orphelins: [] };
  const parId = new Map(obs.map((o) => [o.id, o]));
  const couvertes = new Set<string>();

  for (const l of lignes) {
    const p = periodeDeLigne(l.periode);
    if (!p) continue;
    const ls = { ...(l.lignes_specifiques ?? {}) };
    const sources = { ...(l.sources_specifiques ?? {}) };
    const traces: Trace[] = [];

    for (const def of AGREGATS.filter((a) => a.table === l.table)) {
      const concernees = obs.filter((o) => o.code === l.code && o.indicateur === def.indicateur && o.periode === p.code && o.date_arrete === p.dateArrete);
      if (concernees.length === 0) continue;
      couvertes.add(`${l.code}|${l.table}|${p.code}|${p.dateArrete}`);
      const d = selectionnerExercice(concernees, p.dateArrete, def.nature === 'ratio' ? 'pct' : 'montant');

      if (d.etat === 'conflit' || d.etat === 'a_relire') {
        const premiere = parId.get(d.observations[0]!)!;
        plan.relectures.push({
          code: l.code, indicateur: def.indicateur, periode: p.code, date_arrete: p.dateArrete, perimetre: premiere.perimetre,
          raison: d.etat === 'conflit' ? 'contradiction' : 'controle',
          detail: d.etat === 'conflit'
            ? `Valeurs incompatibles : ${d.observations.map((id) => parId.get(id)?.texte_original ?? '?').join(' / ')}`
            : [...new Set(d.observations.map((id) => parId.get(id)?.controle_motif).filter(Boolean))].join(' ; ') || 'contrôle en échec',
          observations: d.observations,
        });
      }
      if (def.cle == null) continue; // recoupement seul (résultat net)

      const avant = ls[def.cle] == null ? null : Number(ls[def.cle]);
      let apres = avant;
      if (d.etat === 'retenue') apres = d.valeur;
      else if (RETIRE.has(d.etat)) apres = null;
      plan.decisions.push({ code: l.code, indicateur: def.indicateur, periode: p.code, date_arrete: p.dateArrete, decision: d.etat, avant, apres });

      const source = d.etat === 'retenue' ? parId.get(d.observation)! : null;
      const nouvelleSource: SourceRetenue | null = source
        ? { document_url: source.document_url, document_libelle: source.document_libelle, page: source.page, perimetre: source.perimetre, observation: source.id }
        : null;
      const sourceChange = nouvelleSource
        ? JSON.stringify({ ...sources[def.cle], observation: '' }) !== JSON.stringify({ ...nouvelleSource, observation: '' })
        : apres === null && def.cle in sources;
      if (apres === avant && !sourceChange) continue;

      ls[def.cle] = apres;
      if (nouvelleSource) sources[def.cle] = nouvelleSource;
      else delete sources[def.cle];
      if (apres !== avant) {
        traces.push({
          champ: `lignes_specifiques.${def.cle}`, avant, apres, motif: motifDe(d),
          source: source ? `${source.document_libelle ?? source.document_url}${source.page ? `, p. ${source.page}` : ''}` : null,
        });
      }
    }

    const lsAvant = JSON.stringify(l.lignes_specifiques ?? {});
    const srcAvant = JSON.stringify(l.sources_specifiques ?? {});
    if (JSON.stringify(ls) !== lsAvant || JSON.stringify(sources) !== srcAvant) {
      plan.misesAJour.push({ table: l.table, code: l.code, periode: l.periode, type_periode: l.type_periode, lignes_specifiques: ls, sources_specifiques: sources, traces });
    }
  }

  const tableDe = (ind: string) => AGREGATS.find((a) => a.indicateur === ind)?.table;
  plan.orphelins = [...new Set(obs
    .filter((o) => o.statut === 'publie')
    .map((o) => `${o.code}|${tableDe(o.indicateur)}|${o.periode}|${o.date_arrete}`))]
    .filter((k) => !couvertes.has(k));
  return plan;
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsEcritures.test.ts`
Expected: PASS (7 tests). Si le test « aucun changement » échoue sur la source, vérifier que la comparaison ignore bien l'identifiant d'observation (`observation: ''`).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/ecritures.ts scraper/tests/agregatsEcritures.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): plan d'écriture des agrégats retenus et file de relecture"
```

---

### Task 11: Rapport de reprise et message d'alerte (purs)

**Files:**
- Create: `scraper/src/agregats/rapport.ts`, `scraper/src/agregats/alerte.ts`
- Test: `scraper/tests/agregatsRapport.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { construireRapport, rapportTexte, type DocumentRapport } from '../src/agregats/rapport.js';
import { messageFile } from '../src/agregats/alerte.js';
import type { PlanEcritures } from '../src/agregats/ecritures.js';
import type { ObservationNouvelle } from '../src/agregats/normaliser.js';

const obs = (p: Partial<ObservationNouvelle>) => ({ code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', statut: 'publie', controle: 'ok', ...p }) as ObservationNouvelle;
const docs: DocumentRapport[] = [
  { code: 'SGBC', libelle: 'S1 2026', url: 'u1', periode: '2026-S1', etat: 'lu', erreur: null },
  { code: 'SGBC', libelle: 'S1 2025', url: 'u2', periode: '2025-S1', etat: 'echec', erreur: 'Gemini HTTP 500' },
];
const plan: PlanEcritures = {
  misesAJour: [], orphelins: ['SGBC|income_statements|T1|2026-03-31'],
  decisions: [{ code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', decision: 'retenue', avant: null, apres: 1 }],
  relectures: [{ code: 'SGBC', indicateur: 'cout_du_risque', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel', raison: 'contradiction', detail: 'x', observations: ['a', 'b'] }],
};

describe('rapport de reprise', () => {
  const r = construireRapport('2026-11-15T10:00:00Z', docs, [obs({}), obs({ indicateur: 'cout_du_risque', statut: 'non_trouve' }), obs({ indicateur: 'charges_exploitation', controle: 'a_relire' })], plan);
  it('compte trouvées, non trouvées, bloquées, contradictions et échecs', () => {
    expect(r.totaux).toEqual({ documents: 2, lus: 1, echecs: 1, trouvees: 2, non_trouvees: 1, bloquees: 1, contradictions: 1, retenues: 1, orphelins: 1 });
    expect(r.synthese).toEqual([{ code: 'SGBC', periode: 'S1 2026-06-30', trouvees: 2, non_trouvees: 1, bloquees: 1, contradictions: 1, retenues: 1 }]);
  });
  it('garde les observations pour l’écriture depuis le rapport', () => {
    expect(r.observations).toHaveLength(3);
  });
  it('le texte nomme les échecs et dit qu’il n’a rien écrit', () => {
    const t = rapportTexte(r);
    expect(t).toContain('Gemini HTTP 500');
    expect(t).toMatch(/rien n’a été écrit/i);
  });
});

describe('messageFile', () => {
  it('rien à relire → aucun message', () => {
    expect(messageFile([])).toBeNull();
  });
  it('compte par valeur, sans donnée personnelle', () => {
    const m = messageFile([{ code: 'SGBC' }, { code: 'SGBC' }, { code: 'SIBC' }])!;
    expect(m.subject).toContain('3');
    expect(m.body).toContain('SGBC (2)');
    expect(m.body).toContain('/admin/agregats');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsRapport.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Écrire `rapport.ts`**

```ts
/**
 * Rapport de la reprise À BLANC — PUR. Il est présenté à l'exploitant AVANT
 * toute écriture (spec §7, PR 3) et porte les observations elles-mêmes :
 * l'écriture réelle insère ces observations-là, sans relire les PDF.
 */
import type { ObservationNouvelle } from './normaliser.js';
import type { PlanEcritures } from './ecritures.js';

export interface DocumentRapport {
  code: string;
  libelle: string;
  url: string;
  periode: string;
  etat: 'lu' | 'illisible' | 'echec' | 'ecarte';
  erreur: string | null;
}

export interface LigneSynthese {
  code: string;
  periode: string;
  trouvees: number;
  non_trouvees: number;
  bloquees: number;
  contradictions: number;
  retenues: number;
}

export interface RapportReprise {
  version: 1;
  genere_le: string;
  documents: DocumentRapport[];
  observations: ObservationNouvelle[];
  plan: PlanEcritures;
  synthese: LigneSynthese[];
  totaux: {
    documents: number; lus: number; echecs: number; trouvees: number; non_trouvees: number;
    bloquees: number; contradictions: number; retenues: number; orphelins: number;
  };
}

export function construireRapport(genereLe: string, documents: DocumentRapport[], observations: ObservationNouvelle[], plan: PlanEcritures): RapportReprise {
  const cles = new Map<string, LigneSynthese>();
  const ligne = (code: string, periode: string, date: string) => {
    const k = `${code}|${periode} ${date}`;
    if (!cles.has(k)) cles.set(k, { code, periode: `${periode} ${date}`, trouvees: 0, non_trouvees: 0, bloquees: 0, contradictions: 0, retenues: 0 });
    return cles.get(k)!;
  };
  for (const o of observations) {
    const l = ligne(o.code, o.periode, o.date_arrete);
    if (o.statut === 'non_trouve') l.non_trouvees++;
    else l.trouvees++;
    if (o.controle === 'a_relire') l.bloquees++;
  }
  for (const r of plan.relectures.filter((x) => x.raison === 'contradiction')) ligne(r.code, r.periode, r.date_arrete).contradictions++;
  for (const d of plan.decisions.filter((x) => x.decision === 'retenue')) ligne(d.code, d.periode, d.date_arrete).retenues++;
  const synthese = [...cles.values()].sort((a, b) => a.code.localeCompare(b.code) || b.periode.localeCompare(a.periode));
  const somme = (k: keyof Omit<LigneSynthese, 'code' | 'periode'>) => synthese.reduce((s, l) => s + l[k], 0);
  return {
    version: 1, genere_le: genereLe, documents, observations, plan, synthese,
    totaux: {
      documents: documents.length,
      lus: documents.filter((d) => d.etat === 'lu').length,
      echecs: documents.filter((d) => d.etat === 'echec').length,
      trouvees: somme('trouvees'), non_trouvees: somme('non_trouvees'), bloquees: somme('bloquees'),
      contradictions: somme('contradictions'), retenues: somme('retenues'), orphelins: plan.orphelins.length,
    },
  };
}

export function rapportTexte(r: RapportReprise): string {
  const t = r.totaux;
  const lignes = [
    `# Reprise à blanc des agrégats bancaires — ${r.genere_le}`,
    '',
    'Rien n’a été écrit en base. Ce rapport attend l’accord de l’exploitant.',
    '',
    `Documents : ${t.documents} (lus ${t.lus}, échecs ${t.echecs}).`,
    `Valeurs : trouvées ${t.trouvees}, non trouvées ${t.non_trouvees}, bloquées par un contrôle ${t.bloquees}, contradictions ${t.contradictions}, retenues ${t.retenues}.`,
    `Périodes sans ligne de comptes en base (non écrites) : ${t.orphelins}.`,
    '',
    '| Valeur | Période | Trouvées | Non trouvées | Bloquées | Contradictions | Retenues |',
    '|---|---|---|---|---|---|---|',
    ...r.synthese.map((l) => `| ${l.code} | ${l.periode} | ${l.trouvees} | ${l.non_trouvees} | ${l.bloquees} | ${l.contradictions} | ${l.retenues} |`),
  ];
  const echecs = r.documents.filter((d) => d.etat !== 'lu');
  if (echecs.length) {
    lignes.push('', '## Documents non lus', ...echecs.map((d) => `- ${d.code} ${d.periode} — ${d.libelle} : ${d.etat}${d.erreur ? ` (${d.erreur})` : ''}`));
  }
  if (r.plan.relectures.length) {
    lignes.push('', '## À relire', ...r.plan.relectures.map((x) => `- ${x.code} ${x.indicateur} ${x.periode} ${x.date_arrete} (${x.perimetre}) : ${x.raison} — ${x.detail}`));
  }
  if (r.plan.orphelins.length) lignes.push('', '## Sans ligne de comptes', ...r.plan.orphelins.map((k) => `- ${k}`));
  return lignes.join('\n');
}
```

- [ ] **Step 4: Écrire `alerte.ts`**

```ts
/**
 * Message à l'exploitant quand la file de relecture n'est pas vide — PUR.
 * Codes de valeurs et comptes seulement : aucune donnée personnelle.
 */
const SITE = 'https://www.westbourse.com';

export function messageFile(ouvertes: { code: string }[]): { subject: string; body: string } | null {
  if (ouvertes.length === 0) return null;
  const parCode = new Map<string, number>();
  for (const o of ouvertes) parCode.set(o.code, (parCode.get(o.code) ?? 0) + 1);
  const liste = [...parCode.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `${c} (${n})`).join(', ');
  return {
    subject: `Agrégats bancaires — ${ouvertes.length} valeur(s) à relire`,
    body: `Rien de douteux n’est publié tant que ces valeurs ne sont pas tranchées : ${liste}.\n${SITE}/admin/agregats`,
  };
}
```

- [ ] **Step 5: Lancer le test**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/agregatsRapport.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/rapport.ts scraper/src/agregats/alerte.ts scraper/tests/agregatsRapport.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): rapport de reprise à blanc et alerte de relecture"
```

---

### Task 12: Extraction (I/O) — publications, Gemini, références de contrôle

**Files:**
- Create: `scraper/src/agregats/runExtraction.ts`

Pas de test unitaire : toute la décision vit dans les modules purs des Tasks 2-11. Vérification par typecheck ici, puis par la commande à blanc en Task 14.

- [ ] **Step 1: Écrire le module**

```ts
/**
 * Extraction des agrégats bancaires — I/O. Lit les publications des banques,
 * envoie chaque PDF à Gemini (src/interim/gemini.ts, jsonDepuisPdf), valide
 * (zod), normalise et contrôle. N'ÉCRIT RIEN : l'appelant décide (cron :
 * insertion ; reprise à blanc : rapport).
 *
 * Échec bruyant : clé Gemini absente → exception ; erreur HTTP, réponse hors
 * schéma → document en « echec », compté, et le run sort en code 1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { jsonDepuisPdf } from '../interim/gemini.js';
import { construireAlias, documentEtranger } from '../publications/emetteur.js';
import { promptAgregats, schemaLecture } from './schema.js';
import { periodeDuDocument, type PeriodeDoc } from './periode.js';
import { normaliser, type ObservationNouvelle } from './normaliser.js';
import { controler, type Reference } from './controles.js';
import { AGREGATS } from './indicateurs.js';
import type { DocumentRapport } from './rapport.js';

const log = logger.child({ module: 'agregats-extraction' });
const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export interface ResultatExtraction {
  documents: DocumentRapport[];
  observations: ObservationNouvelle[];
  echecs: number;
}

interface Pub { id: string; code: string; libelle: string; date_publication: string; source_url: string | null; type_publication: string | null }

const codePeriodeLigne = (p: PeriodeDoc) => (p.code === 'exercice' ? String(p.annee) : `${p.annee}-${p.code}`);

async function reference(code: string, p: PeriodeDoc): Promise<Reference> {
  const sb = getSupabase();
  const periode = codePeriodeLigne(p);
  const periodeNm1 = p.code === 'exercice' ? String(p.annee - 1) : `${p.annee - 1}-${p.code}`;
  const [annuel, inc, bal, incNm1, balNm1] = await Promise.all([
    sb.from('balance_sheets').select('total_actifs').eq('code', code).eq('type_periode', 'annuel').not('total_actifs', 'is', null).order('periode', { ascending: false }).limit(1),
    sb.from('income_statements').select('resultat_net').eq('code', code).eq('periode', periode).limit(1),
    sb.from('balance_sheets').select('total_actifs,total_capitaux_propres').eq('code', code).eq('periode', periode).limit(1),
    sb.from('income_statements').select('lignes_specifiques,sources_specifiques').eq('code', code).eq('periode', periodeNm1).limit(1),
    sb.from('balance_sheets').select('lignes_specifiques,sources_specifiques').eq('code', code).eq('periode', periodeNm1).limit(1),
  ]);
  for (const r of [annuel, inc, bal, incNm1, balNm1]) if (r.error) throw new Error(`référence ${code} ${periode} : ${r.error.message}`);
  const num = (v: unknown) => (v == null ? null : Number(v));
  // Valeurs N−1 retenues, avec leur périmètre (sources_specifiques) ; sans source connue : non_precise.
  const valeursNm1: Record<string, number> = {};
  for (const row of [incNm1.data?.[0], balNm1.data?.[0]] as ({ lignes_specifiques: Record<string, unknown> | null; sources_specifiques: Record<string, { perimetre: string }> | null } | undefined)[]) {
    if (!row?.lignes_specifiques) continue;
    for (const [cle, v] of Object.entries(row.lignes_specifiques)) {
      if (v == null) continue;
      const ind = AGREGATS.find((a) => a.cle === cle && a.nature !== 'ratio')?.indicateur;
      if (!ind) continue;
      valeursNm1[`${ind}|${row.sources_specifiques?.[cle]?.perimetre ?? 'non_precise'}`] = Number(v);
    }
  }
  return {
    totalBilanAnnuel: num(annuel.data?.[0]?.total_actifs),
    resultatNetBase: num(inc.data?.[0]?.resultat_net),
    totalActifsBase: num(bal.data?.[0]?.total_actifs),
    fondsPropresBase: num(bal.data?.[0]?.total_capitaux_propres),
    valeursNm1,
  };
}

export async function extraireAgregats(opts: { codes?: string[]; reprise: boolean; fixtures?: string | null }): Promise<ResultatExtraction> {
  const sb = getSupabase();
  const cle = await resolveApiKeyForScraper('gemini');
  if (!cle) throw new Error('clé Gemini absente (GEMINI_API_KEY ou api_keys) : extraction impossible');

  const { data: instr, error: eI } = await sb.from('brvm_instruments').select('code,designation,famille_comptable').eq('type', 'action');
  if (eI) throw new Error(`brvm_instruments : ${eI.message}`);
  const tous = (instr ?? []) as { code: string; designation: string | null; famille_comptable: string | null }[];
  let banques = tous.filter((i) => i.famille_comptable === 'banque').map((i) => i.code);
  if (opts.codes?.length) banques = banques.filter((c) => opts.codes!.includes(c));
  if (banques.length === 0) return { documents: [], observations: [], echecs: 0 };

  let q = sb.from('publications').select('id,code,libelle,date_publication,source_url,type_publication').in('code', banques).order('date_publication');
  if (!opts.reprise) q = q.gte('date_publication', new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10));
  const { data: pubs, error: eP } = await q;
  if (eP) throw new Error(`publications : ${eP.message}`);

  const alias = construireAlias(tous);
  const codesConnus = new Set(tous.map((i) => i.code));
  const candidates = ((pubs ?? []) as Pub[])
    .map((p) => ({ p, periode: periodeDuDocument(p.libelle, p.type_publication) }))
    .filter((x): x is { p: Pub; periode: PeriodeDoc } => x.periode != null && !!x.p.source_url);

  // Déjà lus par ce pipeline : sautés, sauf en reprise (qui relit tout, à blanc).
  const deja = new Set<string>();
  if (!opts.reprise && candidates.length) {
    const urls = [...new Set(candidates.map((c) => c.p.source_url!))];
    for (let i = 0; i < urls.length; i += 100) {
      const { data, error } = await sb.from('indicateur_source').select('document_url').eq('methode', 'gemini-agregats').in('document_url', urls.slice(i, i + 100));
      if (error) throw new Error(`indicateur_source (déjà lus) : ${error.message}`);
      for (const r of data ?? []) deja.add(r.document_url as string);
    }
  }

  const documents: DocumentRapport[] = [];
  const observations: ObservationNouvelle[] = [];
  let echecs = 0;
  for (const { p, periode } of candidates) {
    const etiquette = { code: p.code, libelle: p.libelle, url: p.source_url!, periode: codePeriodeLigne(periode) };
    if (deja.has(p.source_url!)) continue;
    const autre = documentEtranger(p.code, p.libelle, p.source_url, alias, codesConnus);
    if (autre) {
      documents.push({ ...etiquette, etat: 'ecarte', erreur: `document de ${autre}` });
      continue;
    }
    try {
      const { systeme, consigne } = promptAgregats(p.code, p.libelle);
      const r = await jsonDepuisPdf(p.source_url!, systeme, consigne, cle);
      if (!r) {
        documents.push({ ...etiquette, etat: 'illisible', erreur: 'PDF trop lourd ou réponse vide' });
        continue;
      }
      if (opts.fixtures) {
        mkdirSync(opts.fixtures, { recursive: true });
        writeFileSync(`${opts.fixtures}/${p.code}-${etiquette.periode}.json`, JSON.stringify({ libelle: p.libelle, periode, reponse: r.brut }, null, 2));
      }
      const lecture = schemaLecture.safeParse(r.brut);
      if (!lecture.success) throw new Error(`réponse hors schéma : ${lecture.error.issues[0]?.message ?? '?'}`);
      const obs = normaliser(lecture.data, {
        code: p.code, url: p.source_url!, libelle: p.libelle, date: p.date_publication, publication_id: p.id, periode, modele: `gemini:${r.modele}`,
      });
      observations.push(...controler(obs, await reference(p.code, periode)));
      documents.push({ ...etiquette, etat: 'lu', erreur: null });
      log.info({ code: p.code, periode: etiquette.periode, publiees: obs.filter((o) => o.statut === 'publie').length }, 'document lu');
    } catch (e) {
      echecs++;
      documents.push({ ...etiquette, etat: 'echec', erreur: (e as Error).message.slice(0, 200) });
      log.error({ code: p.code, libelle: p.libelle, err: (e as Error).message.slice(0, 200) }, 'extraction en échec');
    }
    await pause(2_000);
  }
  return { documents, observations, echecs };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd C:\tmp\wt-banques\scraper; npx tsc -p tsconfig.json --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/runExtraction.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): extraction Gemini des agrégats, sans écriture"
```

---

### Task 13: Sélection (I/O) et orchestration cron / reprise

**Files:**
- Create: `scraper/src/agregats/runSelectionAgregats.ts`, `scraper/src/agregats/runAgregats.ts`

- [ ] **Step 1: Écrire `runSelectionAgregats.ts`**

```ts
/**
 * Sélection des agrégats bancaires — I/O. Lit toutes les observations des
 * banques (paginées : PostgREST tronque à 1000 EN SILENCE), y ajoute celles
 * en mémoire (reprise à blanc), calcule le plan (ecritures.ts) et, hors
 * dryRun, l'applique : lignes_specifiques + sources_specifiques, traces
 * correction_champ, éléments de relecture non encore ouverts.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { INDICATEURS_AGREGATS } from './indicateurs.js';
import { planifierEcritures, type LigneComptes, type ObsLue, type PlanEcritures } from './ecritures.js';

const log = logger.child({ module: 'agregats-selection' });
const COLONNES = 'id,code,indicateur,periode,date_arrete,perimetre,statut,valeur,comparateur,texte_original,motif,document_url,document_libelle,page,nature_source,provisoire,controle,controle_motif,unite_source,decimales,methode';

async function paginer<T>(construire: (de: number, a: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire(de, de + 999);
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as T[];
    out.push(...lot);
    if (lot.length < 1000) return out;
  }
}

export async function selectionnerAgregats(opts: { dryRun: boolean; codes: string[]; enMemoire?: ObsLue[] }): Promise<PlanEcritures & { ecrites: number; relecturesOuvertes: number }> {
  const sb = getSupabase();
  const lues = await paginer<ObsLue>((de, a) =>
    sb.from('indicateur_source').select(COLONNES).in('code', opts.codes).in('indicateur', INDICATEURS_AGREGATS).order('id').range(de, a));
  // Reprise à blanc : la relecture en mémoire d'un document REMPLACE ses
  // anciennes lectures Gemini en base (sinon une même lecture compterait deux
  // fois). Les observations saisies à la main (0147) sont gardées.
  const urlsMemoire = new Set((opts.enMemoire ?? []).map((o) => o.document_url));
  const enBase = lues
    .filter((o) => !(o.methode === 'gemini-agregats' && urlsMemoire.has(o.document_url)))
    .map((o) => ({ ...o, valeur: o.valeur == null ? null : Number(o.valeur) }));
  const ids = new Set(enBase.map((o) => o.id));
  const obs = [...enBase, ...(opts.enMemoire ?? []).filter((o) => !ids.has(o.id))];

  const lignes: LigneComptes[] = [];
  for (const table of ['income_statements', 'balance_sheets'] as const) {
    const rows = await paginer<Omit<LigneComptes, 'table'>>((de, a) =>
      sb.from(table).select('code,periode,type_periode,lignes_specifiques,sources_specifiques').in('code', opts.codes).order('periode').range(de, a));
    lignes.push(...rows.map((r) => ({ ...r, table })));
  }

  const plan = planifierEcritures(obs, lignes);
  if (plan.orphelins.length) log.warn({ orphelins: plan.orphelins }, 'observations sans ligne de comptes — non écrites');
  if (opts.dryRun) return { ...plan, ecrites: 0, relecturesOuvertes: plan.relectures.length };

  let ecrites = 0;
  for (const m of plan.misesAJour) {
    const { error } = await sb.from(m.table).update({ lignes_specifiques: m.lignes_specifiques, sources_specifiques: m.sources_specifiques })
      .eq('code', m.code).eq('periode', m.periode).eq('type_periode', m.type_periode);
    if (error) throw new Error(`${m.table} ${m.code} ${m.periode} : ${error.message}`);
    if (m.traces.length) {
      const { error: e2 } = await sb.from('correction_champ').insert(m.traces.map((t) => ({
        table_cible: m.table, code: m.code, periode: m.periode, champ: t.champ,
        valeur_avant: t.avant, valeur_apres: t.apres, motif: t.motif, source_externe: t.source, corrige_par: 'selection-agregats',
      })));
      if (e2) throw new Error(`correction_champ ${m.code} ${m.periode} : ${e2.message}`);
    }
    ecrites += m.traces.length;
  }

  // Relecture : n'ouvre que ce qui n'est pas déjà ouvert (index unique partiel).
  const { data: ouvertes, error: e3 } = await sb.from('indicateur_relecture').select('code,indicateur,date_arrete,perimetre').eq('statut', 'ouverte').in('code', opts.codes);
  if (e3) throw new Error(`indicateur_relecture : ${e3.message}`);
  const deja = new Set((ouvertes ?? []).map((r) => `${r.code}|${r.indicateur}|${r.date_arrete}|${r.perimetre}`));
  const nouvelles = plan.relectures.filter((r) => !deja.has(`${r.code}|${r.indicateur}|${r.date_arrete}|${r.perimetre}`));
  if (nouvelles.length) {
    const { error: e4 } = await sb.from('indicateur_relecture').insert(nouvelles);
    if (e4) throw new Error(`indicateur_relecture (insertion) : ${e4.message}`);
  }
  return { ...plan, ecrites, relecturesOuvertes: deja.size + nouvelles.length };
}
```

- [ ] **Step 2: Écrire `runAgregats.ts`**

```ts
/**
 * Orchestration des agrégats bancaires.
 *
 *   runAgregatsBancaires — cron hebdomadaire (interim.yml) : lit les
 *     publications nouvelles, insère leurs observations, sélectionne, et
 *     alerte l'exploitant si la file de relecture n'est pas vide.
 *   runRepriseAgregats — reprise de l'historique :
 *     * À BLANC par défaut : relit TOUS les documents, n'écrit RIEN en base,
 *       produit un rapport JSON + Markdown ;
 *     * --ecrire --depuis-rapport=<fichier> : insère les observations DU
 *       RAPPORT approuvé (aucune relecture de PDF) puis sélectionne.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendTelegramText } from '../alerts/channels.js';
import { extraireAgregats } from './runExtraction.js';
import { selectionnerAgregats } from './runSelectionAgregats.js';
import { construireRapport, rapportTexte, type RapportReprise } from './rapport.js';
import { messageFile } from './alerte.js';
import type { ObservationNouvelle } from './normaliser.js';
import type { ObsLue } from './ecritures.js';

const log = logger.child({ module: 'agregats' });

export interface ResultatAgregats {
  documents: number;
  observations: number;
  echecs: number;
  ecrites: number;
  aRelire: number;
  alerteEnvoyee: boolean;
}

async function banques(codes: string[]): Promise<string[]> {
  const { data, error } = await getSupabase().from('brvm_instruments').select('code').eq('type', 'action').eq('famille_comptable', 'banque');
  if (error) throw new Error(`brvm_instruments : ${error.message}`);
  const toutes = (data ?? []).map((r) => r.code as string);
  return codes.length ? toutes.filter((c) => codes.includes(c)) : toutes;
}

async function inserer(obs: ObservationNouvelle[]): Promise<void> {
  const sb = getSupabase();
  for (let i = 0; i < obs.length; i += 200) {
    const { error } = await sb.from('indicateur_source')
      .upsert(obs.slice(i, i + 200), { onConflict: 'code,indicateur,date_arrete,perimetre,document_url', ignoreDuplicates: true });
    if (error) throw new Error(`indicateur_source (insertion) : ${error.message}`);
  }
}

export async function runAgregatsBancaires(opts: { mock: boolean; codes: string[] }): Promise<ResultatAgregats> {
  if (opts.mock) return { documents: 0, observations: 0, echecs: 0, ecrites: 0, aRelire: 0, alerteEnvoyee: false };
  const codes = await banques(opts.codes);
  const ex = await extraireAgregats({ codes, reprise: false });
  await inserer(ex.observations);
  const sel = await selectionnerAgregats({ dryRun: false, codes });

  const { data: ouvertes, error } = await getSupabase().from('indicateur_relecture').select('code').eq('statut', 'ouverte');
  if (error) throw new Error(`indicateur_relecture : ${error.message}`);
  const message = messageFile((ouvertes ?? []) as { code: string }[]);
  let alerteEnvoyee = false;
  if (message) {
    const r = await sendTelegramText({ ...message, operateur: true });
    if (!r || r.status !== 'sent') throw new Error(`alerte Telegram non envoyée : ${r ? r.error ?? r.status : 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID absent'}`);
    alerteEnvoyee = true;
  }
  const res = { documents: ex.documents.length, observations: ex.observations.length, echecs: ex.echecs, ecrites: sel.ecrites, aRelire: ouvertes?.length ?? 0, alerteEnvoyee };
  log.info(res, 'agrégats bancaires');
  return res;
}

export async function runRepriseAgregats(opts: { codes: string[]; ecrire: boolean; depuisRapport: string | null; rapport: string; fixtures: string | null }): Promise<{ rapport: RapportReprise | null; echecs: number; ecrites: number }> {
  const codes = await banques(opts.codes);
  if (opts.ecrire) {
    if (!opts.depuisRapport) throw new Error('--ecrire exige --depuis-rapport=<fichier> : on n’écrit que ce que l’exploitant a approuvé');
    const approuve = JSON.parse(readFileSync(opts.depuisRapport, 'utf8')) as RapportReprise;
    if (approuve.version !== 1) throw new Error(`rapport de version ${String(approuve.version)} non pris en charge`);
    const obs = approuve.observations.filter((o) => codes.includes(o.code));
    await inserer(obs);
    const sel = await selectionnerAgregats({ dryRun: false, codes });
    log.info({ inserees: obs.length, ecrites: sel.ecrites, aRelire: sel.relecturesOuvertes }, 'reprise écrite depuis le rapport approuvé');
    return { rapport: null, echecs: 0, ecrites: sel.ecrites };
  }

  const ex = await extraireAgregats({ codes, reprise: true, fixtures: opts.fixtures });
  const plan = await selectionnerAgregats({ dryRun: true, codes, enMemoire: ex.observations as unknown as ObsLue[] });
  const rapport = construireRapport(new Date().toISOString(), ex.documents, ex.observations, plan);
  mkdirSync(dirname(opts.rapport), { recursive: true });
  writeFileSync(opts.rapport, JSON.stringify(rapport, null, 2));
  writeFileSync(opts.rapport.replace(/\.json$/, '.md'), rapportTexte(rapport));
  log.info({ rapport: opts.rapport, ...rapport.totaux }, 'reprise À BLANC — rien n’a été écrit');
  return { rapport, echecs: ex.echecs, ecrites: 0 };
}
```

- [ ] **Step 3: Typecheck**

Run: `cd C:\tmp\wt-banques\scraper; npx tsc -p tsconfig.json --noEmit`
Expected: aucune erreur. `ObservationNouvelle` est structurellement compatible avec `ObsLue` sauf pour les champs optionnels ; le cast `as unknown as ObsLue[]` est volontaire (les observations en mémoire portent toutes les colonnes lues).

- [ ] **Step 4: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/agregats/runSelectionAgregats.ts scraper/src/agregats/runAgregats.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): sélection, file de relecture, cron et reprise à blanc des agrégats"
```

---

### Task 14: Commandes CLI, scripts npm, workflow

**Files:**
- Modify: `scraper/src/index.ts` (après le `case 'interim': { … }`, avant `case 'pass':`)
- Modify: `scraper/package.json` (scripts)
- Modify: `.github/workflows/interim.yml`

- [ ] **Step 1: Ajouter les commandes à `index.ts`**

```ts
    case 'agregats:bancaires': {
      // Agrégats bancaires des publications nouvelles (cron hebdomadaire) :
      // observations sourcées, contrôles, sélection, alerte si relecture.
      // `agregats:bancaires SGBC SIBC` limite.
      const { runAgregatsBancaires } = await import('./agregats/runAgregats.js');
      const res = await monitored(
        { code: 'agregats-bancaires', label: 'Agrégats bancaires (extraction sourcée)' },
        async () => {
          const r = await runAgregatsBancaires({ mock, codes: positional.map((c) => c.toUpperCase()) });
          return {
            value: r,
            outcome: {
              status: r.echecs > 0 ? ('partial' as const) : ('success' as const),
              rows_extracted: r.observations,
              rows_upserted: r.ecrites,
              metadata: { documents: r.documents, echecs: r.echecs, aRelire: r.aRelire, alerteEnvoyee: r.alerteEnvoyee },
            },
          };
        },
      );
      // Une panne d'extraction fait échouer le job : jamais de vert silencieux.
      return res.echecs > 0 ? 1 : 0;
    }

    case 'agregats:reprise': {
      // Reprise de l'historique. À BLANC par défaut : relit tout, n'écrit rien,
      // produit un rapport. --ecrire --depuis-rapport=<fichier> insère les
      // observations du rapport approuvé, sans relire les PDF.
      const { runRepriseAgregats } = await import('./agregats/runAgregats.js');
      const opt = (nom: string) => rest.find((a) => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') ?? null;
      const jour = new Date().toISOString().slice(0, 10);
      const r = await runRepriseAgregats({
        codes: positional.map((c) => c.toUpperCase()),
        ecrire: rest.includes('--ecrire'),
        depuisRapport: opt('depuis-rapport'),
        rapport: opt('rapport') ?? `output/agregats/reprise-${jour}.json`,
        fixtures: opt('fixtures'),
      });
      if (r.rapport) console.log(`Rapport : ${JSON.stringify(r.rapport.totaux)} — rien n’a été écrit.`);
      else console.log(`Écrit depuis le rapport approuvé : ${r.ecrites} valeur(s) changée(s).`);
      return r.echecs > 0 ? 1 : 0;
    }
```

Ajouter aussi, dans le commentaire d'usage en tête du fichier, après la ligne `sante:llm` :

```ts
 *   tsx src/index.ts agregats:bancaires    # agrégats bancaires des publications nouvelles (cron)
 *   tsx src/index.ts agregats:reprise      # reprise À BLANC de l'historique, rapport sans écriture
 *   tsx src/index.ts agregats:reprise --ecrire --depuis-rapport=output/agregats/reprise-AAAA-MM-JJ.json
```

- [ ] **Step 2: Scripts npm (`scraper/package.json`, dans `scripts`)**

```json
    "agregats": "tsx src/index.ts agregats:bancaires",
    "agregats:mock": "tsx src/index.ts agregats:bancaires --mock",
    "agregats:reprise": "tsx src/index.ts agregats:reprise",
```

- [ ] **Step 3: Workflow — ajouter l'étape à la fin de `.github/workflows/interim.yml`**

Passer `timeout-minutes: 60` à `timeout-minutes: 120`, compléter le commentaire d'en-tête par :

```yaml
# Puis les AGRÉGATS BANCAIRES (scraper/src/agregats/) : chaque publication
# bancaire nouvelle est lue en entier par Gemini, chaque valeur contrôlée ;
# seules les concordantes vont dans lignes_specifiques. Une file de relecture
# non vide alerte l'exploitant sur Telegram. Une panne d'extraction sort en
# code 1. Secrets supplémentaires : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
```

et ajouter l'étape après « Extraire les comptes intermédiaires » :

```yaml
      - name: Extraire les agrégats bancaires
        # Même si l'étape précédente a échoué : ce sont deux lectures distinctes.
        if: ${{ !cancelled() }}
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          LOG_LEVEL: info
          CODES: ${{ github.event.inputs.codes }}
        run: npx tsx src/index.ts agregats:bancaires $CODES
```

- [ ] **Step 4: Vérifier le mode mock et le typecheck**

Run: `cd C:\tmp\wt-banques\scraper; npx tsc -p tsconfig.json --noEmit; npx tsx src/index.ts agregats:bancaires --mock`
Expected: typecheck vert ; la commande mock sort en code 0 sans appel réseau ni écriture.

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/index.ts scraper/package.json .github/workflows/interim.yml
git -C C:\tmp\wt-banques commit -m "feat(banques): commandes agregats:bancaires et agregats:reprise, étape du cron hebdomadaire"
```

---

### Task 15: Page admin de relecture

**Files:**
- Create: `frontend/lib/admin/relecture.ts`, `frontend/lib/admin/relecture.test.ts`, `frontend/lib/admin/relectureServeur.ts`
- Create: `frontend/app/api/admin/agregats/relecture/[id]/route.ts`
- Create: `frontend/app/admin/agregats/page.tsx`, `frontend/app/admin/agregats/RelectureActions.tsx`
- Modify: `frontend/lib/admin-nav.ts` (après l'entrée « Écarts BOC »)

Permissions existantes : lecture `scraping.read`, décision `content.write` (super_admin et data_admin les ont, seed de 0041).

- [ ] **Step 1: Écrire le test des actions**

```ts
import { describe, expect, it } from 'vitest';
import { planAction, LIBELLES_AGREGATS } from './relecture';

const item = { id: 'r1', code: 'SGBC', indicateur: 'pnb', observations: ['a', 'b'] };

describe('planAction', () => {
  it('valider une observation : elle passe « valide », les autres « rejete »', () => {
    expect(planAction(item, { action: 'valider', observation: 'b' })).toEqual({
      valides: ['b'], rejetees: ['a'], correction: null, statut: 'validee', valeurCorrigee: null,
    });
  });
  it('valider une observation étrangère à l’élément : refusé', () => {
    expect(() => planAction(item, { action: 'valider', observation: 'z' })).toThrow(/n’appartient pas/);
  });
  it('corriger : la valeur saisie remplace la lecture de l’observation choisie', () => {
    expect(planAction(item, { action: 'corriger', observation: 'a', texte: '152 345 210 000' })).toEqual({
      valides: ['a'], rejetees: ['b'], correction: { observation: 'a', valeur: 152345210000, texte: '152 345 210 000', decimales: 0 }, statut: 'corrigee', valeurCorrigee: 152345210000,
    });
  });
  it('corriger avec un nombre illisible : refusé', () => {
    expect(() => planAction(item, { action: 'corriger', observation: 'a', texte: 'abc' })).toThrow(/illisible/);
  });
  it('rejeter : toutes les observations sont écartées', () => {
    expect(planAction(item, { action: 'rejeter' })).toEqual({ valides: [], rejetees: ['a', 'b'], correction: null, statut: 'rejetee', valeurCorrigee: null });
  });
  it('libellés pour chaque indicateur du catalogue scraper', () => {
    expect(LIBELLES_AGREGATS.pnb).toBe('Produit net bancaire');
    expect(Object.keys(LIBELLES_AGREGATS)).toHaveLength(19);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/admin/relecture.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `lib/admin/relecture.ts`**

```ts
/**
 * Relecture des agrégats bancaires — PUR. Traduit la décision d'un
 * administrateur en changements d'état des observations (indicateur_source.
 * controle) ; la valeur retenue est recalculée par le scraper au passage
 * suivant (scraper/src/agregats/ecritures.ts), jamais écrite d'ici.
 *
 * ⚠️ LIBELLES_AGREGATS duplique les libellés de scraper/src/agregats/
 * indicateurs.ts (deux paquets TS distincts). À corriger des deux côtés.
 */
export const LIBELLES_AGREGATS: Record<string, string> = {
  pnb: 'Produit net bancaire',
  produits_interets: 'Intérêts et produits assimilés',
  charges_interets: 'Intérêts et charges assimilées',
  marge_interets: 'Marge d’intérêts',
  commissions_nettes: 'Commissions nettes',
  charges_exploitation: 'Charges d’exploitation',
  resultat_brut_exploitation: 'Résultat brut d’exploitation',
  cout_du_risque: 'Coût du risque',
  resultat_net: 'Résultat net',
  total_bilan: 'Total du bilan',
  credits_clientele: 'Crédits à la clientèle',
  depots_clientele: 'Dépôts de la clientèle',
  fonds_propres: 'Fonds propres',
  creances_souffrance_brutes: 'Créances en souffrance brutes',
  taux_creances_souffrance: 'Taux de créances en souffrance',
  couverture_creances_souffrance: 'Couverture des créances en souffrance',
  solvabilite_total: 'Solvabilité totale',
  ratio_cet1: 'Ratio CET1',
  ratio_tier1: 'Ratio Tier 1',
};

/** Indicateurs exprimés en pourcentage (les autres sont des montants en FCFA). */
export const RATIOS: ReadonlySet<string> = new Set(['taux_creances_souffrance', 'couverture_creances_souffrance', 'solvabilite_total', 'ratio_cet1', 'ratio_tier1']);

export type ActionRelecture =
  | { action: 'valider'; observation: string }
  | { action: 'corriger'; observation: string; texte: string }
  | { action: 'rejeter' };

export interface PlanAction {
  valides: string[];
  rejetees: string[];
  correction: { observation: string; valeur: number; texte: string; decimales: number } | null;
  statut: 'validee' | 'corrigee' | 'rejetee';
  valeurCorrigee: number | null;
}

/** Montant ou pourcentage saisi : « 152 345 210 000 », « 14,39 ». */
function lireSaisie(texte: string): { valeur: number; decimales: number } | null {
  const t = texte.trim().replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(/%$/, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return { valeur: Number(t), decimales: t.includes('.') ? t.split('.')[1]!.length : 0 };
}

export function planAction(item: { observations: string[] }, a: ActionRelecture): PlanAction {
  if (a.action === 'rejeter') return { valides: [], rejetees: [...item.observations], correction: null, statut: 'rejetee', valeurCorrigee: null };
  if (!item.observations.includes(a.observation)) throw new Error('Cette observation n’appartient pas à l’élément de relecture.');
  const autres = item.observations.filter((id) => id !== a.observation);
  if (a.action === 'valider') return { valides: [a.observation], rejetees: autres, correction: null, statut: 'validee', valeurCorrigee: null };
  const n = lireSaisie(a.texte);
  if (!n) throw new Error('Valeur corrigée illisible : saisir un nombre (FCFA pour un montant, % pour un ratio).');
  return { valides: [a.observation], rejetees: autres, correction: { observation: a.observation, valeur: n.valeur, texte: a.texte.trim(), decimales: n.decimales }, statut: 'corrigee', valeurCorrigee: n.valeur };
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/admin/relecture.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Écrire `lib/admin/relectureServeur.ts`**

```ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Couche de données de /admin/agregats. indicateur_source et
 * indicateur_relecture n'ont aucune lecture publique (0245) : service_role.
 * Lève en cas d'erreur — une file illisible n'est jamais affichée vide.
 */
export interface ObservationRelecture {
  id: string;
  valeur: number | null;
  texte_original: string | null;
  unite_source: string | null;
  perimetre: string;
  page: number | null;
  extrait: string | null;
  libelle_exact: string | null;
  document_url: string;
  document_libelle: string | null;
  controle_motif: string | null;
}

export interface ElementFile {
  id: string;
  code: string;
  indicateur: string;
  periode: string;
  date_arrete: string;
  perimetre: string;
  raison: 'contradiction' | 'controle';
  detail: string;
  cree_le: string;
  observations: ObservationRelecture[];
}

export async function chargerFileRelecture(): Promise<ElementFile[]> {
  const db = getServiceClient();
  const { data: items, error } = await db.from('indicateur_relecture')
    .select('id,code,indicateur,periode,date_arrete,perimetre,raison,detail,cree_le,observations')
    .eq('statut', 'ouverte').order('code').order('date_arrete', { ascending: false });
  if (error) throw new Error(`indicateur_relecture : ${error.message}`);
  const ids = [...new Set((items ?? []).flatMap((i) => i.observations as string[]))];
  const obs = new Map<string, ObservationRelecture>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e2 } = await db.from('indicateur_source')
      .select('id,valeur,texte_original,unite_source,perimetre,page,extrait,libelle_exact,document_url,document_libelle,controle_motif')
      .in('id', ids.slice(i, i + 200));
    if (e2) throw new Error(`indicateur_source : ${e2.message}`);
    for (const o of data ?? []) obs.set(o.id as string, { ...(o as ObservationRelecture), valeur: o.valeur == null ? null : Number(o.valeur) });
  }
  return (items ?? []).map((i) => ({
    ...(i as Omit<ElementFile, 'observations'>),
    observations: (i.observations as string[]).map((id) => obs.get(id)).filter((x): x is ObservationRelecture => !!x),
  }));
}
```

- [ ] **Step 6: Écrire la route `app/api/admin/agregats/relecture/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { planAction, RATIOS, type ActionRelecture } from '@/lib/admin/relecture';

export const dynamic = 'force-dynamic';

/**
 * Décision de relecture d'un agrégat bancaire : valider, corriger ou rejeter.
 * Ne change que l'état des observations ; la valeur retenue est recalculée
 * par le scraper au passage suivant (cron interim.yml, ou relance manuelle).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminApi('content.write');
  if ('error' in g) return g.error;
  const { id } = await ctx.params;
  const corps = (await req.json().catch(() => null)) as ActionRelecture | null;
  if (!corps || !['valider', 'corriger', 'rejeter'].includes(corps.action)) {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: item, error } = await db.from('indicateur_relecture')
    .select('id,code,indicateur,periode,date_arrete,observations,statut').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: `Lecture impossible : ${error.message}` }, { status: 500 });
  if (!item) return NextResponse.json({ error: 'Élément introuvable.' }, { status: 404 });
  if (item.statut !== 'ouverte') return NextResponse.json({ error: 'Élément déjà traité.' }, { status: 409 });

  let plan;
  try {
    plan = planAction({ observations: item.observations as string[] }, corps);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const maintenant = new Date().toISOString();
  if (plan.correction) {
    const { data: avant, error: eA } = await db.from('indicateur_source').select('texte_original').eq('id', plan.correction.observation).maybeSingle();
    if (eA || !avant) return NextResponse.json({ error: 'Observation introuvable.' }, { status: 500 });
    // L'unité suit la nature de l'indicateur, pas l'observation corrigée (qui pouvait être non exploitable, sans unité).
    const ratio = RATIOS.has(item.indicateur as string);
    const { error: eC } = await db.from('indicateur_source').update({
      statut: 'publie', valeur: plan.correction.valeur, texte_original: plan.correction.texte, decimales: plan.correction.decimales,
      unite: ratio ? 'pct' : 'fcfa', unite_source: ratio ? 'pct' : 'unites', motif: null,
      commentaire: `Lu « ${avant.texte_original ?? '—'} », corrigé en relecture.`,
    }).eq('id', plan.correction.observation);
    if (eC) return NextResponse.json({ error: `Correction impossible : ${eC.message}` }, { status: 500 });
  }
  if (plan.valides.length) {
    const { error: eV } = await db.from('indicateur_source').update({ controle: 'valide', verifie_par: 'relecture-admin', verifie_le: maintenant }).in('id', plan.valides);
    if (eV) return NextResponse.json({ error: `Validation impossible : ${eV.message}` }, { status: 500 });
  }
  if (plan.rejetees.length) {
    const { error: eR } = await db.from('indicateur_source').update({ controle: 'rejete', verifie_par: 'relecture-admin', verifie_le: maintenant }).in('id', plan.rejetees);
    if (eR) return NextResponse.json({ error: `Rejet impossible : ${eR.message}` }, { status: 500 });
  }
  const { error: eI } = await db.from('indicateur_relecture')
    .update({ statut: plan.statut, valeur_corrigee: plan.valeurCorrigee, traite_le: maintenant }).eq('id', id).eq('statut', 'ouverte');
  if (eI) return NextResponse.json({ error: `Clôture impossible : ${eI.message}` }, { status: 500 });

  await recordAudit(g.ctx, {
    action: `agregat.relecture.${corps.action}`,
    resourceType: 'indicateur_relecture',
    resourceId: id,
    metadata: { code: item.code, indicateur: item.indicateur, periode: item.periode, date_arrete: item.date_arrete, valides: plan.valides, rejetees: plan.rejetees, valeur_corrigee: plan.valeurCorrigee },
  });
  return NextResponse.json({ ok: true, statut: plan.statut });
}
```

- [ ] **Step 7: Écrire le composant client `app/admin/agregats/RelectureActions.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Boutons de décision d'un élément de relecture. Aucune valeur n'est publiée d'ici. */
export default function RelectureActions({ id, observations }: { id: string; observations: { id: string; libelle: string }[] }) {
  const router = useRouter();
  const [choix, setChoix] = useState(observations[0]?.id ?? '');
  const [texte, setTexte] = useState('');
  const [etat, setEtat] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(corps: Record<string, string>) {
    setEnCours(true);
    setEtat(null);
    const r = await fetch(`/api/admin/agregats/relecture/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setEnCours(false);
    if (!r.ok) return setEtat(j.error ?? `Erreur ${r.status}`);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-1 text-faint">
        Observation
        <select value={choix} onChange={(e) => setChoix(e.target.value)} className="rounded-md border border-border bg-elevated px-2 py-1 text-ivory">
          {observations.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
        </select>
      </label>
      <button type="button" disabled={enCours || !choix} onClick={() => envoyer({ action: 'valider', observation: choix })} className="rounded-md border border-border px-3 py-1 text-ivory hover:bg-elevated">Valider</button>
      <label className="flex flex-col gap-1 text-faint">
        Valeur corrigée (FCFA ou %)
        <input value={texte} onChange={(e) => setTexte(e.target.value)} inputMode="decimal" className="tabular w-40 rounded-md border border-border bg-elevated px-2 py-1 text-ivory" />
      </label>
      <button type="button" disabled={enCours || !choix || !texte.trim()} onClick={() => envoyer({ action: 'corriger', observation: choix, texte })} className="rounded-md border border-border px-3 py-1 text-ivory hover:bg-elevated">Corriger</button>
      <button type="button" disabled={enCours} onClick={() => envoyer({ action: 'rejeter' })} className="rounded-md border border-border px-3 py-1 text-down hover:bg-elevated">Rejeter tout</button>
      {etat && <p role="alert" className="w-full text-down">{etat}</p>}
    </div>
  );
}
```

- [ ] **Step 8: Écrire la page `app/admin/agregats/page.tsx`**

```tsx
import { requirePermission, can } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { chargerFileRelecture, type ElementFile } from '@/lib/admin/relectureServeur';
import { LIBELLES_AGREGATS } from '@/lib/admin/relecture';
import RelectureActions from './RelectureActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agrégats bancaires à relire — Administration' };

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const valeurLue = (v: number | null, unite: string | null) => (v == null ? 'non exploitable' : unite === 'pct' ? `${nf.format(v)} %` : `${nf.format(v)} FCFA`);

function Element({ e, peutDecider }: { e: ElementFile; peutDecider: boolean }) {
  return (
    <PremiumPanel className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatPill tone={e.raison === 'contradiction' ? 'gold' : 'neutral'}>{e.raison === 'contradiction' ? 'Contradiction' : 'Contrôle'}</StatPill>
        <h2 className="font-display text-base text-ivory">{e.code} · {LIBELLES_AGREGATS[e.indicateur] ?? e.indicateur}</h2>
        <span className="tabular text-xs text-faint">{e.periode} au {e.date_arrete} · {e.perimetre}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{e.detail}</p>
      <ul className="mt-3 space-y-2">
        {e.observations.map((o) => (
          <li key={o.id} className="rounded-lg border border-border/60 p-2 text-xs">
            <p className="tabular text-ivory">{valeurLue(o.valeur, o.unite_source)} <span className="text-faint">(imprimé « {o.texte_original ?? '—'} », {o.unite_source ?? 'unité inconnue'}, {o.perimetre})</span></p>
            <p className="text-muted">
              <a href={o.document_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{o.document_libelle ?? o.document_url}</a>
              {o.page ? `, page ${o.page}` : ''}{o.libelle_exact ? ` · ${o.libelle_exact}` : ''}
            </p>
            {o.extrait && <blockquote className="mt-1 border-l border-border pl-2 text-faint">{o.extrait}</blockquote>}
            {o.controle_motif && <p className="mt-1 text-down">{o.controle_motif}</p>}
          </li>
        ))}
      </ul>
      {peutDecider && (
        <RelectureActions id={e.id} observations={e.observations.map((o) => ({ id: o.id, libelle: `${valeurLue(o.valeur, o.unite_source)} — ${o.document_libelle ?? 'document'}` }))} />
      )}
    </PremiumPanel>
  );
}

export default async function AgregatsRelecturePage() {
  const ctx = await requirePermission('scraping.read');
  const file = await chargerFileRelecture();
  const peutDecider = can(ctx, 'content.write');
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agrégats bancaires à relire"
        subtitle="Valeurs bloquées par une contradiction entre documents ou un contrôle en échec. Rien n’est publié tant qu’elles ne sont pas tranchées ; la décision s’applique au prochain passage du cron « Comptes intermédiaires »."
      />
      {file.length === 0 ? (
        <EmptyStatePremium title="Aucune valeur à relire" description="Toutes les valeurs lues concordent et passent les contrôles." />
      ) : (
        <div className="space-y-4">{file.map((e) => <Element key={e.id} e={e} peutDecider={peutDecider} />)}</div>
      )}
    </div>
  );
}
```

Vérifier les props réelles de `SectionHeader` et `EmptyStatePremium` avant d'écrire :
`rg -n "export function (SectionHeader|EmptyStatePremium|StatPill)" C:\tmp\wt-banques\frontend\components\ui\premium` — si les noms de props diffèrent (`title`/`subtitle`, `title`/`description`, `tone`), aligner la page sur la signature réelle (la page `/admin/coherence` en est l'exemple d'usage).

- [ ] **Step 9: Entrée de menu (`lib/admin-nav.ts`, après « Écarts BOC »)**

```ts
  { href: '/admin/agregats', label: 'Agrégats bancaires à relire', permission: 'scraping.read' },
```

- [ ] **Step 10: Typecheck, tests, build**

Run: `cd C:\tmp\wt-banques\frontend; npx tsc --noEmit -p tsconfig.json; npx vitest run lib/admin/relecture.test.ts; npm run build`
Expected: tout vert.

- [ ] **Step 11: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/lib/admin/relecture.ts frontend/lib/admin/relecture.test.ts frontend/lib/admin/relectureServeur.ts "frontend/app/api/admin/agregats" frontend/app/admin/agregats frontend/lib/admin-nav.ts
git -C C:\tmp\wt-banques commit -m "feat(admin): file de relecture des agrégats bancaires"
```

---

### Task 16: Fixtures gelées, application de la migration, vérifications de sécurité

**Files:**
- Create: `scraper/tests/fixtures/agregats/*.json` (capturés), `scraper/tests/agregatsFixtures.test.ts`

- [ ] **Step 1: Appliquer la migration (après déploiement de la Task 1, Step 2)**

Run: `cd C:\tmp\wt-banques; supabase db query --linked -f supabase/migrations/0245_agregats_bancaires.sql`
Expected: aucune erreur.

- [ ] **Step 2: Tester la RLS à la clé publique (aucune lecture, aucune écriture)**

```powershell
$u = $env:SUPABASE_URL; $k = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
foreach ($t in 'indicateur_source','indicateur_relecture') {
  try { Invoke-RestMethod -Uri "$u/rest/v1/$t?select=id&limit=1" -Headers @{ apikey = $k; 'User-Agent' = 'westbourse-verif/1.0' } } catch { $_.Exception.Response.StatusCode.value__ }
}
```
Expected: `401` ou `[]` vide avec refus (`42501` / `permission denied`) pour les deux tables ; JAMAIS une ligne. Puis lancer le scan sécurité : outil `get_advisors` (type `security`) — aucun nouvel avis sur ces tables.

- [ ] **Step 3: Vérifier que la page financials garde ses libellés**

Ouvrir `/actions/SGBC/financials` (session admin, `next dev` local) : la ligne « Ratio de solvabilité » affiche une valeur ou un libellé d'absence (« non trouvé dans les documents consultés »…), pas « non disponible » partout.

- [ ] **Step 4: Capturer les fixtures (lecture à blanc, aucune écriture en base)**

Run: `cd C:\tmp\wt-banques\scraper; npx tsx src/index.ts agregats:reprise SIBC SGBC CBIBF BOAC --fixtures=tests/fixtures/agregats --rapport=output/agregats/fixtures.json`
Expected: un fichier JSON par document lu dans `tests/fixtures/agregats/` ; message « rien n’a été écrit ». Garder au plus deux fichiers par banque (le dernier S1 et le dernier annuel), et pour BOAC au moins un document dont le rapport indique qu'il est scanné (texte pdfjs vide) — c'est la fixture « scan ». Supprimer les autres.

- [ ] **Step 5: Écrire le test des fixtures**

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { schemaLecture } from '../src/agregats/schema.js';
import { normaliser } from '../src/agregats/normaliser.js';
import { controler } from '../src/agregats/controles.js';
import type { PeriodeDoc } from '../src/agregats/periode.js';

const DOSSIER = new URL('./fixtures/agregats/', import.meta.url);
const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.json'));
const charge = (f: string) => JSON.parse(readFileSync(new URL(f, DOSSIER), 'utf8')) as { libelle: string; periode: PeriodeDoc; reponse: unknown };
const lire = (f: string) => {
  const x = charge(f);
  const lecture = schemaLecture.parse(x.reponse);
  const code = f.split('-')[0]!;
  return normaliser(lecture, { code, url: `fixture:${f}`, libelle: x.libelle, date: null, publication_id: null, periode: x.periode, modele: 'fixture' }, () => `${f}:${Math.random()}`);
};

describe('réponses Gemini gelées', () => {
  it('au moins une fixture par banque témoin', () => {
    for (const code of ['SIBC', 'SGBC', 'CBIBF', 'BOAC']) expect(fichiers.some((f) => f.startsWith(`${code}-`))).toBe(true);
  });

  it.each(fichiers)('%s respecte le schéma', (f) => {
    expect(schemaLecture.safeParse(charge(f).reponse).success).toBe(true);
  });

  it.each(fichiers)('%s : aucune valeur de branche islamique n’est publiée', (f) => {
    const publiees = lire(f).filter((o) => o.statut === 'publie');
    expect(publiees.filter((o) => /islam|fen[eê]tre/i.test(`${o.libelle_exact ?? ''} ${o.extrait ?? ''}`))).toEqual([]);
  });

  it.each(fichiers.filter((f) => !f.startsWith('CBIBF')))('%s : PNB publié et égalités comptables tenues', (f) => {
    const obs = controler(lire(f), { totalBilanAnnuel: null, resultatNetBase: null, totalActifsBase: null, fondsPropresBase: null, valeursNm1: {} });
    expect(obs.some((o) => o.indicateur === 'pnb' && o.statut === 'publie')).toBe(true);
    expect(obs.filter((o) => /RBE|marge d’intérêts/.test(o.controle_motif ?? ''))).toEqual([]);
  });
});
```

Si un document réel échoue au dernier test (égalité non tenue), NE PAS assouplir le test : ouvrir le PDF, établir si la lecture est fausse (corriger le prompt, Task 4) ou si le document publie des agrégats qui ne s'additionnent pas (retirer la fixture du `it.each` avec un commentaire qui cite la page et l'écart). Une égalité fausse dans un document réel est justement ce que la file de relecture doit attraper.

- [ ] **Step 6: Lancer toute la suite scraper**

Run: `cd C:\tmp\wt-banques\scraper; npm test; npm run typecheck`
Expected: tous les tests verts (anciens + agrégats), typecheck vert.

- [ ] **Step 7: Commit et pousser**

```bash
git -C C:\tmp\wt-banques add scraper/tests/fixtures/agregats scraper/tests/agregatsFixtures.test.ts
git -C C:\tmp\wt-banques commit -m "test(banques): réponses Gemini gelées SIBC, SGBC, CBIBF et un scan BOAC"
```

Puis ouvrir la PR 1 (titre « Agrégats bancaires 1/3 : extraction sourcée, contrôles, relecture ») en joignant la sortie de `get_advisors` et le test anonyme.

---

## PR 3 — Reprise réelle de l'historique (procédure, sans code)

À exécuter après la fusion et le déploiement de la PR 1, migration 0245 appliquée.

1. **Lancer la reprise à blanc** sur les 16 banques :
   `cd C:\tmp\wt-banques\scraper; npx tsx src/index.ts agregats:reprise --rapport=output/agregats/reprise-AAAA-MM-JJ.json`
   (`AAAA-MM-JJ` = date du jour). Elle relit tous les documents bancaires de `publications`, n'écrit RIEN en base, et produit `reprise-AAAA-MM-JJ.json` (observations comprises) et `reprise-AAAA-MM-JJ.md` (synthèse). Vérifier ensuite par la donnée qu'aucune ligne n'a été écrite : `select count(*) from indicateur_source where methode = 'gemini-agregats';` doit rendre le même nombre qu'avant.
2. **Présenter le rapport `.md` à l'exploitant** : documents lus / en échec, et pour chaque banque et période : valeurs trouvées, non trouvées, bloquées par un contrôle, contradictions, retenues ; liste « À relire » et périodes sans ligne de comptes. Signaler explicitement les cas attendus : ETIT (agrégats en USD tels que publiés, sans conversion — avenant D1), branches islamiques Coris exclues, scans BOA.
3. **Attendre son accord écrit.** Sans accord, ne rien écrire. S'il demande des corrections (prompt, contrôle), les faire dans une PR distincte puis relancer l'étape 1 : un rapport approuvé correspond à une version de code.
4. **Écrire depuis le rapport approuvé**, sans relire les PDF :
   `cd C:\tmp\wt-banques\scraper; npx tsx src/index.ts agregats:reprise --ecrire --depuis-rapport=output/agregats/reprise-AAAA-MM-JJ.json`
5. **Vérifier par la donnée** : nombre d'observations insérées = nombre du rapport (hors doublons ignorés) ; `select count(*) from indicateur_relecture where statut = 'ouverte'` = nombre « À relire » du rapport ; deux ou trois valeurs retenues recoupées à la main contre leur PDF (page citée dans `sources_specifiques`). Puis traiter la file dans `/admin/agregats`.
