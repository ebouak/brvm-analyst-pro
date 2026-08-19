# Agent conversationnel WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un utilisateur WESTBOURSE avec un numéro WhatsApp vérifié d'écrire au numéro professionnel de la plateforme et de recevoir des réponses générées à partir de ses propres données (watchlist, cours, fondamentaux, signaux) — jamais un conseil en investissement.

**Architecture:** Webhook Next.js (`app/api/whatsapp/webhook/route.ts`) reçoit les messages Meta Cloud API, un module `frontend/lib/whatsappAgent/` orchestre identification → consentement → quota → contexte → LLM (cascade DeepSeek→Mistral déjà utilisée ailleurs) → persistance → réponse (Meta Cloud API, fonction dédiée dans le même module — le frontend ne peut pas importer le package `scraper` séparé, donc on duplique la petite fonction d'envoi plutôt que de coupler les deux apps, même logique que la duplication déjà assumée entre `scraper/src/hebdo/pure/` et `frontend/lib/hebdo/`).

**Tech Stack:** Next.js 14 App Router (Route Handlers), Supabase (Postgres + RLS), TypeScript, Meta WhatsApp Cloud API.

---

### Task 1 : Migration — table `whatsapp_conversations` + colonnes `notification_prefs` + seed `feature_flags`

**Files:**
- Create: `supabase/migrations/0125_whatsapp_agent.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- 0125_whatsapp_agent.sql
-- Agent conversationnel WhatsApp — historique de conversation, consentement
-- RGPD distinct de l'opt-in brief/alertes (0087), et gate d'accès par plan
-- via feature_flags (0091).
--
-- RGPD : donnée perso = contenu des messages échangés avec l'agent. Finalité :
-- répondre aux questions de l'utilisateur avec mémoire conversationnelle
-- courte. Base légale : consentement explicite distinct (agent_optin).
-- Conservation : 90 jours (purge ajoutée à purge_rgpd_retention(), voir
-- migration 0126). Couverte par /api/account/export et /api/account/delete.
--
-- Après application : lancer le scan get_advisors (security) et tester la
-- table avec la clé anon (doit renvoyer 0 ligne sans session).
-- ============================================================================

-- ── 1. Historique de conversation ────────────────────────────────────────────
create table if not exists public.whatsapp_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  contenu     text not null,
  created_at  timestamptz not null default now()
);

comment on table public.whatsapp_conversations is
  'Historique des échanges avec l''agent conversationnel WhatsApp. Donnée perso : contenu des messages — consentement explicite (notification_prefs.agent_optin), rétention 90 jours, cascade à la suppression du compte.';

create index if not exists idx_whatsapp_conversations_user
  on public.whatsapp_conversations (user_id, created_at desc);

alter table public.whatsapp_conversations enable row level security;

-- Lecture par le propriétaire uniquement (ex. futur historique visible dans
-- les paramètres du compte). Pas de policy insert/update/delete pour
-- anon/authenticated : seul service_role écrit (le webhook tourne côté
-- serveur avec la clé service_role).
drop policy if exists "whatsapp_conversations_owner_select" on public.whatsapp_conversations;
create policy "whatsapp_conversations_owner_select" on public.whatsapp_conversations
  for select using (auth.uid() = user_id);

-- ── 2. Consentement distinct sur notification_prefs ──────────────────────────
alter table public.notification_prefs
  add column if not exists agent_optin boolean not null default false,
  add column if not exists agent_optin_at timestamptz;

comment on column public.notification_prefs.agent_optin is
  'Consentement DISTINCT de whatsapp_optin : autorise l''agent conversationnel à garder l''historique des échanges (90 jours). Ne pas confondre avec l''opt-in brief/alertes.';

-- ── 3. Gate d'accès + quota par plan ─────────────────────────────────────────
insert into public.feature_flags (code, label, acces, quota_free, quota_premium, description)
values (
  'whatsapp_agent',
  'Agent WhatsApp',
  'free',
  10,
  100,
  'Nombre de messages traités par l''agent conversationnel WhatsApp, par jour.'
)
on conflict (code) do nothing;
```

- [ ] **Step 2 : Appliquer la migration**

L'utilisateur applique la migration lui-même (Supabase CLI `supabase db push` ou éditeur SQL) — ne pas tenter de le faire depuis cette session. Une fois confirmé appliqué, continuer.

- [ ] **Step 3 : Vérifier RLS avec la clé anon**

Run (remplacer `<ANON_KEY>` et `<PROJECT_REF>` par les vraies valeurs) :
```bash
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/whatsapp_conversations?select=id" -H "apikey: <ANON_KEY>"
```
Expected: `[]` (liste vide, pas d'erreur, pas de ligne exposée sans session).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0125_whatsapp_agent.sql
git commit -m "feat(whatsapp-agent): migration table conversations + consentement + gate d'accès"
```

---

### Task 2 : Migration — purge 90 jours dans `purge_rgpd_retention()`

**Files:**
- Create: `supabase/migrations/0126_whatsapp_conversations_retention.sql`

**Context:** La fonction `purge_rgpd_retention()` (migration 0094) est la source unique de vérité pour toute purge RGPD planifiée (cron `rgpd-retention-monthly`, 1er du mois 03:00). On y ajoute `whatsapp_conversations` plutôt que de créer un second job.

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- 0126_whatsapp_conversations_retention.sql
-- Ajoute whatsapp_conversations (90 jours) à la purge RGPD centralisée.
-- Voir 0094 pour le raisonnement : une seule fonction planifiée, pas de
-- second calendrier de rétention à maintenir en parallèle.
-- ============================================================================

create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
end;
$function$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

- [ ] **Step 2 : Appliquer la migration**

L'utilisateur applique la migration lui-même. Une fois confirmé appliqué, continuer.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0126_whatsapp_conversations_retention.sql
git commit -m "feat(whatsapp-agent): ajoute la purge 90 jours à purge_rgpd_retention"
```

---

### Task 3 : `featureGate.ts` — nouveau `FeatureCode`

**Files:**
- Modify: `frontend/lib/server/featureGate.ts:18-23`

- [ ] **Step 1 : Ajouter le code au type union**

Dans `frontend/lib/server/featureGate.ts`, remplacer :

```ts
export type FeatureCode =
  | 'diagnostic_ia'
  | 'assistant_ia'
  | 'backtest'
  | 'paper_trading'
  | 'dcf';
```

par :

```ts
export type FeatureCode =
  | 'diagnostic_ia'
  | 'assistant_ia'
  | 'backtest'
  | 'paper_trading'
  | 'dcf'
  | 'whatsapp_agent';
```

Rien d'autre à modifier dans ce fichier — `checkFeature()` lit déjà `feature_flags` par `code`, la ligne `whatsapp_agent` a été seedée en Task 1.

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/server/featureGate.ts
git commit -m "feat(whatsapp-agent): déclare le FeatureCode whatsapp_agent"
```

---

### Task 4 : Vérification de signature Meta (fonction pure)

**Files:**
- Create: `frontend/lib/whatsappAgent/verifySignature.ts`
- Test: `frontend/lib/whatsappAgent/verifySignature.test.mjs`

**Context:** Meta signe chaque requête webhook avec un HMAC-SHA256 de l'App Secret sur le corps brut, transmis dans l'en-tête `X-Hub-Signature-256: sha256=<hex>`. Toute requête sans signature valide doit être rejetée avant tout traitement.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// frontend/lib/whatsappAgent/verifySignature.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyMetaSignature } from './verifySignature.ts';

const SECRET = 'test-app-secret';

function sign(body) {
  const hmac = crypto.createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
  return `sha256=${hmac}`;
}

test('accepte une signature valide', () => {
  const body = '{"hello":"world"}';
  const header = sign(body);
  assert.equal(verifyMetaSignature(body, header, SECRET), true);
});

test('rejette une signature invalide', () => {
  const body = '{"hello":"world"}';
  assert.equal(verifyMetaSignature(body, 'sha256=deadbeef', SECRET), false);
});

test('rejette un en-tête absent', () => {
  const body = '{"hello":"world"}';
  assert.equal(verifyMetaSignature(body, null, SECRET), false);
});

test('rejette un corps modifié après signature', () => {
  const original = '{"hello":"world"}';
  const header = sign(original);
  const tampered = '{"hello":"WORLD"}';
  assert.equal(verifyMetaSignature(tampered, header, SECRET), false);
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run: `cd frontend && npx tsx --test lib/whatsappAgent/verifySignature.test.mjs`
Expected: échec — `verifySignature.ts` n'existe pas encore.

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/whatsappAgent/verifySignature.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie la signature Meta (X-Hub-Signature-256) d'une requête webhook
 * WhatsApp Cloud API. `rawBody` doit être le corps BRUT de la requête (avant
 * tout parsing JSON) — le HMAC porte sur les octets exacts envoyés par Meta.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice('sha256='.length);
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run: `cd frontend && npx tsx --test lib/whatsappAgent/verifySignature.test.mjs`
Expected: 4 tests, tous verts.

- [ ] **Step 5 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add frontend/lib/whatsappAgent/verifySignature.ts frontend/lib/whatsappAgent/verifySignature.test.mjs
git commit -m "feat(whatsapp-agent): vérification de signature Meta (HMAC-SHA256)"
```

---

### Task 5 : Envoi WhatsApp sortant (copie frontend de `sendWhatsAppRaw`)

**Files:**
- Create: `frontend/lib/whatsappAgent/sendWhatsapp.ts`

**Context:** `scraper/src/alerts/channels.ts` a déjà `sendWhatsAppRaw(to, body)` — même logique Meta Cloud API. Le frontend ne peut pas importer le package `scraper` (deux apps Node séparées, déploiements distincts) : on duplique cette petite fonction, pas de test dédié (identique en substance au code déjà en production côté scraper, appel HTTP réel non mockable utilement).

- [ ] **Step 1 : Implémenter**

```ts
// frontend/lib/whatsappAgent/sendWhatsapp.ts
import 'server-only';

/**
 * Envoi WhatsApp TEXTE en réponse à un message entrant (Meta Cloud API).
 * Copie volontaire de scraper/src/alerts/channels.ts:sendWhatsAppRaw — le
 * frontend et le scraper sont deux apps Node découplées (déploiements
 * distincts, Vercel vs GitHub Actions), pas de package partagé. Toute
 * correction à ce comportement doit être reportée des deux côtés.
 *
 * Le texte libre ne passe que dans la fenêtre de 24 h après le dernier
 * message entrant du destinataire — cas normal ici puisqu'on RÉPOND à un
 * message qui vient d'arriver.
 */
export async function sendWhatsAppReply(to: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error('whatsappAgent/sendWhatsapp: WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID manquant');
    return false;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        // Limite Cloud API : 4096 caractères par message texte.
        text: { body: body.slice(0, 4096) },
      }),
    });
    if (!resp.ok) {
      console.error('whatsappAgent/sendWhatsapp: échec envoi', { status: resp.status });
      return false;
    }
    return true;
  } catch (err) {
    console.error('whatsappAgent/sendWhatsapp: exception', err instanceof Error ? err.message : String(err));
    return false;
  }
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/whatsappAgent/sendWhatsapp.ts
git commit -m "feat(whatsapp-agent): envoi de réponse WhatsApp (Meta Cloud API)"
```

---

### Task 6 : Prompt système (fonction pure)

**Files:**
- Create: `frontend/lib/whatsappAgent/systemPrompt.ts`
- Test: `frontend/lib/whatsappAgent/systemPrompt.test.mjs`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// frontend/lib/whatsappAgent/systemPrompt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from './systemPrompt.ts';

test('interdit explicitement le conseil en investissement', () => {
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.match(prompt.toLowerCase(), /jamais.*conseil|conseil.*jamais/);
});

test('inclut la watchlist quand fournie', () => {
  const prompt = buildSystemPrompt({ watchlistCodes: ['SNTS', 'ETIT'] });
  assert.match(prompt, /SNTS/);
  assert.match(prompt, /ETIT/);
});

test("ne mentionne pas de watchlist quand elle est vide", () => {
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.doesNotMatch(prompt, /Watchlist\s*:/);
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run: `cd frontend && npx tsx --test lib/whatsappAgent/systemPrompt.test.mjs`
Expected: échec — `systemPrompt.ts` n'existe pas encore.

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/whatsappAgent/systemPrompt.ts

export interface SystemPromptContext {
  watchlistCodes: string[];
}

/**
 * Prompt système de l'agent conversationnel WhatsApp. Même discipline
 * d'honnêteté que lib/narrative.ts et les disclaimers déjà utilisés ailleurs
 * sur le projet : jamais de conseil en investissement, jamais de chiffre
 * inventé, toujours dérivé des données réelles fournies dans le contexte.
 */
export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const watchlistLine =
    ctx.watchlistCodes.length > 0
      ? `Watchlist de l'utilisateur : ${ctx.watchlistCodes.join(', ')}.`
      : '';

  return [
    "Tu es l'agent WhatsApp de WESTBOURSE, plateforme d'analyse de la BRVM (Bourse Régionale des Valeurs Mobilières, UEMOA).",
    '',
    'RÈGLES STRICTES :',
    "1. Tu ne donnes JAMAIS de conseil en investissement, jamais de recommandation d'achat ou de vente. Tu présentes des faits et des données, jamais une décision à la place de l'utilisateur.",
    "2. Tu n'inventes AUCUN chiffre. Si une donnée ne t'est pas fournie dans le contexte, dis que tu ne l'as pas — ne l'estime jamais.",
    "3. Tu ne peux RIEN modifier (pas d'ajout à la watchlist, pas d'ordre, pas de changement de préférences) — tu es en lecture seule.",
    '4. Réponds en français, de façon concise (WhatsApp, pas un rapport).',
    '',
    watchlistLine,
  ]
    .filter(Boolean)
    .join('\n');
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run: `cd frontend && npx tsx --test lib/whatsappAgent/systemPrompt.test.mjs`
Expected: 3 tests, tous verts.

- [ ] **Step 5 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add frontend/lib/whatsappAgent/systemPrompt.ts frontend/lib/whatsappAgent/systemPrompt.test.mjs
git commit -m "feat(whatsapp-agent): prompt système avec discipline anti-conseil"
```

---

### Task 7 : Appel LLM (cascade DeepSeek→Mistral, réutilisation du pattern existant)

**Files:**
- Create: `frontend/lib/whatsappAgent/callAgentLlm.ts`

**Context:** Même pattern que `callLlm` dans `frontend/app/api/import-batch/route.ts:16-39` (cascade DeepSeek puis Mistral, `resolveApiKey` existant) — adapté pour une conversation multi-tour au lieu d'une extraction JSON à un tour.

- [ ] **Step 1 : Implémenter**

```ts
// frontend/lib/whatsappAgent/callAgentLlm.ts
import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Cascade DeepSeek → Mistral, même pattern que callLlm dans
 * app/api/import-batch/route.ts — adapté à une conversation multi-tour
 * (liste de messages) plutôt qu'à une extraction JSON à un tour.
 */
export async function callAgentLlm(messages: ChatMessage[]): Promise<string | null> {
  const providers = [
    { key: await resolveApiKey('deepseek'), url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { key: await resolveApiKey('mistral'), url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  ].filter((p) => p.key);

  for (const p of providers) {
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          temperature: 0.3,
          messages,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = j.choices?.[0]?.message?.content;
      if (content) return content;
    } catch {
      /* provider suivant */
    }
  }
  return null;
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/whatsappAgent/callAgentLlm.ts
git commit -m "feat(whatsapp-agent): appel LLM cascade DeepSeek→Mistral"
```

---

### Task 8 : Orchestration (`handleMessage`)

**Files:**
- Create: `frontend/lib/whatsappAgent/handleMessage.ts`

**Context:** Assemble tout ce qui précède : identification par téléphone → consentement `agent_optin` → quota via `checkFeature` → contexte (historique + watchlist) → LLM → persistance → réponse.

- [ ] **Step 1 : Implémenter**

```ts
// frontend/lib/whatsappAgent/handleMessage.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkFeature } from '@/lib/server/featureGate';
import { buildSystemPrompt } from './systemPrompt';
import { callAgentLlm, type ChatMessage } from './callAgentLlm';
import { sendWhatsAppReply } from './sendWhatsapp';

const HISTORY_LIMIT = 10;

/**
 * Traite un message WhatsApp entrant déjà authentifié (signature Meta
 * vérifiée par l'appelant). Ne lève jamais — toute erreur se traduit par un
 * message de repli envoyé à l'utilisateur (ou un no-op silencieux si même
 * l'envoi échoue), pour ne jamais faire échouer le webhook côté Meta.
 */
export async function handleIncomingMessage(fromE164: string, text: string): Promise<void> {
  const db = getServiceClient();

  // 1. Identification par téléphone vérifié.
  const { data: prefs } = await db
    .from('notification_prefs')
    .select('user_id, agent_optin')
    .eq('whatsapp_phone', fromE164)
    .eq('whatsapp_optin', true)
    .maybeSingle();

  if (!prefs) {
    await sendWhatsAppReply(
      fromE164,
      "Ce numéro n'est associé à aucun compte WESTBOURSE vérifié. Activez WhatsApp dans les paramètres de votre compte pour utiliser l'agent.",
    );
    return;
  }

  // 2. Consentement distinct de l'opt-in brief/alertes.
  if (!prefs.agent_optin) {
    await sendWhatsAppReply(
      fromE164,
      "L'agent conversationnel n'est pas activé sur votre compte. Activez-le dans les paramètres WhatsApp de votre compte WESTBOURSE.",
    );
    return;
  }

  const userId = prefs.user_id as string;

  // 3. Quota par plan (réutilise featureGate.ts existant).
  const { data: profile } = await db
    .from('profiles')
    .select('is_premium, email')
    .eq('id', userId)
    .maybeSingle();

  const gate = await checkFeature('whatsapp_agent', {
    id: userId,
    email: (profile?.email as string | null) ?? null,
    isPremium: Boolean(profile?.is_premium),
  });

  if (!gate.allowed) {
    await sendWhatsAppReply(fromE164, gate.reason);
    return;
  }

  // 4. Contexte : historique récent + watchlist.
  const { data: history } = await db
    .from('whatsapp_conversations')
    .select('role, contenu')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const { data: watchlistRows } = await db
    .from('watchlist_items')
    .select('code, watchlists!inner(user_id)')
    .eq('watchlists.user_id', userId);

  const watchlistCodes = (watchlistRows ?? []).map((r) => r.code as string);

  const chatHistory: ChatMessage[] = (history ?? [])
    .reverse()
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.contenu as string }));

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt({ watchlistCodes }) },
    ...chatHistory,
    { role: 'user', content: text },
  ];

  // 5. Appel LLM.
  const reply = await callAgentLlm(messages);
  const finalReply = reply ?? "Je n'arrive pas à répondre pour le moment, réessayez dans quelques instants.";

  // 6. Persistance (les deux messages).
  await db.from('whatsapp_conversations').insert([
    { user_id: userId, role: 'user', contenu: text },
    { user_id: userId, role: 'assistant', contenu: finalReply },
  ]);

  // 7. Réponse.
  await sendWhatsAppReply(fromE164, finalReply);
}
```

**Note pour l'implémenteur :** la jointure `watchlist_items` → `watchlists` suppose que `watchlist_items` a une colonne `code` et une FK `watchlist_id` vers `watchlists`. Si le nom de colonne diffère dans le schéma réel, l'ajuster — vérifier avec `grep -n "watchlist_items" supabase/migrations/*.sql` avant d'implémenter cette étape si le nom de colonne n'est pas confirmé.

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur. Si la jointure watchlist ne type-check pas, adapter la requête à la structure réelle (ex. deux requêtes séparées : `watchlists` puis `watchlist_items` par `watchlist_id in (...)`, plus simple et plus sûr que la jointure imbriquée si Supabase JS la refuse).

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/whatsappAgent/handleMessage.ts
git commit -m "feat(whatsapp-agent): orchestration complète du traitement d'un message"
```

---

### Task 9 : Webhook Meta (`app/api/whatsapp/webhook/route.ts`)

**Files:**
- Create: `frontend/app/api/whatsapp/webhook/route.ts`

**Context:** Meta exige deux comportements sur la même URL : un `GET` de vérification (handshake à la configuration du webhook, renvoie `hub.challenge` si `hub.verify_token` correspond), et un `POST` pour chaque message reçu.

- [ ] **Step 1 : Implémenter**

```ts
// frontend/app/api/whatsapp/webhook/route.ts
import { NextResponse } from 'next/server';
import { verifyMetaSignature } from '@/lib/whatsappAgent/verifySignature';
import { handleIncomingMessage } from '@/lib/whatsappAgent/handleMessage';

// Handshake de configuration du webhook (une seule fois, dans le dashboard Meta).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// Réception d'un message WhatsApp.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
    console.error('whatsapp/webhook: signature invalide ou WHATSAPP_APP_SECRET manquant');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Meta répond mal (voire redésabonne le webhook) si on met trop de temps à
  // répondre 200 — on traite en tâche de fond et on répond tout de suite.
  void processPayload(payload).catch((err) => {
    console.error('whatsapp/webhook: échec traitement en tâche de fond', err instanceof Error ? err.message : String(err));
  });

  return NextResponse.json({ status: 'received' }, { status: 200 });
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
}

async function processPayload(payload: unknown): Promise<void> {
  const p = payload as MetaWebhookPayload;
  const messages = p.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
  for (const msg of messages) {
    if (msg.type !== 'text' || !msg.from || !msg.text?.body) continue;
    // Meta envoie `from` sans le '+' initial (ex. "2250700000000").
    const fromE164 = `+${msg.from}`;
    await handleIncomingMessage(fromE164, msg.text.body);
  }
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/api/whatsapp/webhook/route.ts
git commit -m "feat(whatsapp-agent): webhook Meta (handshake GET + réception POST)"
```

---

### Task 10 : Case de consentement dans `WhatsAppPrefs.tsx`

**Files:**
- Modify: `frontend/components/settings/WhatsAppPrefs.tsx`

**Context:** Ajouter une case à cocher DISTINCTE de l'opt-in existant (`whatsapp_optin`), visible uniquement quand celui-ci est déjà actif (le numéro doit être vérifié avant d'activer l'agent).

- [ ] **Step 1 : Étendre l'interface `Prefs` et les valeurs par défaut**

Dans `frontend/components/settings/WhatsAppPrefs.tsx`, remplacer :

```ts
interface Prefs {
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
  alerts_whatsapp: boolean;
  alerts_email: boolean;
}

const DEFAULTS: Prefs = {
  whatsapp_phone: null,
  whatsapp_optin: false,
  brief_whatsapp: false,
  alerts_whatsapp: false,
  alerts_email: false,
};
```

par :

```ts
interface Prefs {
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
  alerts_whatsapp: boolean;
  alerts_email: boolean;
  agent_optin: boolean;
}

const DEFAULTS: Prefs = {
  whatsapp_phone: null,
  whatsapp_optin: false,
  brief_whatsapp: false,
  alerts_whatsapp: false,
  alerts_email: false,
  agent_optin: false,
};
```

- [ ] **Step 2 : Inclure la colonne dans le `select` et le `upsert`**

Remplacer le `.select(...)` dans le `useEffect` :

```ts
        .select('whatsapp_phone, whatsapp_optin, brief_whatsapp, alerts_whatsapp, alerts_email')
```

par :

```ts
        .select('whatsapp_phone, whatsapp_optin, brief_whatsapp, alerts_whatsapp, alerts_email, agent_optin')
```

Remplacer le corps du `upsert` dans `save()` :

```ts
      {
        user_id: userId,
        whatsapp_phone: next.whatsapp_phone,
        whatsapp_optin: next.whatsapp_optin,
        whatsapp_optin_at: next.whatsapp_optin ? new Date().toISOString() : null,
        brief_whatsapp: next.brief_whatsapp,
        alerts_whatsapp: next.alerts_whatsapp,
        alerts_email: next.alerts_email,
      },
```

par :

```ts
      {
        user_id: userId,
        whatsapp_phone: next.whatsapp_phone,
        whatsapp_optin: next.whatsapp_optin,
        whatsapp_optin_at: next.whatsapp_optin ? new Date().toISOString() : null,
        brief_whatsapp: next.brief_whatsapp,
        alerts_whatsapp: next.alerts_whatsapp,
        alerts_email: next.alerts_email,
        agent_optin: next.agent_optin,
        agent_optin_at: next.agent_optin ? new Date().toISOString() : null,
      },
```

- [ ] **Step 3 : Ajouter la case à cocher (visible seulement si `whatsapp_optin` actif)**

Dans le bloc `{prefs.whatsapp_optin && (...)}` (après les cases `brief_whatsapp`/`alerts_whatsapp` existantes, avant le bouton "Retirer mon consentement"), ajouter :

```tsx
          <label className="flex items-start gap-2 text-xs text-muted border-t border-border/60 pt-3">
            <input
              type="checkbox"
              checked={prefs.agent_optin}
              onChange={(e) => void save({ ...prefs, agent_optin: e.target.checked })}
              className="mt-0.5 accent-[#56D7FD]"
            />
            <span>
              J&apos;accepte que l&apos;agent conversationnel WESTBOURSE garde l&apos;historique de nos
              échanges (90 jours) pour personnaliser ses réponses. Retrait possible à tout moment ici même.
            </span>
          </label>
```

- [ ] **Step 4 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/settings/WhatsAppPrefs.tsx
git commit -m "feat(whatsapp-agent): consentement RGPD distinct pour l'agent conversationnel"
```

---

### Task 11 : Droits RGPD — export et suppression

**Files:**
- Modify: `frontend/app/api/account/export/route.ts`
- Modify: `frontend/app/api/account/delete/route.ts`

- [ ] **Step 1 : Ajouter au export**

Dans `frontend/app/api/account/export/route.ts`, le tableau de déstructuration et le `Promise.all` sont dans le même ordre (chaque nom déstructuré correspond à la requête au même rang). Ajouter `whatsappConversations` à la fin du tableau déstructuré :

```ts
  const [
    profile,
    watchlists,
    items,
    positions,
    alerts,
    notifs,
    snapshots,
    backtests,
    push,
    ptAccounts,
    ptPositions,
    subscriptions,
    transactions,
    forumTopics,
    forumPosts,
    theses,
    notifPrefs,
    authEvents,
    academyProgress,
    academyNotes,
    academyExamAttempts,
    academyCertificates,
    whatsappConversations,
  ] = await Promise.all([
```

Ajouter la requête correspondante à la fin du tableau `Promise.all` (juste avant le `]);` de fermeture, après la ligne `academy_certificates`) :

```ts
    supabase.from('whatsapp_conversations').select('*').eq('user_id', user.id),
```

Ajouter la clé au `payload`, à la fin de l'objet (après `academy_certificates: academyCertificates.data ?? [],`) :

```ts
    whatsapp_conversations: whatsappConversations.data ?? [],
```

- [ ] **Step 2 : Ajouter à la suppression**

Dans `frontend/app/api/account/delete/route.ts`, ajouter `'whatsapp_conversations'` à l'array `tables` :

```ts
  const tables = [
    'watchlist_items', // via watchlists
    'watchlists',
    'portfolios_positions',
    'alerts',
    'notifications_log',
    'report_snapshots',
    'backtest_runs',
    'push_subscriptions',
    'paper_trading_positions',
    'paper_trading_accounts',
    'investment_theses',
    'academy_progress',
    'academy_notes',
    'academy_exam_attempts',
    'academy_certificates',
    'whatsapp_conversations',
  ] as const;
```

(La cascade FK de la migration Task 1 — `on delete cascade` sur `user_id` — couvre déjà la suppression via `auth.users`, mais cette purge explicite reste cohérente avec le commentaire du fichier : "belt & suspenders".)

- [ ] **Step 3 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/api/account/export/route.ts frontend/app/api/account/delete/route.ts
git commit -m "feat(whatsapp-agent): ajoute whatsapp_conversations aux droits RGPD export/suppression"
```

---

### Task 12 : Configuration Meta + variables d'environnement (documentation, pas de code)

**Files:** aucun fichier de code — étapes de configuration externe.

**Context:** Cette tâche liste ce que l'utilisateur doit configurer manuellement — aucune de ces actions n'est faisable depuis cette session (identifiants tiers, dashboard Meta).

- [ ] **Step 1 : Variables d'environnement à ajouter sur Vercel (production)**

| Variable | Source | Note |
|---|---|---|
| `WHATSAPP_TOKEN` | Meta for Developers → WhatsApp → API Setup | Déjà utilisée côté scraper (GitHub Actions) — même valeur, à dupliquer côté Vercel. |
| `WHATSAPP_PHONE_ID` | Meta for Developers → WhatsApp → API Setup | Idem. |
| `WHATSAPP_VERIFY_TOKEN` | Choisi par l'utilisateur (chaîne arbitraire) | Utilisé UNIQUEMENT pour le handshake `GET` — ne pas réutiliser un secret existant. |
| `WHATSAPP_APP_SECRET` | Meta for Developers → Paramètres de l'app → Basic | Nouveau, jamais utilisé côté scraper (l'envoi sortant n'a pas besoin de vérifier de signature). |

- [ ] **Step 2 : Configurer le webhook dans le dashboard Meta**

URL de callback : `https://www.westbourse.com/api/whatsapp/webhook`
Verify token : la valeur choisie pour `WHATSAPP_VERIFY_TOKEN`.
Champs d'abonnement (webhook fields) : `messages`.

- [ ] **Step 3 : Redéployer**

Une fois les 4 variables posées sur Vercel, déclencher un déploiement (`gh workflow run "Deploy Frontend to Vercel"`) pour qu'elles soient prises en compte.

---

## Self-Review

**1. Spec coverage :**
- Webhook + vérification signature Meta → Task 4, Task 9. ✅
- Identification par téléphone + consentement distinct → Task 8, Task 10. ✅
- Quota par plan via featureGate.ts existant → Task 3, Task 8. ✅
- Contexte (historique + watchlist) + LLM cascade → Task 6, Task 7, Task 8. ✅
- Persistance + réponse via canal Meta → Task 5, Task 8. ✅
- RLS whatsapp_conversations (owner select, service_role write only) → Task 1. ✅
- Rétention 90 jours → Task 2. ✅
- Droits RGPD export/suppression → Task 11. ✅
- Configuration Meta (hors code) → Task 12. ✅

**2. Placeholder scan :** Task 8 et Task 11 contiennent une note explicite à l'implémenteur là où le schéma exact (`watchlist_items`) ou la structure du fichier (`export/route.ts`) n'a pas pu être confirmé pendant le cadrage — ce n'est pas un TODO vague : chaque note dit précisément quoi vérifier et donne une solution de repli concrète. Le reste du plan ne contient aucun placeholder.

**3. Type consistency :** `ChatMessage` défini dans `callAgentLlm.ts` (Task 7), réutilisé tel quel dans `handleMessage.ts` (Task 8) sans redéfinition. `SystemPromptContext`/`buildSystemPrompt` définis en Task 6, appelés avec la même signature en Task 8. `sendWhatsAppReply(to, body)` défini en Task 5, appelé avec les mêmes noms de paramètres en Task 8 et Task 9 (indirectement, via `handleIncomingMessage`).
