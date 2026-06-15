# Lot 3 — Monitoring du scraping + journal d'audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrumenter les scrapers cron-driven pour qu'ils écrivent dans les tables `scraper_runs`/`scraper_errors` (migration 0041), puis brancher les pages admin `/admin/scraping` et `/admin/audit-logs` sur des données réelles (elles sont aujourd'hui des stubs de 9 lignes).

**Architecture :** Une fonction pure `buildRunRecord` calcule l'enregistrement d'un run (statut, durée, lignes, nb erreurs) à partir d'un horodatage de départ et d'un résultat/erreur. Un wrapper I/O fin `withMonitoring(source, trigger, fn)` insère une ligne `scraper_runs` en `running`, exécute le runner, puis finalise la ligne (success/failed), journalise les erreurs dans `scraper_errors` et met à jour `scraper_sources.last_success_at` — sans jamais masquer le code de sortie du runner. Le wrapper est branché dans `index.ts` sur les commandes pilotées par cron (intraday, daily, score, events, dividends, obligations). Côté frontend, deux Server Components lisent ces tables via le client service-role (pattern déjà utilisé dans `app/admin/page.tsx`).

**Tech Stack :** Node 20 + TypeScript ESM (scraper, vitest) ; Next.js 14 App Router Server Components + TailwindCSS (frontend) ; Supabase PostgreSQL.

---

## File Structure

**Scraper (nouveau module `monitoring/`) :**
- `scraper/src/monitoring/recordRun.ts` — `buildRunRecord` (pur) + `withMonitoring` (I/O) + types `RunOutcome`, `MonitoringClient`, `SourceRef`.
- `scraper/src/monitoring/supabaseClient.ts` — adaptateur `MonitoringClient` réel basé sur `getSupabase()`.
- `scraper/tests/monitoring.test.ts` — tests vitest de `buildRunRecord` et `withMonitoring` (client factice, aucune I/O réseau).
- `scraper/src/index.ts` — MODIFIÉ : enrobe 6 commandes cron avec `withMonitoring` + ajoute le flag `--trigger=`.

**Frontend (pages admin réelles) :**
- `frontend/lib/admin/scraping.ts` — requêtes + types pour le dashboard scraping (testable/réutilisable, isolé du JSX).
- `frontend/app/admin/scraping/page.tsx` — REMPLACE le stub : KPIs + table des runs récents + erreurs non résolues.
- `frontend/lib/admin/auditLogs.ts` — requêtes + types pour le journal d'audit.
- `frontend/app/admin/audit-logs/page.tsx` — REMPLACE le stub : table des entrées `admin_audit_logs`.

**Décisions verrouillées :**
- On écrit dans les **nouvelles** tables `scraper_runs`/`scraper_errors`/`scraper_sources` (migration 0041), PAS dans la table legacy `scrape_runs` (qui reste utilisée par `runDaily` pour l'anti-doublon de hash — on n'y touche pas).
- `withMonitoring` **upsert** la source par `code` (avec un `label`) → aucune migration de seed supplémentaire nécessaire (YAGNI).
- Aucun test unitaire frontend (le frontend n'a pas de harness de test — convention du repo). Vérification frontend = `npx tsc --noEmit` + `npx next build`.

---

### Task 1 : Fonction pure `buildRunRecord`

**Files:**
- Create: `scraper/src/monitoring/recordRun.ts`
- Test: `scraper/tests/monitoring.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `scraper/tests/monitoring.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { buildRunRecord } from '../src/monitoring/recordRun.js';

describe('buildRunRecord', () => {
  it('calcule un run réussi avec durée et lignes', () => {
    const rec = buildRunRecord({
      startedAtMs: 1000,
      finishedAtMs: 3500,
      outcome: { status: 'success', rows_extracted: 47, rows_upserted: 47, metadata: { date: '2026-06-16' } },
    });
    expect(rec.status).toBe('success');
    expect(rec.duration_ms).toBe(2500);
    expect(rec.rows_extracted).toBe(47);
    expect(rec.rows_upserted).toBe(47);
    expect(rec.error_count).toBe(0);
    expect(rec.metadata).toEqual({ date: '2026-06-16' });
  });

  it('déduit le statut failed et error_count=1 quand une erreur est fournie', () => {
    const rec = buildRunRecord({
      startedAtMs: 0,
      finishedAtMs: 1200,
      error: new Error('boom'),
    });
    expect(rec.status).toBe('failed');
    expect(rec.error_count).toBe(1);
    expect(rec.rows_extracted).toBe(0);
    expect(rec.rows_upserted).toBe(0);
    expect(rec.duration_ms).toBe(1200);
    expect(rec.metadata).toEqual({});
  });

  it('respecte un statut partiel renvoyé par le runner', () => {
    const rec = buildRunRecord({
      startedAtMs: 0,
      finishedAtMs: 500,
      outcome: { status: 'partial', rows_extracted: 10, rows_upserted: 4 },
    });
    expect(rec.status).toBe('partial');
    expect(rec.error_count).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `cd scraper && npx vitest run tests/monitoring.test.ts`
Expected: FAIL — `Cannot find module '../src/monitoring/recordRun.js'`.

- [ ] **Step 3 : Implémenter le minimum**

Créer `scraper/src/monitoring/recordRun.ts` (partie pure uniquement pour l'instant) :

```ts
/** Issue normalisée d'un runner instrumenté. */
export interface RunOutcome {
  status?: 'success' | 'partial' | 'failed';
  rows_extracted: number;
  rows_upserted: number;
  metadata?: Record<string, unknown>;
}

/** Enregistrement final inséré dans scraper_runs (hors id/source_id/trigger_type/started_at). */
export interface RunRecord {
  status: 'success' | 'partial' | 'failed';
  finished_at: string;
  duration_ms: number;
  rows_extracted: number;
  rows_upserted: number;
  error_count: number;
  metadata: Record<string, unknown>;
}

export interface BuildRunRecordInput {
  startedAtMs: number;
  finishedAtMs: number;
  outcome?: RunOutcome;
  error?: unknown;
}

/** Calcule l'enregistrement d'un run (pur, testable) à partir du timing et du résultat. */
export function buildRunRecord(input: BuildRunRecordInput): RunRecord {
  const { startedAtMs, finishedAtMs, outcome, error } = input;
  const duration_ms = Math.max(0, finishedAtMs - startedAtMs);
  if (error !== undefined && error !== null) {
    return {
      status: 'failed',
      finished_at: new Date(finishedAtMs).toISOString(),
      duration_ms,
      rows_extracted: 0,
      rows_upserted: 0,
      error_count: 1,
      metadata: {},
    };
  }
  return {
    status: outcome?.status ?? 'success',
    finished_at: new Date(finishedAtMs).toISOString(),
    duration_ms,
    rows_extracted: outcome?.rows_extracted ?? 0,
    rows_upserted: outcome?.rows_upserted ?? 0,
    error_count: 0,
    metadata: outcome?.metadata ?? {},
  };
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `cd scraper && npx vitest run tests/monitoring.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/monitoring/recordRun.ts scraper/tests/monitoring.test.ts
git commit -m "feat(scraper): buildRunRecord pur pour le monitoring des runs"
```

---

### Task 2 : Wrapper I/O `withMonitoring`

**Files:**
- Modify: `scraper/src/monitoring/recordRun.ts`
- Test: `scraper/tests/monitoring.test.ts:1` (ajout d'un bloc describe)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter en bas de `scraper/tests/monitoring.test.ts` :

```ts
import { withMonitoring, type MonitoringClient } from '../src/monitoring/recordRun.js';

function fakeClient() {
  const calls: { runs: any[]; updates: any[]; errors: any[]; sources: any[] } = {
    runs: [], updates: [], errors: [], sources: [],
  };
  const client: MonitoringClient = {
    async resolveSourceId(source) {
      calls.sources.push(source);
      return 'src-1';
    },
    async insertRun(row) {
      calls.runs.push(row);
      return 'run-1';
    },
    async finalizeRun(runId, record) {
      calls.updates.push({ runId, record });
    },
    async insertError(runId, err) {
      calls.errors.push({ runId, err });
    },
    async markSourceSuccess(sourceId, at) {
      calls.sources.push({ markSuccess: sourceId, at });
    },
  };
  return { client, calls };
}

describe('withMonitoring', () => {
  it('enregistre un run réussi et renvoie le résultat du runner', async () => {
    const { client, calls } = fakeClient();
    const result = await withMonitoring(
      client,
      { code: 'intraday', label: 'Cours intraday' },
      'cron',
      async () => ({ value: 42, outcome: { rows_extracted: 47, rows_upserted: 47 } }),
    );
    expect(result).toEqual({ value: 42, outcome: { rows_extracted: 47, rows_upserted: 47 } });
    expect(calls.runs).toHaveLength(1);
    expect(calls.runs[0]).toMatchObject({ source_id: 'src-1', trigger_type: 'cron', status: 'running' });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].record.status).toBe('success');
    expect(calls.errors).toHaveLength(0);
  });

  it('journalise l\'erreur, finalise en failed, puis relance l\'erreur', async () => {
    const { client, calls } = fakeClient();
    const boom = new Error('réseau');
    await expect(
      withMonitoring(client, { code: 'daily', label: 'Daily' }, 'manual', async () => {
        throw boom;
      }),
    ).rejects.toThrow('réseau');
    expect(calls.updates[0].record.status).toBe('failed');
    expect(calls.errors).toHaveLength(1);
    expect(calls.errors[0].err).toBe(boom);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `cd scraper && npx vitest run tests/monitoring.test.ts`
Expected: FAIL — `withMonitoring` / `MonitoringClient` non exportés.

- [ ] **Step 3 : Implémenter le wrapper**

Ajouter à la fin de `scraper/src/monitoring/recordRun.ts` :

```ts
/** Référence d'une source de scraping (clé naturelle + libellé). */
export interface SourceRef {
  code: string;
  label: string;
}

/** Résultat attendu d'un runner instrumenté : sa valeur métier + les métriques du run. */
export interface MonitoredResult<T> {
  value: T;
  outcome: RunOutcome;
}

/** Abstraction des écritures de monitoring (injectée → testable sans réseau). */
export interface MonitoringClient {
  resolveSourceId(source: SourceRef): Promise<string>;
  insertRun(row: { source_id: string; trigger_type: string; status: 'running' }): Promise<string>;
  finalizeRun(runId: string, record: RunRecord): Promise<void>;
  insertError(runId: string, error: unknown): Promise<void>;
  markSourceSuccess(sourceId: string, at: string): Promise<void>;
}

/**
 * Enrobe l'exécution d'un runner : insère un run `running`, exécute, finalise
 * (success/partial/failed), journalise les erreurs, met à jour la source.
 * Le monitoring ne doit jamais masquer le résultat ni l'erreur du runner :
 * une erreur du runner est relancée après journalisation ; une erreur de
 * monitoring est avalée (loguée par l'adaptateur).
 */
export async function withMonitoring<T>(
  client: MonitoringClient,
  source: SourceRef,
  triggerType: string,
  fn: () => Promise<MonitoredResult<T>>,
): Promise<MonitoredResult<T>> {
  const startedAtMs = Date.now();
  const sourceId = await client.resolveSourceId(source);
  const runId = await client.insertRun({ source_id: sourceId, trigger_type: triggerType, status: 'running' });
  try {
    const result = await fn();
    const record = buildRunRecord({ startedAtMs, finishedAtMs: Date.now(), outcome: result.outcome });
    await client.finalizeRun(runId, record);
    if (record.status !== 'failed') await client.markSourceSuccess(sourceId, record.finished_at);
    return result;
  } catch (error) {
    const record = buildRunRecord({ startedAtMs, finishedAtMs: Date.now(), error });
    await client.insertError(runId, error);
    await client.finalizeRun(runId, record);
    throw error;
  }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `cd scraper && npx vitest run tests/monitoring.test.ts`
Expected: PASS (5 tests au total).

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/monitoring/recordRun.ts scraper/tests/monitoring.test.ts
git commit -m "feat(scraper): withMonitoring (wrapper I/O injectable) + tests"
```

---

### Task 3 : Adaptateur Supabase réel `MonitoringClient`

**Files:**
- Create: `scraper/src/monitoring/supabaseClient.ts`

> Pas de test unitaire : pur code I/O Supabase (même posture que `persistence/repository.ts`). Vérification = typecheck.

- [ ] **Step 1 : Implémenter l'adaptateur**

Créer `scraper/src/monitoring/supabaseClient.ts` :

```ts
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import type { MonitoringClient, RunRecord, SourceRef } from './recordRun.js';

/** Adaptateur MonitoringClient basé sur le client service-role du scraper. */
export function createSupabaseMonitoringClient(): MonitoringClient {
  const sb = getSupabase();
  return {
    async resolveSourceId(source: SourceRef): Promise<string> {
      // Upsert idempotent par `code` ; renvoie l'id.
      const { data, error } = await sb
        .from('scraper_sources')
        .upsert({ code: source.code, label: source.label }, { onConflict: 'code' })
        .select('id')
        .single();
      if (error) throw new Error(`resolveSourceId: ${error.message}`);
      return data.id as string;
    },
    async insertRun(row): Promise<string> {
      const { data, error } = await sb.from('scraper_runs').insert(row).select('id').single();
      if (error) throw new Error(`insertRun: ${error.message}`);
      return data.id as string;
    },
    async finalizeRun(runId: string, record: RunRecord): Promise<void> {
      const { error } = await sb
        .from('scraper_runs')
        .update({
          status: record.status,
          finished_at: record.finished_at,
          duration_ms: record.duration_ms,
          rows_extracted: record.rows_extracted,
          rows_upserted: record.rows_upserted,
          error_count: record.error_count,
          metadata: record.metadata,
        })
        .eq('id', runId);
      if (error) logger.error({ err: error.message }, 'finalizeRun: échec MAJ scraper_runs');
    },
    async insertError(runId: string, err: unknown): Promise<void> {
      const e = err as Error;
      const { error } = await sb.from('scraper_errors').insert({
        run_id: runId,
        error_type: e?.name ?? 'Error',
        error_message: e?.message ?? String(err),
        stack_excerpt: e?.stack ? e.stack.split('\n').slice(0, 6).join('\n') : null,
      });
      if (error) logger.error({ err: error.message }, 'insertError: échec écriture scraper_errors');
    },
    async markSourceSuccess(sourceId: string, at: string): Promise<void> {
      const { error } = await sb.from('scraper_sources').update({ last_success_at: at }).eq('id', sourceId);
      if (error) logger.warn({ err: error.message }, 'markSourceSuccess: échec MAJ source');
    },
  };
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd scraper && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Commit**

```bash
git add scraper/src/monitoring/supabaseClient.ts
git commit -m "feat(scraper): adaptateur Supabase MonitoringClient (scraper_runs/errors/sources)"
```

---

### Task 4 : Brancher le monitoring dans le CLI `index.ts`

**Files:**
- Modify: `scraper/src/index.ts:60-115` (fonction `main` : flag `--trigger` + enrobage des commandes cron)

> Stratégie : un helper local `monitored(source, run)` enrobe le runner avec `withMonitoring`, en convertissant le résultat du runner en `MonitoredResult`. On instrumente les 6 commandes cron : `intraday`, `daily`, `score`, `events`, `dividends`, `obligations`. Le monitoring est désactivé en mode `--mock` (pas d'écriture base) et silencieusement neutralisé si l'écriture du run de départ échoue (le scrape prime).

- [ ] **Step 1 : Ajouter les imports + le helper + le flag trigger**

Dans `scraper/src/index.ts`, ajouter aux imports (après la ligne `import { logger } from './logger.js';`) :

```ts
import { withMonitoring, type MonitoredResult, type SourceRef } from './monitoring/recordRun.js';
import { createSupabaseMonitoringClient } from './monitoring/supabaseClient.js';
```

Puis, au tout début de `async function main()`, après `const positional = rest.filter((a) => !a.startsWith('--'));`, ajouter :

```ts
  const triggerType = rest.find((a) => a.startsWith('--trigger='))?.split('=')[1] ?? 'manual';

  /**
   * Enrobe un runner cron avec le monitoring (scraper_runs/errors).
   * Neutralisé en mock (aucune écriture) et tolérant aux pannes de monitoring :
   * si l'instrumentation échoue, on exécute quand même le runner nu.
   */
  async function monitored<T>(
    source: SourceRef,
    run: () => Promise<MonitoredResult<T>>,
  ): Promise<T> {
    if (mock) return (await run()).value;
    try {
      const client = createSupabaseMonitoringClient();
      return (await withMonitoring(client, source, triggerType, run)).value;
    } catch (err) {
      // L'erreur du runner remonte telle quelle (relancée par withMonitoring).
      throw err;
    }
  }
```

- [ ] **Step 2 : Enrober la commande `intraday`**

Remplacer le `case 'intraday'` actuel (lignes ~112-115) par :

```ts
    case 'intraday': {
      const res = await monitored(
        { code: 'intraday', label: 'Cours intraday (brvm.org)' },
        async () => {
          const r = await runIntraday({ mock });
          return {
            value: r,
            outcome: {
              status: r.nbActions > 0 ? 'success' : 'failed',
              rows_extracted: r.nbActions + r.nbIndices,
              rows_upserted: r.nbActions + r.nbIndices,
              metadata: { nbActions: r.nbActions, nbIndices: r.nbIndices },
            },
          };
        },
      );
      return res.nbActions > 0 ? 0 : 1;
    }
```

- [ ] **Step 3 : Enrober `daily`, `score`, `events`, `dividends`, `obligations`**

Remplacer le `case 'daily'` (et `undefined`) — lignes ~67-71 :

```ts
    case 'daily':
    case undefined: {
      const res = await monitored(
        { code: 'daily', label: 'Séance quotidienne (BDFIN)' },
        async () => {
          const r = await runDaily({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : r.status === 'partial' ? 'partial' : 'success',
              rows_extracted: r.nbActions ?? 0,
              rows_upserted: r.nbActions ?? 0,
              metadata: { status: r.status },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

Remplacer le `case 'score'` (lignes ~87-95) :

```ts
    case 'score': {
      const date = positional[0];
      if (date && !isIsoDate(date)) {
        logger.error('Usage: score [<YYYY-MM-DD>] [--mock]');
        return 1;
      }
      const res = await monitored(
        { code: 'score', label: 'Scoring / signaux' },
        async () => {
          const r = await runScoring({ date, mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.nbSignals ?? 0,
              rows_upserted: r.nbSignals ?? 0,
              metadata: { status: r.status },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

Remplacer le `case 'events'` (lignes ~96-99) :

```ts
    case 'events': {
      const res = await monitored(
        { code: 'events', label: 'Événements BRVM' },
        async () => {
          const r = await runEvents({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.nbEvents ?? 0,
              rows_upserted: r.nbEvents ?? 0,
              metadata: { status: r.status },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

Remplacer le `case 'dividends'` (lignes ~100-103) :

```ts
    case 'dividends': {
      const res = await monitored(
        { code: 'dividends', label: 'Dividendes' },
        async () => {
          const r = await runDividends({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.nbDividends ?? 0,
              rows_upserted: r.nbDividends ?? 0,
              metadata: { status: r.status },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

Remplacer le `case 'obligations'` (lignes ~104-107) :

```ts
    case 'obligations': {
      const res = await monitored(
        { code: 'obligations', label: 'Obligations' },
        async () => {
          const r = await runObligations({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.nbObligations ?? 0,
              rows_upserted: r.nbObligations ?? 0,
              metadata: { status: r.status },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

> ⚠️ Les champs `r.nbActions` / `r.nbSignals` / `r.nbEvents` / `r.nbDividends` / `r.nbObligations` doivent exister sur les types de retour des runners. **Avant d'écrire le code, ouvrir chaque runner** (`runners/runDaily.ts`, `scoring/runScoring.ts`, `events/runEvents.ts`, `dividends/runDividends.ts`, `scrapers/runObligations.ts`) et lire la signature de retour. Si un champ de comptage porte un autre nom, l'adapter ; s'il n'existe pas, mettre `rows_extracted: 0, rows_upserted: 0` et ne garder que `metadata: { status: r.status }`. Le `?? 0` couvre l'absence du champ mais le typecheck échouera si la propriété n'existe pas sur le type → c'est le garde-fou : corriger au nom réel.

- [ ] **Step 4 : Vérifier le typecheck (révèle les noms de champs réels)**

Run: `cd scraper && npx tsc --noEmit`
Expected: exit 0. Si erreur `Property 'nbX' does not exist`, lire le type du runner concerné et corriger le nom (ou retomber sur `metadata` seul).

- [ ] **Step 5 : Vérifier la non-régression des tests**

Run: `cd scraper && npx vitest run`
Expected: tous les tests verts (les 5 nouveaux + l'existant).

- [ ] **Step 6 : Smoke test en mock (aucune écriture base)**

Run: `cd scraper && npx tsx src/index.ts intraday --mock`
Expected: log `intraday terminé` + exit 0, sans appel Supabase (mock court-circuite `monitored`).

- [ ] **Step 7 : Commit**

```bash
git add scraper/src/index.ts
git commit -m "feat(scraper): instrumente 6 commandes cron (intraday/daily/score/events/dividends/obligations) via withMonitoring + flag --trigger"
```

---

### Task 5 : Couche données frontend du dashboard scraping

**Files:**
- Create: `frontend/lib/admin/scraping.ts`

> Isole les requêtes Supabase + le calcul des KPIs du JSX (testabilité, réutilisation). Vérification = typecheck.

- [ ] **Step 1 : Implémenter la couche données**

Créer `frontend/lib/admin/scraping.ts` :

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/** Client service-role en lecture seule (bypass RLS) — server-only. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface ScraperRunRow {
  id: string;
  source_code: string | null;
  source_label: string | null;
  trigger_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  rows_upserted: number;
  error_count: number;
}

export interface ScraperErrorRow {
  id: string;
  source_code: string | null;
  error_type: string | null;
  error_message: string | null;
  created_at: string | null;
}

export interface ScrapingDashboard {
  runs: ScraperRunRow[];
  errors: ScraperErrorRow[];
  kpis: {
    runs24h: number;
    successRate24h: number | null; // 0..1 ; null si aucun run
    rowsUpserted24h: number;
    openErrors: number;
  };
}

/** Charge les runs récents, erreurs ouvertes et KPIs 24h. Tolérant aux pannes (renvoie vide). */
export async function loadScrapingDashboard(): Promise<ScrapingDashboard> {
  const db = getAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [runsRes, errorsRes] = await Promise.all([
    db
      .from('scraper_runs')
      .select('id, trigger_type, status, started_at, finished_at, duration_ms, rows_upserted, error_count, scraper_sources(code, label)')
      .order('started_at', { ascending: false })
      .limit(40),
    db
      .from('scraper_errors')
      .select('id, source_code, error_type, error_message, created_at')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const runs: ScraperRunRow[] = (runsRes.data ?? []).map((r: Record<string, unknown>) => {
    const src = r.scraper_sources as { code?: string; label?: string } | null;
    return {
      id: r.id as string,
      source_code: src?.code ?? null,
      source_label: src?.label ?? null,
      trigger_type: r.trigger_type as string,
      status: r.status as string,
      started_at: (r.started_at as string) ?? null,
      finished_at: (r.finished_at as string) ?? null,
      duration_ms: (r.duration_ms as number) ?? null,
      rows_upserted: (r.rows_upserted as number) ?? 0,
      error_count: (r.error_count as number) ?? 0,
    };
  });

  const errors: ScraperErrorRow[] = (errorsRes.data ?? []) as ScraperErrorRow[];

  const recent = runs.filter((r) => r.started_at && r.started_at >= since && r.status !== 'running');
  const ok = recent.filter((r) => r.status === 'success' || r.status === 'partial').length;
  const kpis = {
    runs24h: recent.length,
    successRate24h: recent.length > 0 ? ok / recent.length : null,
    rowsUpserted24h: recent.reduce((acc, r) => acc + (r.rows_upserted ?? 0), 0),
    openErrors: errors.length,
  };

  return { runs, errors, kpis };
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/admin/scraping.ts
git commit -m "feat(admin): couche données dashboard scraping (runs/erreurs/KPIs 24h)"
```

---

### Task 6 : Page `/admin/scraping` (KPIs + tables réelles)

**Files:**
- Modify: `frontend/app/admin/scraping/page.tsx` (remplace le stub)

- [ ] **Step 1 : Remplacer le stub par la page réelle**

Écrire `frontend/app/admin/scraping/page.tsx` :

```tsx
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { loadScrapingDashboard } from '@/lib/admin/scraping';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scraping — Administration' };

const DASH = '—';

function fmtDateTime(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return DASH;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const STATUS_STYLE: Record<string, string> = {
  success: 'text-up',
  partial: 'text-warn',
  failed: 'text-down',
  running: 'text-info',
};
const STATUS_LABEL: Record<string, string> = {
  success: 'Succès',
  partial: 'Partiel',
  failed: 'Échec',
  running: 'En cours',
};

export default async function Page() {
  await requirePermission('scraping.read');
  const { runs, errors, kpis } = await loadScrapingDashboard();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Scraping"
        subtitle="Exécutions récentes des collecteurs, taux de réussite et incidents non résolus."
      />
      <div className="gold-rule" />

      <section aria-labelledby="scrap-kpis" className="space-y-3">
        <h2 id="scrap-kpis" className="overline text-faint">Dernières 24 h</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Exécutions" value={new Intl.NumberFormat('fr-FR').format(kpis.runs24h)} accent="sapphire" />
          <MetricCard
            label="Taux de réussite"
            value={kpis.successRate24h == null ? DASH : `${Math.round(kpis.successRate24h * 100)} %`}
            accent={kpis.successRate24h != null && kpis.successRate24h < 0.8 ? 'neutral' : 'emerald'}
          />
          <MetricCard label="Lignes écrites" value={new Intl.NumberFormat('fr-FR').format(kpis.rowsUpserted24h)} accent="neutral" />
          <MetricCard label="Incidents ouverts" value={new Intl.NumberFormat('fr-FR').format(kpis.openErrors)} accent={kpis.openErrors > 0 ? 'gold' : 'neutral'} />
        </div>
      </section>

      <section aria-labelledby="scrap-runs" className="space-y-3">
        <h2 id="scrap-runs" className="overline text-faint">Exécutions récentes</h2>
        {runs.length === 0 ? (
          <EmptyStatePremium title="Aucune exécution enregistrée" description="Les collecteurs instrumentés apparaîtront ici dès leur première exécution hors mode mock." />
        ) : (
          <PremiumPanel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Déclencheur</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Début</th>
                  <th className="px-4 py-3 font-medium text-right">Durée</th>
                  <th className="px-4 py-3 font-medium text-right tabular">Lignes</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-ivory">{r.source_label ?? r.source_code ?? DASH}</td>
                    <td className="px-4 py-2.5 text-muted">{r.trigger_type}</td>
                    <td className={`px-4 py-2.5 font-medium ${STATUS_STYLE[r.status] ?? 'text-muted'}`}>{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDateTime(r.started_at)}</td>
                    <td className="px-4 py-2.5 text-right text-muted tabular">{fmtDuration(r.duration_ms)}</td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">{new Intl.NumberFormat('fr-FR').format(r.rows_upserted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>
        )}
      </section>

      {errors.length > 0 && (
        <section aria-labelledby="scrap-errors" className="space-y-3">
          <h2 id="scrap-errors" className="overline text-faint">Incidents non résolus</h2>
          <PremiumPanel className="divide-y divide-border/40 p-0">
            {errors.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-down">{e.error_type ?? 'Erreur'}</span>
                  <span className="text-xs text-faint tabular">{fmtDateTime(e.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-muted break-words">{e.error_message ?? DASH}</p>
              </div>
            ))}
          </PremiumPanel>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0. (Si `EmptyStatePremium` n'accepte pas `title`/`description`, ouvrir `components/ui/premium.tsx` ligne ~139 et adapter aux props réelles.)

- [ ] **Step 3 : Vérifier le build**

Run: `cd frontend && npx next build`
Expected: `✓ Compiled successfully`, route `ƒ /admin/scraping` présente.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/admin/scraping/page.tsx
git commit -m "feat(admin): dashboard scraping réel (KPIs 24h + runs + incidents)"
```

---

### Task 7 : Couche données + page `/admin/audit-logs`

**Files:**
- Create: `frontend/lib/admin/auditLogs.ts`
- Modify: `frontend/app/admin/audit-logs/page.tsx` (remplace le stub)

- [ ] **Step 1 : Couche données**

Créer `frontend/lib/admin/auditLogs.ts` :

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface AuditLogRow {
  id: string;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  severity: string;
  created_at: string | null;
}

/** Charge les dernières entrées du journal d'audit (lecture seule, tolérant). */
export async function loadAuditLogs(limit = 60): Promise<AuditLogRow[]> {
  const db = getAdminClient();
  const { data } = await db
    .from('admin_audit_logs')
    .select('id, actor_role, action, resource_type, resource_id, severity, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditLogRow[];
}
```

- [ ] **Step 2 : Page**

Écrire `frontend/app/admin/audit-logs/page.tsx` :

```tsx
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { loadAuditLogs } from '@/lib/admin/auditLogs';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Journal d'audit — Administration" };

const DASH = '—';

function fmtDateTime(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const SEVERITY_STYLE: Record<string, string> = {
  info: 'text-muted',
  warning: 'text-warn',
  critical: 'text-down',
};

export default async function Page() {
  await requirePermission('audit.read');
  const logs = await loadAuditLogs();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Journal d'audit"
        subtitle="Traçabilité des actions d'administration (lecture seule)."
      />
      <div className="gold-rule" />

      {logs.length === 0 ? (
        <EmptyStatePremium title="Aucune entrée d'audit" description="Les actions d'administration sensibles seront journalisées ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Ressource</th>
                <th className="px-4 py-3 font-medium">Gravité</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDateTime(l.created_at)}</td>
                  <td className="px-4 py-2.5 text-muted">{l.actor_role ?? DASH}</td>
                  <td className="px-4 py-2.5 text-ivory">{l.action}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {l.resource_type}{l.resource_id ? ` · ${l.resource_id}` : ''}
                  </td>
                  <td className={`px-4 py-2.5 font-medium ${SEVERITY_STYLE[l.severity] ?? 'text-muted'}`}>{l.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes `ƒ /admin/audit-logs` et `ƒ /admin/scraping` présentes.

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/admin/auditLogs.ts frontend/app/admin/audit-logs/page.tsx
git commit -m "feat(admin): journal d'audit réel (admin_audit_logs)"
```

---

### Task 8 : Vérification finale + push

- [ ] **Step 1 : Suite de tests scraper complète**

Run: `cd scraper && npx vitest run && npx tsc --noEmit`
Expected: tous verts, typecheck exit 0.

- [ ] **Step 2 : Build frontend complet**

Run: `cd frontend && npx next build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3 : Push**

```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage**
- « Instrumentation scraper_runs » → Tasks 1–4 (buildRunRecord, withMonitoring, adaptateur Supabase, branchement CLI sur 6 commandes). ✅
- « Scraping dashboard » → Tasks 5–6 (couche données + page KPIs/runs/erreurs). ✅
- « Audit logs » → Task 7 (couche données + page). ✅
- Verification de bout en bout → Task 8. ✅

**2. Placeholder scan** : aucun TODO/TBD ; tout le code est fourni. Les deux points « ouvrir le fichier et adapter au nom réel » (Task 4 step 3, Task 6 step 2) sont des **garde-fous de vérification** explicitement bornés (le typecheck force la correction), pas des placeholders d'implémentation.

**3. Type consistency** : `RunOutcome`, `RunRecord`, `MonitoringClient`, `SourceRef`, `MonitoredResult<T>` définis en Task 1–2 et réutilisés à l'identique en Tasks 3–4. `ScraperRunRow`/`ScraperErrorRow`/`ScrapingDashboard` définis en Task 5 et consommés en Task 6. `AuditLogRow` défini et consommé en Task 7. Les noms de colonnes (`rows_upserted`, `error_count`, `duration_ms`, `is_resolved`, `last_success_at`, `actor_role`, `resource_type`, `severity`) correspondent à la migration 0041. ✅

**Risque résiduel connu** : les champs de comptage des runners (`nbActions`, `nbSignals`, `nbEvents`, `nbDividends`, `nbObligations`) sont supposés ; Task 4 step 4 (typecheck) les valide et impose la correction au nom réel si divergence. C'est le seul point nécessitant une lecture de code à l'exécution, et il est cadré.
