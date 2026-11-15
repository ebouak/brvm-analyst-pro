# BRVM Moving-Average System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a descriptive moving-average trend reading and separate sector-breadth context to the BRVM equity fiche without changing the existing score, signal, or A–F rating.

**Architecture:** Add a pure frontend analysis module that reuses the established SMA convention, a server-only paginated loader for same-sector breadth as of the selected market session, and a focused fiche component. Keep data loading and calculations outside the presentation component; errors in the sector loader remain explicit.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Supabase public client, Vitest, existing `frontend/lib/indicators.ts`.

## Global Constraints

- “Unité de temps : séances BRVM. Les fenêtres SMA20, SMA50 et SMA200 comptent des clôtures de séances, jamais des jours calendaires.”
- “Pas de note agrégée ni de seuil optimisé à la main.”
- “Croisements comme événements descriptifs.”
- “Contexte sectoriel séparé.”
- “Données manquantes visibles.”
- “Les lectures incomplètes ou en erreur doivent échouer explicitement.”
- “Le module ne modifie ni `signals_daily`, ni `computeScore`, ni les seuils, ni le barème `scoreToRating`. Aucune migration n'est requise.”
- “Les fenêtres sont en séances, car les jours sans cotation ne sont pas des observations.”
- “Le score, le signal et la note A–F restent inchangés.”
- “Une éventuelle utilisation future dans le score ou pour des alertes exigera un rejeu hors échantillon par secteur et aux horizons 5/20/60 séances, cas indépendants et intervalles de confiance, avant toute modification des pondérations.”

---

## File map

- `frontend/lib/movingAverages.ts` — pure calculations for one instrument and sector breadth; no I/O.
- `frontend/lib/movingAverages.test.ts` — deterministic tests for windows, gaps, trend states, crossovers, and breadth.
- `frontend/lib/movingAverages/server.ts` — bounded, paginated Supabase read of same-sector prices as of a market date; derives peers from the curated `brvmSectors.json` map and propagates query errors.
- `frontend/lib/movingAverages/server.test.ts` — loader tests with injected/fake query behavior where repository patterns permit.
- `frontend/components/fiche/MoyennesMobiles.tsx` — presentation of the current security's moving averages, stale-data context, crossover fact, sector breadth, and disclaimer.
- `frontend/lib/fiche/moyennesMobiles.test.ts` — rendered-state regression tests for partial history, stale closes, and sector breadth availability.
- `frontend/components/fiche/LectureTechnique.tsx` — place the new component within the existing technical reading, keeping its current layout and score explanation.
- `frontend/app/actions/[code]/page.tsx` — pass dated closes and sector/as-of context to the pure calculation and component.

No scraper, database migration, `signals_daily` schema, `computeScore`, or rating mapping changes are planned.

## Task 1: Pure moving-average analysis

**Files:**
- Create: `frontend/lib/movingAverages.ts`
- Create: `frontend/lib/movingAverages.test.ts`
- Read: `frontend/lib/indicators.ts`

**Interfaces:**
- Consumes:
  ```ts
  export interface DatedClose {
    code: string;
    date: string;
    close: number | null;
  }
  ```
- Produces:
  ```ts
  export type MovingAverageRegime = 'haussier' | 'baissier' | 'mixte' | 'incomplet';
  export type MovingAverageCrossover = 'haussier' | 'baissier' | null;

  export interface MovingAverageReading {
    date: string | null;
    close: number | null;
    observations: number;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    distance20Pct: number | null;
    distance50Pct: number | null;
    distance200Pct: number | null;
    slope20Pct: number | null;
    slope50Pct: number | null;
    slope200Pct: number | null;
    regime: MovingAverageRegime;
    crossover: MovingAverageCrossover;
  }

  export interface SectorBreadthReading {
    sma50Above: { above: number; total: number; percent: number | null };
    sma200Above: { above: number; total: number; percent: number | null };
  }

  export function analyzeMovingAverages(points: DatedClose[]): MovingAverageReading;
  export function calculateSectorBreadth(series: DatedClose[][], asOfDate: string): SectorBreadthReading;
  ```
- Sort input by date ascending before analysis. Discard null, non-finite, and non-positive closes; only observations at or before the latest/as-of market date count. The caller must pass already bounded data.
- For each SMA, use the last `n` valid session closes. Calculate current distance as `(close / sma - 1) * 100`; calculate five-session slope as `(currentSma / smaFiveValidObservationsEarlier - 1) * 100`.
- Emit full bullish/bearish structure only with all three MAs; with SMA20 and SMA50 but no SMA200, classify those relations and label the result as short/intermediate-term only. With SMA20 alone, keep the regime `incomplet` and show only the course's position to SMA20. With fewer than 20 valid closes, return `incomplet`.
- Detect 20/50 crossovers only when both current and immediately previous session SMA20/SMA50 values are available and the ordering changes. Do not infer a crossover from a gap.
- Sector breadth counts only members whose most recent valid close is on `asOfDate`; among them, count closes strictly above their SMA50/SMA200. Members without a valid SMA are omitted from that average's denominator. Percent is `null` when fewer than three members qualify.

**Execution precondition:** the current checkout is 88 commits behind `origin/main` and has unrelated dirty/untracked files. Before implementation, create a clean isolated worktree from `origin/main` with the `using-git-worktrees` skill, then bring only the design specification commit into that worktree. Do not carry or clean unrelated files.

- [ ] **Step 1: Add failing pure-function tests** for exactly 19/20/50/200 observations, invalid closes, chronological ordering, distance and five-session slope.

```ts
import { describe, expect, it } from 'vitest';
import { analyzeMovingAverages, calculateSectorBreadth } from './movingAverages';

const series = (length: number, closeAt: (i: number) => number) =>
  Array.from({ length }, (_, i) => ({
    code: 'TEST',
    date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    close: closeAt(i),
  }));

describe('analyzeMovingAverages', () => {
  it('does not emit SMA20 before 20 valid BRVM closes', () => {
    expect(analyzeMovingAverages(series(19, (i) => 100 + i)).sma20).toBeNull();
    expect(analyzeMovingAverages(series(20, () => 100)).sma20).toBe(100);
  });

  it('reports the close distance and five-observation slope', () => {
    const reading = analyzeMovingAverages(series(25, (i) => 100 + i));
    expect(reading.distance20Pct).not.toBeNull();
    expect(reading.slope20Pct).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the targeted test and verify it fails because the module is absent.**

Run from `frontend`: `npm test -- lib/movingAverages.test.ts`

Expected: FAIL with unresolved import `./movingAverages`.

- [ ] **Step 3: Implement only the pure interfaces and calculations above.**

Keep dates as ISO `YYYY-MM-DD`; do not convert session windows into calendar durations. Use local helper functions for SMA and safe percentages only if they avoid duplicating existing `smaSeries` behavior; import `smaSeries` from `./indicators` to retain the application's established implementation.

- [ ] **Step 4: Add failing tests for regimes, crossovers, invalid inputs, and sector breadth.**

```ts
it('distinguishes full bullish, bearish, mixed, and incomplete structures', () => {
  expect(analyzeMovingAverages(series(220, (i) => 50 + i)).regime).toBe('haussier');
  expect(analyzeMovingAverages(series(220, (i) => 300 - i)).regime).toBe('baissier');
  expect(analyzeMovingAverages(series(20, () => 100)).regime).toBe('incomplet');
});

it('does not include a member without enough observations in breadth', () => {
  const result = calculateSectorBreadth([
    series(200, (i) => 100 + i),
    series(200, () => 100),
    series(20, () => 100),
  ], series(200, () => 100)[199]!.date);
  expect(result.sma200Above.total).toBe(2);
});
```

- [ ] **Step 5: Add a sector-breadth test proving stale peers are excluded from the as-of date.**

Use two 200-point series ending on `asOfDate` and a third series ending one day earlier; assert the third contributes to neither the above count nor the denominator for that session.

- [ ] **Step 6: Run `npm test -- lib/movingAverages.test.ts` and make all cases pass.**

- [ ] **Step 7: Commit the pure module and its tests.**

```powershell
git add -- frontend/lib/movingAverages.ts frontend/lib/movingAverages.test.ts
git commit -m "feat(technicals): analyze BRVM moving averages"
```

## Task 2: Sector-breadth loader

**Files:**
- Create: `frontend/lib/movingAverages/server.ts`
- Create: `frontend/lib/movingAverages/server.test.ts`
- Read: `frontend/lib/supabase/public.ts`
- Read: `frontend/lib/brvmSectors.json`

**Interfaces:**
- Consumes `sector: string | null` and `asOfDate: string`, where `asOfDate` is the latest market session already selected by the fiche.
- Produces:
  ```ts
  export interface SectorBreadthResult {
    status: 'available' | 'insufficient';
    reading: SectorBreadthReading | null;
  }
  export async function loadSectorBreadth(
    sector: string | null,
    asOfDate: string,
  ): Promise<SectorBreadthResult>;
  ```
- A null/unknown sector or successful read with fewer than three members having the applicable average yields `insufficient`. A database/query error throws an `Error` with the table/operation in its message; it must not be converted to `insufficient`.
- Use `brvm_instruments` to resolve same-sector codes, then read `brvm_actions_daily` rows no later than `asOfDate` and no earlier than 400 calendar days before it. Paginate every PostgREST request with `.range(offset, offset + pageSize - 1)` until a short page is returned. Compute per-title MAs with Task 1 and pass the results to `calculateSectorBreadth`, which excludes members whose latest valid close is stale relative to `asOfDate`.

- [ ] **Step 1: Add loader tests** for unknown sector, insufficient peers, successful breadth, multiple pages, and query failure.

Use an internal `paginateSectorRows(readPage, pageSize)` helper with this contract:

```ts
export async function paginateSectorRows(
  readPage: (offset: number, pageSize: number) => Promise<DatedClose[]>,
  pageSize = 1000,
): Promise<DatedClose[]>;
```

`readPage` must throw on a PostgREST error. The helper appends each page and stops only when a page has fewer than `pageSize` rows. Test a fake reader returning 1000 rows and then a short final page; assert exact ordered row count and offsets. Test a thrown reader error and assert the helper rejects. Mock `createPublicClient` for the public loader's sector resolution and verify null sector does not issue the daily-row query.

- [ ] **Step 2: Run `npm test -- lib/movingAverages/server.test.ts` and verify the missing implementation fails.**

- [ ] **Step 3: Implement the bounded sector code and market-row reads.**

All rows must be filtered to `date_marche <= asOfDate`; enforce the 400-calendar-day lower bound from `asOfDate` and use code/date ordering for stable pagination. Query errors are thrown, including failure to resolve the peer instruments. Do not use a partial sector result after a page error.

- [ ] **Step 4: Run loader and pure-module tests.**

Run from `frontend`: `npm test -- lib/movingAverages.test.ts lib/movingAverages/server.test.ts`

Expected: PASS; verify the test fixture with more than one page counts all rows exactly once.

- [ ] **Step 5: Commit loader and tests.**

```powershell
git add -- frontend/lib/movingAverages/server.ts frontend/lib/movingAverages/server.test.ts
git commit -m "feat(technicals): load BRVM sector moving-average breadth"
```

## Task 3: Fiche presentation

**Files:**
- Create: `frontend/components/fiche/MoyennesMobiles.tsx`
- Modify: `frontend/components/fiche/LectureTechnique.tsx`
- Modify: `frontend/app/actions/[code]/page.tsx`
- Read: `frontend/lib/indicators.ts`
- Read: `frontend/lib/movingAverages.ts`
- Read: `frontend/lib/movingAverages/server.ts`

**Interfaces:**
- `MoyennesMobiles` receives:
  ```ts
  interface MoyennesMobilesProps {
    reading: MovingAverageReading;
    breadth: SectorBreadthResult;
    secteur: string | null;
    dateDernierCours: string | null;
    dateSeance: string;
    seancesSansCotation: number | null;
  }
  ```
- The page takes the title's sector from `brvmSectors.json`, computes `reading` from its existing dated close rows, and calls `loadSectorBreadth(secteur, reading.date ?? dateSeanceAnalyse)`. The older `brvm_instruments.secteur` value is not authoritative. It reports a no-quote session count only when the loaded rows cover the reference session.
- `LectureTechnique` accepts one optional `moyennesMobiles: ReactNode` and renders it after the existing indicators/graphs, without changing the score band or summary.

- [ ] **Step 1: Add a component test or existing page-level assertion** for: all averages available, SMA200 unavailable, crossover absent, sector breadth available, and sector breadth insufficient.

Use `renderToStaticMarkup(createElement(...))` from the already installed React packages so the test needs no DOM or added dependency:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MoyennesMobiles } from '@/components/fiche/MoyennesMobiles';

it('shows unavailable long-term and sector context without inventing values', () => {
  const html = renderToStaticMarkup(createElement(MoyennesMobiles, {
    reading: {
      date: '2026-11-13', close: 100, observations: 50,
      sma20: 98, sma50: 95, sma200: null,
      distance20Pct: 2.04, distance50Pct: 5.26, distance200Pct: null,
      slope20Pct: 1.2, slope50Pct: 0.8, slope200Pct: null,
      regime: 'haussier', regimeHorizon: 'court_moyen', crossover: null,
    },
    breadth: { status: 'insufficient', reading: null },
    secteur: 'Industrie', dateDernierCours: '2026-11-13', dateSeance: '2026-11-13',
    seancesSansCotation: 0,
  }));
  expect(html).toContain('SMA200');
  expect(html).toContain('données sectorielles insuffisantes');
  expect(html).toContain('Indicateurs descriptifs, non prédictifs');
});
```

Add a second fixture with `breadth.status = 'available'` and assert both percentages and numerators/denominators are rendered. Do not assert Tailwind class implementation details.

- [ ] **Step 2: Implement the component with the existing fiche visual tokens.**

Show the session date, latest close, SMA20/50/200 values, distances, slopes, and regime. Format unavailable values as `—` with a nearby explanation. Show the crossover only when present and phrase it as an observed event. For sector breadth, show each count and denominator, percentage when available, and the sector label. Include the disclaimer from the spec verbatim. Do not add BUY/SELL language, a grade, or a recommendation.

- [ ] **Step 3: Wire the page to the existing dated close rows and selected market date.**

Pass sector from the already loaded instrument/last market row. If the server loader throws, let the route's normal error handling surface it; do not silently render an empty/healthy sector. Continue to show the per-title moving-average reading when `secteur` is unknown, with sector breadth marked insufficient.

- [ ] **Step 4: Run focused component and page type checks.**

Run from `frontend`: `npm test -- lib/fiche/moyennesMobiles.test.ts lib/movingAverages.test.ts lib/movingAverages/server.test.ts`

Expected: PASS with all four UI states represented.

- [ ] **Step 5: Commit the fiche integration.**

```powershell
git add -- frontend/components/fiche/MoyennesMobiles.tsx frontend/lib/fiche/moyennesMobiles.test.ts frontend/components/fiche/LectureTechnique.tsx "frontend/app/actions/[code]/page.tsx"
git commit -m "feat(technicals): show BRVM moving-average reading"
```

## Task 4: Regression verification and documentation

**Files:**
- Modify: `docs/SCORING.md`
- Read: `docs/superpowers/specs/2026-11-15-moyennes-mobiles-brvm-design.md`

- [ ] **Step 1: Update `docs/SCORING.md`** to distinguish the standalone SMA20/50/200 fiche reading from the `signals_daily` score, note the 400-calendar-day bound for sector breadth, and state that neither modifies A–F or emits orders.

- [ ] **Step 2: Run the focused tests and typecheck.**

Run from `frontend`:

```powershell
npm test -- lib/movingAverages.test.ts lib/movingAverages/server.test.ts lib/fiche/moyennesMobiles.test.ts
npm run typecheck
```

Expected: both commands exit 0. If the test runner uses a different accepted path selector, use the repository's existing Vitest file-selection convention without changing configuration.

- [ ] **Step 3: Review the final diff.**

Run from the repository root:

```powershell
git diff --check
git diff -- frontend/lib/movingAverages.ts frontend/lib/movingAverages/server.ts frontend/components/fiche/MoyennesMobiles.tsx frontend/components/fiche/LectureTechnique.tsx "frontend/app/actions/[code]/page.tsx" docs/SCORING.md
```

Verify no changes to `scraper/src/scoring/score.ts`, `frontend/lib/rating.ts`, any signal thresholds, or database migrations.

- [ ] **Step 4: Commit documentation.**

```powershell
git add -- docs/SCORING.md
git commit -m "docs(technicals): document moving-average reading"
```

- [ ] **Step 5: Report results.**

Summarize the feature, tests, and whether the sector peer data was available in test fixtures. State explicitly that predictive performance has not been claimed or used to change the score.
