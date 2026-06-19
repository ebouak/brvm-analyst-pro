# Forum de discussion BRVM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un forum de discussion (lecture publique, publication connectée) où les sujets se rattachent optionnellement à une action, une obligation ou un événement BRVM.

**Architecture:** Module additif sur Supabase + Next.js App Router. 3 tables (`forum_topics`, `forum_posts`, `forum_reports`) + `profiles.display_name`, RLS lecture publique (`hidden = false`), publication connectée. Logique pure isolée (`lib/forum/`) et testée (vitest) ; I/O via les patterns serveur existants ; post-modération via la console admin.

**Tech Stack:** Next.js 14, TypeScript strict, Supabase (PostgreSQL + RLS + Auth), TailwindCSS, vitest.

**Référence spec :** `docs/superpowers/specs/2026-06-18-forum-discussion-design.md`

---

## Conventions du dépôt à respecter

- ESM côté lib avec extension `.js` dans les imports relatifs **uniquement côté scraper** ; côté `frontend/` (Next), imports sans extension.
- Tests : `vitest`, fichiers `*.test.ts` à côté du module. Lancer depuis `frontend/` : `npx vitest run lib/forum`.
- RLS : lecture publique = `using (hidden = false)` (convention `0044_content_moderation.sql`).
- Admin server-only via `service_role` (`getServiceClient()` / `@/lib/billing/serviceClient`) ; jamais exposé au client.
- Kit UI : `@/components/ui/premium` (SectionHeader, PremiumPanel, EmptyStatePremium, StatPill).
- Format dates : `fmtDateFR` de `@/lib/format`.

## File Structure

- Create `supabase/migrations/0047_forum.sql` — tables, contraintes, RLS, `profiles.display_name`.
- Create `frontend/lib/forum/types.ts` — types partagés.
- Create `frontend/lib/forum/validation.ts` (+ `.test.ts`) — validation pure.
- Create `frontend/lib/forum/rateLimit.ts` (+ `.test.ts`) — anti-flood pur.
- Create `frontend/lib/forum/identity.ts` (+ `.test.ts`) — `displayName()` pur.
- Create `frontend/lib/forum/server.ts` — couche données (I/O Supabase).
- Create `frontend/lib/forum/actions.ts` — server actions (create/reply/edit/delete/report).
- Create `frontend/app/forum/page.tsx`, `frontend/app/forum/[id]/page.tsx`, `frontend/app/forum/nouveau/page.tsx`.
- Create `frontend/components/forum/` — `ForumTopicList.tsx`, `ForumThread.tsx`, `ForumReplyForm.tsx`, `ForumNewTopicForm.tsx`, `ReportButton.tsx`, `LinkPicker.tsx`.
- Create `frontend/app/admin/forum/page.tsx` + `frontend/components/admin/ForumModerationQueue.tsx`.
- Modify `frontend/app/api/account/export/route.ts` — ajouter le contenu forum.
- Modify `frontend/lib/nav.ts` — entrée « Forum » (groupe Découverte).
- Modify la fiche instrument (`frontend/app/actions/[code]/page.tsx`) — section « Discussions ».
- Modify `frontend/app/parametres/compte/page.tsx` — champ pseudonyme `display_name`.
- Modify `docs/RGPD.md` — inventaire du traitement forum.

---

## Task 1 : Migration base de données

**Files:**
- Create: `supabase/migrations/0047_forum.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- supabase/migrations/0047_forum.sql
-- Forum de discussion (additif). RLS lecture publique (convention 0044).
-- Anonymisation RGPD : author_id ... on delete set null → la suppression du
-- compte auth.users nullifie automatiquement l'auteur (« Utilisateur supprimé »).

-- Pseudonyme d'affichage (jamais le nom réel ni l'email). Minimisation RGPD.
alter table public.profiles add column if not exists display_name text;

create table if not exists public.forum_topics (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references auth.users(id) on delete set null,
  title            text not null,
  body             text not null,
  instrument_code  text references public.brvm_instruments(code) on update cascade,
  event_id         uuid references public.market_events(id) on delete set null,
  hidden           boolean not null default false,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  constraint forum_topic_single_link check (instrument_code is null or event_id is null)
);
create index if not exists idx_forum_topics_instrument on public.forum_topics (instrument_code) where instrument_code is not null;
create index if not exists idx_forum_topics_event on public.forum_topics (event_id) where event_id is not null;
create index if not exists idx_forum_topics_activity on public.forum_topics (last_activity_at desc) where hidden = false;
create index if not exists idx_forum_topics_author on public.forum_topics (author_id);

create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.forum_topics(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index if not exists idx_forum_posts_topic on public.forum_posts (topic_id, created_at) where hidden = false;
create index if not exists idx_forum_posts_author on public.forum_posts (author_id);

create table if not exists public.forum_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('topic','post')),
  target_id   uuid not null,
  reason      text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_forum_reports_open on public.forum_reports (created_at desc) where resolved = false;

alter table public.forum_topics  enable row level security;
alter table public.forum_posts   enable row level security;
alter table public.forum_reports enable row level security;

drop policy if exists "forum_topics_public_read" on public.forum_topics;
create policy "forum_topics_public_read" on public.forum_topics for select using (hidden = false);
drop policy if exists "forum_posts_public_read" on public.forum_posts;
create policy "forum_posts_public_read" on public.forum_posts for select using (hidden = false);

drop policy if exists "forum_topics_insert" on public.forum_topics;
create policy "forum_topics_insert" on public.forum_topics for insert with check (auth.uid() = author_id);
drop policy if exists "forum_posts_insert" on public.forum_posts;
create policy "forum_posts_insert" on public.forum_posts for insert with check (auth.uid() = author_id);

drop policy if exists "forum_topics_owner_update" on public.forum_topics;
create policy "forum_topics_owner_update" on public.forum_topics for update using (auth.uid() = author_id);
drop policy if exists "forum_topics_owner_delete" on public.forum_topics;
create policy "forum_topics_owner_delete" on public.forum_topics for delete using (auth.uid() = author_id);
drop policy if exists "forum_posts_owner_update" on public.forum_posts;
create policy "forum_posts_owner_update" on public.forum_posts for update using (auth.uid() = author_id);
drop policy if exists "forum_posts_owner_delete" on public.forum_posts;
create policy "forum_posts_owner_delete" on public.forum_posts for delete using (auth.uid() = author_id);

drop policy if exists "forum_reports_insert" on public.forum_reports;
create policy "forum_reports_insert" on public.forum_reports for insert with check (auth.uid() = reporter_id);
-- Pas de policy select sur forum_reports → lecture réservée au service_role (admin).
```

- [ ] **Step 2: Appliquer en base de dev**

Run (éditeur SQL Supabase ou CLI) : `supabase db push` puis vérifier que les 3 tables et `profiles.display_name` existent.
Expected: aucune erreur ; `select * from forum_topics limit 1;` renvoie 0 ligne sans erreur.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0047_forum.sql
git commit -m "feat(forum): migration tables + RLS + profiles.display_name"
```

---

## Task 2 : Types partagés

**Files:**
- Create: `frontend/lib/forum/types.ts`

- [ ] **Step 1: Écrire les types**

```typescript
// frontend/lib/forum/types.ts
export type TopicCategory = 'instrument' | 'evenement' | 'general';

export interface ForumTopic {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  instrument_code: string | null;
  event_id: string | null;
  hidden: boolean;
  created_at: string;
  last_activity_at: string;
}

export interface ForumPost {
  id: string;
  topic_id: string;
  author_id: string | null;
  body: string;
  hidden: boolean;
  created_at: string;
  edited_at: string | null;
}

/** Profil minimal pour l'affichage de l'auteur. */
export interface AuthorProfile {
  id: string;
  display_name: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/forum/types.ts
git commit -m "feat(forum): types partagés"
```

---

## Task 3 : Validation pure (TDD)

**Files:**
- Create: `frontend/lib/forum/validation.ts`
- Test: `frontend/lib/forum/validation.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```typescript
// frontend/lib/forum/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateTopicInput, validatePostInput, resolveTopicLink } from './validation';

describe('validateTopicInput', () => {
  it('accepte un titre et un corps valides (trim appliqué)', () => {
    const r = validateTopicInput({ title: '  Avis sur SONATEL  ', body: 'Que pensez-vous des résultats ?' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.title).toBe('Avis sur SONATEL'); }
  });
  it('rejette un titre trop court (< 5)', () => {
    expect(validateTopicInput({ title: 'abc', body: 'corps suffisant ici' }).ok).toBe(false);
  });
  it('rejette un titre trop long (> 140)', () => {
    expect(validateTopicInput({ title: 'a'.repeat(141), body: 'corps suffisant ici' }).ok).toBe(false);
  });
  it('rejette un corps trop court (< 10)', () => {
    expect(validateTopicInput({ title: 'Titre ok', body: 'court' }).ok).toBe(false);
  });
});

describe('validatePostInput', () => {
  it('accepte un corps valide', () => {
    expect(validatePostInput({ body: 'ok' }).ok).toBe(true);
  });
  it('rejette un corps vide après trim', () => {
    expect(validatePostInput({ body: '   ' }).ok).toBe(false);
  });
});

describe('resolveTopicLink', () => {
  it('catégorie instrument quand un code est fourni', () => {
    const r = resolveTopicLink({ instrumentCode: 'SNTS', eventId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('instrument');
  });
  it('catégorie evenement quand un event est fourni', () => {
    const r = resolveTopicLink({ instrumentCode: null, eventId: 'e1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('evenement');
  });
  it('catégorie general quand aucun rattachement', () => {
    const r = resolveTopicLink({ instrumentCode: null, eventId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('general');
  });
  it('rejette un double rattachement (xor)', () => {
    expect(resolveTopicLink({ instrumentCode: 'SNTS', eventId: 'e1' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

Run: `cd frontend && npx vitest run lib/forum/validation.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

```typescript
// frontend/lib/forum/validation.ts
import type { TopicCategory } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const TITLE_MIN = 5;
const TITLE_MAX = 140;
const BODY_TOPIC_MIN = 10;
const BODY_MAX = 10_000;
const BODY_POST_MIN = 2;

export function validateTopicInput(input: { title: string; body: string }): Result<{ title: string; body: string }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < TITLE_MIN) return { ok: false, error: 'Titre trop court (5 caractères minimum).' };
  if (title.length > TITLE_MAX) return { ok: false, error: 'Titre trop long (140 caractères maximum).' };
  if (body.length < BODY_TOPIC_MIN) return { ok: false, error: 'Message trop court (10 caractères minimum).' };
  if (body.length > BODY_MAX) return { ok: false, error: 'Message trop long (10 000 caractères maximum).' };
  return { ok: true, value: { title, body } };
}

export function validatePostInput(input: { body: string }): Result<{ body: string }> {
  const body = input.body.trim();
  if (body.length < BODY_POST_MIN) return { ok: false, error: 'Réponse trop courte.' };
  if (body.length > BODY_MAX) return { ok: false, error: 'Réponse trop longue (10 000 caractères maximum).' };
  return { ok: true, value: { body } };
}

export function resolveTopicLink(input: { instrumentCode: string | null; eventId: string | null }): Result<{
  instrumentCode: string | null;
  eventId: string | null;
  category: TopicCategory;
}> {
  const hasInstrument = !!input.instrumentCode;
  const hasEvent = !!input.eventId;
  if (hasInstrument && hasEvent) return { ok: false, error: 'Un sujet ne peut être rattaché qu’à une action OU un événement.' };
  const category: TopicCategory = hasInstrument ? 'instrument' : hasEvent ? 'evenement' : 'general';
  return { ok: true, value: { instrumentCode: input.instrumentCode, eventId: input.eventId, category } };
}
```

- [ ] **Step 4: Lancer les tests (succès attendu)**

Run: `cd frontend && npx vitest run lib/forum/validation.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/forum/validation.ts frontend/lib/forum/validation.test.ts
git commit -m "feat(forum): validation pure des sujets/réponses (TDD)"
```

---

## Task 4 : Anti-flood pur (TDD)

**Files:**
- Create: `frontend/lib/forum/rateLimit.ts`
- Test: `frontend/lib/forum/rateLimit.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```typescript
// frontend/lib/forum/rateLimit.test.ts
import { describe, it, expect } from 'vitest';
import { checkPostRate, checkTopicRate, MIN_POST_INTERVAL_MS, MAX_TOPICS_PER_HOUR } from './rateLimit';

const now = new Date('2026-06-18T12:00:00Z').getTime();

describe('checkPostRate', () => {
  it('autorise si aucun message récent', () => {
    expect(checkPostRate(null, now).ok).toBe(true);
  });
  it('bloque si le dernier message date de moins de 20 s', () => {
    const last = new Date(now - 5_000).toISOString();
    expect(checkPostRate(last, now).ok).toBe(false);
  });
  it('autorise après le délai minimal', () => {
    const last = new Date(now - (MIN_POST_INTERVAL_MS + 1)).toISOString();
    expect(checkPostRate(last, now).ok).toBe(true);
  });
});

describe('checkTopicRate', () => {
  it('autorise sous le plafond horaire', () => {
    const stamps = Array.from({ length: MAX_TOPICS_PER_HOUR - 1 }, () => new Date(now - 60_000).toISOString());
    expect(checkTopicRate(stamps, now).ok).toBe(true);
  });
  it('bloque au plafond horaire', () => {
    const stamps = Array.from({ length: MAX_TOPICS_PER_HOUR }, () => new Date(now - 60_000).toISOString());
    expect(checkTopicRate(stamps, now).ok).toBe(false);
  });
  it('ignore les sujets de plus d’une heure', () => {
    const stamps = Array.from({ length: MAX_TOPICS_PER_HOUR }, () => new Date(now - 3_700_000).toISOString());
    expect(checkTopicRate(stamps, now).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

Run: `cd frontend && npx vitest run lib/forum/rateLimit.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

```typescript
// frontend/lib/forum/rateLimit.ts
import type { Result } from './validation';

export const MIN_POST_INTERVAL_MS = 20_000; // 20 s entre deux publications
export const MAX_TOPICS_PER_HOUR = 5;
const HOUR_MS = 3_600_000;

/** `lastAt` = ISO du dernier message de l'utilisateur, ou null. */
export function checkPostRate(lastAt: string | null, now = Date.now()): Result<true> {
  if (!lastAt) return { ok: true, value: true };
  const elapsed = now - new Date(lastAt).getTime();
  if (elapsed < MIN_POST_INTERVAL_MS) {
    const wait = Math.ceil((MIN_POST_INTERVAL_MS - elapsed) / 1000);
    return { ok: false, error: `Patientez ${wait} s avant de publier à nouveau.` };
  }
  return { ok: true, value: true };
}

/** `topicStamps` = ISO de création des sujets récents de l'utilisateur. */
export function checkTopicRate(topicStamps: string[], now = Date.now()): Result<true> {
  const inWindow = topicStamps.filter((s) => now - new Date(s).getTime() < HOUR_MS);
  if (inWindow.length >= MAX_TOPICS_PER_HOUR) {
    return { ok: false, error: `Limite de ${MAX_TOPICS_PER_HOUR} sujets par heure atteinte.` };
  }
  return { ok: true, value: true };
}
```

- [ ] **Step 4: Lancer les tests (succès attendu)**

Run: `cd frontend && npx vitest run lib/forum/rateLimit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/forum/rateLimit.ts frontend/lib/forum/rateLimit.test.ts
git commit -m "feat(forum): anti-flood pur (TDD)"
```

---

## Task 5 : Pseudonyme d'affichage pur (TDD)

**Files:**
- Create: `frontend/lib/forum/identity.ts`
- Test: `frontend/lib/forum/identity.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```typescript
// frontend/lib/forum/identity.test.ts
import { describe, it, expect } from 'vitest';
import { displayName } from './identity';

describe('displayName', () => {
  it('utilise le pseudonyme si présent', () => {
    expect(displayName({ id: 'u1', display_name: 'Koffi' })).toBe('Koffi');
  });
  it('repli « Membre » si pseudonyme absent (jamais l’email)', () => {
    expect(displayName({ id: 'u1', display_name: null })).toBe('Membre');
  });
  it('« Utilisateur supprimé » si auteur null (anonymisé)', () => {
    expect(displayName(null)).toBe('Utilisateur supprimé');
  });
  it('trim et repli si pseudonyme vide', () => {
    expect(displayName({ id: 'u1', display_name: '   ' })).toBe('Membre');
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd frontend && npx vitest run lib/forum/identity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```typescript
// frontend/lib/forum/identity.ts
import type { AuthorProfile } from './types';

/** Affichage de l'auteur. Jamais l'email ni le nom réel (minimisation RGPD). */
export function displayName(profile: AuthorProfile | null): string {
  if (!profile) return 'Utilisateur supprimé';
  const name = (profile.display_name ?? '').trim();
  return name.length > 0 ? name : 'Membre';
}
```

- [ ] **Step 4: Lancer (succès attendu)**

Run: `cd frontend && npx vitest run lib/forum/identity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/forum/identity.ts frontend/lib/forum/identity.test.ts
git commit -m "feat(forum): pseudonyme d'affichage pur (TDD)"
```

---

## Task 6 : Couche données serveur

**Files:**
- Create: `frontend/lib/forum/server.ts`

- [ ] **Step 1: Implémenter les lectures**

```typescript
// frontend/lib/forum/server.ts
import { createPublicClient } from '@/lib/supabase/public';
import type { ForumTopic, ForumPost, AuthorProfile } from './types';

const PAGE_SIZE = 20;

/** Liste paginée des sujets visibles, plus récents d'abord. */
export async function listTopics(page = 0, instrumentCode?: string): Promise<{ topics: ForumTopic[]; authors: Map<string, AuthorProfile> }> {
  const supabase = createPublicClient();
  let q = supabase
    .from('forum_topics')
    .select('*')
    .eq('hidden', false)
    .order('last_activity_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (instrumentCode) q = q.eq('instrument_code', instrumentCode);
  const { data } = await q;
  const topics = (data ?? []) as ForumTopic[];
  return { topics, authors: await loadAuthors(topics.map((t) => t.author_id)) };
}

/** Un sujet + ses réponses visibles. */
export async function getTopic(id: string): Promise<{ topic: ForumTopic; posts: ForumPost[]; authors: Map<string, AuthorProfile> } | null> {
  const supabase = createPublicClient();
  const { data: topic } = await supabase.from('forum_topics').select('*').eq('id', id).eq('hidden', false).single();
  if (!topic) return null;
  const { data: posts } = await supabase
    .from('forum_posts').select('*').eq('topic_id', id).eq('hidden', false).order('created_at', { ascending: true });
  const list = (posts ?? []) as ForumPost[];
  const authors = await loadAuthors([(topic as ForumTopic).author_id, ...list.map((p) => p.author_id)]);
  return { topic: topic as ForumTopic, posts: list, authors };
}

/** Profils (pseudonymes) des auteurs, indexés par id. */
async function loadAuthors(ids: (string | null)[]): Promise<Map<string, AuthorProfile>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, AuthorProfile>();
  if (unique.length === 0) return map;
  const supabase = createPublicClient();
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  for (const p of (data ?? []) as AuthorProfile[]) map.set(p.id, p);
  return map;
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/forum/server.ts
git commit -m "feat(forum): couche données lecture (sujets/réponses/auteurs)"
```

---

## Task 7 : Server actions (create/reply/edit/delete/report)

**Files:**
- Create: `frontend/lib/forum/actions.ts`

- [ ] **Step 1: Implémenter les actions**

```typescript
// frontend/lib/forum/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validateTopicInput, validatePostInput, resolveTopicLink } from './validation';
import { checkPostRate, checkTopicRate } from './rateLimit';

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connexion requise.');
  return { supabase, user };
}

export async function createTopic(input: { title: string; body: string; instrumentCode: string | null; eventId: string | null }) {
  const { supabase, user } = await requireUser();
  const v = validateTopicInput(input);
  if (!v.ok) return { error: v.error };
  const link = resolveTopicLink({ instrumentCode: input.instrumentCode, eventId: input.eventId });
  if (!link.ok) return { error: link.error };

  // Anti-flood : sujets de la dernière heure.
  const { data: recent } = await supabase
    .from('forum_topics').select('created_at').eq('author_id', user.id)
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  const rate = checkTopicRate((recent ?? []).map((r) => r.created_at as string));
  if (!rate.ok) return { error: rate.error };

  const { data, error } = await supabase.from('forum_topics').insert({
    author_id: user.id, title: v.value.title, body: v.value.body,
    instrument_code: link.value.instrumentCode, event_id: link.value.eventId,
  }).select('id').single();
  if (error) return { error: 'Création impossible.' };
  revalidatePath('/forum');
  return { id: data!.id as string };
}

export async function createPost(input: { topicId: string; body: string }) {
  const { supabase, user } = await requireUser();
  const v = validatePostInput(input);
  if (!v.ok) return { error: v.error };

  const { data: last } = await supabase
    .from('forum_posts').select('created_at').eq('author_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const rate = checkPostRate((last?.created_at as string) ?? null);
  if (!rate.ok) return { error: rate.error };

  const { error } = await supabase.from('forum_posts').insert({ topic_id: input.topicId, author_id: user.id, body: v.value.body });
  if (error) return { error: 'Réponse impossible.' };
  await supabase.from('forum_topics').update({ last_activity_at: new Date().toISOString() }).eq('id', input.topicId);
  revalidatePath(`/forum/${input.topicId}`);
  return { ok: true };
}

export async function editPost(input: { postId: string; body: string }) {
  const { supabase } = await requireUser();
  const v = validatePostInput(input);
  if (!v.ok) return { error: v.error };
  // RLS owner_update garantit que seul l'auteur modifie.
  const { error } = await supabase.from('forum_posts').update({ body: v.value.body, edited_at: new Date().toISOString() }).eq('id', input.postId);
  if (error) return { error: 'Modification impossible.' };
  return { ok: true };
}

export async function deletePost(postId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
  if (error) return { error: 'Suppression impossible.' };
  return { ok: true };
}

export async function reportContent(input: { targetType: 'topic' | 'post'; targetId: string; reason: string }) {
  const { supabase, user } = await requireUser();
  const reason = input.reason.trim().slice(0, 500);
  const { error } = await supabase.from('forum_reports').insert({
    reporter_id: user.id, target_type: input.targetType, target_id: input.targetId, reason: reason || null,
  });
  if (error) return { error: 'Signalement impossible.' };
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/forum/actions.ts
git commit -m "feat(forum): server actions (sujet/réponse/édition/signalement) + anti-flood"
```

---

## Task 8 : Composants UI forum

**Files:**
- Create: `frontend/components/forum/ForumTopicList.tsx`
- Create: `frontend/components/forum/ForumThread.tsx`
- Create: `frontend/components/forum/ForumReplyForm.tsx`
- Create: `frontend/components/forum/ForumNewTopicForm.tsx`
- Create: `frontend/components/forum/ReportButton.tsx`

- [ ] **Step 1: Liste des sujets (server component)**

```tsx
// frontend/components/forum/ForumTopicList.tsx
import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import { displayName } from '@/lib/forum/identity';
import type { ForumTopic, AuthorProfile } from '@/lib/forum/types';
import { EmptyStatePremium } from '@/components/ui/premium';

export function ForumTopicList({ topics, authors }: { topics: ForumTopic[]; authors: Map<string, AuthorProfile> }) {
  if (topics.length === 0) {
    return <EmptyStatePremium icon="💬" title="Aucune discussion" hint="Lancez la première discussion de la communauté." />;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {topics.map((t) => (
        <li key={t.id} className="bg-surface hover:bg-elevated/40 transition">
          <Link href={`/forum/${t.id}`} className="block px-4 py-3">
            <p className="font-medium text-white">{t.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {displayName(t.author_id ? authors.get(t.author_id) ?? null : null)} ·{' '}
              {fmtDateFR(t.last_activity_at)}
              {t.instrument_code ? ` · ${t.instrument_code}` : ''}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Fil de discussion + bouton signaler + réponse**

```tsx
// frontend/components/forum/ReportButton.tsx
'use client';
import { useState } from 'react';
import { reportContent } from '@/lib/forum/actions';

export function ReportButton({ targetType, targetId }: { targetType: 'topic' | 'post'; targetId: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <span className="text-xs text-muted">Signalé ✓</span>;
  return (
    <button
      type="button" disabled={busy}
      onClick={async () => {
        setBusy(true);
        const reason = window.prompt('Raison du signalement (optionnel) :') ?? '';
        const r = await reportContent({ targetType, targetId, reason });
        setBusy(false);
        if (!('error' in r)) setDone(true);
      }}
      className="text-xs text-muted hover:text-down transition focus:outline-none focus:ring-2 focus:ring-down/40 rounded"
    >
      Signaler
    </button>
  );
}
```

```tsx
// frontend/components/forum/ForumReplyForm.tsx
'use client';
import { useState } from 'react';
import { createPost } from '@/lib/forum/actions';

export function ForumReplyForm({ topicId, canPost }: { topicId: string; canPost: boolean }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canPost) return <p className="text-sm text-muted">Connectez-vous pour répondre.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        const r = await createPost({ topicId, body });
        setBusy(false);
        if ('error' in r) setError(r.error ?? null); else { setBody(''); location.reload(); }
      }}
      className="space-y-2"
    >
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} rows={4}
        placeholder="Votre réponse…" aria-label="Votre réponse"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50"
      />
      {error && <p className="text-xs text-down">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg disabled:opacity-40">
        {busy ? 'Envoi…' : 'Répondre'}
      </button>
    </form>
  );
}
```

```tsx
// frontend/components/forum/ForumThread.tsx
import { fmtDateFR } from '@/lib/format';
import { displayName } from '@/lib/forum/identity';
import type { ForumTopic, ForumPost, AuthorProfile } from '@/lib/forum/types';
import { ReportButton } from './ReportButton';
import { ForumReplyForm } from './ForumReplyForm';

export function ForumThread({ topic, posts, authors, canPost }: {
  topic: ForumTopic; posts: ForumPost[]; authors: Map<string, AuthorProfile>; canPost: boolean;
}) {
  const author = (id: string | null) => displayName(id ? authors.get(id) ?? null : null);
  return (
    <div className="space-y-6">
      <article className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-lg font-semibold text-white">{topic.title}</h1>
        <p className="mt-1 text-xs text-muted">{author(topic.author_id)} · {fmtDateFR(topic.created_at)}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-white/90">{topic.body}</p>
        <div className="mt-3"><ReportButton targetType="topic" targetId={topic.id} /></div>
      </article>

      <section className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl border border-border/60 bg-surface/60 p-4">
            <p className="text-xs text-muted">{author(p.author_id)} · {fmtDateFR(p.created_at)}{p.edited_at ? ' · modifié' : ''}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{p.body}</p>
            <div className="mt-2"><ReportButton targetType="post" targetId={p.id} /></div>
          </div>
        ))}
      </section>

      <ForumReplyForm topicId={topic.id} canPost={canPost} />
    </div>
  );
}
```

- [ ] **Step 3: Formulaire de création de sujet**

```tsx
// frontend/components/forum/ForumNewTopicForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTopic } from '@/lib/forum/actions';

export function ForumNewTopicForm({ instruments }: { instruments: { code: string; designation: string | null }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        const r = await createTopic({ title, body, instrumentCode: code || null, eventId: null });
        setBusy(false);
        if ('error' in r) setError(r.error ?? null); else router.push(`/forum/${r.id}`);
      }}
      className="space-y-3"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du sujet" aria-label="Titre"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50" />
      <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Rattacher à une action (optionnel)"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white">
        <option value="">— Discussion générale (aucun rattachement) —</option>
        {instruments.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.designation ?? ''}</option>)}
      </select>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Votre message…" aria-label="Message"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50" />
      {error && <p className="text-xs text-down">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg disabled:opacity-40">
        {busy ? 'Publication…' : 'Publier le sujet'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` (Expected: aucune erreur)

```bash
git add frontend/components/forum
git commit -m "feat(forum): composants UI (liste, fil, réponse, création, signalement)"
```

---

## Task 9 : Pages forum + entrée nav

**Files:**
- Create: `frontend/app/forum/page.tsx`
- Create: `frontend/app/forum/[id]/page.tsx`
- Create: `frontend/app/forum/nouveau/page.tsx`
- Modify: `frontend/lib/nav.ts`

- [ ] **Step 1: Page liste**

```tsx
// frontend/app/forum/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listTopics } from '@/lib/forum/server';
import { ForumTopicList } from '@/components/forum/ForumTopicList';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Forum — WESTBOURSE' };
export const revalidate = 60;

export default async function ForumPage() {
  const { topics, authors } = await listTopics(0);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader kicker="Communauté" title="Forum"
        subtitle="Échangez sur les actions, obligations et événements de la BRVM."
        actions={user ? <Link href="/forum/nouveau" className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg">Nouveau sujet</Link> : null} />
      <ForumTopicList topics={topics} authors={authors} />
    </div>
  );
}
```

- [ ] **Step 2: Page fil**

```tsx
// frontend/app/forum/[id]/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTopic } from '@/lib/forum/server';
import { ForumThread } from '@/components/forum/ForumThread';

export const revalidate = 30;

export default async function ForumTopicPage({ params }: { params: { id: string } }) {
  const data = await getTopic(params.id);
  if (!data) notFound();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ForumThread topic={data.topic} posts={data.posts} authors={data.authors} canPost={!!user} />
    </div>
  );
}
```

- [ ] **Step 3: Page création (connexion requise)**

```tsx
// frontend/app/forum/nouveau/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ForumNewTopicForm } from '@/components/forum/ForumNewTopicForm';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Nouveau sujet — WESTBOURSE' };

export default async function NewTopicPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: instruments } = await supabase
    .from('brvm_instruments').select('code, designation').eq('type', 'action').order('code');
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader kicker="Communauté" title="Nouveau sujet" subtitle="Partagez une analyse ou posez une question." />
      <ForumNewTopicForm instruments={instruments ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Entrée nav (groupe Découverte)**

Modifier `frontend/lib/nav.ts`, dans le groupe `Découverte`, ajouter après `{ href: '/brief', label: 'Brief quotidien' }` :

```typescript
      { href: '/forum', label: 'Forum' },
```

- [ ] **Step 5: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` (Expected: aucune erreur)

```bash
git add frontend/app/forum frontend/lib/nav.ts
git commit -m "feat(forum): pages liste/fil/création + entrée nav"
```

---

## Task 10 : Section « Discussions » sur la fiche instrument

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1: Charger et afficher les sujets liés**

Dans `frontend/app/actions/[code]/page.tsx`, après le contenu principal de la fiche, ajouter une section serveur :

```tsx
// imports en tête du fichier
import Link from 'next/link';
import { listTopics } from '@/lib/forum/server';
import { ForumTopicList } from '@/components/forum/ForumTopicList';

// … dans le composant page, après avoir récupéré `code` :
const { topics: forumTopics, authors: forumAuthors } = await listTopics(0, code);

// … dans le JSX, à la fin de la fiche :
<section className="mt-8 space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-white">Discussions</h2>
    <Link href="/forum/nouveau" className="text-sm text-info hover:underline">Démarrer une discussion</Link>
  </div>
  <ForumTopicList topics={forumTopics} authors={forumAuthors} />
</section>
```

> Note : adapter le nom de la variable `code` à celle déjà présente dans la page (souvent `params.code.toUpperCase()`).

- [ ] **Step 2: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` (Expected: aucune erreur)

```bash
git add frontend/app/actions/[code]/page.tsx
git commit -m "feat(forum): section Discussions sur la fiche instrument"
```

---

## Task 11 : Modération admin

**Files:**
- Create: `frontend/app/admin/forum/page.tsx`
- Create: `frontend/lib/forum/admin.ts`

- [ ] **Step 1: Couche admin (service_role)**

```typescript
// frontend/lib/forum/admin.ts
'use server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { requirePermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';

export interface OpenReport {
  id: string; target_type: 'topic' | 'post'; target_id: string; reason: string | null; created_at: string;
}

export async function listOpenReports(): Promise<OpenReport[]> {
  await requirePermission('content.write');
  const admin = getServiceClient();
  const { data } = await admin.from('forum_reports').select('*').eq('resolved', false).order('created_at', { ascending: false });
  return (data ?? []) as OpenReport[];
}

export async function setHidden(targetType: 'topic' | 'post', targetId: string, hidden: boolean) {
  await requirePermission('content.write');
  const admin = getServiceClient();
  const table = targetType === 'topic' ? 'forum_topics' : 'forum_posts';
  await admin.from(table).update({ hidden }).eq('id', targetId);
  revalidatePath('/admin/forum');
  return { ok: true };
}

export async function resolveReport(id: string) {
  await requirePermission('content.write');
  const admin = getServiceClient();
  await admin.from('forum_reports').update({ resolved: true }).eq('id', id);
  revalidatePath('/admin/forum');
  return { ok: true };
}
```

> Vérifier la signature exacte de `requirePermission` dans `frontend/lib/server/rbac.ts` (code de permission attendu, ex. `'content.write'`) et l'ajuster si nécessaire.

- [ ] **Step 2: Page admin**

```tsx
// frontend/app/admin/forum/page.tsx
import { listOpenReports, setHidden, resolveReport } from '@/lib/forum/admin';

export const metadata = { title: 'Modération forum — Admin' };

export default async function AdminForumPage() {
  const reports = await listOpenReports();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Modération du forum</h1>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">Aucun signalement en attente.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <p className="text-white">{r.target_type} · {r.target_id}</p>
              {r.reason && <p className="text-muted mt-1">« {r.reason} »</p>}
              <div className="mt-3 flex gap-2">
                <form action={async () => { 'use server'; await setHidden(r.target_type, r.target_id, true); await resolveReport(r.id); }}>
                  <button className="rounded border border-down/40 px-3 py-1 text-xs text-down">Masquer + résoudre</button>
                </form>
                <form action={async () => { 'use server'; await resolveReport(r.id); }}>
                  <button className="rounded border border-border px-3 py-1 text-xs text-muted">Ignorer</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` (Expected: aucune erreur)

```bash
git add frontend/app/admin/forum frontend/lib/forum/admin.ts
git commit -m "feat(forum): modération admin (file de signalements + masquage)"
```

---

## Task 12 : RGPD (export + pseudonyme) + docs

**Files:**
- Modify: `frontend/app/api/account/export/route.ts`
- Modify: `frontend/app/parametres/compte/page.tsx`
- Modify: `docs/RGPD.md`

- [ ] **Step 1: Export — ajouter le contenu forum**

Dans `frontend/app/api/account/export/route.ts`, ajouter aux requêtes parallèles :

```typescript
    supabase.from('forum_topics').select('*').eq('author_id', user.id),
    supabase.from('forum_posts').select('*').eq('author_id', user.id),
```

…et au `payload` :

```typescript
    forum_topics: forumTopics.data ?? [],
    forum_posts: forumPosts.data ?? [],
```

(en nommant les deux nouvelles entrées du `await Promise.all([...])` `forumTopics` et `forumPosts`).

> Suppression de compte : AUCUN code à ajouter. Les FK `author_id ... on delete set null` anonymisent automatiquement les contributions quand `auth.admin.deleteUser` s'exécute (Task 1). Vérifier ce comportement manuellement (créer un compte test, publier, supprimer le compte, constater « Utilisateur supprimé »).

- [ ] **Step 2: Champ pseudonyme dans les paramètres**

Dans `frontend/app/parametres/compte/page.tsx`, ajouter un champ permettant de définir `profiles.display_name` (formulaire + server action `update profiles set display_name`). Réutiliser le style des autres champs de la page. Exemple de server action :

```typescript
async function saveDisplayName(formData: FormData) {
  'use server';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const name = String(formData.get('display_name') ?? '').trim().slice(0, 40);
  await supabase.from('profiles').update({ display_name: name || null }).eq('id', user.id);
}
```

- [ ] **Step 3: Documenter le traitement RGPD**

Dans `docs/RGPD.md`, ajouter une entrée d'inventaire : « Forum — pseudonyme + contenu des messages ; finalité discussion communautaire ; base légale intérêt légitime + action volontaire ; conservation jusqu'à suppression par l'auteur ou masquage admin ; droits export (inclus dans /api/account/export) et anonymisation à la suppression du compte ».

- [ ] **Step 4: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` (Expected: aucune erreur)

```bash
git add frontend/app/api/account/export/route.ts frontend/app/parametres/compte/page.tsx docs/RGPD.md
git commit -m "feat(forum): RGPD — export du contenu forum, pseudonyme, inventaire"
```

---

## Task 13 : Vérification finale

- [ ] **Step 1: Tests purs**

Run: `cd frontend && npx vitest run lib/forum`
Expected: PASS (validation 10 + rateLimit 6 + identity 4 = 20 tests).

- [ ] **Step 2: Typecheck complet**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Build Next**

Run: `cd frontend && npm run build`
Expected: build réussi, routes `/forum`, `/forum/[id]`, `/forum/nouveau`, `/admin/forum` présentes.

- [ ] **Step 4: Vérification manuelle (état vide + flux)**

1. `/forum` sans données → état vide « Aucune discussion ».
2. Connecté → créer un sujet rattaché à une action → apparaît dans `/forum` et sur la fiche action.
3. Répondre deux fois de suite < 20 s → message anti-flood.
4. Signaler un message → apparaît dans `/admin/forum` → masquer → disparaît de la lecture publique.
5. Exporter le compte (`/api/account/export`) → contient `forum_topics`/`forum_posts`.
6. Supprimer un compte test ayant publié → l'auteur s'affiche « Utilisateur supprimé ».

- [ ] **Step 5: Commit final éventuel** (si correctifs)

```bash
git add -A && git commit -m "fix(forum): correctifs de vérification finale"
```

---

## Notes de sécurité / RGPD (rappel)

- `service_role` uniquement côté serveur (`lib/forum/admin.ts`), jamais exposé au client.
- Lecture publique limitée à `hidden = false` par RLS.
- Aucune donnée personnelle au-delà du pseudonyme ; pas de traceur tiers.
- Anonymisation automatique à la suppression (FK `on delete set null`).
