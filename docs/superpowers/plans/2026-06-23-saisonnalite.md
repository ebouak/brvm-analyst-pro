# Outil Saisonnalité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un outil de saisonnalité BRVM (matrice de performance mensuelle pluriannuelle) en page dédiée `/saisonnalite` + encart sur la fiche action.

**Architecture:** Approche A hybride — 2 fonctions PURES testées (`monthlyReturnsFromPrices`, `aggregateSeasonality`) portent toute la logique métier ; une couche serveur `React.cache` récupère l'historique (fetch paginé plafonné 15 ans) et renvoie une série mensuelle compacte ; le composant client recalcule la matrice à chaque changement de fenêtre (5/10/15 ans) sans refetch.

**Tech Stack:** Next.js 14 (App Router, server components + ISR), TypeScript, TailwindCSS, vitest, `@supabase/ssr` (createPublicClient).

**Spec :** `docs/superpowers/specs/2026-06-23-saisonnalite-design.md`

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `frontend/lib/seasonality/compute.ts` | Types + 2 fonctions pures (cœur métier) |
| `frontend/lib/seasonality/compute.test.ts` | Tests vitest des fonctions pures |
| `frontend/lib/seasonality/server.ts` | `getMonthlyReturns(code)` : fetch paginé + React.cache |
| `frontend/components/seasonality/SeasonalityMatrix.tsx` | Matrice + sélecteur fenêtre (client) |
| `frontend/components/seasonality/SeasonalityCard.tsx` | Encart compact fiche (client) |
| `frontend/app/saisonnalite/page.tsx` | Page dédiée + sélecteur de titre |
| `frontend/app/actions/[code]/page.tsx` | Intègre l'encart (modif) |
| `frontend/lib/nav.ts` | Lien « Saisonnalité » (modif) |

Convention : commandes exécutées depuis `frontend/`. Tests : `npx vitest run <fichier>`.

---

## Task 1: Fonction pure `monthlyReturnsFromPrices` + types

**Files:**
- Create: `frontend/lib/seasonality/compute.ts`
- Test: `frontend/lib/seasonality/compute.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// frontend/lib/seasonality/compute.test.ts
import { describe, it, expect } from 'vitest';
import { monthlyReturnsFromPrices } from './compute';

describe('monthlyReturnsFromPrices', () => {
  it('calcule le rendement mois-sur-mois (dernier close du mois)', () => {
    const prices = [
      { date: '2025-01-10', close: 100 },
      { date: '2025-01-31', close: 110 }, // dernier close janvier
      { date: '2025-02-15', close: 120 },
      { date: '2025-02-28', close: 121 }, // dernier close février
    ];
    const r = monthlyReturnsFromPrices(prices);
    // février : 121/110 - 1 = 0.1 ; janvier n'a pas de mois précédent → omis
    expect(r).toEqual([{ year: 2025, month: 2, ret: 121 / 110 - 1 }]);
  });

  it('omet un mois sans séance (gap) et chaîne sur le dernier mois coté', () => {
    const prices = [
      { date: '2025-01-31', close: 100 },
      // pas de février (titre suspendu)
      { date: '2025-03-31', close: 120 },
    ];
    const r = monthlyReturnsFromPrices(prices);
    // mars chaîne sur janvier (dernier mois coté) : 120/100 - 1 = 0.2
    expect(r).toEqual([{ year: 2025, month: 3, ret: 0.2 }]);
  });

  it('renvoie [] si moins de 2 mois cotés', () => {
    expect(monthlyReturnsFromPrices([{ date: '2025-01-31', close: 100 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run lib/seasonality/compute.test.ts`
Expected: FAIL — `monthlyReturnsFromPrices is not a function` (module absent).

- [ ] **Step 3: Implémenter**

```ts
// frontend/lib/seasonality/compute.ts

export interface DailyClose { date: string; close: number }
export interface MonthlyReturn { year: number; month: number; ret: number }

/**
 * Daily closes → rendements mensuels (month-over-month).
 * ret(M) = dernier close de M / dernier close du mois coté PRÉCÉDENT - 1.
 * Un mois sans séance est omis (pas de rendement 0 fictif) ; on chaîne sur le
 * dernier mois réellement coté.
 */
export function monthlyReturnsFromPrices(prices: DailyClose[]): MonthlyReturn[] {
  // Dernier close par mois (clé YYYY-MM), en respectant l'ordre chronologique.
  const sorted = [...prices]
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastByMonth = new Map<string, { year: number; month: number; close: number }>();
  for (const p of sorted) {
    const year = Number(p.date.slice(0, 4));
    const month = Number(p.date.slice(5, 7));
    lastByMonth.set(`${p.date.slice(0, 7)}`, { year, month, close: p.close });
  }
  const months = [...lastByMonth.values()]; // déjà ordonnés (Map garde l'ordre d'insertion chronologique)

  const out: MonthlyReturn[] = [];
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1]!;
    const cur = months[i]!;
    out.push({ year: cur.year, month: cur.month, ret: cur.close / prev.close - 1 });
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run lib/seasonality/compute.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/seasonality/compute.ts frontend/lib/seasonality/compute.test.ts
git commit -m "feat(saisonnalite): monthlyReturnsFromPrices (rendements MoM, gaps gérés)"
```

---

## Task 2: Fonction pure `aggregateSeasonality`

**Files:**
- Modify: `frontend/lib/seasonality/compute.ts` (ajout types + fonction)
- Modify: `frontend/lib/seasonality/compute.test.ts` (ajout tests)

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// Ajouter en haut du fichier de test :
import { aggregateSeasonality, type MonthlyReturn } from './compute';

describe('aggregateSeasonality', () => {
  // 6 années, mois 1 = [+10%, -10%, +20%, 0%, +5%, -5%] ; autres mois vides
  const returns: MonthlyReturn[] = [
    { year: 2020, month: 1, ret: 0.10 },
    { year: 2021, month: 1, ret: -0.10 },
    { year: 2022, month: 1, ret: 0.20 },
    { year: 2023, month: 1, ret: 0.0 },
    { year: 2024, month: 1, ret: 0.05 },
    { year: 2025, month: 1, ret: -0.05 },
  ];
  const now = new Date('2025-01-15T00:00:00Z');

  it('agrège moyenne, bullPct et n pour un mois', () => {
    const r = aggregateSeasonality(returns, 10, now);
    const jan = r.matrix.find((m) => m.month === 1)!;
    expect(jan.n).toBe(6);
    expect(jan.avgReturn).toBeCloseTo((0.10 - 0.10 + 0.20 + 0 + 0.05 - 0.05) / 6);
    expect(jan.bullPct).toBeCloseTo((3 / 6) * 100); // 3 mois > 0 sur 6
    expect(jan.reliability).toBe('medium'); // 5-9
  });

  it('volatility = null quand n < 3', () => {
    const r = aggregateSeasonality(
      [{ year: 2024, month: 3, ret: 0.1 }, { year: 2025, month: 3, ret: 0.2 }],
      10, now,
    );
    expect(r.matrix.find((m) => m.month === 3)!.volatility).toBeNull();
  });

  it('fenêtre glissante : exclut les années hors fenêtre', () => {
    const r = aggregateSeasonality(returns, 5, now); // garde 2021-2025 → 5 obs
    expect(r.matrix.find((m) => m.month === 1)!.n).toBe(5);
  });

  it('dataQuality et currentMonthBias', () => {
    const r = aggregateSeasonality(returns, 10, now);
    expect(r.dataQuality).toBe('limited'); // 6 années couvertes (5-9)
    expect(r.currentMonthBias?.month).toBe(1); // now = janvier
  });

  it('bestMonth/worstMonth ignorent les mois n=0', () => {
    const r = aggregateSeasonality(returns, 10, now);
    expect(r.bestMonth).toBe(1);
    expect(r.worstMonth).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `npx vitest run lib/seasonality/compute.test.ts`
Expected: FAIL — `aggregateSeasonality is not a function`.

- [ ] **Step 3: Implémenter (ajouter à `compute.ts`)**

```ts
export interface MonthStats {
  month: number;
  avgReturn: number;
  medianReturn: number;
  volatility: number | null;
  bullPct: number;
  n: number;
  reliability: 'high' | 'medium' | 'low';
}
export interface SeasonalityResult {
  matrix: MonthStats[];
  bestMonth: number | null;
  worstMonth: number | null;
  currentMonthBias: MonthStats | null;
  dataQuality: 'robust' | 'limited' | 'insufficient';
  yearsCovered: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function stddev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
function reliabilityOf(n: number): MonthStats['reliability'] {
  return n >= 10 ? 'high' : n >= 5 ? 'medium' : 'low';
}

export function aggregateSeasonality(
  returns: MonthlyReturn[],
  windowYears: number,
  now: Date = new Date(),
): SeasonalityResult {
  const currentYear = now.getUTCFullYear();
  const minYear = currentYear - windowYears + 1;
  const windowed = returns.filter((r) => r.year >= minYear && r.year <= currentYear);

  const byMonth = new Map<number, number[]>();
  for (const r of windowed) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month)!.push(r.ret);
  }

  const matrix: MonthStats[] = [];
  for (let month = 1; month <= 12; month++) {
    const xs = byMonth.get(month) ?? [];
    const n = xs.length;
    matrix.push({
      month,
      avgReturn: n ? xs.reduce((a, b) => a + b, 0) / n : 0,
      medianReturn: n ? median(xs) : 0,
      volatility: n >= 3 ? stddev(xs) : null,
      bullPct: n ? (xs.filter((x) => x > 0).length / n) * 100 : 0,
      n,
      reliability: reliabilityOf(n),
    });
  }

  const withData = matrix.filter((m) => m.n > 0);
  const bestMonth = withData.length
    ? withData.reduce((a, b) => (b.avgReturn > a.avgReturn ? b : a)).month : null;
  const worstMonth = withData.length
    ? withData.reduce((a, b) => (b.avgReturn < a.avgReturn ? b : a)).month : null;

  const yearsCovered = new Set(windowed.map((r) => r.year)).size;
  const dataQuality = yearsCovered >= 10 ? 'robust' : yearsCovered >= 5 ? 'limited' : 'insufficient';
  const currentMonth = now.getUTCMonth() + 1;
  const currentMonthBias = matrix.find((m) => m.month === currentMonth) ?? null;

  return { matrix, bestMonth, worstMonth, currentMonthBias, dataQuality, yearsCovered };
}
```

- [ ] **Step 4: Lancer (succès attendu)**

Run: `npx vitest run lib/seasonality/compute.test.ts`
Expected: PASS (8 tests au total).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/seasonality/compute.ts frontend/lib/seasonality/compute.test.ts
git commit -m "feat(saisonnalite): aggregateSeasonality (matrice, médiane, vol null si N<3, fenêtre)"
```

---

## Task 3: Couche serveur `getMonthlyReturns`

**Files:**
- Create: `frontend/lib/seasonality/server.ts`

- [ ] **Step 1: Implémenter** (pas de test unitaire : I/O ; vérifié au build + manuellement)

```ts
// frontend/lib/seasonality/server.ts
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { monthlyReturnsFromPrices, type MonthlyReturn, type DailyClose } from './compute';

const WINDOW_YEARS_MAX = 15; // plafond fetch (borne la bande passante)
const PAGE = 1000;

/**
 * Série mensuelle compacte (≈180 points) d'un titre, sur 15 ans max.
 * Mémoïsée par rendu (React.cache) → encart fiche + page partagent le calcul.
 */
export const getMonthlyReturns = cache(async (code: string): Promise<MonthlyReturn[]> => {
  const sb = createPublicClient();
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - WINDOW_YEARS_MAX);
  const fromDate = since.toISOString().slice(0, 10);

  const closes: DailyClose[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code.toUpperCase())
      .gte('date_marche', fromDate)
      .not('cours_jour', 'is', null)
      .order('date_marche', { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as Array<{ date_marche: string; cours_jour: number }>;
    for (const r of batch) closes.push({ date: r.date_marche, close: r.cours_jour });
    if (batch.length < PAGE) break;
  }
  return monthlyReturnsFromPrices(closes);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/seasonality/server.ts
git commit -m "feat(saisonnalite): getMonthlyReturns (fetch paginé 15 ans + React.cache)"
```

---

## Task 4: Composant `SeasonalityMatrix` (client)

**Files:**
- Create: `frontend/components/seasonality/SeasonalityMatrix.tsx`

- [ ] **Step 1: Implémenter**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { aggregateSeasonality, type MonthlyReturn } from '@/lib/seasonality/compute';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const WINDOWS = [5, 10, 15] as const;
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export default function SeasonalityMatrix({ returns }: { returns: MonthlyReturn[] }) {
  const [windowYears, setWindowYears] = useState<number>(10);
  const r = useMemo(() => aggregateSeasonality(returns, windowYears), [returns, windowYears]);

  if (returns.length === 0) {
    return <p className="text-sm text-muted">Historique indisponible pour ce titre.</p>;
  }

  const cellBg = (avg: number, n: number) =>
    n === 0 ? 'bg-surface' : avg > 0 ? 'bg-up/10 border-up/30' : avg < 0 ? 'bg-down/10 border-down/30' : 'bg-surface';

  return (
    <div className="space-y-4">
      {/* Sélecteur de fenêtre */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-faint">Fenêtre :</span>
        {WINDOWS.map((w) => (
          <button key={w} type="button" onClick={() => setWindowYears(w)}
            className={`text-xs px-2.5 py-1 rounded-md border ${windowYears === w ? 'border-info text-info bg-info/10' : 'border-border text-muted'}`}>
            {w} ans
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">{r.yearsCovered} an(s) de données</span>
      </div>

      {/* Bandeau qualité */}
      {r.dataQuality !== 'robust' && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${r.dataQuality === 'insufficient' ? 'border-down/30 bg-down/5 text-down' : 'border-warn/30 bg-warn/5 text-warn'}`}>
          {r.dataQuality === 'insufficient'
            ? 'Historique court (< 5 ans) : saisonnalité peu fiable, à interpréter avec prudence.'
            : 'Fenêtre limitée (5-9 ans) : tendances indicatives.'}
        </div>
      )}

      {/* Matrice 12 mois */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {r.matrix.map((m) => (
          <div key={m.month} className={`rounded-lg border p-2.5 ${cellBg(m.avgReturn, m.n)}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">{MONTHS[m.month - 1]}</span>
              {m.reliability === 'low' && m.n > 0 && (
                <span className={`text-[8px] px-1 rounded ${m.n < 3 ? 'bg-down/20 text-down' : 'bg-warn/20 text-warn'}`}>N={m.n}</span>
              )}
            </div>
            {m.n === 0 ? (
              <p className="mt-1 text-[10px] text-faint">aucune donnée</p>
            ) : (
              <>
                <p className={`mt-1 tabular text-sm font-bold ${m.avgReturn >= 0 ? 'text-up' : 'text-down'}`}>{pct(m.avgReturn)}</p>
                <p className="text-[10px] text-faint">hausse {m.bullPct.toFixed(0)}% · N={m.n}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Extrêmes + biais */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-up/30 bg-up/5 p-2">
          <p className="text-faint">Meilleur mois</p>
          <p className="font-semibold text-up">{r.bestMonth ? MONTHS[r.bestMonth - 1] : '—'}</p>
        </div>
        <div className="rounded-lg border border-down/30 bg-down/5 p-2">
          <p className="text-faint">Pire mois</p>
          <p className="font-semibold text-down">{r.worstMonth ? MONTHS[r.worstMonth - 1] : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-2">
          <p className="text-faint">Biais mois en cours</p>
          <p className="font-semibold text-white">
            {r.currentMonthBias && r.currentMonthBias.n > 0
              ? `${MONTHS[r.currentMonthBias.month - 1]} ${pct(r.currentMonthBias.avgReturn)}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Table détaillée (médiane + volatilité) */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Mois</th>
              <th className="px-3 py-2 text-right">Moy.</th>
              <th className="px-3 py-2 text-right">Médiane</th>
              <th className="px-3 py-2 text-right">Volatilité</th>
              <th className="px-3 py-2 text-right">Hausse %</th>
              <th className="px-3 py-2 text-right">N</th>
            </tr>
          </thead>
          <tbody>
            {r.matrix.map((m) => (
              <tr key={m.month} className="border-t border-border/50">
                <td className="px-3 py-1.5 text-white">{MONTHS[m.month - 1]}</td>
                <td className={`px-3 py-1.5 text-right tabular ${m.avgReturn >= 0 ? 'text-up' : 'text-down'}`}>{m.n ? pct(m.avgReturn) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.n ? pct(m.medianReturn) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.volatility != null ? `${(m.volatility * 100).toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.n ? `${m.bullPct.toFixed(0)}%` : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-faint">{m.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/seasonality/SeasonalityMatrix.tsx
git commit -m "feat(saisonnalite): SeasonalityMatrix (sélecteur fenêtre + badges fiabilité)"
```

---

## Task 5: Page dédiée `/saisonnalite`

**Files:**
- Create: `frontend/app/saisonnalite/page.tsx`

- [ ] **Step 1: Implémenter**

```tsx
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { getMonthlyReturns } from '@/lib/seasonality/server';
import SeasonalityMatrix from '@/components/seasonality/SeasonalityMatrix';
import { SectionHeader } from '@/components/ui/premium';

export const revalidate = 3600;
export const metadata = { title: 'Saisonnalité — WESTBOURSE' };

export default async function SaisonnalitePage({ searchParams }: { searchParams?: { code?: string } }) {
  const sb = createPublicClient();
  const { data: instr } = await sb
    .from('brvm_instruments').select('code, designation').eq('type', 'action').order('code');
  const instruments = (instr ?? []) as { code: string; designation: string | null }[];

  const code = (searchParams?.code ?? instruments[0]?.code ?? 'PALC').toUpperCase();
  const returns = await getMonthlyReturns(code).catch(() => []);
  const designation = instruments.find((i) => i.code === code)?.designation ?? code;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Outil · Analyse statistique"
        title="Saisonnalité"
        subtitle="Performance mensuelle moyenne d'une action sur plusieurs années — lecture statistique, à croiser avec tendance, liquidité et dividende."
      />

      {/* Sélecteur de titre (form GET) */}
      <form className="flex items-center gap-2">
        <label className="text-xs text-faint">Titre :</label>
        <select name="code" defaultValue={code}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory"
          // soumission au changement
          // eslint-disable-next-line react/no-unknown-property
          onChange={undefined}>
          {instruments.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.designation ?? ''}</option>)}
        </select>
        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-info/15 text-info">Afficher</button>
      </form>

      <div>
        <h2 className="font-display text-lg text-white">{code} <span className="text-sm text-muted">— {designation}</span></h2>
        <SeasonalityMatrix returns={returns} />
      </div>

      <p className="text-[11px] text-faint">
        Calcul sur l'historique réel des cours (max 15 ans). Lecture statistique uniquement ;
        ne constitue pas un conseil en investissement.
      </p>
      <Link href="/outils" className="text-xs text-info hover:underline">← Outils</Link>
    </div>
  );
}
```

> Note : le `<select onChange>` ne peut pas soumettre dans un server component. La soumission se fait via le bouton « Afficher ». (Une amélioration client-side facultative pourra auto-soumettre, hors périmètre v1.)

- [ ] **Step 2: Retirer le `onChange={undefined}` (inutile en server component)**

Supprimer la ligne `onChange={undefined}` et le commentaire eslint au-dessus — le `<select>` natif dans un `<form>` GET + bouton « Afficher » suffit.

```tsx
        <select name="code" defaultValue={code}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory">
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0 ; route `/saisonnalite` listée (ƒ Dynamic ou ○).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/saisonnalite/page.tsx
git commit -m "feat(saisonnalite): page dédiée /saisonnalite + sélecteur de titre"
```

---

## Task 6: Encart fiche action

**Files:**
- Create: `frontend/components/seasonality/SeasonalityCard.tsx`
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1: Implémenter l'encart**

```tsx
'use client';

import Link from 'next/link';
import { aggregateSeasonality, type MonthlyReturn } from '@/lib/seasonality/compute';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export default function SeasonalityCard({ code, returns }: { code: string; returns: MonthlyReturn[] }) {
  if (returns.length === 0) return null;
  const r = aggregateSeasonality(returns, 10);
  const bias = r.currentMonthBias;

  return (
    <div className="rounded-panel border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em]">Saisonnalité (10 ans)</p>
        <Link href={`/saisonnalite?code=${code}`} className="text-[11px] text-info hover:underline">Complet →</Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-faint">Mois en cours</p>
          <p className="font-semibold text-white">{bias && bias.n > 0 ? `${MONTHS[bias.month - 1]} ${pct(bias.avgReturn)}` : '—'}</p></div>
        <div><p className="text-faint">Meilleur</p>
          <p className="font-semibold text-up">{r.bestMonth ? MONTHS[r.bestMonth - 1] : '—'}</p></div>
        <div><p className="text-faint">Pire</p>
          <p className="font-semibold text-down">{r.worstMonth ? MONTHS[r.worstMonth - 1] : '—'}</p></div>
      </div>
      {r.dataQuality === 'insufficient' && <p className="text-[10px] text-down">Historique court — peu fiable.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Intégrer dans la fiche** (`frontend/app/actions/[code]/page.tsx`)

En haut, après les imports existants (ex. après `import ActionMenu ...`) :

```tsx
import SeasonalityCard from '@/components/seasonality/SeasonalityCard';
import { getMonthlyReturns } from '@/lib/seasonality/server';
```

Dans le corps `async` de la page, à côté des autres `await` (ex. près du chargement des signaux) :

```tsx
  const seasonalityReturns = await getMonthlyReturns(code).catch(() => []);
```

Insérer le rendu juste après la section « MA THÈSE » (chercher `<div id="these"` et placer après son `</div>` de fermeture de section) :

```tsx
      {/* ── SAISONNALITÉ ── */}
      <div id="saisonnalite" className="scroll-mt-24">
        <Eyebrow className="mb-3">Saisonnalité</Eyebrow>
        <SeasonalityCard code={code} returns={seasonalityReturns} />
      </div>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/seasonality/SeasonalityCard.tsx "frontend/app/actions/[code]/page.tsx"
git commit -m "feat(saisonnalite): encart saisonnalité sur la fiche action"
```

---

## Task 7: Lien de navigation + vérif finale

**Files:**
- Modify: `frontend/lib/nav.ts`

- [ ] **Step 1: Ajouter le lien dans le groupe « Découverte »**

Dans `frontend/lib/nav.ts`, groupe `Découverte`, après l'entrée `{ href: '/formations', label: 'Formations' }` :

```ts
      { href: '/saisonnalite', label: 'Saisonnalité' },
```

- [ ] **Step 2: Suite de tests complète + build**

Run: `npx vitest run lib/seasonality/compute.test.ts && npx tsc --noEmit && npm run build`
Expected: 8 tests PASS, tsc exit 0, build exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/nav.ts
git commit -m "feat(saisonnalite): lien nav Saisonnalité (Découverte)"
```

- [ ] **Step 4: Déployer**

```bash
git push origin main
curl -sS -X POST "https://api.vercel.com/v1/integrations/deploy/prj_AbYYHa8M1gvrvr5Ef58DXCLlnfws/nxYAqxhUAQ"
```

- [ ] **Step 5: Vérif manuelle** : ouvrir `/saisonnalite?code=PALC` (titre ancien → matrice robuste) et `/saisonnalite?code=ORAC` (4 ans → bandeau « historique court »), puis la fiche `/actions/PALC` (encart présent).

---

## Self-Review

**Couverture du spec :**
- §3.1 fonctions pures → Tasks 1-2 ✅
- §3.2 serveur React.cache + pagination 15 ans → Task 3 ✅
- §3.3 page + matrice + sélecteur fenêtre → Tasks 4-5 ✅ ; encart fiche → Task 6 ✅
- §4 edge cases (gaps, vol null N<3, dataQuality) → couverts dans compute + tests ✅
- §5 tests vitest → Tasks 1-2 ✅
- §6 Phase 2 → documenté dans le spec (non codé) ✅
- Nav → Task 7 ✅

**Placeholders :** aucun (code complet à chaque step).

**Cohérence des types :** `MonthlyReturn`, `MonthStats`, `SeasonalityResult`, `getMonthlyReturns`, `aggregateSeasonality`, `monthlyReturnsFromPrices` identiques entre tasks. ✅
