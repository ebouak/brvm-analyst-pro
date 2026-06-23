# Outil Saisonnalité — Design

**Date :** 2026-06-23
**Statut :** Validé (brainstorming) → prêt pour writing-plans

## 1. Objectif

Ajouter à WESTBOURSE un outil de **saisonnalité** : pour une action BRVM, une
**matrice de performance mensuelle** sur plusieurs années (rendement moyen par
mois, médiane, volatilité, fréquence de hausse, nombre d'observations), avec
meilleur/pire mois et biais du mois en cours. Inspiré du concurrent brvmetrics,
mais plus rigoureux statistiquement et honnête sur la fiabilité des données.

Source : `brvm_actions_daily` (historique déjà en base, de 1998 à aujourd'hui
selon les titres — variable par date d'introduction).

## 2. Décisions (brainstorming)

| Sujet | Décision |
|---|---|
| Placement | **Les deux** : page dédiée `/saisonnalite` + encart résumé sur la fiche `/actions/[code]` |
| Robustesse statistique | Toujours afficher la matrice, avec **N (observations)** par mois + avertissement si historique court |
| Métriques | Set concurrent **+ médiane + volatilité** (enrichi) |
| Fenêtre | **10 ans glissants** par défaut, **sélecteur interactif [5 / 10 / 15 ans]** (recalcul client-side, 0 infra) |
| Architecture | **Approche A hybride** (calcul à la volée + fonctions pures testées + `React.cache`), plafond fetch 15 ans |

## 3. Architecture

### 3.1 Cœur métier — fonctions pures (testables, `lib/seasonality/`)

Tout le comportement métier réside ici. Aucune I/O. Testé sous vitest.

```ts
// compute.ts

export interface DailyClose { date: string; close: number } // date ISO, close > 0

export interface MonthlyReturn { year: number; month: number; ret: number } // ret = rendement MoM

export interface MonthStats {
  month: number;             // 1-12
  avgReturn: number;         // moyenne des rendements MoM pour ce mois calendaire
  medianReturn: number;      // médiane
  volatility: number | null; // écart-type ; NULL si n < 3 (non significatif)
  bullPct: number;           // % de mois en hausse (ret > 0)
  n: number;                 // nb d'observations (années) pour ce mois
  reliability: 'high' | 'medium' | 'low'; // n>=10 / 5-9 / <5
}

export interface SeasonalityResult {
  matrix: MonthStats[];                 // 12 entrées (mois 1..12), n peut être 0
  bestMonth: number | null;             // mois au meilleur avgReturn (n>=1)
  worstMonth: number | null;            // mois au pire avgReturn
  currentMonthBias: MonthStats | null;  // stats du mois calendaire courant
  dataQuality: 'robust' | 'limited' | 'insufficient'; // >=10 ans / 5-9 / <5
  yearsCovered: number;                 // nb d'années distinctes effectivement utilisées
}

/**
 * Daily closes → rendements mensuels (month-over-month).
 * Rendement du mois M = (dernier close de M / dernier close de M-1) - 1.
 * Un mois SANS séance (titre suspendu, gap) est OMIS : il ne produit pas
 * d'observation et ne sert pas de référence M-1 pour le mois suivant
 * (on chaîne sur le dernier mois réellement coté). Jamais de rendement 0 fictif.
 */
export function monthlyReturnsFromPrices(prices: DailyClose[]): MonthlyReturn[];

/**
 * Agrège les rendements mensuels par mois calendaire sur une fenêtre glissante.
 * windowYears : ne garde que les `windowYears` dernières années civiles.
 * Recalculable côté client à chaque changement de fenêtre (entrée compacte).
 */
export function aggregateSeasonality(
  returns: MonthlyReturn[],
  windowYears: number,        // 5 | 10 | 15
  now?: Date,                 // injectable pour les tests
): SeasonalityResult;
```

**Règles statistiques :**
- `volatility = null` si `n < 3` (l'écart-type sur 2 points n'a pas de sens).
- `reliability` : `high` (n≥10), `medium` (5-9), `low` (<5).
- `dataQuality` (global) dérivé de `yearsCovered` : `robust` (≥10), `limited`
  (5-9), `insufficient` (<5) → conditionne le bandeau d'avertissement global.
- `bestMonth`/`worstMonth` ignorent les mois `n=0`.

### 3.2 Couche serveur — `lib/seasonality/server.ts`

```ts
import { cache } from 'react';

/**
 * Récupère l'historique d'un titre et renvoie la SÉRIE MENSUELLE compacte
 * (≈180 points sur 15 ans), pas les ~4000 prix bruts. Plafonné à 15 ans pour
 * borner la bande passante (4 pages .range() max). Mémoïsé par rendu (React.cache)
 * → l'encart fiche et la page partagent le calcul dans un même cycle de rendu.
 */
export const getMonthlyReturns = cache(async (code: string): Promise<MonthlyReturn[]> => { ... });
```

- Pagination via `.range()` (plafond PostgREST 1000) — réutilise le helper de
  `/secteurs`. Borne : `date_marche >= aujourd'hui - 15 ans`.
- Renvoie `monthlyReturnsFromPrices(closes)`.

### 3.3 UI

**Page `/saisonnalite`** (route `app/saisonnalite/page.tsx`, ISR `revalidate`) :
- `searchParams.code` (défaut : un titre liquide, ex. PALC). Sélecteur de titre
  (liste `brvm_instruments` type action).
- Server : `getMonthlyReturns(code)` → passe la série au composant client.
- `components/seasonality/SeasonalityMatrix.tsx` (client) :
  - Sélecteur de fenêtre **[5 / 10 / 15 ans]** → appelle `aggregateSeasonality`
    en local (pas de refetch).
  - Matrice 12 cellules : couleur de fond = `avgReturn` (vert/rouge), affiche
    `avgReturn`, `bullPct`, `n`. **Badge orange si reliability=low (n<5)** ;
    **rouge + colonne/valeur volatilité masquée si n<3**.
  - Sous la matrice : table mensuelle (mois, moy, médiane, vol, hausse %, N),
    encarts meilleur/pire mois, biais du mois en cours.
  - Bandeau global selon `dataQuality` (`insufficient` → « fenêtre courte, à
    interpréter avec prudence »).

**Encart fiche** (`app/actions/[code]/page.tsx`) :
- `components/seasonality/SeasonalityCard.tsx` : biais du mois en cours +
  meilleur/pire mois (fenêtre 10 ans) + lien « Saisonnalité complète → »
  vers `/saisonnalite?code=`. Même `getMonthlyReturns` (dédup `React.cache`).

## 4. Edge cases

- **Gaps de cotation** (titre suspendu, ex. SIVC 2016-2018) : mois sans séance
  omis (pas de rendement 0). Un mois calendaire peut donc avoir moins
  d'observations que d'années couvertes.
- **Volatilité non significative** : `null` si n<3 (masquée en UI).
- **Historique court** (ORAC, 4 ans) : matrice affichée, `dataQuality=insufficient`,
  badges de fiabilité par mois, bandeau d'avertissement.
- **Aucune donnée** : message « Historique indisponible pour ce titre ».

## 5. Tests (vitest)

`lib/seasonality/compute.test.ts` :
- `monthlyReturnsFromPrices` : rendement MoM correct ; gap d'un mois → chaînage
  sur le dernier mois coté ; close manquant ignoré.
- `aggregateSeasonality` : moyenne/médiane/bullPct corrects ; `volatility=null`
  quand n<3 ; fenêtre glissante (exclut les années hors fenêtre) ;
  `reliability`/`dataQuality` aux seuils ; `bestMonth`/`worstMonth` ignorent n=0 ;
  `now` injecté pour `currentMonthBias`.

## 6. Phase 2 (déclencheur, NON codé maintenant)

**Quand** : ajout d'un **comparateur multi-titres** (comparer PALC vs SGBC) OU
charge **>100 req/jour** OU bande passante problématique.

**Quoi** : migrer `getMonthlyReturns` vers une **RPC Postgres `get_seasonality(code, years)`**
(agrégation côté DB → contourne structurellement le plafond PostgREST, 1 appel).
La fonction TypeScript `aggregateSeasonality` **reste la référence de test** : on
valide la sortie SQL contre elle. La testabilité unitaire n'est pas perdue.

## 7. Hors périmètre (YAGNI)

- Comparateur multi-titres (Phase 2).
- Saisonnalité intra-mois / par jour de semaine.
- Export PDF/PNG dédié (la page reste imprimable via le pattern existant).
