# Liquidité v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un moteur unique de liquidité (présence, activité, Amihud, spread de Roll + flux acheteur/vendeur intraday) calculé chaque séance dans `liquidity_daily`, consommé par la fiche action, le screener, le scoring signaux et une page `/liquidite`.

**Architecture:** Module pur `scraper/src/liquidity/` (pattern `scoring/`) orchestré par un CLI `liquidity` cronné dans `score.yml`, qui upsert une table `liquidity_daily` (RLS lecture publique). Le frontend lit la table avec repli sur le calcul legacy `computeLiquidity` tant qu'elle est vide ; la pénalité du scoring signaux dérive du score v2 avec le même repli.

**Tech Stack:** TypeScript ESM (imports `.js`), vitest (scraper), zod non requis ici, Supabase PostgREST, Next.js 14 App Router, tests frontend `.test.mjs` via `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-07-19-liquidite-v2-design.md`

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0111_liquidity_daily.sql` | Table + RLS (créé) |
| `scraper/src/liquidity/compute.ts` | Score v2 pur : 4 composantes (créé) |
| `scraper/src/liquidity/flow.ts` | Flux achat/vente pur (tick rule) (créé) |
| `scraper/src/liquidity/runLiquidity.ts` | Orchestration + upsert (créé) |
| `scraper/tests/liquidity.test.ts` | Tests compute + flow (créé) |
| `scraper/src/index.ts` | CLI `case 'liquidity'` (modifié) |
| `scraper/package.json` | Scripts `liquidity[:mock]` (modifié) |
| `.github/workflows/score.yml` | Job `liquidity` après `score` (modifié) |
| `scraper/src/scoring/score.ts` | Pénalité dérivée du score v2 + fallback (modifié) |
| `scraper/src/scoring/runScoring.ts` | Lecture `liquidity_daily` (modifié) |
| `frontend/lib/liquidity.ts` | Types v2 partagés + `fromDailyRow` (modifié) |
| `frontend/lib/liquidity.test.mjs` | Tests fromDailyRow/fallback (créé) |
| `frontend/app/actions/[code]/page.tsx` | Fiche : lecture table + fallback (modifié) |
| `frontend/app/conseiller/page.tsx` | idem (modifié) |
| `frontend/components/screener/ScreenerClient.tsx` | idem côté client (modifié) |
| `frontend/components/LiquidityCard.tsx` | Sous-jauges + flux + coût Roll (modifié) |
| `frontend/app/liquidite/page.tsx` | Page classement marché (créé) |
| `frontend/lib/nav.ts` | Entrée nav Analyse (modifié) |

---

### Task 1 : Migration `0111_liquidity_daily`

**Files:**
- Create: `supabase/migrations/0111_liquidity_daily.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- 0111_liquidity_daily.sql
-- Liquidité v2 : score quotidien par titre reconstitué depuis les échanges.
-- Spec : docs/superpowers/specs/2026-07-19-liquidite-v2-design.md
-- Score 0-100 (presence, activite, Amihud, Roll) nullable si < 10 séances.
-- Flux achat/vente (tick rule sur brvm_intraday_snapshots) nullable si pas
-- de snapshots. Donnée de marché => lecture publique, écriture service_role.
-- ============================================================================

create table if not exists public.liquidity_daily (
  code                text not null,
  date_marche         date not null,
  score               integer check (score is null or (score >= 0 and score <= 100)),
  classe              text check (classe is null or classe in ('A','B','C','D')),
  presence_pct        numeric(6,2) not null default 0,
  activite            numeric(6,4) not null default 0,
  amihud              numeric(20,6),
  spread_roll_pct     numeric(8,4),
  valeur_moyenne_30j  numeric(20,2) not null default 0,
  seances_traitees    integer not null default 0,
  seances_marche      integer not null default 0,
  volume_achat        bigint,
  volume_vente        bigint,
  volume_neutre       bigint,
  flux_net_pct        numeric(6,2),
  engine_version      text not null default 'liq-v2.0.0',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (code, date_marche)
);

create index if not exists idx_liquidity_daily_date on public.liquidity_daily (date_marche desc);

alter table public.liquidity_daily enable row level security;

drop policy if exists "liquidity_daily_public_read" on public.liquidity_daily;
create policy "liquidity_daily_public_read"
  on public.liquidity_daily for select using (true);

revoke insert, update, delete on public.liquidity_daily from public, anon, authenticated;
```

- [ ] **Step 2 : Demander à l'utilisateur d'appliquer la migration** dans le SQL Editor Supabase (aucun DDL via REST). Ne pas continuer les tasks 4+ (écriture en base) avant son « ok ». Les tasks 2-3 (fonctions pures) peuvent avancer en attendant.

- [ ] **Step 3 : Vérifier RLS avec la clé anon** (après application) :

```bash
cd scraper && set -a && source .env.local && set +a
# Lecture anon : 200 attendu, tableau vide [].
curl -s "$SUPABASE_URL/rest/v1/liquidity_daily?select=code&limit=1" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
# Écriture anon : 401/403 attendu.
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/liquidity_daily" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"code":"X","date_marche":"2026-01-01"}'
```

Si `SUPABASE_ANON_KEY` absent de `scraper/.env.local`, prendre la clé anon dans `frontend/.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0111_liquidity_daily.sql
git commit -m "feat(db): table liquidity_daily — score de liquidite v2 quotidien (RLS lecture publique)"
```

---

### Task 2 : `compute.ts` — score v2 pur (TDD)

**Files:**
- Create: `scraper/src/liquidity/compute.ts`
- Test: `scraper/tests/liquidity.test.ts`

- [ ] **Step 1 : Écrire les tests (échouent : module absent)**

```ts
// scraper/tests/liquidity.test.ts
import { describe, it, expect } from 'vitest';
import { computeLiquidityV2, classifyLiquidity, type LiquiditySessionRow30 } from '../src/liquidity/compute.js';

/** n séances traitées identiques : cours 5000, variation 0.5 %, valeur `valeur` FCFA. */
function rows(n: number, valeur: number, variation = 0.5): LiquiditySessionRow30[] {
  return Array.from({ length: n }, (_, i) => ({
    date_marche: `2026-07-${String(i + 1).padStart(2, '0')}`,
    cours_jour: 5000, variation_pct: variation, volume: Math.round(valeur / 5000), valeur_echangee: valeur,
  }));
}

describe('computeLiquidityV2', () => {
  it('retourne score null sous 10 séances de marché', () => {
    const r = computeLiquidityV2(rows(5, 1_000_000), 5);
    expect(r.score).toBeNull();
    expect(r.classe).toBeNull();
    expect(r.seances_marche).toBe(5);
  });

  it('titre jamais traité → classe D, présence 0', () => {
    const vides: LiquiditySessionRow30[] = [];
    const r = computeLiquidityV2(vides, 30);
    expect(r.presence_pct).toBe(0);
    expect(r.score).not.toBeNull();
    expect(r.classe).toBe('D');
  });

  it('titre très actif (30/30 séances, 50 M/séance) score élevé, amihud faible', () => {
    const r = computeLiquidityV2(rows(30, 50_000_000), 30);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.amihud).not.toBeNull();
    expect(r.amihud!).toBeLessThan(1); // 0,5 % / 50 M FCFA = 0,01 %/M
  });

  it('amihud discrimine : même présence, gros impact prix → score plus bas', () => {
    const liquide = computeLiquidityV2(rows(30, 50_000_000, 0.2), 30);
    const illiquide = computeLiquidityV2(rows(30, 500_000, 5), 30); // 5 % de variation sur 500 k
    expect(illiquide.score!).toBeLessThan(liquide.score!);
    expect(illiquide.amihud!).toBeGreaterThan(liquide.amihud!);
  });

  it('Roll : série alternante → spread estimé > 0 ; tendance pure → null (composante neutre)', () => {
    const alternant = rows(30, 5_000_000).map((r, i) => ({ ...r, cours_jour: i % 2 === 0 ? 5000 : 5050 }));
    const tendance = rows(30, 5_000_000).map((r, i) => ({ ...r, cours_jour: 5000 + i * 10 }));
    const a = computeLiquidityV2(alternant, 30);
    const t = computeLiquidityV2(tendance, 30);
    expect(a.spread_roll_pct).not.toBeNull();
    expect(a.spread_roll_pct!).toBeGreaterThan(0);
    expect(t.spread_roll_pct).toBeNull();
  });
});

describe('classifyLiquidity', () => {
  it('seuils A/B/C/D', () => {
    expect(classifyLiquidity(75)).toBe('A');
    expect(classifyLiquidity(50)).toBe('B');
    expect(classifyLiquidity(25)).toBe('C');
    expect(classifyLiquidity(24)).toBe('D');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `cd scraper && npx vitest run tests/liquidity.test.ts` → FAIL (« Cannot find module '../src/liquidity/compute.js' »).

- [ ] **Step 3 : Implémenter `compute.ts`**

```ts
// scraper/src/liquidity/compute.ts
/**
 * Score de liquidité v2 — fonctions PURES (aucune I/O), testées.
 * 4 composantes à 25 % : présence, activité (valeur), impact prix (Amihud),
 * spread implicite (Roll). Spec : docs/superpowers/specs/2026-07-19-liquidite-v2-design.md
 * Le carnet d'ordres n'étant pas publié par la BRVM, la profondeur est ESTIMÉE
 * (Amihud) et le coût d'exécution ESTIMÉ (Roll) — jamais inventés.
 */

export interface LiquiditySessionRow30 {
  date_marche: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
  valeur_echangee: number | null;
}

export type LiquidityClass = 'A' | 'B' | 'C' | 'D';

export interface LiquidityV2Result {
  score: number | null;          // null si < MIN_SEANCES séances de marché
  classe: LiquidityClass | null;
  presence_pct: number;          // 0-100
  activite: number;              // 0-1 (échelle log valeur moyenne)
  amihud: number | null;         // %/M FCFA — null si aucune séance traitée
  spread_roll_pct: number | null;// % du cours — null si cov >= 0 (non estimable)
  valeur_moyenne_30j: number;    // FCFA / séance de marché
  seances_traitees: number;
  seances_marche: number;
}

export const ENGINE_VERSION = 'liq-v2.0.0';
const MIN_SEANCES = 10;
const LOG_FLOOR = 100_000;      // activité : 100 k FCFA/séance → 0
const LOG_CEIL = 100_000_000;   // 100 M FCFA/séance → 1
// Amihud (%/M FCFA), échelle log inversée. Bornes calibrées sur la
// distribution BRVM (SNTS ~0,01 ; micro-caps illiquides > 20).
const AMIHUD_GOOD = 0.05;
const AMIHUD_BAD = 50;
// Spread de Roll en % du cours, échelle inversée (0,2 % excellent, 5 % très cher).
const SPREAD_GOOD = 0.2;
const SPREAD_BAD = 5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function classifyLiquidity(score: number): LiquidityClass {
  if (score >= 75) return 'A';
  if (score >= 50) return 'B';
  if (score >= 25) return 'C';
  return 'D';
}

/** Estimateur de Roll : 2·√(−cov(Δp_t, Δp_{t−1})) en % du cours moyen. Null si cov ≥ 0. */
export function rollSpreadPct(closes: number[]): number | null {
  const p = closes.filter((c) => c > 0);
  if (p.length < 3) return null;
  const d: number[] = [];
  for (let i = 1; i < p.length; i++) d.push(p[i]! - p[i - 1]!);
  if (d.length < 2) return null;
  const x = d.slice(1);
  const y = d.slice(0, -1);
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let cov = 0;
  for (let i = 0; i < x.length; i++) cov += (x[i]! - mx) * (y[i]! - my);
  cov /= x.length;
  if (cov >= 0) return null; // tendance pure : spread non estimable
  const spread = 2 * Math.sqrt(-cov);
  const meanPrice = p.reduce((a, b) => a + b, 0) / p.length;
  return (spread / meanPrice) * 100;
}

export function computeLiquidityV2(
  rows: LiquiditySessionRow30[],
  seancesMarche: number,
): LiquidityV2Result {
  const traitees = rows.filter((r) => (r.volume ?? 0) > 0);
  const seancesTraitees = traitees.length;

  let valeurTotale = 0;
  for (const r of traitees) {
    valeurTotale += r.valeur_echangee ?? ((r.cours_jour ?? 0) * (r.volume ?? 0));
  }
  const valeurMoyenne = seancesMarche > 0 ? valeurTotale / seancesMarche : 0;

  // Composante 1 : présence.
  const presencePct = seancesMarche > 0 ? Math.min(100, (seancesTraitees / seancesMarche) * 100) : 0;

  // Composante 2 : activité (log).
  const activite =
    valeurMoyenne <= LOG_FLOOR
      ? 0
      : clamp01(Math.log10(valeurMoyenne / LOG_FLOOR) / Math.log10(LOG_CEIL / LOG_FLOOR));

  // Composante 3 : impact prix (Amihud) = moyenne |variation %| / valeur (M FCFA).
  let amihud: number | null = null;
  const impacts = traitees
    .filter((r) => r.variation_pct != null && (r.valeur_echangee ?? 0) > 0)
    .map((r) => Math.abs(r.variation_pct!) / ((r.valeur_echangee!) / 1_000_000));
  if (impacts.length > 0) amihud = impacts.reduce((a, b) => a + b, 0) / impacts.length;
  const compAmihud =
    amihud == null
      ? 0 // jamais traité (ou sans valeur) : au pire
      : clamp01(Math.log10(AMIHUD_BAD / Math.max(amihud, AMIHUD_GOOD)) / Math.log10(AMIHUD_BAD / AMIHUD_GOOD));

  // Composante 4 : spread implicite (Roll) sur les clôtures chronologiques.
  const closes = [...rows]
    .sort((a, b) => a.date_marche.localeCompare(b.date_marche))
    .map((r) => r.cours_jour)
    .filter((c): c is number => c != null && c > 0);
  const spreadPct = rollSpreadPct(closes);
  const compRoll =
    spreadPct == null
      ? 0.5 // non estimable : neutre, documenté
      : clamp01(Math.log10(SPREAD_BAD / Math.max(spreadPct, SPREAD_GOOD)) / Math.log10(SPREAD_BAD / SPREAD_GOOD));

  const base: Omit<LiquidityV2Result, 'score' | 'classe'> = {
    presence_pct: Math.round(presencePct * 100) / 100,
    activite: Math.round(activite * 10_000) / 10_000,
    amihud: amihud != null ? Math.round(amihud * 1_000_000) / 1_000_000 : null,
    spread_roll_pct: spreadPct != null ? Math.round(spreadPct * 10_000) / 10_000 : null,
    valeur_moyenne_30j: Math.round(valeurMoyenne * 100) / 100,
    seances_traitees: seancesTraitees,
    seances_marche: seancesMarche,
  };

  // Honnêteté : historique insuffisant → pas de score.
  if (seancesMarche < MIN_SEANCES) return { ...base, score: null, classe: null };

  const score = Math.round(100 * (0.25 * (presencePct / 100) + 0.25 * activite + 0.25 * compAmihud + 0.25 * compRoll));
  return { ...base, score, classe: classifyLiquidity(score) };
}
```

- [ ] **Step 4 : Vérifier** — `npx vitest run tests/liquidity.test.ts` → les tests `computeLiquidityV2`/`classifyLiquidity` passent. Ajuster UNIQUEMENT les attentes de seuil si un test de niveau (`>= 70`) échoue de peu — jamais les règles null.

- [ ] **Step 5 : Commit** — `git add scraper/src/liquidity/compute.ts scraper/tests/liquidity.test.ts && git commit -m "feat(liquidity): moteur v2 pur — presence, activite, Amihud, spread de Roll"`

---

### Task 3 : `flow.ts` — flux acheteur/vendeur (TDD)

**Files:**
- Create: `scraper/src/liquidity/flow.ts`
- Test: `scraper/tests/liquidity.test.ts` (ajout)

- [ ] **Step 1 : Ajouter les tests (échouent)**

```ts
// à ajouter dans scraper/tests/liquidity.test.ts
import { computeSessionFlow, type FlowSnapshot } from '../src/liquidity/flow.js';

function snap(t: string, close: number, volume: number): FlowSnapshot {
  return { captured_at: `2026-07-17T${t}:00Z`, close, volume };
}

describe('computeSessionFlow', () => {
  it('null si moins de 2 snapshots', () => {
    expect(computeSessionFlow([])).toBeNull();
    expect(computeSessionFlow([snap('09:00', 5000, 100)])).toBeNull();
  });

  it('tick rule : hausse → achat, baisse → vente, plat → neutre', () => {
    const f = computeSessionFlow([
      snap('09:00', 5000, 0),
      snap('09:15', 5050, 100), // +50 : 100 titres côté achat
      snap('09:30', 5050, 150), // plat : 50 neutres
      snap('09:45', 5000, 250), // -50 : 100 côté vente
    ])!;
    expect(f.volume_achat).toBe(100);
    expect(f.volume_neutre).toBe(50);
    expect(f.volume_vente).toBe(100);
    expect(f.flux_net_pct).toBe(0); // (100-100)/200
  });

  it('volume cumulé non monotone (correction de séance) → delta clampé à 0', () => {
    const f = computeSessionFlow([snap('09:00', 5000, 200), snap('09:15', 5100, 150)])!;
    expect(f.volume_achat).toBe(0);
    expect(f.flux_net_pct).toBeNull(); // aucun volume classé
  });

  it('désordre chronologique toléré (tri interne)', () => {
    const f = computeSessionFlow([snap('09:15', 5050, 100), snap('09:00', 5000, 0)])!;
    expect(f.volume_achat).toBe(100);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npx vitest run tests/liquidity.test.ts` → FAIL (module flow absent).

- [ ] **Step 3 : Implémenter `flow.ts`**

```ts
// scraper/src/liquidity/flow.ts
/**
 * Flux acheteur/vendeur d'une séance — tick rule sur les snapshots intraday
 * (cours + volume CUMULÉ toutes les ~15 min). PURE, testée.
 * Volume passé pendant une hausse de cours = pression acheteuse ; pendant une
 * baisse = vendeuse ; cours inchangé = neutre. Indicateur DIRECTIONNEL, jamais
 * intégré au score de liquidité (spec §3).
 */

export interface FlowSnapshot {
  captured_at: string;
  close: number | null;
  volume: number | null; // cumul de séance au moment de la capture
}

export interface SessionFlow {
  volume_achat: number;
  volume_vente: number;
  volume_neutre: number;
  /** (achat − vente) / (achat + vente) × 100 ; null si aucun volume classé directionnel. */
  flux_net_pct: number | null;
}

export function computeSessionFlow(snapshots: FlowSnapshot[]): SessionFlow | null {
  const pts = snapshots
    .filter((s) => s.close != null && s.volume != null)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  if (pts.length < 2) return null;

  let achat = 0;
  let vente = 0;
  let neutre = 0;
  let lastClose = pts[0]!.close!;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i]!;
    // Cumul de séance : un recul (correction source) donne un delta négatif → 0.
    const delta = Math.max(0, cur.volume! - pts[i - 1]!.volume!);
    if (delta > 0) {
      if (cur.close! > lastClose) achat += delta;
      else if (cur.close! < lastClose) vente += delta;
      else neutre += delta;
    }
    lastClose = cur.close!;
  }

  const directionnel = achat + vente;
  return {
    volume_achat: achat,
    volume_vente: vente,
    volume_neutre: neutre,
    flux_net_pct: directionnel > 0 ? Math.round(((achat - vente) / directionnel) * 10_000) / 100 : null,
  };
}
```

- [ ] **Step 4 : Vérifier** — `npx vitest run tests/liquidity.test.ts` → tout passe. Puis suite complète `npm test` (aucune régression).

- [ ] **Step 5 : Commit** — `git add scraper/src/liquidity/flow.ts scraper/tests/liquidity.test.ts && git commit -m "feat(liquidity): flux acheteur/vendeur par tick rule sur snapshots intraday"`

---

### Task 4 : `runLiquidity.ts` + CLI + scripts npm

**Files:**
- Create: `scraper/src/liquidity/runLiquidity.ts`
- Modify: `scraper/src/index.ts` (après `case 'score'`), `scraper/package.json`

- [ ] **Step 1 : Implémenter l'orchestration**

```ts
// scraper/src/liquidity/runLiquidity.ts
/**
 * Calcule la liquidité v2 de tous les titres pour la dernière séance et
 * upsert liquidity_daily (clé code,date_marche — idempotent).
 * --mock : fixture en mémoire, aucun accès réseau ni écriture.
 */
import { getSupabase } from '../persistence/supabase.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { computeLiquidityV2, ENGINE_VERSION } from './compute.js';
import { computeSessionFlow, type FlowSnapshot } from './flow.js';

export interface LiquidityRunResult {
  status: 'success' | 'mock' | 'failed';
  date_marche: string | null;
  nb_titres: number;
  nb_scores: number; // score non null
  nb_flux: number;   // flux non null
}

interface DailyRow {
  code: string; date_marche: string; cours_jour: number | null;
  variation_pct: number | null; volume: number | null; valeur_echangee: number | null;
}

function mockRows(): DailyRow[] {
  const out: DailyRow[] = [];
  for (let i = 0; i < 30; i++) {
    const d = `2026-06-${String(i + 1).padStart(2, '0')}`;
    out.push({ code: 'SNTS', date_marche: d, cours_jour: 17500, variation_pct: 0.3, volume: 5000, valeur_echangee: 87_500_000 });
    if (i % 5 === 0) out.push({ code: 'XXXC', date_marche: d, cours_jour: 900, variation_pct: 4, volume: 50, valeur_echangee: 45_000 });
  }
  return out;
}

export async function runLiquidity(opts: { mock?: boolean } = {}): Promise<LiquidityRunResult> {
  if (opts.mock) {
    const rows = mockRows();
    const dates = [...new Set(rows.map((r) => r.date_marche))].sort();
    const byCode = new Map<string, DailyRow[]>();
    for (const r of rows) (byCode.get(r.code) ?? byCode.set(r.code, []).get(r.code)!).push(r);
    let nbScores = 0;
    for (const [code, list] of byCode) {
      const res = computeLiquidityV2(list, dates.length);
      if (res.score != null) nbScores++;
      logger.info({ code, score: res.score, classe: res.classe }, '[mock] liquidité');
    }
    return { status: 'mock', date_marche: dates.at(-1) ?? null, nb_titres: byCode.size, nb_scores: nbScores, nb_flux: 0 };
  }

  const sb = getSupabase();

  // 30 dernières séances de marché.
  const { data: dateRows, error: e1 } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(4000);
  if (e1) throw e1;
  const dates = [...new Set((dateRows ?? []).map((r) => r.date_marche as string))].slice(0, 30);
  if (dates.length === 0) {
    logger.warn('liquidité : aucune séance en base');
    return { status: 'failed', date_marche: null, nb_titres: 0, nb_scores: 0, nb_flux: 0 };
  }
  const lastDate = dates[0]!;

  const { data: daily, error: e2 } = await sb
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
    .in('date_marche', dates);
  if (e2) throw e2;

  const { data: snaps, error: e3 } = await sb
    .from('brvm_intraday_snapshots')
    .select('code, captured_at, close, volume')
    .eq('date_marche', lastDate);
  if (e3) throw e3;

  const byCode = new Map<string, DailyRow[]>();
  for (const r of (daily ?? []) as DailyRow[]) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(r);
  }
  const snapsByCode = new Map<string, FlowSnapshot[]>();
  for (const s of (snaps ?? []) as ({ code: string } & FlowSnapshot)[]) {
    if (!snapsByCode.has(s.code)) snapsByCode.set(s.code, []);
    snapsByCode.get(s.code)!.push(s);
  }

  const records = [];
  let nbScores = 0;
  let nbFlux = 0;
  for (const [code, list] of byCode) {
    const liq = computeLiquidityV2(list, dates.length);
    const flow = computeSessionFlow(snapsByCode.get(code) ?? []);
    if (liq.score != null) nbScores++;
    if (flow?.flux_net_pct != null) nbFlux++;
    records.push({
      code,
      date_marche: lastDate,
      score: liq.score,
      classe: liq.classe,
      presence_pct: liq.presence_pct,
      activite: liq.activite,
      amihud: liq.amihud,
      spread_roll_pct: liq.spread_roll_pct,
      valeur_moyenne_30j: liq.valeur_moyenne_30j,
      seances_traitees: liq.seances_traitees,
      seances_marche: liq.seances_marche,
      volume_achat: flow?.volume_achat ?? null,
      volume_vente: flow?.volume_vente ?? null,
      volume_neutre: flow?.volume_neutre ?? null,
      flux_net_pct: flow?.flux_net_pct ?? null,
      engine_version: ENGINE_VERSION,
      updated_at: new Date().toISOString(),
    });
  }

  if (config.DRY_RUN) {
    logger.info({ nb: records.length }, '[DRY_RUN] upsert liquidity_daily sauté');
  } else {
    const { error: e4 } = await sb.from('liquidity_daily').upsert(records, { onConflict: 'code,date_marche' });
    if (e4) throw e4;
  }

  logger.info({ date: lastDate, titres: byCode.size, scores: nbScores, flux: nbFlux }, 'liquidité v2 calculée');
  return { status: 'success', date_marche: lastDate, nb_titres: byCode.size, nb_scores: nbScores, nb_flux: nbFlux };
}
```

NB : vérifier le nom réel de l'accès Supabase dans `scraper/src/persistence/supabase.ts` (`getSupabase` supposé — adapter l'import au nom exporté réel) et le nom exact du flag dans `config.ts` (`DRY_RUN`).

- [ ] **Step 2 : Câbler le CLI** — dans `scraper/src/index.ts`, ajouter après le bloc `case 'score': {...}` :

```ts
    case 'liquidity': {
      const { runLiquidity } = await import('./liquidity/runLiquidity.js');
      const res = await monitored(
        { code: 'liquidity', label: 'Liquidité v2' },
        async () => {
          const r = await runLiquidity({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.nb_titres,
              rows_upserted: r.nb_titres,
              metadata: { date_marche: r.date_marche, nb_scores: r.nb_scores, nb_flux: r.nb_flux },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

(Adapter à la signature exacte du helper `monitored` visible dans le `case 'score'` du fichier.) Ajouter `liquidity` à la liste d'usage/help du CLI si elle existe.

- [ ] **Step 3 : Scripts npm** — dans `scraper/package.json` :

```json
    "liquidity": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts liquidity",
    "liquidity:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts liquidity --mock",
```

- [ ] **Step 4 : Vérifier** — `npm run liquidity:mock` → logs `[mock] liquidité` avec SNTS score élevé et XXXC classe C/D, exit 0. Puis `npm run typecheck` et `npm test`.

- [ ] **Step 5 : Exécution réelle** (après migration appliquée, Task 1) — `npm run liquidity` → `liquidité v2 calculée` avec ~47 titres. Vérifier en base :

```bash
curl -s "$SUPABASE_URL/rest/v1/liquidity_daily?select=code,score,classe,flux_net_pct&order=score.desc.nullslast&limit=5" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- [ ] **Step 6 : Commit** — `git add scraper/src/liquidity/runLiquidity.ts scraper/src/index.ts scraper/package.json && git commit -m "feat(liquidity): orchestration runLiquidity + CLI liquidity[:mock] instrumente"`

---

### Task 5 : cron — job `liquidity` dans `score.yml`

**Files:**
- Modify: `.github/workflows/score.yml`

- [ ] **Step 1 : Ajouter le job** à la fin de `score.yml` (même déclencheur, s'exécute après le scoring) :

```yaml
  liquidity:
    runs-on: ubuntu-latest
    needs: score
    if: always() # la liquidité ne dépend pas du succès du scoring
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install
      - name: Run liquidity
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
        run: npm run liquidity
```

- [ ] **Step 2 : Vérifier la syntaxe** — `npx yaml-lint .github/workflows/score.yml 2>/dev/null || node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/score.yml','utf8'));console.log('YAML OK')"` (depuis `scraper/` où js-yaml est disponible via deps, sinon lecture attentive).

- [ ] **Step 3 : Commit** — `git add .github/workflows/score.yml && git commit -m "ci: job liquidity quotidien apres le scoring (score.yml)"`

---

### Task 6 : unification pénalité scoring

**Files:**
- Modify: `scraper/src/scoring/score.ts` (~l.157, pénalité), `scraper/src/scoring/runScoring.ts` (chargement inputs)
- Test: `scraper/tests/` (fichier de tests scoring existant — repérer avec `ls scraper/tests/`)

- [ ] **Step 1 : Test d'abord** — dans le fichier de tests du scoring existant, ajouter :

```ts
describe('pénalité de liquidité v2', () => {
  it('classe D (score 10) → pénalité proche du max ; classe A (score 90) → aucune', () => {
    const base = { /* reprendre l'input minimal utilisé par les tests existants du scoring */ };
    const d = computeScore({ ...base, liquidity_score: 10 });
    const a = computeScore({ ...base, liquidity_score: 90 });
    expect(d.penalite_liquidite).toBeGreaterThan(0);
    expect(a.penalite_liquidite).toBe(0);
  });

  it('liquidity_score absent → fallback règle volume 30j (comportement historique inchangé)', () => {
    const base = { /* input minimal avec avg_volume_30d sous le seuil */ };
    const r = computeScore({ ...base, liquidity_score: null });
    expect(r.penalite_liquidite).toBeGreaterThan(0);
  });
});
```

(Reprendre la fabrique d'inputs des tests scoring existants — ne pas inventer une nouvelle forme.) Lancer : FAIL (`liquidity_score` inconnu).

- [ ] **Step 2 : `score.ts`** — ajouter au type d'input du scoring le champ `liquidity_score?: number | null`, et remplacer le bloc pénalité (~l.157) :

```ts
  // --- Pénalité de faible liquidité (v2 : score liquidity_daily ; fallback volume 30j) ---
  let penaliteLiquidite = 0;
  if (input.liquidity_score != null) {
    // Classe C/D uniquement (score < 50) : pénalité proportionnelle au déficit.
    if (input.liquidity_score < 50) {
      penaliteLiquidite = ((50 - input.liquidity_score) / 50) * P.PENALITE_LIQUIDITE_MAX;
    }
  } else if (input.avg_volume_30d != null && input.avg_volume_30d < P.MIN_LIQUIDITY_AVG_VOLUME) {
    const deficit = 1 - input.avg_volume_30d / P.MIN_LIQUIDITY_AVG_VOLUME;
    penaliteLiquidite = clamp(deficit, 0, 1) * P.PENALITE_LIQUIDITE_MAX;
  }
```

Mettre à jour l'explication (~l.303) : `if (a.penaliteLiquidite > 0) parts.push('pénalité de faible liquidité appliquée (liquidité C/D)');` — garder la phrase générique si le fallback a servi (pas de distinction nécessaire dans le texte).

- [ ] **Step 3 : `runScoring.ts`** — après le chargement des inputs (~l.159), charger les scores de liquidité et les joindre :

```ts
  // Liquidité v2 du jour (table liquidity_daily) — absente => fallback volume 30j dans computeScore.
  const { data: liqRows } = await sb
    .from('liquidity_daily')
    .select('code, score')
    .eq('date_marche', dateMarche); // réutiliser la variable de date du run
  const liqByCode = new Map((liqRows ?? []).map((r) => [r.code as string, r.score as number | null]));
```

puis, là où chaque input est construit : `liquidity_score: liqByCode.get(row.code) ?? null,`. Si la variable de date du run porte un autre nom, l'utiliser ; si la table est vide ou en erreur, le `?? null` déclenche le fallback — ne JAMAIS faire échouer le scoring pour une absence de liquidité.

- [ ] **Step 4 : Vérifier** — `npm test` (tous les tests scoring + liquidity verts), `npm run typecheck`, puis `npm run score:mock` (exit 0).

- [ ] **Step 5 : Commit** — `git add scraper/src/scoring/ scraper/tests/ && git commit -m "feat(scoring): penalite de liquidite derivee du score v2, fallback volume 30j"`

---

### Task 7 : frontend — types v2 + `fromDailyRow` (TDD)

**Files:**
- Modify: `frontend/lib/liquidity.ts`
- Test: `frontend/lib/liquidity.test.mjs` (créé)

- [ ] **Step 1 : Test d'abord**

```js
// frontend/lib/liquidity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDailyRow, computeLiquidity } from './liquidity.ts';

test('fromDailyRow mappe une ligne liquidity_daily en LiquidityScore enrichi', () => {
  const s = fromDailyRow({
    code: 'SNTS', date_marche: '2026-07-17', score: 82, classe: 'A',
    presence_pct: 96.67, activite: 0.91, amihud: 0.02, spread_roll_pct: 0.6,
    valeur_moyenne_30j: 45_000_000, seances_traitees: 29, seances_marche: 30,
    volume_achat: 3000, volume_vente: 1000, volume_neutre: 500, flux_net_pct: 50,
  });
  assert.equal(s.score, 82);
  assert.equal(s.classe, 'A');
  assert.equal(s.label, 'Très liquide');
  assert.equal(s.presencePct, 97);
  assert.equal(s.v2.spread_roll_pct, 0.6);
  assert.equal(s.v2.flux_net_pct, 50);
});

test('fromDailyRow score null (données insuffisantes) → null', () => {
  assert.equal(fromDailyRow({ score: null, classe: null, presence_pct: 0, valeur_moyenne_30j: 0, seances_traitees: 0, seances_marche: 5 }), null);
});

test('computeLiquidity legacy reste intact (fallback)', () => {
  const rows = Array.from({ length: 20 }, () => ({ volume: 100, cours_jour: 5000, valeur_echangee: 500_000 }));
  const s = computeLiquidity(rows, 30);
  assert.ok(s && s.score > 0);
});
```

Lancer `cd frontend && npx tsx --test lib/liquidity.test.mjs` → FAIL (`fromDailyRow` absent).

- [ ] **Step 2 : Implémenter dans `lib/liquidity.ts`** (à la suite du code existant, sans toucher `computeLiquidity`) :

```ts
/** Ligne de la table liquidity_daily (moteur scraper liq-v2). */
export interface LiquidityDailyRow {
  code?: string;
  date_marche?: string;
  score: number | null;
  classe: LiquidityClass | null;
  presence_pct: number;
  activite?: number | null;
  amihud?: number | null;
  spread_roll_pct?: number | null;
  valeur_moyenne_30j: number;
  seances_traitees: number;
  seances_marche: number;
  volume_achat?: number | null;
  volume_vente?: number | null;
  volume_neutre?: number | null;
  flux_net_pct?: number | null;
}

/** LiquidityScore + détail v2 (sous-composantes, flux) pour l'affichage enrichi. */
export interface LiquidityScoreV2 extends LiquidityScore {
  v2: Pick<LiquidityDailyRow, 'amihud' | 'spread_roll_pct' | 'activite' | 'volume_achat' | 'volume_vente' | 'volume_neutre' | 'flux_net_pct'>;
}

/** Mappe une ligne liquidity_daily ; null si le moteur n'a pas pu scorer (honnêteté). */
export function fromDailyRow(row: LiquidityDailyRow | null | undefined): LiquidityScoreV2 | null {
  if (!row || row.score == null || row.classe == null) return null;
  return {
    score: row.score,
    classe: row.classe,
    label: LIQUIDITY_LABELS[row.classe],
    valeurMoyenne: row.valeur_moyenne_30j,
    presencePct: Math.round(row.presence_pct),
    nbSeances: row.seances_marche,
    v2: {
      amihud: row.amihud ?? null,
      spread_roll_pct: row.spread_roll_pct ?? null,
      activite: row.activite ?? null,
      volume_achat: row.volume_achat ?? null,
      volume_vente: row.volume_vente ?? null,
      volume_neutre: row.volume_neutre ?? null,
      flux_net_pct: row.flux_net_pct ?? null,
    },
  };
}
```

- [ ] **Step 3 : Vérifier** — `npx tsx --test lib/liquidity.test.mjs` → 3 tests verts. `npx tsc --noEmit`.

- [ ] **Step 4 : Commit** — `git add frontend/lib/liquidity.ts frontend/lib/liquidity.test.mjs && git commit -m "feat(liquidity): fromDailyRow — lecture table v2 avec types enrichis"`

---

### Task 8 : brancher les 3 consommateurs (fiche, conseiller, screener)

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx` (~l.379-388), `frontend/app/conseiller/page.tsx` (~l.40-44), `frontend/components/screener/ScreenerClient.tsx` (~l.64-68)

- [ ] **Step 1 : fiche action** — remplacer le calcul (~l.382) par lecture table + fallback legacy :

```ts
  // Liquidité v2 (table liquidity_daily) — fallback calcul legacy si table vide.
  const { data: liqRow } = await db
    .from('liquidity_daily')
    .select('*')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const liquidity = fromDailyRow(liqRow as LiquidityDailyRow | null) ?? computeLiquidity(liqRows, liqRows.length);
```

Ajouter `fromDailyRow, type LiquidityDailyRow` à l'import de `@/lib/liquidity` (l.29). `db` = le client Supabase déjà utilisé dans la page (repérer son nom local). Le `liqRows`/`computeLiquidity` existant reste en place comme fallback.

- [ ] **Step 2 : conseiller** — dans la fonction qui construit la map (~l.40), tenter d'abord la table :

```ts
  const { data: liqRows2 } = await db
    .from('liquidity_daily')
    .select('code, score, classe, presence_pct, valeur_moyenne_30j, seances_traitees, seances_marche')
    .order('date_marche', { ascending: false })
    .limit(100);
  const out = new Map<string, { classe: string; score: number }>();
  for (const r of (liqRows2 ?? []) as LiquidityDailyRow[]) {
    if (r.score != null && r.classe != null && r.code && !out.has(r.code)) out.set(r.code, { classe: r.classe, score: r.score });
  }
  if (out.size === 0) {
    for (const [code, list] of byCode) {
      const liq = computeLiquidity(list, seances);
      if (liq) out.set(code, { classe: liq.classe, score: liq.score });
    }
  }
```

(`limit(100)` > 2 séances × 47 titres ; la dédup `!out.has` garde la ligne la plus récente grâce au tri. Adapter le nom du client `db` à celui du fichier — `createPublicClient` d'après l'import l.3.)

- [ ] **Step 3 : screener (client)** — même logique avec le client navigateur (~l.64) :

```ts
        const { data: liqDaily } = await supabase
          .from('liquidity_daily')
          .select('code, score, classe')
          .order('date_marche', { ascending: false })
          .limit(100);
        const liquidityByCode = new Map<string, { score: number; classe: string }>();
        for (const r of (liqDaily ?? []) as { code: string; score: number | null; classe: string | null }[]) {
          if (r.score != null && r.classe != null && !liquidityByCode.has(r.code)) liquidityByCode.set(r.code, { score: r.score, classe: r.classe });
        }
        if (liquidityByCode.size === 0) {
          for (const [code, rows] of histoByCode) {
            const liq = computeLiquidity(rows, seances);
            if (liq) liquidityByCode.set(code, { score: liq.score, classe: liq.classe });
          }
        }
```

- [ ] **Step 4 : Vérifier** — `npx tsc --noEmit` puis `npm run build`. Lancer le dev server et ouvrir `/actions/SNTS`, `/conseiller`, `/screener` : les scores s'affichent (depuis la table si le run réel de la Task 4 a eu lieu, sinon via fallback).

- [ ] **Step 5 : Commit** — `git add frontend/app/actions frontend/app/conseiller frontend/components/screener && git commit -m "feat(liquidity): fiche, conseiller et screener lisent liquidity_daily (fallback legacy)"`

---

### Task 9 : LiquidityCard v2

**Files:**
- Modify: `frontend/components/LiquidityCard.tsx`, `frontend/app/actions/[code]/page.tsx` (prop)

- [ ] **Step 1 : Étendre la carte.** La prop `liquidity` devient `LiquidityScore | LiquidityScoreV2 | null`. Après le bloc score/classe existant, ajouter (rendu conditionnel — la carte reste identique si `v2` absent) :

```tsx
      {'v2' in (liquidity ?? {}) && (() => {
        const v2 = (liquidity as import('@/lib/liquidity').LiquidityScoreV2).v2;
        const fluxOk = v2.flux_net_pct != null && (v2.volume_achat ?? 0) + (v2.volume_vente ?? 0) > 0;
        const achat = v2.volume_achat ?? 0;
        const vente = v2.volume_vente ?? 0;
        const pctAchat = fluxOk ? Math.round((achat / (achat + vente)) * 100) : 0;
        return (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            {/* Flux acheteur/vendeur de la dernière séance (tick rule intraday) */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted">Flux de la séance (achat / vente)</span>
                <span className="tabular text-faint">{fluxOk ? `net ${v2.flux_net_pct! > 0 ? '+' : ''}${v2.flux_net_pct} %` : '—'}</span>
              </div>
              {fluxOk ? (
                <div className="flex h-2 overflow-hidden rounded-full bg-border">
                  <div className="bg-up" style={{ width: `${pctAchat}%` }} />
                  <div className="bg-down" style={{ width: `${100 - pctAchat}%` }} />
                </div>
              ) : (
                <p className="text-[11px] text-faint">Pas de données intraday pour cette séance.</p>
              )}
            </div>
            {/* Coût d'aller-retour estimé (spread de Roll) */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">Coût d’aller-retour estimé (spread)</span>
              <span className="tabular text-ivory">
                {v2.spread_roll_pct != null
                  ? `≈ ${v2.spread_roll_pct.toFixed(2)} % (${fmtFcfa(500_000 * (v2.spread_roll_pct / 100))} sur 500 000 FCFA)`
                  : 'non estimable'}
              </span>
            </div>
            {v2.amihud != null && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Impact prix (Amihud, %/M FCFA)</span>
                <span className="tabular text-ivory">{v2.amihud.toFixed(3)}</span>
              </div>
            )}
          </div>
        );
      })()}
```

(Adapter l'emplacement exact à la structure JSX de la carte ; conserver les explications existantes sur le courtage SGI.)

- [ ] **Step 2 : Vérifier** — `npx tsc --noEmit`, dev server sur `/actions/SNTS` : la carte montre flux + spread si la table est peuplée, et reste comme avant sinon.

- [ ] **Step 3 : Commit** — `git add frontend/components/LiquidityCard.tsx frontend/app/actions && git commit -m "feat(liquidity): LiquidityCard v2 — flux achat/vente + cout d'aller-retour estime"`

---

### Task 10 : page `/liquidite` + nav

**Files:**
- Create: `frontend/app/liquidite/page.tsx`
- Modify: `frontend/lib/nav.ts` (groupe Analyse)

- [ ] **Step 1 : Créer la page** (server component, force-dynamic, pattern des pages du repo) :

```tsx
import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { fromDailyRow, LIQUIDITY_LABELS, type LiquidityDailyRow } from '@/lib/liquidity';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Liquidité du marché BRVM — scores par titre',
  description: 'Score de liquidité 0-100 par action : présence, activité, impact prix (Amihud), spread estimé (Roll) et flux acheteur/vendeur intraday.',
};

const CLASS_STYLE: Record<string, string> = {
  A: 'border-up/30 bg-up/10 text-up',
  B: 'border-accent/30 bg-accent/10 text-accent',
  C: 'border-gold/30 bg-gold/10 text-gold',
  D: 'border-down/30 bg-down/10 text-down',
};

export default async function LiquiditePage() {
  const db = createPublicClient();
  const { data: dateRow } = await db
    .from('liquidity_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const asOf = (dateRow as { date_marche: string } | null)?.date_marche ?? null;
  const { data } = asOf
    ? await db.from('liquidity_daily').select('*').eq('date_marche', asOf).order('score', { ascending: false, nullsFirst: false })
    : { data: [] };
  const rows = (data ?? []) as (LiquidityDailyRow & { code: string })[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <SectionHeader
        kicker="Analyse"
        title="Liquidité du marché"
        subtitle={asOf ? `Scores au ${asOf} — présence, activité, impact prix (Amihud), spread estimé (Roll), flux intraday.` : 'Scores de liquidité par titre.'}
      />
      {rows.length === 0 ? (
        <EmptyStatePremium title="Pas encore de scores" hint="Le calcul quotidien n'a pas encore tourné — revenez après la prochaine clôture." />
      ) : (
        <PremiumPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-3 py-2">Titre</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Classe</th>
                  <th className="px-3 py-2">Présence</th>
                  <th className="px-3 py-2">Valeur moy. / séance</th>
                  <th className="px-3 py-2">Spread estimé</th>
                  <th className="px-3 py-2">Flux net séance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = fromDailyRow(r);
                  return (
                    <tr key={r.code} className="border-b border-border/40 last:border-0 hover:bg-surface/60">
                      <td className="px-3 py-2">
                        <a href={`/actions/${r.code}`} className="font-semibold text-ivory hover:text-accent">{r.code}</a>
                      </td>
                      <td className="tabular px-3 py-2">{s ? s.score : '—'}</td>
                      <td className="px-3 py-2">
                        {s ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${CLASS_STYLE[s.classe]}`}>
                            {s.classe} · {LIQUIDITY_LABELS[s.classe]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-faint">données insuffisantes</span>
                        )}
                      </td>
                      <td className="tabular px-3 py-2 text-muted">{Math.round(r.presence_pct)} %</td>
                      <td className="tabular px-3 py-2 text-muted">
                        {r.valeur_moyenne_30j >= 1_000_000
                          ? `${(r.valeur_moyenne_30j / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
                          : Math.round(r.valeur_moyenne_30j).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="tabular px-3 py-2 text-muted">{r.spread_roll_pct != null ? `≈ ${Number(r.spread_roll_pct).toFixed(2)} %` : '—'}</td>
                      <td className={`tabular px-3 py-2 ${r.flux_net_pct == null ? 'text-faint' : r.flux_net_pct >= 0 ? 'text-up' : 'text-down'}`}>
                        {r.flux_net_pct != null ? `${r.flux_net_pct > 0 ? '+' : ''}${Number(r.flux_net_pct).toFixed(0)} %` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PremiumPanel>
      )}
      <PremiumPanel>
        <h2 className="text-sm font-semibold text-ivory">Méthodologie</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Score 0-100 sur 30 séances : présence (25 %), activité en valeur échangée (25 %, échelle log 100 k → 100 M FCFA),
          impact prix (25 %, ratio d’Amihud : variation moyenne par million de FCFA échangé) et spread implicite (25 %,
          estimateur de Roll sur les alternances de clôture). La BRVM ne publie pas son carnet d’ordres : la profondeur et le
          coût d’exécution sont estimés depuis les échanges, jamais inventés. Le flux acheteur/vendeur est reconstitué par
          tick rule sur les captures intraday (volume passé sur cours en hausse = pression acheteuse) ; il est directionnel
          et n’entre pas dans le score. Moins de 10 séances d’historique : pas de score (« données insuffisantes »).
        </p>
      </PremiumPanel>
    </div>
  );
}
```

Vérifier que `EmptyStatePremium` accepte bien `title`/`hint` (sinon adapter aux props réelles du kit `@/components/ui/premium`).

- [ ] **Step 2 : Nav** — dans `frontend/lib/nav.ts`, groupe `Analyse`, après `{ href: '/screener', label: 'Screener' }` :

```ts
      { href: '/liquidite', label: 'Liquidité' },
```

(La page est dans l'app authentifiée : `/liquidite` n'est PAS dans `PUBLIC_EXACT`/`PUBLIC_PREFIXES` du middleware — ne rien y ajouter.)

- [ ] **Step 3 : Vérifier** — `npx tsc --noEmit`, `npm run build`, dev server : `/liquidite` affiche le classement (ou l'empty state), l'entrée apparaît dans la sidebar et la palette ⌘K (elle indexe NAV_GROUPS).

- [ ] **Step 4 : Commit** — `git add frontend/app/liquidite frontend/lib/nav.ts && git commit -m "feat(liquidity): page /liquidite — classement des titres + methodologie"`

---

### Task 11 : vérifications finales

- [ ] **Step 1 : Scraper** — `cd scraper && npm test && npm run typecheck` → tout vert.
- [ ] **Step 2 : Frontend** — `cd frontend && npx tsx --test lib/liquidity.test.mjs && npx tsc --noEmit && npm run build` → tout vert.
- [ ] **Step 3 : RLS** — re-jouer les deux curl anon de la Task 1 Step 3 (lecture 200, écriture 401/403).
- [ ] **Step 4 : Bout en bout** — `npm run liquidity` (scraper), puis vérifier `/liquidite` et la fiche `/actions/SNTS` en dev : scores v2 affichés, flux présent pour les titres ayant traité.
- [ ] **Step 5 : Docs** — ajouter à `CLAUDE.md` §8 une ligne « Liquidité v2 (0111, module scraper/liquidity, page /liquidite, pénalité scoring unifiée) ». Commit final :

```bash
git add CLAUDE.md docs/superpowers/plans/2026-07-19-liquidite-v2.md
git commit -m "docs: liquidite v2 — plan execute, etat CLAUDE.md"
git push
```

---

## Self-review (fait à la rédaction)

- **Couverture spec** : migration §4.1 → Task 1 ; compute/flow §3-4.2 → Tasks 2-3 ; run/CLI/cron §4.2 → Tasks 4-5 ; unification scoring §4.3 → Task 6 ; frontend §4.4 → Tasks 7-10 ; tests §5 → Tasks 2,3,6,7,11 ; règles d'honnêteté → testées (score null < 10 séances, flux null sans snapshots, Roll neutre).
- **Placeholders** : aucun TBD ; deux points laissés volontairement « à adapter au nom réel » (export de `persistence/supabase.ts`, helper `monitored`) car le fichier fait foi — l'action à faire est décrite précisément.
- **Cohérence de types** : `LiquiditySessionRow30`/`LiquidityV2Result` (Tasks 2, 4), `FlowSnapshot`/`SessionFlow` (Tasks 3, 4), `LiquidityDailyRow`/`fromDailyRow`/`LiquidityScoreV2` (Tasks 7, 8, 9, 10), `liquidity_score` (Task 6) : noms alignés partout.
