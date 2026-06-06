# Assistant IA du brief + Page admin clés API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter (1) une gestion des clés API LLM en base via une page admin réservée à l'admin, et (2) un assistant IA dans le brief de séance qui répond aux questions avec contexte du jour + outils ciblés.

**Architecture:** Clés résolues côté serveur (env prioritaire, sinon table `api_keys` lue en service_role). Page admin protégée par garde email-admin. Assistant IA = route serveur qui construit le contexte du jour, expose 2 outils (function calling), exécute la cascade DeepSeek→Mistral→Grok. Tout en Next.js App Router, clés jamais exposées au client.

**Tech Stack:** Next.js 14, TypeScript strict, Supabase (service_role côté serveur), APIs LLM OpenAI-compatibles, TailwindCSS dark finance.

---

## Fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0016_api_keys.sql` | Table api_keys (RLS service_role-only) |
| `frontend/lib/server/admin.ts` | ADMIN_EMAILS + isAdminEmail + requireAdmin |
| `frontend/lib/server/apiKeys.ts` | resolveApiKey (env → table) |
| `frontend/lib/server/admin.test.mjs` | tests isAdminEmail |
| `frontend/app/api/admin/cles/route.ts` | GET statut clés / POST maj (admin) |
| `frontend/components/admin/ApiKeysForm.tsx` | formulaire clés (client) |
| `frontend/app/admin/cles-api/page.tsx` | page admin (garde serveur) |
| `frontend/app/api/extract-llm/route.ts` | MODIF : utiliser resolveApiKey |
| `frontend/lib/briefTools.ts` | définitions outils + exécuteurs Supabase |
| `frontend/app/api/brief-assistant/route.ts` | chat IA + function calling |
| `frontend/components/dashboard/BriefAssistant.tsx` | bouton + modale chat |
| `frontend/app/page.tsx` | MODIF : insérer <BriefAssistant /> |
| `frontend/components/Sidebar.tsx` | MODIF : lien admin « 🔑 Clés API » |

---

## Task 1: Migration table api_keys

**Files:**
- Create: `supabase/migrations/0016_api_keys.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- ============================================================================
-- Clés API LLM gérées via la page admin. Accès UNIQUEMENT via service_role
-- (routes serveur) : aucune policy publique -> la clé anon ne lit/écrit rien.
-- ============================================================================
create table if not exists public.api_keys (
  provider   text primary key,          -- 'deepseek' | 'mistral' | 'xai'
  api_key    text not null,
  updated_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
-- Pas de policy : RLS activé sans policy => seul service_role contourne RLS.
```

- [ ] **Step 2: Appliquer**

Run (depuis la racine): `supabase db push`
Expected: `Applying migration 0016_api_keys.sql...` puis `Finished`.

- [ ] **Step 3: Vérifier (service_role lit, anon non)**

Run (depuis `scraper/`): `node --env-file=.env.local -e "import('@supabase/supabase-js').then(async m=>{const sb=m.createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const{error}=await sb.from('api_keys').select('provider').limit(1);console.log(error?error.message:'OK api_keys (service_role)');})"`
Expected: `OK api_keys (service_role)`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0016_api_keys.sql
git commit -m "feat(admin-cles): migration table api_keys (RLS service_role-only)"
```

---

## Task 2: Garde admin (`admin.ts`)

**Files:**
- Create: `frontend/lib/server/admin.ts`
- Create: `frontend/lib/server/admin.test.mjs`

- [ ] **Step 1: Écrire le test**

```javascript
// frontend/lib/server/admin.test.mjs
import assert from 'node:assert';
import { isAdminEmail } from './admin.ts';

assert.equal(isAdminEmail('ebouak@gmail.com'), true);
assert.equal(isAdminEmail('EBOUAK@Gmail.com'), true);   // casse ignorée
assert.equal(isAdminEmail('autre@gmail.com'), false);
assert.equal(isAdminEmail(null), false);
assert.equal(isAdminEmail(undefined), false);

console.log('✓ admin tests OK');
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run (depuis `frontend/`): `npx tsx lib/server/admin.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `admin.ts`**

```typescript
// frontend/lib/server/admin.ts
import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Emails autorisés à l'administration (clés API, etc.). */
export const ADMIN_EMAILS = ['ebouak@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Garde pour route API : renvoie l'email admin, ou une NextResponse d'erreur
 * (401 non connecté, 403 non-admin) à retourner telle quelle.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<{ email: string } | { error: NextResponse }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Accès réservé à l’administrateur' }, { status: 403 }) };
  }
  return { email: user.email! };
}
```

NOTE : `'server-only'` empêche l'import côté client. Le fichier `.test.mjs`
importe `isAdminEmail` via tsx (Node) — si `'server-only'` casse le test, retire
la ligne `import 'server-only';` UNIQUEMENT le temps du test n'est pas une option ;
à la place, le test n'importe que `isAdminEmail` qui n'utilise rien de serveur.
Si tsx échoue sur `server-only`, déplace `ADMIN_EMAILS`/`isAdminEmail` dans un
sous-fichier `admin-emails.ts` sans `server-only`, et réexporte-le depuis
`admin.ts`. Choisis la solution qui fait passer le test sans exposer de secret.

- [ ] **Step 4: Lancer le test (succès attendu)**

Run (depuis `frontend/`): `npx tsx lib/server/admin.test.mjs`
Expected: `✓ admin tests OK`

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/server/admin.ts frontend/lib/server/admin.test.mjs
git commit -m "feat(admin-cles): garde admin (isAdminEmail + requireAdmin) + tests"
```

---

## Task 3: Résolution des clés (`apiKeys.ts`)

**Files:**
- Create: `frontend/lib/server/apiKeys.ts`

- [ ] **Step 1: Implémenter**

```typescript
// frontend/lib/server/apiKeys.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export type LlmProvider = 'deepseek' | 'mistral' | 'xai';

const ENV_VAR: Record<LlmProvider, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
};

/**
 * Résout la clé d'un provider. Priorité : variable d'env, sinon table api_keys
 * (lue via service_role). Renvoie null si aucune source.
 */
export async function resolveApiKey(provider: LlmProvider): Promise<string | null> {
  const fromEnv = process.env[ENV_VAR[provider]];
  if (fromEnv) return fromEnv;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  const admin = createClient(url, svc);
  const { data } = await admin.from('api_keys').select('api_key').eq('provider', provider).maybeSingle();
  return data?.api_key ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/server/apiKeys.ts
git commit -m "feat(admin-cles): resolveApiKey (env -> table api_keys)"
```

---

## Task 4: Route admin clés (`/api/admin/cles`)

**Files:**
- Create: `frontend/app/api/admin/cles/route.ts`

- [ ] **Step 1: Implémenter GET (statut) + POST (maj)**

```typescript
// frontend/app/api/admin/cles/route.ts
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSb } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/server/admin';

const PROVIDERS = ['deepseek', 'mistral', 'xai'] as const;
type Provider = (typeof PROVIDERS)[number];
const ENV_VAR: Record<Provider, string> = {
  deepseek: 'DEEPSEEK_API_KEY', mistral: 'MISTRAL_API_KEY', xai: 'XAI_API_KEY',
};

function admin() {
  return createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET : statut de chaque clé (jamais la valeur en clair). */
export async function GET() {
  const guard = await requireAdmin(createServerClient());
  if ('error' in guard) return guard.error;

  const { data } = await admin().from('api_keys').select('provider');
  const inTable = new Set((data ?? []).map((r) => r.provider as string));
  const status = PROVIDERS.map((p) => ({
    provider: p,
    configured: Boolean(process.env[ENV_VAR[p]]) || inTable.has(p),
    source: process.env[ENV_VAR[p]] ? 'env' : inTable.has(p) ? 'table' : null,
  }));
  return NextResponse.json({ status });
}

/** POST : { provider, api_key } -> upsert (admin uniquement). */
export async function POST(req: Request) {
  const guard = await requireAdmin(createServerClient());
  if ('error' in guard) return guard.error;

  const body = (await req.json().catch(() => null)) as { provider?: string; api_key?: string } | null;
  if (!body || !PROVIDERS.includes(body.provider as Provider) || !body.api_key?.trim()) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const { error } = await admin()
    .from('api_keys')
    .upsert({ provider: body.provider, api_key: body.api_key.trim(), updated_at: new Date().toISOString() },
            { onConflict: 'provider' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/admin/cles/route.ts
git commit -m "feat(admin-cles): route API statut + maj clés (admin only)"
```

---

## Task 5: UI page admin clés

**Files:**
- Create: `frontend/components/admin/ApiKeysForm.tsx`
- Create: `frontend/app/admin/cles-api/page.tsx`

- [ ] **Step 1: Formulaire client**

```tsx
// frontend/components/admin/ApiKeysForm.tsx
'use client';

import { useEffect, useState } from 'react';

interface KeyStatus { provider: string; configured: boolean; source: string | null; }
const LABELS: Record<string, string> = { deepseek: 'DeepSeek (prioritaire)', mistral: 'Mistral (vision/scannés)', xai: 'Grok / xAI (fallback)' };

export default function ApiKeysForm() {
  const [status, setStatus] = useState<KeyStatus[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/admin/cles');
    if (r.ok) { const j = await r.json(); setStatus(j.status); }
  }
  useEffect(() => { void load(); }, []);

  async function save(provider: string) {
    setBusy(provider); setMsg(null);
    try {
      const r = await fetch('/api/admin/cles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: vals[provider] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Échec');
      setVals({ ...vals, [provider]: '' });
      setMsg(`Clé ${provider} enregistrée.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {status.map((s) => (
        <div key={s.provider} className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{LABELS[s.provider] ?? s.provider}</span>
            <span className={`text-xs ${s.configured ? 'text-up' : 'text-muted'}`}>
              {s.configured ? `✓ configurée (${s.source})` : '○ absente'}
            </span>
          </div>
          <div className="flex gap-2">
            <input type="password" placeholder="Nouvelle clé…" value={vals[s.provider] ?? ''}
              onChange={(e) => setVals({ ...vals, [s.provider]: e.target.value })}
              className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm" />
            <button type="button" onClick={() => save(s.provider)} disabled={busy === s.provider || !vals[s.provider]?.trim()}
              className="text-xs bg-up/90 hover:bg-up text-black font-medium rounded px-3 disabled:opacity-50">
              {busy === s.provider ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ))}
      {msg && <p className="text-xs text-muted">{msg}</p>}
      <p className="text-[10px] text-muted">Les clés env Vercel sont prioritaires. Les clés saisies ici sont stockées en base (service_role) et jamais réaffichées.</p>
    </div>
  );
}
```

- [ ] **Step 2: Page serveur avec garde admin**

```tsx
// frontend/app/admin/cles-api/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/server/admin';
import ApiKeysForm from '@/components/admin/ApiKeysForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clés API' };

export default async function ClesApiPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) {
    return <div className="p-6 text-muted">Accès réservé à l’administrateur.</div>;
  }
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">🔑 Clés API</h1>
        <p className="text-sm text-muted">Configurez les clés des fournisseurs IA (DeepSeek, Mistral, Grok).</p>
      </div>
      <ApiKeysForm />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit && npm run build`
Expected: route `/admin/cles-api` listée, build OK.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/admin/ApiKeysForm.tsx "frontend/app/admin/cles-api/page.tsx"
git commit -m "feat(admin-cles): page /admin/cles-api (garde admin + formulaire)"
```

---

## Task 6: Brancher extract-llm sur resolveApiKey

**Files:**
- Modify: `frontend/app/api/extract-llm/route.ts`

- [ ] **Step 1: Remplacer les lectures env par resolveApiKey**

Dans `frontend/app/api/extract-llm/route.ts`, le code lit `process.env.DEEPSEEK_API_KEY`
etc. de façon synchrone dans `providers()`. On rend la résolution asynchrone.

Remplacer la fonction `providers()` et son usage. Localiser le bloc :
```typescript
function providers(): Record<Provider, ProviderCfg> {
  return {
    deepseek: { key: process.env.DEEPSEEK_API_KEY, url: 'https://api.deepseek.com/chat/completions', model: () => 'deepseek-chat' },
    mistral: { key: process.env.MISTRAL_API_KEY, url: 'https://api.mistral.ai/v1/chat/completions', model: (m) => (m === 'vision' ? 'pixtral-large-latest' : 'mistral-large-latest') },
    grok: { key: process.env.XAI_API_KEY, url: 'https://api.x.ai/v1/chat/completions', model: (m) => (m === 'vision' ? 'grok-2-vision-latest' : 'grok-2-latest') },
  };
}
```
Remplacer par (clés résolues via resolveApiKey, provider 'grok' mappé sur la clé 'xai') :
```typescript
import { resolveApiKey } from '@/lib/server/apiKeys';

async function providers(): Promise<Record<Provider, ProviderCfg>> {
  const [deepseekKey, mistralKey, xaiKey] = await Promise.all([
    resolveApiKey('deepseek'), resolveApiKey('mistral'), resolveApiKey('xai'),
  ]);
  return {
    deepseek: { key: deepseekKey ?? undefined, url: 'https://api.deepseek.com/chat/completions', model: () => 'deepseek-chat' },
    mistral: { key: mistralKey ?? undefined, url: 'https://api.mistral.ai/v1/chat/completions', model: (m) => (m === 'vision' ? 'pixtral-large-latest' : 'mistral-large-latest') },
    grok: { key: xaiKey ?? undefined, url: 'https://api.x.ai/v1/chat/completions', model: (m) => (m === 'vision' ? 'grok-2-vision-latest' : 'grok-2-latest') },
  };
}
```
Puis dans `POST`, remplacer `const cfgs = providers();` par `const cfgs = await providers();`. Ajouter l'import en haut.

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/extract-llm/route.ts
git commit -m "refactor(import-ia): clés via resolveApiKey (env -> table admin)"
```

---

## Task 7: Outils de l'assistant (`briefTools.ts`)

**Files:**
- Create: `frontend/lib/briefTools.ts`

- [ ] **Step 1: Implémenter définitions + exécuteurs**

```typescript
// frontend/lib/briefTools.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Schémas d'outils (format function-calling OpenAI). */
export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'get_action_history',
      description: "Cours de clôture récents d'une action BRVM (par code, ex. SNTS).",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM 4 lettres' },
          days: { type: 'integer', description: 'Nombre de séances (défaut 30, max 90)' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fundamentals',
      description: "Derniers fondamentaux d'un émetteur (CA, résultat net, capitaux propres).",
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'Code BRVM 4 lettres' } },
        required: ['code'],
      },
    },
  },
];

/** Exécute un outil demandé par le LLM et renvoie un résultat sérialisable. */
export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const sb = createClient();
  if (name === 'get_action_history') {
    const code = String(args.code ?? '').toUpperCase();
    const days = Math.min(Number(args.days ?? 30) || 30, 90);
    const { data } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour, variation_pct')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(days);
    return { code, points: data ?? [] };
  }
  if (name === 'get_fundamentals') {
    const code = String(args.code ?? '').toUpperCase();
    const { data } = await sb
      .from('fundamentals')
      .select('year, revenue, net_income, equity, debt')
      .eq('code', code)
      .order('year', { ascending: false })
      .limit(3);
    return { code, fundamentals: data ?? [] };
  }
  return { error: `Outil inconnu: ${name}` };
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/briefTools.ts
git commit -m "feat(ia-brief): outils ciblés (historique action, fondamentaux)"
```

---

## Task 8: Route assistant IA (`/api/brief-assistant`)

**Files:**
- Create: `frontend/app/api/brief-assistant/route.ts`

- [ ] **Step 1: Implémenter (contexte du jour + cascade + function calling)**

```typescript
// frontend/app/api/brief-assistant/route.ts
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { TOOL_DEFS, runTool } from '@/lib/briefTools';

export const maxDuration = 60;

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  { provider: 'xai', url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
];

const SYSTEM =
  "Tu es un analyste financier de la BRVM. Réponds en français, de façon concise et factuelle. " +
  "Base-toi UNIQUEMENT sur le contexte fourni et les outils disponibles. N'invente jamais de chiffres : " +
  "si une donnée manque, dis 'donnée non disponible'. Pas de conseil d'investissement personnalisé.";

async function buildContext(): Promise<string> {
  const sb = createServerClient();
  const { data: lastRow } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche;
  if (!lastDate) return 'Aucune donnée de marché disponible.';
  const { data: lastIdx } = await sb.from('brvm_indices_daily').select('code, valeur, variation_pct, date_marche').not('valeur', 'is', null).order('date_marche', { ascending: false }).limit(2);
  const { data: actions } = await sb.from('brvm_actions_daily').select('code, variation_pct, valeur_echangee').eq('date_marche', lastDate);
  const rows = actions ?? [];
  const up = rows.filter((r) => (r.variation_pct ?? 0) > 0).length;
  const down = rows.filter((r) => (r.variation_pct ?? 0) < 0).length;
  const topVol = [...rows].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, 5).map((r) => r.code).join(', ');
  const idxTxt = (lastIdx ?? []).map((i) => `${i.code}=${i.valeur} (${i.variation_pct}%)`).join(' ; ');
  return `Séance du ${lastDate}. Indices: ${idxTxt}. ${up} actions en hausse, ${down} en baisse sur ${rows.length}. Top volumes: ${topVol}.`;
}

interface ChatMsg { role: string; content: unknown; tool_call_id?: string; tool_calls?: unknown; name?: string; }

async function callLLM(cfg: { url: string; model: string }, key: string, messages: ChatMsg[], withTools: boolean) {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2, ...(withTools ? { tools: TOOL_DEFS } : {}) }),
    signal: AbortSignal.timeout(50000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function POST(request: Request) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { question?: string; history?: ChatMsg[] } | null;
  if (!body?.question?.trim()) return NextResponse.json({ error: 'Question vide' }, { status: 400 });

  // 1er provider disponible.
  let chosen: { url: string; model: string; key: string } | null = null;
  for (const c of ORDER) {
    const k = await resolveApiKey(c.provider);
    if (k) { chosen = { url: c.url, model: c.model, key: k }; break; }
  }
  if (!chosen) return NextResponse.json({ error: 'Aucune clé IA configurée (page admin Clés API).' }, { status: 503 });

  const ctx = await buildContext();
  const messages: ChatMsg[] = [
    { role: 'system', content: `${SYSTEM}\n\nContexte du jour: ${ctx}` },
    ...((body.history ?? []).slice(-6)),
    { role: 'user', content: body.question },
  ];

  try {
    // Boucle d'outils (max 3 tours).
    for (let turn = 0; turn < 3; turn++) {
      const json = await callLLM(chosen, chosen.key, messages, true);
      const msg = json?.choices?.[0]?.message;
      if (!msg) break;
      const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls?.length) {
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
        for (const tc of toolCalls) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
          const result = await runTool(tc.function.name, parsed);
          messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
        }
        continue; // redonne la main au LLM avec les résultats d'outils
      }
      return NextResponse.json({ answer: msg.content ?? '', provider: chosen.model });
    }
    // Dernier tour sans outils pour forcer une réponse.
    const finalJson = await callLLM(chosen, chosen.key, messages, false);
    return NextResponse.json({ answer: finalJson?.choices?.[0]?.message?.content ?? 'Réponse indisponible.', provider: chosen.model });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur IA' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/brief-assistant/route.ts
git commit -m "feat(ia-brief): route assistant (contexte du jour + function calling cascade)"
```

---

## Task 9: Composant BriefAssistant + intégration dashboard

**Files:**
- Create: `frontend/components/dashboard/BriefAssistant.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Composant chat**

```tsx
// frontend/components/dashboard/BriefAssistant.tsx
'use client';

import { useState } from 'react';

interface Msg { role: 'user' | 'assistant'; content: string; }

export default function BriefAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    const next = [...msgs, { role: 'user' as const, content: question }];
    setMsgs(next); setQ('');
    try {
      const r = await fetch('/api/brief-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: msgs.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const raw = await r.text();
      let j: { answer?: string; error?: string };
      try { j = JSON.parse(raw); } catch { j = { error: raw.slice(0, 200) }; }
      setMsgs([...next, { role: 'assistant', content: r.ok ? (j.answer ?? '') : `⚠️ ${j.error ?? 'Erreur'}` }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Erreur'}` }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs bg-up/10 border border-up/30 text-up rounded px-3 py-1.5 hover:bg-up/20 transition">
        🤖 Demander à l’IA
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-surface border border-border rounded-xl shadow-lg max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">🤖 Assistant IA — Séance</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-fg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {msgs.length === 0 && <p className="text-xs text-muted">Posez une question sur la séance (ex. « Quelles actions ont le plus monté ? », « Analyse SONATEL »).</p>}
              {msgs.map((m, i) => (
                <div key={i} className={`text-sm ${m.role === 'user' ? 'text-white' : 'text-muted'}`}>
                  <span className="text-[10px] uppercase opacity-60">{m.role === 'user' ? 'Vous' : 'IA'}</span>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
              {busy && <p className="text-xs text-muted">🤖 réflexion…</p>}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
                placeholder="Votre question…" className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm" />
              <button type="button" onClick={ask} disabled={busy || !q.trim()}
                className="text-xs bg-up/90 hover:bg-up text-black font-medium rounded px-3 disabled:opacity-50">Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Intégrer dans le dashboard**

Dans `frontend/app/page.tsx`, ajouter l'import en haut (près des autres composants) :
```tsx
import BriefAssistant from '@/components/dashboard/BriefAssistant';
```
Puis remplacer le bloc :
```tsx
      {/* ── Brief narratif ── */}
      {brief && <DailyBrief brief={brief} />}
```
par :
```tsx
      {/* ── Brief narratif ── */}
      {brief && (
        <div className="relative">
          <DailyBrief brief={brief} />
          <div className="absolute top-4 right-4"><BriefAssistant /></div>
        </div>
      )}
```

- [ ] **Step 3: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/BriefAssistant.tsx frontend/app/page.tsx
git commit -m "feat(ia-brief): bouton + modale assistant IA dans le brief"
```

---

## Task 10: Lien sidebar admin + déploiement

**Files:**
- Modify: `frontend/components/Sidebar.tsx`

- [ ] **Step 1: Ajouter le lien (visible par tous, page protégée serveur)**

Dans le `NAV` de `frontend/components/Sidebar.tsx`, ajouter après l'entrée
`{ href: '/admin/import-fondamentaux', label: '📥 Import IA' },` :
```tsx
  { href: '/admin/cles-api', label: '🔑 Clés API' },
```
(La page elle-même refuse l'accès aux non-admins ; le lien peut rester visible.)

- [ ] **Step 2: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit && npm run build`
Expected: build OK, routes `/admin/cles-api`, `/api/admin/cles`, `/api/brief-assistant` présentes.

- [ ] **Step 3: Déployer**

Run (depuis `frontend/`): `npx vercel deploy --prod --yes`
Expected: `Aliased: https://frontend-zeta-ten-22.vercel.app`.

- [ ] **Step 4: Vérifier les routes**

Run: `for p in admin/cles-api ; do curl -s -o /dev/null -w "%{http_code} /$p\n" "https://frontend-zeta-ten-22.vercel.app/$p"; done`
Expected: `200 /admin/cles-api` (page rend « accès réservé » si non connecté, mais répond 200).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Sidebar.tsx
git commit -m "feat(admin-cles): lien sidebar Clés API + déploiement"
```

---

## Self-review (effectué)

- **Couverture spec** : migration api_keys (T1), garde admin (T2), resolveApiKey
  (T3), route admin clés (T4), page admin UI (T5), extract-llm branché sur les
  clés table (T6), outils IA (T7), route assistant + function calling + cascade
  (T8), composant chat + intégration brief (T9), sidebar + deploy (T10). Toutes
  les sections de la spec sont couvertes.
- **Types cohérents** : `LlmProvider` ('deepseek'|'mistral'|'xai') défini T3,
  utilisé T6/T8. `resolveApiKey` (T3) utilisé T6/T8. `TOOL_DEFS`/`runTool` (T7)
  utilisés T8. `isAdminEmail`/`requireAdmin` (T2) utilisés T4/T5. Provider 'grok'
  (UI/cascade) ↔ clé 'xai' (env/table) : mapping explicite en T6.
- **Pas de placeholder** : tout le code est fourni.
- **Sécurité** : clés jamais renvoyées en clair (T4 GET = statut booléen) ;
  routes admin gardées par requireAdmin ; clés lues via service_role ;
  `'server-only'` sur les libs serveur.
- **Robustesse** : parsing réponse tolérant côté client (T9 try/catch JSON),
  borne 3 tours d'outils (T8), 1er provider disponible.
- **YAGNI** : pas de chiffrement applicatif (RLS service_role + chiffrement
  Supabase au repos), pas de streaming, historique UI local.
