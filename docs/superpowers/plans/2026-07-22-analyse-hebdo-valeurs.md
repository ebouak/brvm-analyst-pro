# Analyse hebdo des valeurs en vogue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier chaque samedi une analyse technique de 3 à 5 valeurs BRVM notables (hausses et baisses), sur données réelles, avec graphique cours + RSI, narratif hybride, page SEO et image partageable.

**Architecture:** Sélection et narratif sont des fonctions PURES testées (`frontend/lib/hebdo/`) ; un worker scraper (`hebdo`) les orchestre, fige un snapshot des métriques en base (`hebdo_editions`/`hebdo_items`), auto-publie et alerte. Le frontend rend la page publique depuis le snapshot (jamais de recalcul), avec image OG et PNG haute-résolution via satori.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (RLS), Recharts, `next/og` (ImageResponse), scraper TS ESM (imports `.js`), tests `.test.mjs` via `npx tsx --test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-22-analyse-hebdo-valeurs-design.md`

---

## Écarts spec → plan (constatés au cadrage, intégrés ci-dessous)

1. **`detect()` n'expose pas `hi`/`lo`.** L'interface `Detection` (`frontend/lib/indicators.ts:161`) ne renvoie que des booléens (`breakoutUp/Down`, `overbought`…). Les bornes du canal 20 séances sont des variables locales. → Le plan ajoute `computeLevels(closes)` dans `lib/hebdo/levels.ts` (pur, testé) qui recalcule support/résistance/objectifs depuis les clôtures, **sans modifier le module partagé**.
2. **Permission admin** : `content.write` et `content.publish` existent déjà au seed RBAC (`0041`). → `/admin/hebdo` utilise `requirePermission('content.publish')`.

## Conventions vérifiées (à réutiliser telles quelles)

- Indicateurs : `import { rsi, rsiSeries, macdSeries, smaSeries, detect } from '@/lib/indicators';`
- Service client : `import { getServiceClient } from '@/lib/billing/serviceClient';` · anon : `createPublicClient` (`@/lib/supabase/public`) · session : `createClient` (`@/lib/supabase/server`).
- Admin : `import { requirePermission } from '@/lib/server/rbac';`
- LLM : `import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';` (`'deepseek' | 'mistral' | 'xai'`).
- Scraper alertes : `import { dispatch } from '../alerts/channels.js';` → `dispatch({ subject, body, code, to: null })`.
- Scraper CLI : dans `scraper/src/index.ts`, `async function monitored<T>(source, run)` retourne la valeur ; `mock` est un booléen du scope.
- OG : `import { ImageResponse } from 'next/og'; export const runtime = 'edge';`
- `/analyses` est **déjà** dans `PUBLIC_PREFIXES` du middleware → `/analyses/hebdo/...` est public sans modification.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0113_hebdo_analyses.sql` | 2 tables + RLS (créé) |
| `frontend/lib/hebdo/levels.ts` | `computeLevels` pur (créé) |
| `frontend/lib/hebdo/select.ts` | `selectHebdo` pur (créé) |
| `frontend/lib/hebdo/narrative.ts` | `buildSkeleton` + `assertNoForeignNumber` purs (créé) |
| `frontend/lib/hebdo/hebdo.test.mjs` | tests des 3 modules purs (créé) |
| `frontend/lib/hebdo/types.ts` | types partagés snapshot (créé) |
| `scraper/src/hebdo/polish.ts` | `polishNarrative` (LLM, I/O) (créé) |
| `scraper/src/hebdo/runHebdo.ts` | orchestration + upsert + alerte (créé) |
| `scraper/src/index.ts` | `case 'hebdo'` (modifié) |
| `scraper/package.json` | scripts `hebdo[:mock]` (modifié) |
| `.github/workflows/hebdo.yml` | cron samedi 06:00 UTC (créé) |
| `frontend/app/analyses/hebdo/page.tsx` | index des éditions (créé) |
| `frontend/app/analyses/hebdo/[date]/page.tsx` | page d'une édition (créé) |
| `frontend/components/hebdo/HebdoChart.tsx` | graphe cours + RSI (créé) |
| `frontend/app/analyses/hebdo/[date]/opengraph-image.tsx` | OG satori (créé) |
| `frontend/app/api/hebdo/[date]/image/route.tsx` | PNG haute-rés (créé) |
| `frontend/app/admin/hebdo/page.tsx` | console admin (créé) |
| `frontend/app/api/admin/hebdo/[id]/route.ts` | publier/dépublier (créé) |
| `frontend/lib/nav.ts`, `frontend/lib/admin-nav.ts` | entrées de nav (modifiés) |

---

### Task 1 : Migration `0113` — éditions & items

**Files:** Create `supabase/migrations/0113_hebdo_analyses.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- 0113_hebdo_analyses.sql
-- Analyse hebdomadaire des valeurs en vogue.
-- Spec : docs/superpowers/specs/2026-07-22-analyse-hebdo-valeurs-design.md
-- Le snapshot `metrics` fige les séries au moment de la publication : la page
-- reste stable et citable même si brvm_actions_daily évolue ensuite.
-- ============================================================================

create table if not exists public.hebdo_editions (
  id            uuid primary key default gen_random_uuid(),
  date_edition  date not null unique,
  statut        text not null default 'brouillon' check (statut in ('brouillon','publie')),
  auto          boolean not null default true,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists idx_hebdo_editions_pub on public.hebdo_editions (statut, date_edition desc);

create table if not exists public.hebdo_items (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references public.hebdo_editions(id) on delete cascade,
  code         text not null,
  sens         text not null check (sens in ('hausse','baisse')),
  raison       text not null default '',
  metrics      jsonb not null,
  narratif_md  text not null default '',
  ordre        integer not null default 0,
  unique (edition_id, code)
);
create index if not exists idx_hebdo_items_edition on public.hebdo_items (edition_id, ordre);

alter table public.hebdo_editions enable row level security;
alter table public.hebdo_items    enable row level security;

-- Lecture publique des éditions PUBLIÉES uniquement (les brouillons restent privés).
drop policy if exists "hebdo_editions public read" on public.hebdo_editions;
create policy "hebdo_editions public read" on public.hebdo_editions
  for select using (statut = 'publie');

-- Un item n'est lisible que si son édition est publiée.
drop policy if exists "hebdo_items public read" on public.hebdo_items;
create policy "hebdo_items public read" on public.hebdo_items
  for select using (
    exists (select 1 from public.hebdo_editions e where e.id = edition_id and e.statut = 'publie')
  );

-- Toute écriture passe par le service_role (worker + routes admin).
revoke insert, update, delete on public.hebdo_editions from public, anon, authenticated;
revoke insert, update, delete on public.hebdo_items    from public, anon, authenticated;

comment on table public.hebdo_editions is
  'Éditions hebdomadaires d''analyse technique BRVM. Lecture publique des éditions publiées ; écriture service_role (worker hebdo + admin). Aucune donnée personnelle.';
```

- [ ] **Step 2 : Demander à l'utilisateur d'appliquer la migration** (SQL Editor). Les tasks 2-5 (code pur + LLM) avancent sans attendre ; les tasks 6+ (écriture/lecture base) exigent la migration.

- [ ] **Step 3 : Sonde RLS anon** (après application ; `$ANON` = `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `frontend/.env.local`) :

```bash
cd scraper && set -a && source .env.local && set +a
curl -s "$SUPABASE_URL/rest/v1/hebdo_editions?select=id,statut&limit=2" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/hebdo_editions" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"date_edition":"2026-01-01"}'
```

Attendu : lecture `[]` (aucune édition publiée au départ) ; écriture `401` ou `403`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0113_hebdo_analyses.sql
git commit -m "feat(db): editions hebdo + items (snapshot metrics, RLS lecture des publies)"
```

---

### Task 2 : `levels.ts` — niveaux techniques (TDD)

**Files:** Create `frontend/lib/hebdo/levels.ts`, `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Écrire le test**

```js
// frontend/lib/hebdo/hebdo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLevels } from './levels.ts';

/** Série croissante 40 → 79 (40 points). */
const croissante = Array.from({ length: 40 }, (_, i) => 40 + i);

test('computeLevels : résistance = plus haut des 20 séances précédentes', () => {
  const l = computeLevels(croissante);
  // closes[19..38] hors dernière = max 78 ; dernière = 79 → cassure haussière.
  assert.equal(l.resistance, 78);
  assert.equal(l.cassureHaut, true);
  assert.equal(l.cassureBas, false);
});

test('computeLevels : support = plus bas du canal', () => {
  const l = computeLevels(croissante);
  assert.ok(l.support < l.resistance);
});

test('computeLevels : objectifs au-dessus de la résistance, invalidation sous le support', () => {
  const l = computeLevels(croissante);
  assert.ok(l.objectif1 > l.resistance);
  assert.ok(l.objectif2 > l.objectif1);
  assert.ok(l.invalidation < l.support);
});

test('computeLevels : historique trop court → null', () => {
  assert.equal(computeLevels([1, 2, 3]), null);
});
```

- [ ] **Step 2 : Vérifier l'échec** — `cd frontend && npx tsx --test lib/hebdo/hebdo.test.mjs` → FAIL (module absent).

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/hebdo/levels.ts
/**
 * Niveaux techniques dérivés des CLÔTURES RÉELLES — fonction PURE, testée.
 * `detect()` (lib/indicators) ne renvoie que des booléens : les bornes du canal
 * 20 séances y sont locales. On les recalcule ici plutôt que de modifier le
 * module partagé. Aucun niveau n'est saisi à la main (règle §5 : rien d'inventé).
 */

export interface Levels {
  /** Plus haut des 20 séances précédant la dernière. */
  resistance: number;
  /** Plus bas des 20 séances précédant la dernière. */
  support: number;
  /** Dernière clôture. */
  dernier: number;
  cassureHaut: boolean;
  cassureBas: boolean;
  /** Extensions au-delà de la résistance (amplitude du canal projetée). */
  objectif1: number;
  objectif2: number;
  /** Sous le support : niveau qui invaliderait la lecture haussière. */
  invalidation: number;
}

const FENETRE = 20;

export function computeLevels(closes: number[]): Levels | null {
  const n = closes.length;
  if (n < FENETRE + 2) return null;
  const canal = closes.slice(n - (FENETRE + 1), n - 1);
  const resistance = Math.max(...canal);
  const support = Math.min(...canal);
  const dernier = closes[n - 1]!;
  const amplitude = Math.max(resistance - support, 0);
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    resistance: round(resistance),
    support: round(support),
    dernier: round(dernier),
    cassureHaut: dernier > resistance,
    cassureBas: dernier < support,
    objectif1: round(resistance + amplitude * 0.5),
    objectif2: round(resistance + amplitude),
    invalidation: round(support - amplitude * 0.25),
  };
}
```

- [ ] **Step 4 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 4/4 verts. `npx tsc --noEmit`.

- [ ] **Step 5 : Commit** — `git add frontend/lib/hebdo/levels.ts frontend/lib/hebdo/hebdo.test.mjs && git commit -m "feat(hebdo): computeLevels — support/resistance/objectifs depuis les clotures reelles"`

---

### Task 3 : `types.ts` + `select.ts` — sélection des valeurs (TDD)

**Files:** Create `frontend/lib/hebdo/types.ts`, `frontend/lib/hebdo/select.ts`; Modify `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Créer les types partagés**

```ts
// frontend/lib/hebdo/types.ts
import type { Levels } from './levels';

/** Entrée de sélection : une valeur avec sa semaine et son historique. */
export interface HebdoCandidate {
  code: string;
  /** Clôtures chronologiques (≥ 32 points requis pour être retenu). */
  closes: number[];
  /** Variation de la semaine, en %. */
  variationHebdo: number | null;
  /** Volume de la dernière séance. */
  volume: number | null;
  /** Volume moyen 20 séances. */
  avgVolume20: number | null;
}

export interface HebdoPick {
  code: string;
  sens: 'hausse' | 'baisse';
  raison: string;
  score: number;
}

/** Snapshot figé stocké dans hebdo_items.metrics (rendu de la page). */
export interface HebdoMetrics {
  code: string;
  dates: string[];
  closes: number[];
  rsi: (number | null)[];
  dernier: number;
  variationHebdo: number | null;
  volume: number | null;
  ratioVolume: number | null;
  rsiDernier: number | null;
  macdPositif: boolean | null;
  levels: Levels | null;
}
```

- [ ] **Step 2 : Ajouter les tests de sélection** à `frontend/lib/hebdo/hebdo.test.mjs`

```js
import { selectHebdo } from './select.ts';

function cand(code, variation, volume, avgVolume, base = 100) {
  return {
    code,
    closes: Array.from({ length: 40 }, (_, i) => base + i * (variation >= 0 ? 1 : -1)),
    variationHebdo: variation,
    volume,
    avgVolume20: avgVolume,
  };
}

test('selectHebdo retient au plus 5 valeurs, triées par notabilité', () => {
  const picks = selectHebdo([
    cand('AAAA', 12, 3000, 1000), cand('BBBB', 9, 2500, 1000), cand('CCCC', 7, 1200, 1000),
    cand('DDDD', 5, 1100, 1000), cand('EEEE', 4, 1000, 1000), cand('FFFF', 3, 900, 1000),
    cand('GGGG', -8, 4000, 1000),
  ]);
  assert.ok(picks.length >= 3 && picks.length <= 5);
  assert.ok(picks[0].score >= picks[picks.length - 1].score);
});

test('selectHebdo garantit au moins une baisse si une baisse existe', () => {
  const picks = selectHebdo([
    cand('AAAA', 12, 3000, 1000), cand('BBBB', 11, 2900, 1000), cand('CCCC', 10, 2800, 1000),
    cand('DDDD', 9, 2700, 1000), cand('EEEE', 8, 2600, 1000), cand('ZZZZ', -3, 1100, 1000),
  ]);
  assert.ok(picks.some((p) => p.sens === 'baisse'), 'au moins une baisse attendue');
});

test('selectHebdo ignore un historique trop court', () => {
  const court = { code: 'SHRT', closes: [1, 2, 3], variationHebdo: 20, volume: 9999, avgVolume20: 10 };
  const picks = selectHebdo([court, cand('AAAA', 5, 2000, 1000), cand('BBBB', 4, 1500, 1000), cand('CCCC', 3, 1200, 1000)]);
  assert.ok(!picks.some((p) => p.code === 'SHRT'));
});

test('selectHebdo : volume anormal (≥2×) mentionné dans la raison', () => {
  const picks = selectHebdo([cand('AAAA', 6, 3000, 1000), cand('BBBB', 5, 1100, 1000), cand('CCCC', 4, 1050, 1000)]);
  const a = picks.find((p) => p.code === 'AAAA');
  assert.match(a.raison, /volume/i);
});

test('selectHebdo : aucune valeur exploitable → tableau vide', () => {
  assert.deepEqual(selectHebdo([]), []);
});
```

- [ ] **Step 3 : Vérifier l'échec** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → FAIL (`selectHebdo` absent).

- [ ] **Step 4 : Implémenter**

```ts
// frontend/lib/hebdo/select.ts
/**
 * Sélection des valeurs « en vogue » de la semaine — PURE, testée.
 * Score de notabilité sur 4 axes : ampleur du mouvement, volume anormal,
 * cassure de canal, extrémité de RSI. Garantit au moins une BAISSE quand il en
 * existe une : l'hebdo ne doit pas être un bulletin uniquement haussier.
 */
import { detect, rsi } from '../indicators';
import { computeLevels } from './levels';
import type { HebdoCandidate, HebdoPick } from './types';

const MIN_CLOSES = 32;
const MAX_PICKS = 5;
const MIN_PICKS = 3;
const VOLUME_ANORMAL = 2;

interface Scored extends HebdoPick {
  variation: number;
}

function scoreOne(c: HebdoCandidate): Scored | null {
  if (!Array.isArray(c.closes) || c.closes.length < MIN_CLOSES) return null;
  const variation = c.variationHebdo ?? 0;
  const ratio = c.avgVolume20 && c.avgVolume20 > 0 && c.volume != null ? c.volume / c.avgVolume20 : null;
  const lv = computeLevels(c.closes);
  const d = detect(c.closes);
  const r = rsi(c.closes, 14);

  const raisons: string[] = [];
  let score = Math.abs(variation); // axe 1 : ampleur

  if (ratio != null && ratio >= VOLUME_ANORMAL) {
    score += 10;
    raisons.push(`volume ${ratio.toFixed(1)}× la moyenne`);
  }
  if (lv?.cassureHaut || d.breakoutUp) { score += 8; raisons.push('cassure de résistance'); }
  if (lv?.cassureBas || d.breakoutDown) { score += 8; raisons.push('rupture de support'); }
  if (d.overbought) { score += 3; raisons.push('RSI en zone de surachat'); }
  if (d.oversold) { score += 3; raisons.push('RSI en zone de survente'); }
  if (d.goldenCross) { score += 4; raisons.push('croisement haussier MA20/MA50'); }
  if (d.deathCross) { score += 4; raisons.push('croisement baissier MA20/MA50'); }
  if (raisons.length === 0 && r != null) raisons.push(`RSI à ${r.toFixed(0)}`);

  return {
    code: c.code,
    sens: variation >= 0 ? 'hausse' : 'baisse',
    raison: `${variation >= 0 ? 'Hausse' : 'Baisse'} de ${Math.abs(variation).toFixed(2)} % · ${raisons.join(' · ')}`,
    score: Math.round(score * 100) / 100,
    variation,
  };
}

export function selectHebdo(candidats: HebdoCandidate[]): HebdoPick[] {
  const scored = candidats.map(scoreOne).filter((s): s is Scored => s !== null);
  if (scored.length === 0) return [];
  scored.sort((a, b) => b.score - a.score);

  const retenus = scored.slice(0, MAX_PICKS);
  // Honnêteté : si aucune baisse dans le haut du classement mais qu'il en existe
  // une, on remplace la dernière hausse par la baisse la mieux classée.
  const baisses = scored.filter((s) => s.sens === 'baisse');
  if (baisses.length > 0 && !retenus.some((s) => s.sens === 'baisse')) {
    retenus[retenus.length - 1] = baisses[0]!;
  }
  const final = retenus.slice(0, Math.max(MIN_PICKS, Math.min(MAX_PICKS, retenus.length)));
  return final.map(({ code, sens, raison, score }) => ({ code, sens, raison, score }));
}
```

- [ ] **Step 5 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 9/9 verts. `npx tsc --noEmit`.

- [ ] **Step 6 : Commit** — `git add frontend/lib/hebdo/types.ts frontend/lib/hebdo/select.ts frontend/lib/hebdo/hebdo.test.mjs && git commit -m "feat(hebdo): selectHebdo — 3-5 valeurs notables, au moins une baisse garantie"`

---

### Task 4 : `narrative.ts` — squelette + garde-fou anti-invention (TDD)

**Files:** Create `frontend/lib/hebdo/narrative.ts`; Modify `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Ajouter les tests**

```js
import { buildSkeleton, assertNoForeignNumber } from './narrative.ts';

const metrics = {
  code: 'ETIT', dates: ['2026-07-20', '2026-07-21'], closes: [63, 66],
  rsi: [68, 69.8], dernier: 66, variationHebdo: 4.76, volume: 7600000,
  ratioVolume: 2.8, rsiDernier: 69.8, macdPositif: true,
  levels: { resistance: 63, support: 55, dernier: 66, cassureHaut: true, cassureBas: false, objectif1: 67, objectif2: 71, invalidation: 53 },
};

test('buildSkeleton produit des sections et une whitelist de chiffres', () => {
  const s = buildSkeleton(metrics);
  assert.ok(s.sections.length >= 3);
  assert.ok(s.chiffres.includes(69.8));
  assert.ok(s.chiffres.includes(66));
  assert.ok(s.verdict.length > 0);
});

test('buildSkeleton mentionne la cassure quand elle a lieu', () => {
  const s = buildSkeleton(metrics);
  const texte = s.sections.map((x) => x.texte).join(' ');
  assert.match(texte, /cassure|franchi/i);
});

test('assertNoForeignNumber accepte un texte n’utilisant que la whitelist', () => {
  assert.equal(assertNoForeignNumber('Le RSI atteint 69.8 et le cours 66 FCFA.', [69.8, 66]), true);
});

test('assertNoForeignNumber REJETTE un nombre inventé', () => {
  assert.equal(assertNoForeignNumber('Objectif à 120 FCFA.', [69.8, 66]), false);
});

test('assertNoForeignNumber tolère un arrondi proche', () => {
  assert.equal(assertNoForeignNumber('RSI de 70 environ.', [69.8]), true);
});
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL (module absent).

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/hebdo/narrative.ts
/**
 * Narratif d'une valeur : squelette 100 % déterministe (chaque phrase dérive
 * d'une métrique) + garde-fou qui empêche toute reformulation LLM d'introduire
 * un chiffre absent des données. Règle §5 : rien d'inventé.
 */
import type { HebdoMetrics } from './types';

export interface Skeleton {
  sections: { titre: string; texte: string }[];
  /** TOUS les nombres autorisés dans la reformulation (whitelist du garde-fou). */
  chiffres: number[];
  verdict: string;
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)} %`;

export function buildSkeleton(m: HebdoMetrics): Skeleton {
  const sections: { titre: string; texte: string }[] = [];
  const chiffres: number[] = [m.dernier];

  // 1. Séance / semaine
  let s1 = `${m.code} termine la semaine à ${m.dernier} FCFA`;
  if (m.variationHebdo != null) {
    s1 += `, soit ${pct(m.variationHebdo)} sur la période`;
    chiffres.push(Math.abs(Math.round(m.variationHebdo * 100) / 100));
  }
  if (m.ratioVolume != null) {
    s1 += `, avec un volume ${m.ratioVolume.toFixed(1)}× la moyenne des 20 séances`;
    chiffres.push(Math.round(m.ratioVolume * 10) / 10);
  }
  sections.push({ titre: 'La semaine en un coup d’œil', texte: `${s1}.` });

  // 2. Momentum (RSI + MACD)
  if (m.rsiDernier != null) {
    chiffres.push(Math.round(m.rsiDernier * 10) / 10);
    const zone = m.rsiDernier > 70 ? 'en zone de surachat' : m.rsiDernier < 30 ? 'en zone de survente' : 'en zone neutre';
    const macd = m.macdPositif == null ? '' : m.macdPositif
      ? ' Le MACD est positif, ce qui soutient la dynamique en cours.'
      : ' Le MACD est négatif, ce qui pèse sur la dynamique.';
    sections.push({
      titre: 'Momentum',
      texte: `Le RSI(14) s’établit à ${m.rsiDernier.toFixed(1)}, ${zone}.${macd}`,
    });
  }

  // 3. Niveaux et cassure
  if (m.levels) {
    const l = m.levels;
    chiffres.push(l.resistance, l.support, l.objectif1, l.objectif2, l.invalidation);
    const etat = l.cassureHaut
      ? `Le cours a franchi la résistance des ${l.resistance} FCFA`
      : l.cassureBas
        ? `Le cours a rompu le support des ${l.support} FCFA`
        : `Le cours évolue entre ${l.support} et ${l.resistance} FCFA`;
    sections.push({
      titre: 'Niveaux à surveiller',
      texte: `${etat}. Support : ${l.support} FCFA. Premier objectif : ${l.objectif1} FCFA, second : ${l.objectif2} FCFA. Invalidation sous ${l.invalidation} FCFA.`,
    });
  }

  const verdict = m.variationHebdo != null && m.variationHebdo >= 0
    ? 'Dynamique haussière sur la semaine'
    : 'Repli sur la semaine';

  return { sections, chiffres: [...new Set(chiffres.map((x) => Math.round(x * 100) / 100))], verdict };
}

/**
 * Garde-fou : tout nombre présent dans `texte` doit figurer dans `chiffres`
 * (tolérance d'arrondi 1 %). Retourne false si le LLM a inventé une valeur.
 */
export function assertNoForeignNumber(texte: string, chiffres: number[]): boolean {
  const trouves = (texte.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
  return trouves.every((n) =>
    chiffres.some((c) => Math.abs(c - n) <= Math.max(0.5, Math.abs(c) * 0.01)),
  );
}
```

- [ ] **Step 4 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 14/14 verts. `npx tsc --noEmit`.

- [ ] **Step 5 : Commit** — `git add frontend/lib/hebdo/narrative.ts frontend/lib/hebdo/hebdo.test.mjs && git commit -m "feat(hebdo): squelette narratif deterministe + garde-fou anti-invention"`

---

### Task 5 : `polish.ts` — reformulation LLM contrainte (scraper)

**Files:** Create `scraper/src/hebdo/polish.ts`

- [ ] **Step 1 : Implémenter**

```ts
// scraper/src/hebdo/polish.ts
/**
 * Reformulation LLM des sections du squelette : rend le texte fluide SANS
 * ajouter le moindre fait. Toute sortie contenant un chiffre absent de la
 * whitelist est REJETÉE → on retombe sur le squelette brut (jamais d'invention).
 */
import { logger } from '../logger.js';

export interface SkeletonSection { titre: string; texte: string }

const ORDER: { provider: string; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
];

/** Même règle que frontend/lib/hebdo/narrative.ts (dupliquée : paquets séparés). */
function assertNoForeignNumber(texte: string, chiffres: number[]): boolean {
  const trouves = (texte.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
  return trouves.every((n) =>
    chiffres.some((c) => Math.abs(c - n) <= Math.max(0.5, Math.abs(c) * 0.01)),
  );
}

/**
 * @param resolveKey fonction fournie par l'appelant pour obtenir une clé
 *   (permet de tester sans réseau et de réutiliser le stockage api_keys).
 */
export async function polishNarrative(
  sections: SkeletonSection[],
  chiffres: number[],
  resolveKey: (provider: string) => Promise<string | null>,
): Promise<SkeletonSection[]> {
  const brut = sections.map((s) => `## ${s.titre}\n${s.texte}`).join('\n\n');
  const prompt =
    `Reformule ce commentaire boursier en français pour le rendre fluide et professionnel.\n` +
    `RÈGLES ABSOLUES : n'ajoute AUCUN chiffre, AUCUN fait, AUCune prévision. ` +
    `N'utilise que ces valeurs numériques : ${chiffres.join(', ')}. ` +
    `Conserve exactement les mêmes titres de section (lignes commençant par ##).\n\n${brut}`;

  for (const p of ORDER) {
    const key = await resolveKey(p.provider);
    if (!key) continue;
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const out = json.choices?.[0]?.message?.content ?? '';
      if (!out) continue;

      if (!assertNoForeignNumber(out, chiffres)) {
        logger.warn({ provider: p.provider }, 'hebdo : reformulation rejetée (chiffre étranger) — squelette conservé');
        continue;
      }
      // Redécoupe par titres ## ; si le découpage ne correspond pas, on garde le brut.
      const blocs = out.split(/^##\s+/m).map((b) => b.trim()).filter(Boolean);
      if (blocs.length !== sections.length) continue;
      return blocs.map((b, i) => {
        const nl = b.indexOf('\n');
        return { titre: sections[i]!.titre, texte: (nl >= 0 ? b.slice(nl + 1) : b).trim() };
      });
    } catch (e) {
      logger.warn({ provider: p.provider, err: String(e) }, 'hebdo : provider LLM indisponible');
    }
  }
  return sections; // fallback honnête
}
```

- [ ] **Step 2 : Vérifier** — `cd scraper && npx tsc --noEmit` → 0 erreur.

- [ ] **Step 3 : Commit** — `git add scraper/src/hebdo/polish.ts && git commit -m "feat(hebdo): reformulation LLM contrainte, rejet de tout chiffre etranger"`

---

### Task 6 : `runHebdo.ts` + CLI + scripts npm

**Files:** Create `scraper/src/hebdo/runHebdo.ts`; Modify `scraper/src/index.ts`, `scraper/package.json`

- [ ] **Step 1 : Implémenter l'orchestration**

```ts
// scraper/src/hebdo/runHebdo.ts
/**
 * Édition hebdomadaire : sélectionne les valeurs notables de la semaine, fige
 * un snapshot de leurs métriques, génère le narratif, PUBLIE l'édition et
 * envoie une alerte (l'admin peut réviser/dépublier ensuite).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { dispatch } from '../alerts/channels.js';
import { polishNarrative } from './polish.js';
import { selectHebdo } from '../../../frontend/lib/hebdo/select.js';
import { buildSkeleton } from '../../../frontend/lib/hebdo/narrative.js';
import { computeLevels } from '../../../frontend/lib/hebdo/levels.js';
import { rsiSeries, macdSeries } from '../../../frontend/lib/indicators.js';

export interface HebdoRunResult {
  status: 'success' | 'mock' | 'failed';
  date_edition: string | null;
  nb_items: number;
}

const PAGE = 1000;
const HISTO = 60; // séances chargées par titre (assez pour RSI/MACD/canal)

export async function runHebdo(opts: { mock?: boolean } = {}): Promise<HebdoRunResult> {
  if (opts.mock) {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
    const picks = selectHebdo([
      { code: 'AAAA', closes, variationHebdo: 6, volume: 3000, avgVolume20: 1000 },
      { code: 'BBBB', closes, variationHebdo: 4, volume: 1500, avgVolume20: 1000 },
      { code: 'ZZZZ', closes: [...closes].reverse(), variationHebdo: -5, volume: 2200, avgVolume20: 1000 },
    ]);
    logger.info({ picks }, '[mock] hebdo');
    return { status: 'mock', date_edition: null, nb_items: picks.length };
  }

  const sb = getSupabase();

  // 1) Dernières séances (paginées : PostgREST plafonne à 1000 lignes/réponse).
  const rows: { code: string; date_marche: string; cours_jour: number | null; volume: number | null }[] = [];
  for (let off = 0; off < 4000; off += PAGE) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour, volume')
      .order('date_marche', { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  const dates = [...new Set(rows.map((r) => r.date_marche))].sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return { status: 'failed', date_edition: null, nb_items: 0 };
  const dateEdition = dates[0]!;
  const semaine = dates.slice(0, 5); // 5 dernières séances = la semaine

  // 2) Séries par code (chronologiques).
  const byCode = new Map<string, { date: string; close: number; volume: number | null }[]>();
  for (const r of rows) {
    if (r.cours_jour == null) continue;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push({ date: r.date_marche, close: r.cours_jour, volume: r.volume });
  }
  for (const [, list] of byCode) list.sort((a, b) => a.date.localeCompare(b.date));

  // 3) Candidats.
  const candidats = [...byCode.entries()].map(([code, list]) => {
    const serie = list.slice(-HISTO);
    const closes = serie.map((x) => x.close);
    const debutSemaine = serie.find((x) => x.date === semaine[semaine.length - 1])?.close ?? closes[0]!;
    const dernier = closes[closes.length - 1]!;
    const variationHebdo = debutSemaine > 0 ? ((dernier - debutSemaine) / debutSemaine) * 100 : null;
    const vols = serie.slice(-20).map((x) => x.volume ?? 0);
    const avgVolume20 = vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
    return { code, closes, variationHebdo, volume: serie[serie.length - 1]?.volume ?? null, avgVolume20 };
  });

  const picks = selectHebdo(candidats);
  if (picks.length === 0) {
    logger.warn('hebdo : aucune valeur retenue');
    return { status: 'failed', date_edition: dateEdition, nb_items: 0 };
  }

  // 4) Édition publiée.
  const { data: ed, error: eEd } = await sb
    .from('hebdo_editions')
    .upsert({ date_edition: dateEdition, statut: 'publie', auto: true, published_at: new Date().toISOString() }, { onConflict: 'date_edition' })
    .select('id')
    .single();
  if (eEd) throw eEd;

  // 5) Items (snapshot + narratif).
  const { resolveApiKeyForScraper } = await import('./apiKey.js');
  let ordre = 0;
  for (const p of picks) {
    const serie = (byCode.get(p.code) ?? []).slice(-HISTO);
    const closes = serie.map((x) => x.close);
    const c = candidats.find((x) => x.code === p.code)!;
    const macd = macdSeries(closes);
    const metrics = {
      code: p.code,
      dates: serie.map((x) => x.date),
      closes,
      rsi: rsiSeries(closes, 14),
      dernier: closes[closes.length - 1]!,
      variationHebdo: c.variationHebdo,
      volume: c.volume,
      ratioVolume: c.avgVolume20 && c.avgVolume20 > 0 && c.volume != null ? c.volume / c.avgVolume20 : null,
      rsiDernier: rsiSeries(closes, 14).at(-1) ?? null,
      macdPositif: (macd.histogram.at(-1) ?? null) == null ? null : (macd.histogram.at(-1)! > 0),
      levels: computeLevels(closes),
    };
    const sk = buildSkeleton(metrics);
    const sections = await polishNarrative(sk.sections, sk.chiffres, resolveApiKeyForScraper);
    const narratif = sections.map((s) => `## ${s.titre}\n\n${s.texte}`).join('\n\n');

    const { error: eIt } = await sb.from('hebdo_items').upsert(
      { edition_id: ed.id, code: p.code, sens: p.sens, raison: p.raison, metrics, narratif_md: narratif, ordre: ordre++ },
      { onConflict: 'edition_id,code' },
    );
    if (eIt) throw eIt;
  }

  const lien = `https://www.westbourse.com/analyses/hebdo/${dateEdition}`;
  await dispatch({
    subject: `Édition hebdo publiée — ${picks.length} valeurs`,
    body: `L'analyse hebdomadaire du ${dateEdition} est en ligne : ${lien}\nValeurs : ${picks.map((p) => p.code).join(', ')}\nRévisez ou dépubliez depuis /admin/hebdo si nécessaire.`,
    code: null,
    to: null,
  });

  logger.info({ date: dateEdition, items: picks.length }, 'hebdo publiée');
  return { status: 'success', date_edition: dateEdition, nb_items: picks.length };
}
```

- [ ] **Step 2 : Créer le pont de clé LLM côté scraper**

```ts
// scraper/src/hebdo/apiKey.ts
/**
 * Résolution d'une clé LLM côté scraper : table api_keys (comme le frontend),
 * avec repli sur les variables d'environnement.
 */
import { getSupabase } from '../persistence/supabase.js';

export async function resolveApiKeyForScraper(provider: string): Promise<string | null> {
  const env = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (env) return env;
  try {
    const { data } = await getSupabase()
      .from('api_keys')
      .select('key_value')
      .eq('provider', provider)
      .limit(1)
      .maybeSingle();
    return (data as { key_value?: string } | null)?.key_value ?? null;
  } catch {
    return null;
  }
}
```

Vérifier le nom réel des colonnes de `api_keys` (`grep -n "api_keys" -A 10 supabase/migrations/*.sql | head -30`) et adapter `provider`/`key_value` si nécessaire.

- [ ] **Step 3 : Câbler le CLI** — dans `scraper/src/index.ts`, après le bloc `case 'score': { … }` :

```ts
    case 'hebdo': {
      const { runHebdo } = await import('./hebdo/runHebdo.js');
      const res = await monitored(
        { code: 'hebdo', label: 'Analyse hebdo' },
        async () => {
          const r = await runHebdo({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.nb_items,
              rows_upserted: r.nb_items,
              metadata: { date_edition: r.date_edition, nb_items: r.nb_items },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

- [ ] **Step 4 : Scripts npm** — dans `scraper/package.json` :

```json
    "hebdo": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts hebdo",
    "hebdo:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts hebdo --mock",
```

- [ ] **Step 5 : Vérifier** — `cd scraper && npx tsx src/index.ts hebdo --mock` → log `[mock] hebdo` avec 3 picks, exit 0. Puis `npm run typecheck` et `npm test` (aucune régression).

> Si l'import cross-package `../../../frontend/lib/...` échoue au typecheck (rootDir), copier les 3 modules purs sous `scraper/src/hebdo/pure/` et importer localement — les fonctions restent identiques et testées côté frontend. Choisir cette option dès la première erreur plutôt que d'assouplir `tsconfig`.

- [ ] **Step 6 : Commit** — `git add scraper/src/hebdo scraper/src/index.ts scraper/package.json && git commit -m "feat(hebdo): worker — selection, snapshot, narratif, publication + alerte"`

---

### Task 7 : Cron hebdomadaire

**Files:** Create `.github/workflows/hebdo.yml`

- [ ] **Step 1 : Écrire le workflow**

```yaml
name: Analyse hebdo

env:
  SCRAPER_TRIGGER: ${{ github.event_name == 'schedule' && 'cron' || 'manual' }}

on:
  schedule:
    # Samedi 06:00 UTC : la séance de vendredi et le scoring sont passés.
    - cron: '0 6 * * 6'
  workflow_dispatch: {}

concurrency:
  group: hebdo
  cancel-in-progress: false

jobs:
  hebdo:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install
      - name: Run hebdo
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ALERTS_EMAIL_FROM: ${{ secrets.ALERTS_EMAIL_FROM }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          LOG_LEVEL: info
        run: npm run hebdo
```

- [ ] **Step 2 : Valider le YAML** — `cd scraper && node -e "require('js-yaml').load(require('fs').readFileSync('../.github/workflows/hebdo.yml','utf8'));console.log('YAML OK')"`

- [ ] **Step 3 : Commit** — `git add .github/workflows/hebdo.yml && git commit -m "ci: cron analyse hebdo samedi 06:00 UTC"`

---

### Task 8 : Page publique — index + édition + graphe

**Files:** Create `frontend/components/hebdo/HebdoChart.tsx`, `frontend/app/analyses/hebdo/page.tsx`, `frontend/app/analyses/hebdo/[date]/page.tsx`

- [ ] **Step 1 : Graphe cours + RSI**

```tsx
// frontend/components/hebdo/HebdoChart.tsx
'use client';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface Props {
  dates: string[];
  closes: number[];
  rsi: (number | null)[];
  resistance: number | null;
  support: number | null;
}

/** Cours (aire) + RSI(14) en sous-graphe, avec les niveaux réels en repères. */
export default function HebdoChart({ dates, closes, rsi, resistance, support }: Props) {
  const data = dates.map((d, i) => ({ date: d.slice(5), close: closes[i] ?? null, rsi: rsi[i] ?? null }));
  const tip = {
    contentStyle: { background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#e5e7eb' },
  };
  return (
    <div className="space-y-2">
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid stroke="#1a2a30" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#7a9ea8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#7a9ea8', fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip {...tip} formatter={(v: number) => [`${v} FCFA`, 'Cours']} />
            {resistance != null && (
              <ReferenceLine y={resistance} stroke="#e8b54d" strokeDasharray="6 4"
                label={{ value: `Résistance ${resistance}`, fill: '#e8b54d', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {support != null && (
              <ReferenceLine y={support} stroke="#7a9ea8" strokeDasharray="4 4"
                label={{ value: `Support ${support}`, fill: '#7a9ea8', fontSize: 11, position: 'insideBottomLeft' }} />
            )}
            <Area dataKey="close" stroke="#56D7FD" fill="#56D7FD" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke="#1a2a30" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} ticks={[30, 70]} tick={{ fill: '#7a9ea8', fontSize: 10 }} />
            <Tooltip {...tip} formatter={(v: number) => [v?.toFixed?.(1) ?? v, 'RSI']} />
            <ReferenceLine y={70} stroke="#ff6b6b" strokeDasharray="4 4" />
            <ReferenceLine y={30} stroke="#3fe18b" strokeDasharray="4 4" />
            <Line dataKey="rsi" stroke="#3fe18b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Page d'une édition**

```tsx
// frontend/app/analyses/hebdo/[date]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import HebdoChart from '@/components/hebdo/HebdoChart';
import type { HebdoMetrics } from '@/lib/hebdo/types';

export const dynamic = 'force-dynamic';

interface Item { code: string; sens: string; raison: string; metrics: HebdoMetrics; narratif_md: string; ordre: number }

async function load(date: string) {
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id, date_edition').eq('date_edition', date).maybeSingle();
  if (!ed) return null;
  const { data: items } = await db
    .from('hebdo_items')
    .select('code, sens, raison, metrics, narratif_md, ordre')
    .eq('edition_id', (ed as { id: string }).id)
    .order('ordre');
  return { date: (ed as { date_edition: string }).date_edition, items: (items ?? []) as Item[] };
}

export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
  const e = await load(params.date);
  if (!e) return { title: 'Édition introuvable' };
  const codes = e.items.map((i) => i.code).join(', ');
  return {
    title: `Analyse hebdo BRVM du ${e.date} — ${codes}`,
    description: `Analyse technique des valeurs en vue de la semaine : ${codes}. Cours, RSI, niveaux à surveiller.`,
  };
}

export default async function HebdoEditionPage({ params }: { params: { date: string } }) {
  const e = await load(params.date);
  if (!e) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <Link href="/analyses/hebdo" className="text-sm text-muted hover:text-white">← Toutes les éditions</Link>
      <SectionHeader
        kicker="Analyse hebdomadaire"
        title={`Les valeurs en vue — semaine du ${e.date}`}
        subtitle="Analyse technique sur données réelles de la BRVM : cours de clôture, RSI(14), niveaux de support et de résistance."
      />

      {e.items.map((it) => {
        const m = it.metrics;
        return (
          <PremiumPanel key={it.code} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl text-white">
                {it.code}{' '}
                <span className={`text-sm ${it.sens === 'hausse' ? 'text-up' : 'text-down'}`}>
                  {m.variationHebdo != null ? `${m.variationHebdo >= 0 ? '+' : ''}${m.variationHebdo.toFixed(2)} %` : ''}
                </span>
              </h2>
              <span className="tabular text-sm text-muted">{m.dernier} FCFA</span>
            </div>
            <p className="text-xs text-faint">{it.raison}</p>

            <HebdoChart
              dates={m.dates} closes={m.closes} rsi={m.rsi}
              resistance={m.levels?.resistance ?? null} support={m.levels?.support ?? null}
            />

            <div className="space-y-3">
              {it.narratif_md.split(/^##\s+/m).filter(Boolean).map((bloc, i) => {
                const nl = bloc.indexOf('\n');
                const titre = nl >= 0 ? bloc.slice(0, nl).trim() : bloc;
                const texte = nl >= 0 ? bloc.slice(nl + 1).trim() : '';
                return (
                  <div key={i}>
                    <h3 className="text-sm font-semibold text-ivory">{titre}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{texte}</p>
                  </div>
                );
              })}
            </div>

            <a href={`/api/hebdo/${e.date}/image?code=${it.code}`} download
              className="inline-block rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-white">
              ⤓ Télécharger l’image
            </a>
          </PremiumPanel>
        );
      })}

      <PremiumPanel>
        <h2 className="text-sm font-semibold text-ivory">Lexique</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <strong>RSI (Relative Strength Index)</strong> : mesure de 0 à 100 si un titre a été acheté
          ou vendu trop vite récemment. Au-dessus de 70 on parle de surachat, en dessous de 30 de
          survente. <strong>MACD</strong> : compare deux moyennes de prix de vitesses différentes pour
          détecter un changement de dynamique ; positif, il accompagne une tendance haussière.
          <strong> Support / résistance</strong> : bornes basse et haute des 20 dernières séances.
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Analyse technique produite automatiquement à partir des cours de clôture réels de la BRVM.
          Contenu fourni à titre informatif et pédagogique : il ne constitue pas un conseil en
          investissement.
        </p>
      </PremiumPanel>
    </div>
  );
}
```

- [ ] **Step 3 : Index des éditions**

```tsx
// frontend/app/analyses/hebdo/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Analyses hebdomadaires BRVM — valeurs en vue',
  description: 'Chaque semaine, l’analyse technique des valeurs BRVM les plus actives : cours, RSI, niveaux à surveiller.',
};

export default async function HebdoIndexPage() {
  const db = createPublicClient();
  const { data } = await db
    .from('hebdo_editions')
    .select('date_edition')
    .order('date_edition', { ascending: false })
    .limit(52);
  const editions = (data ?? []) as { date_edition: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <SectionHeader
        kicker="Analyses"
        title="Analyses hebdomadaires"
        subtitle="Les valeurs BRVM en vue chaque semaine, en hausse comme en baisse."
      />
      {editions.length === 0 ? (
        <EmptyStatePremium title="Pas encore d’édition" hint="La première analyse hebdomadaire paraîtra samedi prochain." />
      ) : (
        <PremiumPanel>
          <ul className="divide-y divide-border/40">
            {editions.map((e) => (
              <li key={e.date_edition}>
                <Link href={`/analyses/hebdo/${e.date_edition}`}
                  className="flex items-center justify-between py-3 text-sm text-ivory transition-colors hover:text-accent">
                  <span>Semaine du {e.date_edition}</span>
                  <span aria-hidden className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </PremiumPanel>
      )}
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier** — `cd frontend && npx tsc --noEmit` (0 erreur). Vérifier que `EmptyStatePremium` accepte `title`/`hint` (`grep -n "export function EmptyStatePremium" -A 10 components/ui/premium.tsx`) et adapter sinon.

- [ ] **Step 5 : Commit** — `git add frontend/components/hebdo frontend/app/analyses/hebdo && git commit -m "feat(hebdo): pages publiques — index, edition, graphe cours+RSI, lexique"`

---

### Task 9 : Image OG + PNG haute-résolution

**Files:** Create `frontend/app/analyses/hebdo/[date]/opengraph-image.tsx`, `frontend/app/api/hebdo/[date]/image/route.tsx`

- [ ] **Step 1 : Helper de rendu partagé**

```tsx
// frontend/lib/hebdo/card.tsx
import type { ReactElement } from 'react';

export interface CardData {
  code: string;
  dernier: number;
  variation: number | null;
  rsi: number | null;
  date: string;
  closes: number[];
}

/** Sparkline SVG des clôtures RÉELLES (aucune donnée inventée). */
function sparkPath(closes: number[], w: number, h: number): string {
  if (closes.length < 2) return '';
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || 1;
  return closes
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${(i / (closes.length - 1)) * w} ${h - ((c - min) / span) * h}`)
    .join(' ');
}

/** Carte partagée par l'OG (1200×630) et le PNG haute-rés (2400×1260). */
export function HebdoCard({ d, scale }: { d: CardData; scale: number }): ReactElement {
  const w = 1200 * scale, h = 630 * scale;
  const up = (d.variation ?? 0) >= 0;
  return (
    <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#030303', color: '#FCFCFC', padding: 64 * scale }}>
      <div style={{ color: '#56D7FD', fontSize: 24 * scale, letterSpacing: 4 }}>WESTBOURSE · ANALYSE HEBDO</div>
      <div style={{ fontSize: 84 * scale, fontWeight: 700, marginTop: 16 * scale }}>{d.code}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 * scale, marginTop: 8 * scale }}>
        <span style={{ fontSize: 52 * scale }}>{d.dernier} FCFA</span>
        {d.variation != null && (
          <span style={{ fontSize: 40 * scale, color: up ? '#3fe18b' : '#ff6b6b' }}>
            {up ? '+' : ''}{d.variation.toFixed(2)} %
          </span>
        )}
      </div>
      {d.rsi != null && <div style={{ fontSize: 28 * scale, color: '#7a9ea8', marginTop: 8 * scale }}>RSI(14) : {d.rsi.toFixed(1)}</div>}
      <svg width={1000 * scale} height={160 * scale} style={{ marginTop: 24 * scale }}>
        <path d={sparkPath(d.closes, 1000 * scale, 160 * scale)} fill="none" stroke="#56D7FD" strokeWidth={4 * scale} />
      </svg>
      <div style={{ fontSize: 22 * scale, color: '#7a9ea8', marginTop: 16 * scale }}>Semaine du {d.date} · données réelles BRVM</div>
    </div>
  );
}
```

- [ ] **Step 2 : OG image de l'édition**

```tsx
// frontend/app/analyses/hebdo/[date]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';
import { HebdoCard } from '@/lib/hebdo/card';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { date: string } }) {
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id').eq('date_edition', params.date).maybeSingle();
  const { data: items } = ed
    ? await db.from('hebdo_items').select('code, metrics').eq('edition_id', (ed as { id: string }).id).order('ordre').limit(1)
    : { data: [] };
  const it = (items ?? [])[0] as { code: string; metrics: { dernier: number; variationHebdo: number | null; rsiDernier: number | null; closes: number[] } } | undefined;
  const d = {
    code: it?.code ?? 'BRVM',
    dernier: it?.metrics.dernier ?? 0,
    variation: it?.metrics.variationHebdo ?? null,
    rsi: it?.metrics.rsiDernier ?? null,
    date: params.date,
    closes: it?.metrics.closes?.slice(-40) ?? [],
  };
  return new ImageResponse(<HebdoCard d={d} scale={1} />, { ...size });
}
```

- [ ] **Step 3 : PNG haute-résolution téléchargeable**

```tsx
// frontend/app/api/hebdo/[date]/image/route.tsx
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { HebdoCard } from '@/lib/hebdo/card';

export const runtime = 'edge';

/** PNG 2400×1260 d'une valeur de l'édition. GET /api/hebdo/2026-07-21/image?code=ETIT */
export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const code = (new URL(req.url).searchParams.get('code') ?? '').toUpperCase().slice(0, 8);
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id').eq('date_edition', params.date).maybeSingle();
  if (!ed) return new Response('Introuvable', { status: 404 });
  let q = db.from('hebdo_items').select('code, metrics').eq('edition_id', (ed as { id: string }).id).order('ordre').limit(1);
  if (code) q = db.from('hebdo_items').select('code, metrics').eq('edition_id', (ed as { id: string }).id).eq('code', code).limit(1);
  const { data: items } = await q;
  const it = (items ?? [])[0] as { code: string; metrics: { dernier: number; variationHebdo: number | null; rsiDernier: number | null; closes: number[] } } | undefined;
  if (!it) return new Response('Introuvable', { status: 404 });
  const d = {
    code: it.code, dernier: it.metrics.dernier, variation: it.metrics.variationHebdo,
    rsi: it.metrics.rsiDernier, date: params.date, closes: it.metrics.closes?.slice(-40) ?? [],
  };
  return new ImageResponse(<HebdoCard d={d} scale={2} />, { width: 2400, height: 1260 });
}
```

- [ ] **Step 4 : Vérifier** — `npx tsc --noEmit` (0 erreur). En dev, ouvrir `/api/hebdo/<date>/image?code=<CODE>` → PNG.

- [ ] **Step 5 : Commit** — `git add frontend/lib/hebdo/card.tsx "frontend/app/analyses/hebdo/[date]/opengraph-image.tsx" "frontend/app/api/hebdo" && git commit -m "feat(hebdo): image OG + PNG haute-res partageable (sparkline reelle)"`

---

### Task 10 : Admin — révision & dépublication

**Files:** Create `frontend/app/admin/hebdo/page.tsx`, `frontend/app/api/admin/hebdo/[id]/route.ts`; Modify `frontend/lib/admin-nav.ts`, `frontend/lib/nav.ts`

- [ ] **Step 1 : Route publier/dépublier**

```ts
// frontend/app/api/admin/hebdo/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requirePermission('content.publish');
  const body = (await req.json()) as { statut?: 'brouillon' | 'publie' };
  if (body.statut !== 'brouillon' && body.statut !== 'publie') {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }
  const svc = getServiceClient();
  const { error } = await svc
    .from('hebdo_editions')
    .update({ statut: body.statut, published_at: body.statut === 'publie' ? new Date().toISOString() : null })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Échec' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2 : Page admin**

```tsx
// frontend/app/admin/hebdo/page.tsx
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

export default async function AdminHebdoPage() {
  await requirePermission('content.publish');
  const svc = getServiceClient();
  const { data } = await svc
    .from('hebdo_editions')
    .select('id, date_edition, statut, auto, published_at')
    .order('date_edition', { ascending: false })
    .limit(30);
  const editions = (data ?? []) as { id: string; date_edition: string; statut: string; auto: boolean }[];

  return (
    <div className="space-y-4 p-6">
      <h1 className="font-display text-xl text-white">Analyses hebdomadaires</h1>
      <p className="text-sm text-muted">
        Les éditions sont publiées automatiquement chaque samedi. Vous pouvez en dépublier une si
        elle doit être corrigée.
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
            <th className="px-3 py-2">Semaine</th><th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2">Origine</th><th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {editions.map((e) => (
            <tr key={e.id} className="border-b border-border/40">
              <td className="px-3 py-2 text-ivory">
                <Link href={`/analyses/hebdo/${e.date_edition}`} className="hover:text-accent">{e.date_edition}</Link>
              </td>
              <td className="px-3 py-2">
                <span className={e.statut === 'publie' ? 'text-up' : 'text-faint'}>{e.statut}</span>
              </td>
              <td className="px-3 py-2 text-muted">{e.auto ? 'auto' : 'manuel'}</td>
              <td className="px-3 py-2">
                <form action={`/api/admin/hebdo/${e.id}`} method="post">
                  <span className="text-[11px] text-faint">
                    PATCH {`{"statut":"${e.statut === 'publie' ? 'brouillon' : 'publie'}"}`}
                  </span>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editions.length === 0 && <p className="text-sm text-faint">Aucune édition pour le moment.</p>}
    </div>
  );
}
```

> Le bouton d'action est volontairement minimal (la route PATCH fait le travail).
> Si le repo a déjà un composant de bouton d'action admin (chercher un bouton
> « Confirmer »/« Rejeter » dans `app/admin/payments/`), le réutiliser ici pour
> garder l'UX cohérente ; sinon garder cet affichage.

- [ ] **Step 3 : Nav** — dans `frontend/lib/admin-nav.ts`, ajouter une entrée `{ href: '/admin/hebdo', label: 'Analyses hebdo' }` au groupe contenu ; dans `frontend/lib/nav.ts`, ajouter `{ href: '/analyses/hebdo', label: 'Analyses hebdo' }` au groupe **Intelligence** (à côté d'« Actualités & Veille »).

- [ ] **Step 4 : Vérifier** — `npx tsc --noEmit`, puis `npm run build` (attendre la fin) → « Compiled successfully ».

- [ ] **Step 5 : Commit** — `git add frontend/app/admin/hebdo "frontend/app/api/admin/hebdo" frontend/lib/admin-nav.ts frontend/lib/nav.ts && git commit -m "feat(hebdo): console admin (depublier) + entrees de navigation"`

---

### Task 11 : Vérifications finales

- [ ] **Step 1 : Tests & types** — `cd frontend && npx tsx --test lib/hebdo/hebdo.test.mjs && npx tsc --noEmit && npm run build` → tout vert. `cd ../scraper && npm test && npm run typecheck`.
- [ ] **Step 2 : RLS** — rejouer les sondes anon de la Task 1 Step 3 ; vérifier qu'une édition en `brouillon` n'est **pas** lisible en anon (créer une ligne brouillon via service_role, tenter la lecture anon → absente), puis la repasser en `publie`.
- [ ] **Step 3 : Bout en bout** — `cd scraper && npm run hebdo` (réel) → édition publiée + alerte reçue ; ouvrir `/analyses/hebdo`, l'édition, vérifier graphe + narratif + PNG téléchargeable ; dépublier depuis `/admin/hebdo` → la page publique renvoie 404.
- [ ] **Step 4 : Docs & push** —

```bash
git add CLAUDE.md docs/superpowers/plans/2026-07-22-analyse-hebdo-valeurs.md
git commit -m "docs: analyse hebdo executee, etat CLAUDE.md"
git push
```

Ajouter à `CLAUDE.md` §8 : « Analyse hebdo (0113, lib/hebdo purs + scraper/src/hebdo, cron samedi, /analyses/hebdo, admin /admin/hebdo) ».

---

## Self-review (fait à la rédaction)

- **Couverture spec** : honnêteté des données §1 → Tasks 2/4/9 (sparkline et niveaux issus des closes réels) ; sélection §2 → Task 3 ; narratif hybride §3 → Tasks 4 (squelette + garde-fou) et 5 (LLM) ; stockage §4 → Task 1 ; worker/cron/alerte §5 → Tasks 6-7 ; publication/partage §6 → Tasks 8-9 ; admin §5 → Task 10 ; tests §7 → Tasks 2-4 et 11.
- **Placeholders** : aucun TBD. Trois points « à vérifier au réel » explicitement bornés avec l'action à faire : colonnes de `api_keys` (Task 6 Step 2), import cross-package et son repli (Task 6 Step 5), props d'`EmptyStatePremium` (Task 8 Step 4) et bouton admin réutilisable (Task 10 Step 2).
- **Cohérence de types** : `Levels` (Tasks 2, 3, 4) · `HebdoCandidate`/`HebdoPick`/`HebdoMetrics` (Tasks 3, 6, 8) · `Skeleton`/`SkeletonSection` + `assertNoForeignNumber` (Tasks 4, 5) · `CardData`/`HebdoCard` (Task 9) · `hebdo_editions`/`hebdo_items` colonnes identiques entre Task 1, 6, 8, 9, 10.
- **Écart assumé** : `assertNoForeignNumber` est dupliqué entre `frontend/lib/hebdo/narrative.ts` et `scraper/src/hebdo/polish.ts` (paquets séparés, pas de module partagé dans ce repo). Documenté en commentaire dans les deux fichiers.
