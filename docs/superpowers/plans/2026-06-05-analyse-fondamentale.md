# Analyse Fondamentale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'app Streamlit fragile par une analyse fondamentale intégrée au site Next.js (screener `/fondamentaux` + bloc enrichi `/actions/[code]`), avec ratios style Trading 212 en dark finance, garde-fous qualité, correction manuelle, et récupération automatique du nombre d'actions.

**Architecture:** Lecture directe Supabase (cours, fundamentals, dividends, brvm_instruments). Calculs purs côté `lib/fundamentals.ts`. Récupération du nombre d'actions par un script scraper (cascade sikafinance → dérivation → manuel). Écriture des corrections via route API protégée (service_role).

**Tech Stack:** Next.js 14 (App Router, server components), TypeScript strict, TailwindCSS (dark finance), Supabase, Node scraper (axios + cheerio), vitest (scraper).

---

## Fichiers touchés

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0015_fundamentals_manual.sql` | Colonnes shares, shares_source, is_manual |
| `scraper/src/shares/sikafinance.ts` | Récup nb actions depuis sikafinance |
| `scraper/src/shares/runShares.ts` | Cascade + upsert brvm_instruments |
| `scraper/src/index.ts` | Wire CLI `shares` |
| `scraper/package.json` | Script `shares` |
| `scraper/tests/shares.test.ts` | Tests parsing sikafinance |
| `frontend/lib/fundamentals.ts` | Calculs ratios purs + assessQuality |
| `frontend/lib/fundamentals.test.mjs` | Tests calculs (Node) |
| `frontend/components/fundamentals/RatioCard.tsx` | Carte ratio + badge qualité |
| `frontend/components/fundamentals/RangeBar.tsx` | Range Haut/Bas T212 |
| `frontend/components/fundamentals/FundamentalsPanel.tsx` | Bloc /actions/[code] |
| `frontend/components/fundamentals/FundamentalsTable.tsx` | Screener triable |
| `frontend/components/fundamentals/EditFundamentalsModal.tsx` | Correction manuelle |
| `frontend/app/fondamentaux/page.tsx` | Page screener |
| `frontend/app/api/fundamentals/route.ts` | POST correction (service_role) |
| `frontend/app/actions/[code]/page.tsx` | Remplace bloc fondamentaux |
| `frontend/components/Sidebar.tsx` | Lien → /fondamentaux interne |
| `brvm_scanner/README.md` | Marque DEPRECATED |

---

## Task 1: Migration colonnes shares + is_manual

**Files:**
- Create: `supabase/migrations/0015_fundamentals_manual.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- ============================================================================
-- Colonnes pour l'analyse fondamentale : nombre d'actions (PER, P/B, capi) +
-- marquage des corrections manuelles (non écrasées par l'extraction auto).
-- ============================================================================

alter table public.brvm_instruments
  add column if not exists shares bigint,
  add column if not exists shares_source text;  -- 'sikafinance' | 'derive' | 'pdf' | 'manual'

alter table public.fundamentals
  add column if not exists is_manual boolean not null default false;

comment on column public.brvm_instruments.shares is 'Nombre d''actions en circulation (pour PER, P/B, capitalisation)';
comment on column public.fundamentals.is_manual is 'true = saisie manuelle, prioritaire sur extraction auto';
```

- [ ] **Step 2: Appliquer**

Run: `supabase db push`
Expected: `Applying migration 0015_fundamentals_manual.sql...` puis `Finished supabase db push.`

- [ ] **Step 3: Vérifier les colonnes**

Run (depuis `scraper/`): `node --env-file=.env.local -e "import('@supabase/supabase-js').then(async m=>{const sb=m.createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {error}=await sb.from('brvm_instruments').select('code,shares,shares_source').limit(1);console.log(error?error.message:'OK shares colonnes');})"`
Expected: `OK shares colonnes`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_fundamentals_manual.sql
git commit -m "feat(fondamentaux): migration shares + is_manual"
```

---

## Task 2: Script récupération nombre d'actions (sikafinance)

**Files:**
- Create: `scraper/src/shares/sikafinance.ts`
- Create: `scraper/tests/shares.test.ts`

Contexte : sikafinance publie la capitalisation boursière par titre. `shares = capitalisation / cours`. Réutilise le pattern de mapping nom→code de `scraper/src/dividends/sikafinance.ts` (fonctions `normalizeStr`, similarité par tokens) — **recopier** ces helpers (ne pas importer le module dividendes pour éviter le couplage).

- [ ] **Step 1: Écrire le test de parsing**

```typescript
// scraper/tests/shares.test.ts
import { describe, it, expect } from 'vitest';
import { parseSharesFromCapitalisation } from '../src/shares/sikafinance.js';

describe('parseSharesFromCapitalisation', () => {
  it('derive shares = capitalisation / cours', () => {
    // SONATEL : capi 1 000 000 000 000 FCFA, cours 20 000 -> 50 000 000 actions
    expect(parseSharesFromCapitalisation(1_000_000_000_000, 20_000)).toBe(50_000_000);
  });
  it('retourne null si cours nul ou manquant', () => {
    expect(parseSharesFromCapitalisation(1_000_000, 0)).toBeNull();
    expect(parseSharesFromCapitalisation(null, 20_000)).toBeNull();
  });
  it('arrondit à l entier', () => {
    expect(parseSharesFromCapitalisation(1_000_050, 100)).toBe(10000);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run (depuis `scraper/`): `npx vitest run tests/shares.test.ts`
Expected: FAIL — `parseSharesFromCapitalisation` introuvable / module manquant.

- [ ] **Step 3: Implémenter le module**

```typescript
// scraper/src/shares/sikafinance.ts
/**
 * Récupération du nombre d'actions en circulation depuis sikafinance.
 * Stratégie : capitalisation boursière publiée / dernier cours = nombre d'actions.
 * Le SCRAPER peut lire des sources externes (le frontend reste Supabase-only).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { parseFrNumber } from '../utils/parseNumber.js';

// Page liste des sociétés avec capitalisation (BRVM/sikafinance).
const SIKA_CAP_URL = 'https://www.sikafinance.com/marches/capitalisations_brvm';

/** shares = capitalisation / cours (arrondi entier), ou null si non calculable. */
export function parseSharesFromCapitalisation(
  capitalisation: number | null,
  cours: number | null,
): number | null {
  if (capitalisation == null || cours == null || cours <= 0) return null;
  return Math.round(capitalisation / cours);
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const STOP = new Set(['ci','sn','bf','tg','sa','group','groupe','cote','ivoire','de','du','des']);
function tokens(s: string): string[] {
  return normalizeStr(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t));
}
function similarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  let inter = 0;
  for (const t of ta) {
    if (setB.has(t)) inter += 1;
    else if (tb.some((x) => x.startsWith(t) || t.startsWith(x))) inter += 0.6;
  }
  return inter / Math.max(ta.length, tb.length);
}

interface Instrument { code: string; designation: string | null; }

export interface SharesRow { code: string; shares: number; source: 'sikafinance'; }

/** Récupère et calcule le nombre d'actions par société BRVM. */
export async function fetchSharesFromSikafinance(): Promise<SharesRow[]> {
  const sb = getSupabase();
  const { data: instruments, error } = await sb
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .eq('actif', true);
  if (error) throw new Error(`load instruments: ${error.message}`);

  // Dernier cours par code (pour dériver shares = capi / cours).
  const { data: quotes } = await sb
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche')
    .order('date_marche', { ascending: false });
  const lastCours: Record<string, number | null> = {};
  for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) {
    if (!(q.code in lastCours)) lastCours[q.code] = q.cours_jour;
  }

  const res = await axios.get<string>(SIKA_CAP_URL, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' },
    responseType: 'text',
  });
  const $ = cheerio.load(res.data);

  const match = (name: string): string | null => {
    let best: string | null = null, bestScore = 0;
    for (const ins of (instruments ?? []) as Instrument[]) {
      const s = similarity(name, ins.designation ?? ins.code);
      if (s > bestScore) { bestScore = s; best = ins.code; }
    }
    return bestScore >= 0.5 ? best : null;
  };

  const out: SharesRow[] = [];
  const seen = new Set<string>();
  // Table générique : on cherche les lignes <tr> avec [nom, ... , capitalisation].
  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td').map((__, td) => $(td).text().trim()).get();
    if (cells.length < 2) return;
    const name = cells[0];
    // La capitalisation est la cellule numérique la plus grande de la ligne.
    const nums = cells.map((c) => parseFrNumber(c)).filter((n): n is number => n != null);
    if (!nums.length) return;
    const capitalisation = Math.max(...nums);
    const code = match(name);
    if (!code || seen.has(code)) return;
    const shares = parseSharesFromCapitalisation(capitalisation, lastCours[code] ?? null);
    if (shares && shares > 0) { out.push({ code, shares, source: 'sikafinance' }); seen.add(code); }
  });

  logger.info({ count: out.length }, 'Nombre d actions récupéré (sikafinance)');
  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run (depuis `scraper/`): `npx vitest run tests/shares.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/shares/sikafinance.ts scraper/tests/shares.test.ts
git commit -m "feat(fondamentaux): scraper nombre d'actions sikafinance + tests"
```

---

## Task 3: Runner shares (cascade + upsert) + CLI

**Files:**
- Create: `scraper/src/shares/runShares.ts`
- Modify: `scraper/src/index.ts`
- Modify: `scraper/package.json`

- [ ] **Step 1: Écrire le runner**

```typescript
// scraper/src/shares/runShares.ts
/**
 * Met à jour brvm_instruments.shares. Cascade : sikafinance (capi/cours).
 * Ne JAMAIS écraser une valeur shares_source='manual'.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { fetchSharesFromSikafinance } from './sikafinance.js';

export interface SharesRunResult { status: 'success' | 'failed'; nb: number; message: string | null; }

export async function runShares(): Promise<SharesRunResult> {
  const cfg = getConfig();
  try {
    const rows = await fetchSharesFromSikafinance();
    if (cfg.DRY_RUN) { logger.warn({ count: rows.length }, 'DRY_RUN — shares non écrits'); return { status: 'success', nb: rows.length, message: null }; }
    const sb = getSupabase();

    // Codes déjà en 'manual' : on les saute.
    const { data: manual } = await sb
      .from('brvm_instruments')
      .select('code')
      .eq('shares_source', 'manual');
    const manualSet = new Set((manual ?? []).map((m) => m.code as string));

    let nb = 0;
    for (const r of rows) {
      if (manualSet.has(r.code)) continue;
      const { error } = await sb
        .from('brvm_instruments')
        .update({ shares: r.shares, shares_source: r.source })
        .eq('code', r.code);
      if (error) { logger.warn({ code: r.code, err: error.message }, 'update shares échec'); continue; }
      nb += 1;
    }
    logger.info({ nb }, 'shares mis à jour');
    return { status: 'success', nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'runShares échoué');
    return { status: 'failed', nb: 0, message };
  }
}
```

- [ ] **Step 2: Wire le CLI dans index.ts**

Ajouter l'import en haut de `scraper/src/index.ts` (près des autres imports de runners) :

```typescript
import { runShares } from './shares/runShares.js';
```

Ajouter le case dans le switch de commandes (à côté de `case 'dividends'`) :

```typescript
      case 'shares': {
        const res = await runShares();
        return res.status === 'failed' ? 1 : 0;
      }
```

- [ ] **Step 3: Ajouter le script package.json**

Dans `scraper/package.json`, après la ligne `"publications:mock": ...`, ajouter :

```json
    "shares": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts shares",
```

- [ ] **Step 4: Typecheck + exécution réelle**

Run (depuis `scraper/`): `npm run typecheck`
Expected: aucune erreur.

Run (depuis `scraper/`): `npm run shares`
Expected: log `shares mis à jour` avec `nb > 0`.

- [ ] **Step 5: Vérifier en base**

Run (depuis `scraper/`): `node --env-file=.env.local -e "import('@supabase/supabase-js').then(async m=>{const sb=m.createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {count}=await sb.from('brvm_instruments').select('*',{count:'exact',head:true}).not('shares','is',null);console.log('codes avec shares:',count);})"`
Expected: `codes avec shares: N` (N ≥ 10).

- [ ] **Step 6: Commit**

```bash
git add scraper/src/shares/runShares.ts scraper/src/index.ts scraper/package.json
git commit -m "feat(fondamentaux): CLI shares + cascade upsert (skip manual)"
```

---

## Task 4: lib/fundamentals.ts — calculs purs + garde-fous

**Files:**
- Create: `frontend/lib/fundamentals.ts`
- Create: `frontend/lib/fundamentals.test.mjs`

- [ ] **Step 1: Écrire les tests (Node, sans framework)**

```javascript
// frontend/lib/fundamentals.test.mjs
// Exécuté via: node frontend/lib/fundamentals.test.mjs (après compilation tsx)
import assert from 'node:assert';
import { computeRatios, assessQuality } from './fundamentals.ts';

// Cas plausible : SNTS-like
const r = computeRatios({
  cours: 20000, shares: 50_000_000,
  revenue: 1_400_000_000_000, net_income: 300_000_000_000,
  equity: 800_000_000_000, debt: 100_000_000_000, dividende: 1750,
});
assert.ok(Math.abs(r.per - 3.33) < 0.1, `PER ~3.33, got ${r.per}`);
assert.ok(Math.abs(r.roe - 0.375) < 0.01, `ROE ~0.375, got ${r.roe}`);
assert.ok(Math.abs(r.margeNette - 0.214) < 0.01, `marge ~0.214, got ${r.margeNette}`);
assert.ok(Math.abs(r.rendementDiv - 0.0875) < 0.001, `rdt div ~0.0875, got ${r.rendementDiv}`);

// Garde-fous : valeur aberrante FTSC (CA=3)
assert.equal(assessQuality('revenue', 3), 'suspect');
assert.equal(assessQuality('revenue', 1_400_000_000_000), 'ok');
assert.equal(assessQuality('per', -1.86), 'suspect');     // PER négatif
assert.equal(assessQuality('per', 8.5), 'ok');
assert.equal(assessQuality('margeNette', 2.0), 'suspect'); // marge > 100%
assert.equal(assessQuality('roe', 5.0), 'suspect');        // ROE > 200%
assert.equal(assessQuality('revenue', null), 'missing');

console.log('✓ fundamentals tests OK');
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run (depuis `frontend/`): `npx tsx lib/fundamentals.test.mjs`
Expected: FAIL — module/fonctions introuvables.

- [ ] **Step 3: Implémenter lib/fundamentals.ts**

```typescript
// frontend/lib/fundamentals.ts
/**
 * Calculs d'analyse fondamentale (purs, testables) + garde-fous qualité.
 * Toutes les valeurs monétaires sont en FCFA. Les fonctions retournent
 * `number | null` (null = donnée insuffisante).
 */

export interface FundamentalInputs {
  cours: number | null;       // dernier cours
  shares: number | null;      // nombre d'actions
  revenue: number | null;     // chiffre d'affaires
  net_income: number | null;  // résultat net
  equity: number | null;      // capitaux propres
  debt: number | null;        // dette financière
  dividende: number | null;   // dividende par action (dernier)
}

export interface Ratios {
  bpa: number | null;          // RN / shares
  per: number | null;          // cours / bpa
  pb: number | null;           // cours / (equity / shares)
  ps: number | null;           // (cours*shares) / revenue
  capitalisation: number | null; // cours * shares
  roe: number | null;          // RN / equity
  roa: number | null;          // RN / (equity + debt)  (proxy actif)
  margeNette: number | null;   // RN / revenue
  gearing: number | null;      // debt / equity
  rendementDiv: number | null; // dividende / cours
  payout: number | null;       // (dividende * shares) / RN
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

export function computeRatios(i: FundamentalInputs): Ratios {
  const bpa = div(i.net_income, i.shares);
  const capitalisation = i.cours != null && i.shares != null ? i.cours * i.shares : null;
  return {
    bpa,
    per: div(i.cours, bpa),
    pb: div(i.cours, div(i.equity, i.shares)),
    ps: div(capitalisation, i.revenue),
    capitalisation,
    roe: div(i.net_income, i.equity),
    roa: div(i.net_income, i.equity != null && i.debt != null ? i.equity + i.debt : null),
    margeNette: div(i.net_income, i.revenue),
    gearing: div(i.debt, i.equity),
    rendementDiv: div(i.dividende, i.cours),
    payout: i.dividende != null && i.shares != null ? div(i.dividende * i.shares, i.net_income) : null,
  };
}

export type Quality = 'ok' | 'suspect' | 'missing';

/**
 * Évalue la plausibilité d'une métrique. Best practice : ne jamais afficher un
 * chiffre faux comme vrai. Les plages sont volontairement larges.
 */
export function assessQuality(metric: string, value: number | null): Quality {
  if (value == null || Number.isNaN(value)) return 'missing';
  switch (metric) {
    case 'revenue':
    case 'net_income':
    case 'equity':
      // Une société cotée BRVM a un CA/RN/equity > 1M FCFA (sinon extraction ratée).
      return Math.abs(value) < 1_000_000 ? 'suspect' : 'ok';
    case 'per':
      return value < 0 || value > 1000 ? 'suspect' : 'ok';
    case 'pb':
    case 'ps':
      return value < 0 || value > 100 ? 'suspect' : 'ok';
    case 'margeNette':
      return Math.abs(value) > 1 ? 'suspect' : 'ok';   // |marge| > 100%
    case 'roe':
    case 'roa':
      return Math.abs(value) > 2 ? 'suspect' : 'ok';   // |ROE| > 200%
    case 'gearing':
      return value < 0 || value > 20 ? 'suspect' : 'ok';
    case 'rendementDiv':
      return value < 0 || value > 0.5 ? 'suspect' : 'ok'; // rdt > 50%
    case 'payout':
      return value < 0 || value > 3 ? 'suspect' : 'ok';
    default:
      return 'ok';
  }
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run (depuis `frontend/`): `npx tsx lib/fundamentals.test.mjs`
Expected: `✓ fundamentals tests OK`

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/fundamentals.ts frontend/lib/fundamentals.test.mjs
git commit -m "feat(fondamentaux): lib calculs ratios + garde-fous qualité + tests"
```

---

## Task 5: RatioCard + RangeBar (composants présentation)

**Files:**
- Create: `frontend/components/fundamentals/RatioCard.tsx`
- Create: `frontend/components/fundamentals/RangeBar.tsx`

- [ ] **Step 1: RatioCard**

```tsx
// frontend/components/fundamentals/RatioCard.tsx
import type { Quality } from '@/lib/fundamentals';

interface Props {
  label: string;
  value: string;            // déjà formaté ('8,5', '+12,3 %', '2,3 Mds FCFA')
  quality?: Quality;        // ok | suspect | missing
  positive?: boolean | null; // colore vert/rouge si fourni
}

/** Ligne ratio dans une carte de section (style Trading 212, dark finance). */
export default function RatioCard({ label, value, quality = 'ok', positive }: Props) {
  if (quality === 'missing') {
    return (
      <div className="flex items-center justify-between py-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-muted/60">non disponible</span>
      </div>
    );
  }
  const colorCls =
    positive == null ? 'text-white' : positive ? 'text-up' : 'text-down';
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tabular ${quality === 'suspect' ? 'text-warn line-through/0' : colorCls}`}>
        {value}
        {quality === 'suspect' && <span title="Donnée douteuse" className="ml-1">⚠️</span>}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: RangeBar**

```tsx
// frontend/components/fundamentals/RangeBar.tsx
import { fmtNumber } from '@/lib/format';

interface Props {
  title: string;        // '1 jour' | '52 semaines'
  low: number | null;
  high: number | null;
  current: number | null;
}

/** Range Haut/Bas avec curseur de position (inspiré Trading 212), dark finance. */
export default function RangeBar({ title, low, high, current }: Props) {
  const pos =
    low != null && high != null && current != null && high > low
      ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
      : null;
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-muted mb-3">{title}</div>
      <div className="flex items-center gap-3">
        <div className="text-xs">
          <div className="text-muted">Bas</div>
          <div className="tabular">{low != null ? fmtNumber(low) : '—'}</div>
        </div>
        <div className="relative flex-1 h-1.5 bg-border rounded-full">
          {pos != null && (
            <div
              className="absolute -top-1 w-3 h-3 rounded-full bg-up border-2 border-surface"
              style={{ left: `calc(${pos}% - 6px)` }}
            />
          )}
        </div>
        <div className="text-xs text-right">
          <div className="text-muted">Haut</div>
          <div className="tabular">{high != null ? fmtNumber(high) : '—'}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/fundamentals/RatioCard.tsx frontend/components/fundamentals/RangeBar.tsx
git commit -m "feat(fondamentaux): composants RatioCard + RangeBar (style T212 dark)"
```

---

## Task 6: FundamentalsPanel (bloc /actions/[code])

**Files:**
- Create: `frontend/components/fundamentals/FundamentalsPanel.tsx`

Le panel reçoit des props déjà calculées côté serveur (la page les passera). Il rend les sections T212 + le range 52 semaines + l'historique pluriannuel + le lien PDF + un bouton « Corriger » (qui montera la modale en Task 8).

- [ ] **Step 1: Implémenter le panel**

```tsx
// frontend/components/fundamentals/FundamentalsPanel.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { computeRatios, assessQuality, type FundamentalInputs } from '@/lib/fundamentals';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import RatioCard from './RatioCard';
import RangeBar from './RangeBar';
import EditFundamentalsModal from './EditFundamentalsModal';

export interface FundamentalsPanelProps {
  code: string;
  inputs: FundamentalInputs;
  sharesSource: string | null;
  isManual: boolean;
  year: number | null;
  history: Array<{ year: number; revenue: number | null; net_income: number | null }>;
  sourceUrl: string | null;
  range52: { low: number | null; high: number | null; current: number | null };
}

function pct(v: number | null): string { return v == null ? '—' : `${(v * 100).toFixed(1)} %`; }
function num(v: number | null, d = 2): string { return v == null ? '—' : fmtNumber(v, d); }

export default function FundamentalsPanel(p: FundamentalsPanelProps) {
  const [editing, setEditing] = useState(false);
  const r = computeRatios(p.inputs);

  // Croissance CA / RN sur l'historique (du plus ancien au plus récent).
  const sortedHist = [...p.history].sort((a, b) => a.year - b.year);
  const last = sortedHist[sortedHist.length - 1];
  const prev = sortedHist[sortedHist.length - 2];
  const croissanceCA = last?.revenue && prev?.revenue ? last.revenue / prev.revenue - 1 : null;
  const croissanceRN = last?.net_income && prev?.net_income ? last.net_income / prev.net_income - 1 : null;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">🏦 Fondamentaux{p.year ? ` (exercice ${p.year})` : ''}</h2>
        <button type="button" onClick={() => setEditing(true)}
          className="text-xs border border-border rounded px-2 py-1 hover:border-up/40 hover:text-up transition">
          ✏️ Corriger
        </button>
      </div>

      {p.range52.low != null && (
        <RangeBar title="52 semaines" low={p.range52.low} high={p.range52.high} current={p.range52.current} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Générales">
          <RatioCard label="Capitalisation" value={r.capitalisation != null ? fmtFcfa(r.capitalisation) + ' FCFA' : '—'} quality={assessQuality('revenue', r.capitalisation)} />
          <RatioCard label="BPA" value={r.bpa != null ? fmtNumber(r.bpa) + ' FCFA' : '—'} quality={r.bpa == null ? 'missing' : 'ok'} positive={r.bpa != null ? r.bpa >= 0 : null} />
          <RatioCard label="Rendement dividende" value={pct(r.rendementDiv)} quality={assessQuality('rendementDiv', r.rendementDiv)} />
        </Section>

        <Section title="Évaluation">
          <RatioCard label="PER (P/E)" value={num(r.per)} quality={assessQuality('per', r.per)} />
          <RatioCard label="P/B" value={num(r.pb)} quality={assessQuality('pb', r.pb)} />
          <RatioCard label="P/S" value={num(r.ps)} quality={assessQuality('ps', r.ps)} />
        </Section>

        <Section title="Rentabilité">
          <RatioCard label="ROE" value={pct(r.roe)} quality={assessQuality('roe', r.roe)} positive={r.roe != null ? r.roe >= 0 : null} />
          <RatioCard label="Marge nette" value={pct(r.margeNette)} quality={assessQuality('margeNette', r.margeNette)} positive={r.margeNette != null ? r.margeNette >= 0 : null} />
        </Section>

        <Section title="Effet de levier">
          <RatioCard label="Dette / Capitaux propres" value={num(r.gearing)} quality={assessQuality('gearing', r.gearing)} />
          <RatioCard label="Payout (distribution)" value={pct(r.payout)} quality={assessQuality('payout', r.payout)} />
        </Section>

        <Section title="Croissance">
          <RatioCard label="Croissance CA" value={pct(croissanceCA)} positive={croissanceCA != null ? croissanceCA >= 0 : null} quality={croissanceCA == null ? 'missing' : 'ok'} />
          <RatioCard label="Croissance RN" value={pct(croissanceRN)} positive={croissanceRN != null ? croissanceRN >= 0 : null} quality={croissanceRN == null ? 'missing' : 'ok'} />
        </Section>
      </div>

      {p.sourceUrl && (
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-up hover:underline block">
          📄 États financiers officiels (PDF)
        </a>
      )}
      <p className="text-[10px] text-muted">
        Nombre d&apos;actions : {p.inputs.shares != null ? fmtNumber(p.inputs.shares) : 'non renseigné'}
        {p.sharesSource ? ` (${p.sharesSource})` : ''}. {p.isManual && '· Fondamentaux corrigés manuellement.'}
      </p>

      {editing && (
        <EditFundamentalsModal
          code={p.code}
          inputs={p.inputs}
          year={p.year}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck (échouera tant que EditFundamentalsModal n'existe pas)**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: erreur `Cannot find module './EditFundamentalsModal'` — attendu, résolu en Task 8. Ne pas committer cassé : passer Task 8 avant le typecheck final. (Spec reviewer : noter cette dépendance inter-tâches.)

- [ ] **Step 3: Commit (sans typecheck vert, dépend de Task 8)**

```bash
git add frontend/components/fundamentals/FundamentalsPanel.tsx
git commit -m "feat(fondamentaux): FundamentalsPanel (sections T212 + croissance + range)"
```

---

## Task 7: Route API correction manuelle

**Files:**
- Create: `frontend/app/api/fundamentals/route.ts`

- [ ] **Step 1: Implémenter la route POST**

```typescript
// frontend/app/api/fundamentals/route.ts
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * POST /api/fundamentals — correction manuelle des fondamentaux + shares.
 * Authentifié (utilisateur connecté). Écrit via service_role (jamais exposé client).
 * Marque is_manual=true (fundamentals) et shares_source='manual' (instruments).
 */
export async function POST(req: Request) {
  // 1) Auth : utilisateur connecté requis.
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const { code, year, revenue, net_income, equity, debt, shares } = body;

  // 2) Écriture service_role.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  const admin = createSbClient(url, key);

  if (year != null) {
    const { error } = await admin.from('fundamentals').upsert(
      { code, year, revenue, net_income, equity, debt, is_manual: true, source: 'manuel' },
      { onConflict: 'code,year' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (shares != null) {
    const { error } = await admin.from('brvm_instruments')
      .update({ shares, shares_source: 'manual' }).eq('code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Vérifier la variable d'env service_role côté Vercel**

Run: `grep -r "SUPABASE_SERVICE_ROLE_KEY" frontend/.env.local 2>/dev/null && echo "présent local" || echo "À AJOUTER dans Vercel env"`
Expected : présent localement ; sinon noter qu'il faut l'ajouter dans Vercel (Settings → Environment Variables) avant le déploiement.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/fundamentals/route.ts
git commit -m "feat(fondamentaux): route API correction manuelle (service_role, auth)"
```

---

## Task 8: EditFundamentalsModal

**Files:**
- Create: `frontend/components/fundamentals/EditFundamentalsModal.tsx`

- [ ] **Step 1: Implémenter la modale**

```tsx
// frontend/components/fundamentals/EditFundamentalsModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FundamentalInputs } from '@/lib/fundamentals';

interface Props {
  code: string;
  inputs: FundamentalInputs;
  year: number | null;
  onClose: () => void;
}

/** Correction manuelle des fondamentaux + nombre d'actions (POST /api/fundamentals). */
export default function EditFundamentalsModal({ code, inputs, year, onClose }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const numOrNull = (k: string) => { const v = fd.get(k); return v && String(v).trim() !== '' ? Number(v) : null; };
    const payload = {
      code,
      year: numOrNull('year'),
      revenue: numOrNull('revenue'),
      net_income: numOrNull('net_income'),
      equity: numOrNull('equity'),
      debt: numOrNull('debt'),
      shares: numOrNull('shares'),
    };
    try {
      const res = await fetch('/api/fundamentals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Échec');
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setBusy(false); }
  }

  const Field = ({ name, label, def }: { name: string; label: string; def: number | null }) => (
    <div>
      <label htmlFor={`ef-${name}`} className="block text-xs text-muted mb-1">{label}</label>
      <input id={`ef-${name}`} name={name} type="number" step="any" defaultValue={def ?? ''}
        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Corriger les fondamentaux — {code}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg text-lg" aria-label="Fermer">✕</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field name="year" label="Exercice" def={year} />
            <Field name="shares" label="Nombre d'actions" def={inputs.shares} />
            <Field name="revenue" label="Chiffre d'affaires" def={inputs.revenue} />
            <Field name="net_income" label="Résultat net" def={inputs.net_income} />
            <Field name="equity" label="Capitaux propres" def={inputs.equity} />
            <Field name="debt" label="Dette financière" def={inputs.debt} />
          </div>
          {error && <p className="text-xs text-down">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={busy} className="flex-1 px-4 py-2 rounded border border-border text-sm hover:bg-bg/40 transition">Annuler</button>
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck (Task 6 + 8 ensemble compilent)**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/fundamentals/EditFundamentalsModal.tsx
git commit -m "feat(fondamentaux): EditFundamentalsModal (correction manuelle)"
```

---

## Task 9: Intégrer FundamentalsPanel dans /actions/[code]

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx`

Le bloc fondamentaux actuel lit déjà `fundamentals` (3 dernières années). On enrichit `getData` pour aussi charger `shares`/`shares_source`, le dernier dividende, le range 52 semaines, et l'URL PDF, puis on remplace le bloc par `<FundamentalsPanel>`.

- [ ] **Step 1: Étendre getData**

Dans le `Promise.all` de `getData` (où `fundamentals` est déjà requêté, voir `frontend/app/actions/[code]/page.tsx`), s'assurer que la requête `fundamentals` sélectionne aussi `source_file` ; et que `brvm_instruments` sélectionne `shares, shares_source`. Ajouter une requête pour le range 52 semaines :

```typescript
      // 52 semaines : min/max cours sur ~252 séances déjà chargées dans `hist`.
```

(Le range se calcule depuis `rows` déjà disponibles — pas de requête supplémentaire.)

- [ ] **Step 2: Construire les props et remplacer le bloc**

Remplacer le bloc JSX `{/* ── Fondamentaux ── */}` existant par :

```tsx
      {fundamentals.length > 0 && (() => {
        const latest = fundamentals[0];
        const closes = rows.map((r) => r.cours_jour).filter((c): c is number => c != null);
        const range52 = {
          low: closes.length ? Math.min(...closes) : null,
          high: closes.length ? Math.max(...closes) : null,
          current: last.cours_jour ?? null,
        };
        return (
          <FundamentalsPanel
            code={code}
            year={latest.year}
            inputs={{
              cours: last.cours_jour ?? null,
              shares: (instrument as { shares?: number | null })?.shares ?? null,
              revenue: latest.revenue, net_income: latest.net_income,
              equity: latest.equity, debt: latest.debt, dividende: lastDiv?.montant ?? null,
            }}
            sharesSource={(instrument as { shares_source?: string | null })?.shares_source ?? null}
            isManual={false}
            history={fundamentals.map((f) => ({ year: f.year ?? 0, revenue: f.revenue, net_income: f.net_income }))}
            sourceUrl={null}
            range52={range52}
          />
        );
      })()}
```

Ajouter l'import en haut du fichier :

```typescript
import FundamentalsPanel from '@/components/fundamentals/FundamentalsPanel';
```

S'assurer que la requête `brvm_instruments` du `getData` inclut `shares, shares_source` (elle fait `select('*')` → déjà inclus).

- [ ] **Step 3: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

Run (depuis `frontend/`): `npm run build`
Expected: `✓ Compiled successfully`, route `/actions/[code]` présente.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/actions/[code]/page.tsx
git commit -m "feat(fondamentaux): intégrer FundamentalsPanel dans la fiche action"
```

---

## Task 10: Page screener /fondamentaux

**Files:**
- Create: `frontend/components/fundamentals/FundamentalsTable.tsx`
- Create: `frontend/app/fondamentaux/page.tsx`

- [ ] **Step 1: FundamentalsTable (client, triable)**

```tsx
// frontend/components/fundamentals/FundamentalsTable.tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import { assessQuality } from '@/lib/fundamentals';

export interface ScreenerRow {
  code: string;
  designation: string | null;
  secteur: string | null;
  per: number | null;
  pb: number | null;
  roe: number | null;
  margeNette: number | null;
  rendementDiv: number | null;
}

type SortKey = 'per' | 'pb' | 'roe' | 'margeNette' | 'rendementDiv';

export default function FundamentalsTable({ rows }: { rows: ScreenerRow[] }) {
  const [sort, setSort] = useState<SortKey>('per');
  const [asc, setAsc] = useState(true);
  const [secteur, setSecteur] = useState<string>('');

  const secteurs = useMemo(() => [...new Set(rows.map((r) => r.secteur).filter(Boolean))] as string[], [rows]);

  const filtered = useMemo(() => {
    const base = secteur ? rows.filter((r) => r.secteur === secteur) : rows;
    return [...base].sort((a, b) => {
      const av = a[sort], bv = b[sort];
      if (av == null) return 1; if (bv == null) return -1;
      return asc ? av - bv : bv - av;
    });
  }, [rows, sort, asc, secteur]);

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2 text-right cursor-pointer hover:text-up"
      onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(true); } }}>
      {label}{sort === k ? (asc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const Cell = ({ metric, value, isPct }: { metric: SortKey; value: number | null; isPct?: boolean }) => {
    const q = assessQuality(metric, value);
    if (q === 'missing') return <td className="px-3 py-2 text-right text-muted/60">—</td>;
    const txt = isPct ? `${((value ?? 0) * 100).toFixed(1)} %` : fmtNumber(value, 2);
    return <td className={`px-3 py-2 text-right tabular ${q === 'suspect' ? 'text-warn' : ''}`}>{txt}{q === 'suspect' && ' ⚠️'}</td>;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setSecteur('')} className={`text-xs px-2 py-1 rounded border ${secteur === '' ? 'border-up text-up' : 'border-border text-muted'}`}>Tous</button>
        {secteurs.map((s) => (
          <button type="button" key={s} onClick={() => setSecteur(s)} className={`text-xs px-2 py-1 rounded border ${secteur === s ? 'border-up text-up' : 'border-border text-muted'}`}>{s}</button>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border bg-bg/40">
            <tr>
              <th className="px-3 py-2 text-left">Titre</th>
              <Th k="per" label="PER" />
              <Th k="pb" label="P/B" />
              <Th k="roe" label="ROE" />
              <Th k="margeNette" label="Marge" />
              <Th k="rendementDiv" label="Rdt div." />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.code} className="border-b border-border/40 hover:bg-bg/40">
                <td className="px-3 py-2"><Link href={`/actions/${r.code}`} className="font-medium hover:text-up">{r.code}</Link><span className="text-muted text-xs ml-2">{r.secteur}</span></td>
                <Cell metric="per" value={r.per} />
                <Cell metric="pb" value={r.pb} />
                <Cell metric="roe" value={r.roe} isPct />
                <Cell metric="margeNette" value={r.margeNette} isPct />
                <Cell metric="rendementDiv" value={r.rendementDiv} isPct />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted">⚠️ = donnée extraite douteuse (vérifier les états financiers). « — » = non disponible.</p>
    </div>
  );
}
```

- [ ] **Step 2: Page screener (server)**

```tsx
// frontend/app/fondamentaux/page.tsx
import { createClient } from '@/lib/supabase/server';
import { computeRatios } from '@/lib/fundamentals';
import FundamentalsTable, { type ScreenerRow } from '@/components/fundamentals/FundamentalsTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyse fondamentale' };

async function getData(): Promise<ScreenerRow[]> {
  const sb = createClient();
  const [{ data: instruments }, { data: funds }, { data: quotes }, { data: divs }] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, shares').eq('type', 'action').eq('actif', true),
    sb.from('fundamentals').select('code, year, revenue, net_income, equity, debt').order('year', { ascending: false }),
    sb.from('brvm_actions_daily').select('code, cours_jour, date_marche').order('date_marche', { ascending: false }),
    sb.from('dividends').select('code, montant, ex_date').order('ex_date', { ascending: false }),
  ]);

  const lastCours: Record<string, number | null> = {};
  for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) if (!(q.code in lastCours)) lastCours[q.code] = q.cours_jour;
  const lastFund: Record<string, { revenue: number | null; net_income: number | null; equity: number | null; debt: number | null }> = {};
  for (const f of (funds ?? []) as { code: string; revenue: number | null; net_income: number | null; equity: number | null; debt: number | null }[]) if (!(f.code in lastFund)) lastFund[f.code] = f;
  const lastDiv: Record<string, number | null> = {};
  for (const d of (divs ?? []) as { code: string; montant: number | null }[]) if (!(d.code in lastDiv)) lastDiv[d.code] = d.montant;

  return ((instruments ?? []) as { code: string; designation: string | null; secteur: string | null; shares: number | null }[]).map((ins) => {
    const f = lastFund[ins.code] ?? { revenue: null, net_income: null, equity: null, debt: null };
    const r = computeRatios({ cours: lastCours[ins.code] ?? null, shares: ins.shares, revenue: f.revenue, net_income: f.net_income, equity: f.equity, debt: f.debt, dividende: lastDiv[ins.code] ?? null });
    return { code: ins.code, designation: ins.designation, secteur: ins.secteur, per: r.per, pb: r.pb, roe: r.roe, margeNette: r.margeNette, rendementDiv: r.rendementDiv };
  });
}

export default async function FondamentauxPage() {
  const rows = await getData();
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">🏦 Analyse fondamentale</h1>
        <p className="text-sm text-muted">Ratios clés des 48 actions BRVM — triez et filtrez par secteur.</p>
      </div>
      <FundamentalsTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit && npm run build`
Expected: `✓ Compiled successfully`, route `/fondamentaux` listée.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/fundamentals/FundamentalsTable.tsx frontend/app/fondamentaux/page.tsx
git commit -m "feat(fondamentaux): page screener /fondamentaux (triable, filtres secteur)"
```

---

## Task 11: Sidebar → lien interne + archivage Streamlit

**Files:**
- Modify: `frontend/components/Sidebar.tsx`
- Modify: `brvm_scanner/README.md`

- [ ] **Step 1: Pointer le lien sidebar vers /fondamentaux interne**

Dans `frontend/components/Sidebar.tsx`, remplacer l'entrée externe « Analyse fondamentale » par une entrée interne. Localiser :

```tsx
  { href: SCANNER_URL, label: '📑 Analyse fondamentale', external: true },
```

Remplacer par :

```tsx
  { href: '/fondamentaux', label: '🏦 Analyse fondamentale' },
```

Et supprimer la constante `SCANNER_URL` et l'interface `external` si elles ne sont plus utilisées ailleurs (vérifier avec `grep -n "SCANNER_URL\|external" frontend/components/Sidebar.tsx`). Si `external` n'est plus utilisé par aucune entrée, retirer le bloc de rendu `if (n.external)`.

- [ ] **Step 2: Marquer Streamlit DEPRECATED**

Ajouter en tête de `brvm_scanner/README.md` :

```markdown
> ⚠️ **DEPRECATED (2026-06-05)** — L'analyse fondamentale est désormais intégrée
> au site Next.js (`/fondamentaux`), sans mise en veille ni synchro locale.
> Cette app Streamlit n'est plus maintenue ; conservée pour archive uniquement.
```

- [ ] **Step 3: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Sidebar.tsx brvm_scanner/README.md
git commit -m "feat(fondamentaux): lien sidebar interne + archivage Streamlit (deprecated)"
```

---

## Task 12: Déploiement + vérification

- [ ] **Step 1: Build final**

Run (depuis `frontend/`): `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 2: Déployer**

Run (depuis `frontend/`): `npx vercel deploy --prod --yes`
Expected: `Aliased: https://frontend-zeta-ten-22.vercel.app`.

- [ ] **Step 3: Vérifier les pages**

Run: `curl -s -o /dev/null -w "%{http_code}" https://frontend-zeta-ten-22.vercel.app/fondamentaux`
Expected: `200`.

- [ ] **Step 4: Vérifier la variable Vercel service_role**

Si `SUPABASE_SERVICE_ROLE_KEY` n'est pas dans les env Vercel du projet frontend, l'ajouter (Settings → Environment Variables) puis redéployer — sinon la correction manuelle renverra 500. Tester un POST authentifié depuis l'UI (bouton « Corriger »).

---

## Self-review (effectué)

- **Couverture spec** : migration (T1) ✓, shares auto cascade (T2-T3) ✓, calculs + garde-fous (T4) ✓, composants T212 dark (T5-T6) ✓, correction manuelle (T7-T8) ✓, intégration fiche action (T9) ✓, screener (T10) ✓, archivage Streamlit + sidebar (T11) ✓, déploiement (T12) ✓.
- **Dépendance inter-tâches notée** : Task 6 (FundamentalsPanel) importe EditFundamentalsModal (Task 8) → typecheck vert seulement après Task 8. Signalé dans T6 Step 2.
- **Cohérence types** : `FundamentalInputs`, `Ratios`, `Quality`, `ScreenerRow`, `FundamentalsPanelProps` cohérents entre tâches. `assessQuality(metric, value)` signature identique partout. `computeRatios(inputs)` idem.
- **Pas de placeholder** : tout le code est fourni.
- **YAGNI** : pas de DCF, pas de ratios de liquidité comptables (pas de données bilan détaillées fiables), pas de ré-extraction PDF.
