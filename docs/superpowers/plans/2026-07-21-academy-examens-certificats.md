# Academy P2 — examens & certificats · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un examen noté (≥ 70 %) par niveau de la WESTBOURSE Academy, débloqué après les leçons, générant un certificat partageable (page publique vérifiable + LinkedIn) avec consentement RGPD.

**Architecture:** Banque de questions serveur-only (RLS sans lecture) ; assemblage et correction purs et testés côté serveur (les bonnes réponses ne quittent jamais la base) ; certificats exposés via une vue `security_invoker` qui masque `user_id` ; OG image dynamique via `ImageResponse` ; droits RGPD (export/delete) complétés.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgREST + RLS), TypeScript, tests purs `.test.mjs` via `npx tsx --test`, `next/og` `ImageResponse`.

**Spec:** `docs/superpowers/specs/2026-07-21-academy-examens-certificats-design.md`

---

## Conventions vérifiées (à réutiliser telles quelles)

- Auth route serveur : `import { createClient } from '@/lib/supabase/server';` puis
  `const db = createClient(); const { data: { user } } = await db.auth.getUser();`
  (cf. `app/formations/academy/actions.ts`). `if (!user) return NextResponse.json({error}, {status:401})`.
- Service client (bypass RLS, server-only) : `import { getServiceClient } from '@/lib/billing/serviceClient';`.
- Client public anon : `import { createPublicClient } from '@/lib/supabase/public';`.
- Gating : `import { canAccess } from '@/lib/server/featureAccess';` → `const g = await canAccess('formations'); if (!g.allowed) …`.
- OG : `import { ImageResponse } from 'next/og'; export const runtime = 'edge';` (cf. `app/api/og/societe/route.tsx`).
- Contenu d'un cours : `academy_courses.content` = `{ intro, lessons: [{ …, qcm?: {question, options[], correct, explication} }], glossaire }`, colonne `niveau ∈ {debutant,intermediaire,avance,expert}`.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0112_academy_exams_certificats.sql` | 3 tables + vue publique (créé) |
| `frontend/lib/academy/exam.ts` | `assembleExam`/`gradeExam` + PRNG seedé, purs (créé) |
| `frontend/lib/academy/exam.test.mjs` | tests purs (créé) |
| `frontend/lib/academy/examServer.ts` | chargement banque + accès niveau (créé) |
| `scraper/scripts/seed-exam-bank.mjs` | seed banque (qcm leçons + inédits) (créé) |
| `frontend/app/api/academy/exam/[niveau]/start/route.ts` | démarrage examen (créé) |
| `frontend/app/api/academy/exam/[niveau]/submit/route.ts` | correction + attempt (créé) |
| `frontend/app/api/academy/certificate/route.ts` | génération (POST) (créé) |
| `frontend/app/api/academy/certificate/[id]/route.ts` | révocation (PATCH) (créé) |
| `frontend/app/formations/academy/examen/[niveau]/page.tsx` | UI examen (créé) |
| `frontend/components/academy/ExamRunner.tsx` | composant client examen (créé) |
| `frontend/app/certificat/[id]/page.tsx` | page publique certificat (créé) |
| `frontend/app/certificat/[id]/opengraph-image.tsx` | OG image (créé) |
| `frontend/components/academy/CertificateActions.tsx` | générer/partager/LinkedIn (créé) |
| `frontend/app/formations/academy/page.tsx` | bouton « Passer l'examen » (modifié) |
| `frontend/lib/supabase/middleware.ts` | `/certificat` en public (modifié) |
| `frontend/app/api/account/export/route.ts` | +4 tables academy (modifié) |
| `frontend/app/api/account/delete/route.ts` | +4 tables academy (modifié) |

---

### Task 1 : Migration `0112` — tables + vue

**Files:** Create `supabase/migrations/0112_academy_exams_certificats.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- 0112_academy_exams_certificats.sql
-- Examens de niveau + certificats partageables.
-- Spec : docs/superpowers/specs/2026-07-21-academy-examens-certificats-design.md
-- ============================================================================

-- 1) Banque de questions — JAMAIS lisible (assemblée serveur-only via service_role).
create table if not exists public.academy_exam_questions (
  id           uuid primary key default gen_random_uuid(),
  niveau       text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  question     text not null,
  options      jsonb not null,
  correct      integer not null check (correct >= 0),
  explication  text not null,
  source       text not null check (source in ('quiz','inedite')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_exam_questions_niveau on public.academy_exam_questions (niveau) where active;
alter table public.academy_exam_questions enable row level security;
-- Aucune policy de lecture : personne (anon/authenticated) ne lit cette table.
revoke insert, update, delete on public.academy_exam_questions from public, anon, authenticated;

-- 2) Passages d'examen — RLS owner-strict.
create table if not exists public.academy_exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  niveau       text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  question_ids uuid[] not null,
  score        integer not null check (score between 0 and 100),
  passed       boolean not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_exam_attempts_user on public.academy_exam_attempts (user_id, niveau, created_at desc);
alter table public.academy_exam_attempts enable row level security;
drop policy if exists "exam_attempts owner select" on public.academy_exam_attempts;
create policy "exam_attempts owner select" on public.academy_exam_attempts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "exam_attempts owner insert" on public.academy_exam_attempts;
create policy "exam_attempts owner insert" on public.academy_exam_attempts
  for insert to authenticated with check (user_id = (select auth.uid()));

-- 3) Certificats — la table n'a PAS de lecture publique ; l'exposition publique
--    passe par la vue academy_certificates_public (sans user_id).
create table if not exists public.academy_certificates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  niveau        text not null check (niveau in ('debutant','intermediaire','avance','expert')),
  display_name  text not null,
  consent_at    timestamptz not null,
  issued_at     timestamptz not null default now(),
  revoked       boolean not null default false,
  unique (user_id, niveau)
);
alter table public.academy_certificates enable row level security;
drop policy if exists "certificates owner all" on public.academy_certificates;
create policy "certificates owner all" on public.academy_certificates
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Vue publique : uniquement les certificats actifs, SANS user_id ni consent_at.
drop view if exists public.academy_certificates_public;
create view public.academy_certificates_public
  with (security_invoker = true) as
  select id, niveau, display_name, issued_at
  from public.academy_certificates
  where revoked = false;
grant select on public.academy_certificates_public to anon, authenticated;

comment on table public.academy_certificates is
  'Certificats de niveau Academy. Donnée perso (display_name) exposée publiquement SUR CONSENTEMENT (consent_at), via la vue academy_certificates_public (sans user_id). Révocable.';
```

- [ ] **Step 2 : Demander à l'utilisateur d'appliquer la migration** dans le SQL Editor Supabase. Les tasks 2-4 (code pur / seed) peuvent avancer sans attendre ; les tasks 5+ (routes lisant la base) et les sondes RLS nécessitent la migration appliquée.

- [ ] **Step 3 : Sonde RLS anon (après application)** — remplacer `$ANON` par `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `frontend/.env.local` :

```bash
cd scraper && set -a && source .env.local && set +a
ANON="<clé anon>"
# Banque illisible en anon (attendu [] vide OU erreur permission, JAMAIS de lignes) :
curl -s "$SUPABASE_URL/rest/v1/academy_exam_questions?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# Vue publique lisible mais SANS user_id (demander user_id doit échouer) :
curl -s "$SUPABASE_URL/rest/v1/academy_certificates_public?select=id,user_id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# Table certificats : pas de lecture anon :
curl -s "$SUPABASE_URL/rest/v1/academy_certificates?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Attendu : banque `[]` (RLS sans policy → aucune ligne), la 2ᵉ requête renvoie une erreur PostgREST (`column ... does not exist` côté vue), la 3ᵉ `[]`.

- [ ] **Step 4 : Commit** — `git add supabase/migrations/0112_academy_exams_certificats.sql && git commit -m "feat(db): examens academy + certificats (banque RLS-only, vue publique sans user_id)"`

---

### Task 2 : `exam.ts` — assemblage & correction purs (TDD)

**Files:** Create `frontend/lib/academy/exam.ts`, `frontend/lib/academy/exam.test.mjs`

- [ ] **Step 1 : Test d'abord**

```js
// frontend/lib/academy/exam.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleExam, gradeExam } from './exam.ts';

/** Banque jouet : n questions à 3 options, bonne réponse = index 0. */
function banque(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`, question: `Q${i}`, options: [`bon${i}`, `faux${i}a`, `faux${i}b`], correct: 0, explication: `e${i}`,
  }));
}

test('assembleExam tire `taille` questions sans doublon', () => {
  const ex = assembleExam(banque(40), 'seed-1', 20);
  assert.equal(ex.questions.length, 20);
  assert.equal(new Set(ex.question_ids).size, 20);
});

test('assembleExam est déterministe par seed', () => {
  const a = assembleExam(banque(40), 'seed-1', 20);
  const b = assembleExam(banque(40), 'seed-1', 20);
  assert.deepEqual(a.question_ids, b.question_ids);
  const c = assembleExam(banque(40), 'seed-2', 20);
  assert.notDeepEqual(a.question_ids, c.question_ids);
});

test('assembleExam ne renvoie jamais le champ correct', () => {
  const ex = assembleExam(banque(10), 's', 5);
  for (const q of ex.questions) assert.equal('correct' in q, false);
});

test('assembleExam mélange les options mais garde options intactes', () => {
  const ex = assembleExam(banque(10), 's', 5);
  for (const q of ex.questions) assert.equal(q.options.length, 3);
});

test('taille > banque → toute la banque', () => {
  const ex = assembleExam(banque(5), 's', 20);
  assert.equal(ex.questions.length, 5);
});

test('gradeExam : score et seuil 70', () => {
  const b = banque(10);
  const ex = assembleExam(b, 's', 10);
  // Réponses : pour chaque question affichée, retrouver l'index de l'option "bon..."
  const bonnes = ex.questions.map((q) => q.options.findIndex((o) => o.startsWith('bon')));
  const r10 = gradeExam(b, ex.question_ids, bonnes);
  assert.equal(r10.score, 100);
  assert.equal(r10.passed, true);
  // 6/10 = 60 → échec ; 7/10 = 70 → réussite
  const r6 = gradeExam(b, ex.question_ids, bonnes.map((v, i) => (i < 6 ? v : (v + 1) % 3)));
  assert.equal(r6.score, 60); assert.equal(r6.passed, false);
  const r7 = gradeExam(b, ex.question_ids, bonnes.map((v, i) => (i < 7 ? v : (v + 1) % 3)));
  assert.equal(r7.score, 70); assert.equal(r7.passed, true);
});
```

- [ ] **Step 2 : Vérifier l'échec** — `cd frontend && npx tsx --test lib/academy/exam.test.mjs` → FAIL (module absent).

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/academy/exam.ts
/**
 * Assemblage et correction d'un examen — PUR, testé. Les bonnes réponses ne
 * sortent d'ici que via gradeExam (serveur) : assembleExam ne les renvoie jamais.
 * Spec : docs/superpowers/specs/2026-07-21-academy-examens-certificats-design.md
 */

export interface BankQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explication: string;
}

/** Question envoyée au client : SANS `correct`, options éventuellement mélangées. */
export interface ExamQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface AssembledExam {
  question_ids: string[];
  questions: ExamQuestion[];
}

export interface ExamGrade {
  score: number; // 0-100
  passed: boolean;
  /** Corrigé par question (pour l'affichage post-soumission). */
  corrige: { id: string; correct: number; explication: string }[];
}

export const PASS_THRESHOLD = 70;
export const EXAM_SIZE = 20;

/** PRNG déterministe (mulberry32) seedé par une chaîne (hash FNV-1a). */
function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange Fisher-Yates in place avec un rng fourni. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function assembleExam(bank: BankQuestion[], seed: string, taille = EXAM_SIZE): AssembledExam {
  const rng = seededRng(seed);
  const picked = shuffle(bank, rng).slice(0, Math.min(taille, bank.length));
  const questions: ExamQuestion[] = picked.map((q) => ({
    id: q.id,
    question: q.question,
    options: shuffle(q.options, rng),
  }));
  return { question_ids: picked.map((q) => q.id), questions };
}

/**
 * Corrige : compare, pour chaque question tirée, l'option choisie (par sa VALEUR
 * de texte, robuste au mélange) à la bonne réponse de la banque.
 * `reponses[i]` = index choisi dans les options MÉLANGÉES renvoyées par assembleExam.
 * On reconstruit le même mélange avec le seed pour retrouver la valeur choisie.
 */
export function gradeExam(
  bank: BankQuestion[],
  questionIds: string[],
  reponses: number[],
  seed = '',
): ExamGrade {
  const byId = new Map(bank.map((q) => [q.id, q]));
  let bonnes = 0;
  const corrige: ExamGrade['corrige'] = [];
  questionIds.forEach((id, i) => {
    const q = byId.get(id);
    if (!q) return;
    const bonneValeur = q.options[q.correct];
    // Sans seed on suppose reponses[i] = index dans l'ordre d'origine ; avec seed on
    // reconstruit le mélange. La route passe TOUJOURS le seed (cf. Task 5).
    const optionsAffichees = seed ? shuffleForGrade(q.options, seed, i) : q.options;
    const choixValeur = optionsAffichees[reponses[i] ?? -1];
    if (choixValeur === bonneValeur) bonnes++;
    corrige.push({ id, correct: q.correct, explication: q.explication });
  });
  const score = questionIds.length > 0 ? Math.round((bonnes / questionIds.length) * 100) : 0;
  return { score, passed: score >= PASS_THRESHOLD, corrige };
}

/** Reconstruit le mélange d'options d'UNE question (même logique qu'assembleExam). */
function shuffleForGrade(options: string[], seed: string, indexQuestion: number): string[] {
  // Recrée l'état du rng jusqu'à cette question : impossible sans rejouer tout
  // assembleExam. Pour rester simple et robuste, la route stocke le mélange —
  // voir Task 5 (le client renvoie l'ordre des options qu'il a vu).
  return options;
}
```

> Note d'implémentation : le mélange par-question complique la correction stateless.
> **Décision (simplifie et reste sûr)** : `assembleExam` renvoie l'ordre mélangé au
> client ; à la soumission, le client renvoie **l'ordre des options tel qu'affiché**
> (`options[]` par question), et `gradeExam` compare la VALEUR choisie à la valeur
> correcte de la banque — plus besoin de rejouer le rng. Ajuster la signature en Step 3
> comme ci-dessous et adapter les tests (le test passe déjà la valeur via `findIndex`).

Signature finale de `gradeExam` (remplace celle ci-dessus) :

```ts
export function gradeExam(
  bank: BankQuestion[],
  answers: { id: string; options: string[]; choix: number }[],
): ExamGrade {
  const byId = new Map(bank.map((q) => [q.id, q]));
  let bonnes = 0;
  const corrige: ExamGrade['corrige'] = [];
  for (const a of answers) {
    const q = byId.get(a.id);
    if (!q) continue;
    const choixValeur = a.options[a.choix];
    if (choixValeur === q.options[q.correct]) bonnes++;
    corrige.push({ id: a.id, correct: q.correct, explication: q.explication });
  }
  const score = answers.length > 0 ? Math.round((bonnes / answers.length) * 100) : 0;
  return { score, passed: score >= PASS_THRESHOLD, corrige };
}
```

Et supprimer `shuffleForGrade`. Adapter le test `gradeExam` pour appeler la nouvelle
signature :

```js
test('gradeExam : score et seuil 70', () => {
  const b = banque(10);
  const ex = assembleExam(b, 's', 10);
  const answers = ex.questions.map((q) => ({ id: q.id, options: q.options, choix: q.options.findIndex((o) => o.startsWith('bon')) }));
  assert.equal(gradeExam(b, answers).score, 100);
  const six = answers.map((a, i) => (i < 6 ? a : { ...a, choix: (a.choix + 1) % 3 }));
  assert.equal(gradeExam(b, six).score, 60);
  assert.equal(gradeExam(b, six).passed, false);
  const seven = answers.map((a, i) => (i < 7 ? a : { ...a, choix: (a.choix + 1) % 3 }));
  assert.equal(gradeExam(b, seven).score, 70);
  assert.equal(gradeExam(b, seven).passed, true);
});
```

- [ ] **Step 4 : Vérifier** — `npx tsx --test lib/academy/exam.test.mjs` → tous verts. `npx tsc --noEmit`.

- [ ] **Step 5 : Commit** — `git add frontend/lib/academy/exam.ts frontend/lib/academy/exam.test.mjs && git commit -m "feat(academy): assembleExam/gradeExam purs — tirage seede, correction par valeur"`

---

### Task 3 : `examServer.ts` — banque & déblocage

**Files:** Create `frontend/lib/academy/examServer.ts`

- [ ] **Step 1 : Implémenter** (I/O, non testé unitairement — couvert par les routes)

```ts
// frontend/lib/academy/examServer.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import type { BankQuestion } from './exam.ts';

export type Niveau = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export const NIVEAUX: Niveau[] = ['debutant', 'intermediaire', 'avance', 'expert'];

export function isNiveau(x: string): x is Niveau {
  return (NIVEAUX as string[]).includes(x);
}

/** Charge la banque active d'un niveau (service_role : la table n'est pas lisible autrement). */
export async function loadBank(niveau: Niveau): Promise<BankQuestion[]> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('academy_exam_questions')
    .select('id, question, options, correct, explication')
    .eq('niveau', niveau)
    .eq('active', true);
  return (data ?? []) as BankQuestion[];
}

/**
 * L'utilisateur a-t-il terminé toutes les leçons du cours de ce niveau ?
 * (Déblocage de l'examen.) Compare le nb de leçons du contenu au nb de
 * lignes academy_progress `completed` de l'utilisateur pour ce cours.
 */
export async function niveauLessonsDone(niveau: Niveau): Promise<{ ok: boolean; courseId: string | null }> {
  const svc = getServiceClient();
  const { data: course } = await svc
    .from('academy_courses')
    .select('id, content')
    .eq('niveau', niveau)
    .eq('published', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!course) return { ok: false, courseId: null };
  const total = ((course.content as { lessons?: unknown[] })?.lessons ?? []).length;

  const db = createClient(); // session → RLS owner
  const { data: prog } = await db
    .from('academy_progress')
    .select('lesson_idx')
    .eq('course_id', course.id)
    .eq('completed', true);
  const done = new Set((prog ?? []).map((r) => r.lesson_idx as number)).size;
  return { ok: total > 0 && done >= total, courseId: course.id as string };
}
```

- [ ] **Step 2 : Vérifier** — `npx tsc --noEmit` (0 erreur).

- [ ] **Step 3 : Commit** — `git add frontend/lib/academy/examServer.ts && git commit -m "feat(academy): examServer — chargement banque (service_role) + deblocage par lecons completees"`

---

### Task 4 : Seed de la banque

**Files:** Create `scraper/scripts/seed-exam-bank.mjs`

- [ ] **Step 1 : Écrire le script** (import qcm des leçons + inédits ; idempotent par hash)

```js
// scraper/scripts/seed-exam-bank.mjs
// Seed academy_exam_questions : QCM des leçons (source=quiz) + questions inédites
// de synthèse (source=inedite). Idempotent (dédoublonnage par hash question+niveau).
// Usage : SUPABASE_URL=… KEY=<service_role> node scripts/seed-exam-bank.mjs
import crypto from 'node:crypto';

const U = process.env.SUPABASE_URL, K = process.env.KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error('SUPABASE_URL / KEY manquants');
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

// Questions inédites de synthèse par niveau (rédigées ; complétables depuis
// git show b7c3d9d:frontend/public/academy/index.html — bloc QCM_DATA).
const INEDITES = {
  debutant: [
    { question: 'Quel est le rôle premier d’une SGI à la BRVM ?', options: ['Fixer les cours', 'Exécuter les ordres des investisseurs', 'Garantir les dividendes'], correct: 1, explication: 'La SGI est l’intermédiaire agréé qui transmet et exécute les ordres.' },
  ],
  intermediaire: [
    { question: 'Un PER faible peut être un piège quand…', options: ['le bénéfice est en baisse structurelle', 'l’action vient de monter', 'le dividende est élevé'], correct: 0, explication: 'Un PER optiquement bas sur un bénéfice qui s’effondre est un value trap.' },
  ],
  avance: [
    { question: 'Le ratio d’Amihud mesure…', options: ['la rentabilité', 'l’impact prix par unité de volume échangé', 'le rendement du dividende'], correct: 1, explication: 'Amihud = |variation| / valeur échangée : plus il est élevé, moins le titre est liquide.' },
  ],
  expert: [
    { question: 'Dans un DCF, une hausse du taux d’actualisation…', options: ['augmente la valeur', 'diminue la valeur actuelle des flux futurs', 'n’a aucun effet'], correct: 1, explication: 'Actualiser plus fort réduit la valeur présente des flux lointains.' },
  ],
};

async function main() {
  // 1) QCM des leçons par niveau.
  const courses = await (await fetch(`${U}/rest/v1/academy_courses?select=niveau,content&published=eq.true`, { headers: H })).json();
  const rows = [];
  for (const c of courses) {
    if (!c.niveau) continue;
    for (const l of (c.content?.lessons ?? [])) {
      const q = l.qcm;
      if (q && Array.isArray(q.options) && typeof q.correct === 'number') {
        rows.push({ niveau: c.niveau, question: q.question, options: q.options, correct: q.correct, explication: q.explication ?? '', source: 'quiz' });
      }
    }
  }
  // 2) Inédits.
  for (const [niveau, list] of Object.entries(INEDITES)) {
    for (const q of list) rows.push({ ...q, niveau, source: 'inedite' });
  }
  // 3) Dédoublonnage local par hash(niveau+question).
  const seen = new Set();
  const uniq = rows.filter((r) => { const h = hash(r.niveau + '|' + r.question); if (seen.has(h)) return false; seen.add(h); return true; });

  // 4) Existants (pour idempotence : on n’insère que les nouveaux).
  const existing = await (await fetch(`${U}/rest/v1/academy_exam_questions?select=niveau,question`, { headers: H })).json();
  const known = new Set(existing.map((e) => hash(e.niveau + '|' + e.question)));
  const toInsert = uniq.filter((r) => !known.has(hash(r.niveau + '|' + r.question)));

  if (toInsert.length === 0) { console.log('banque à jour, rien à insérer'); return; }
  const res = await fetch(`${U}/rest/v1/academy_exam_questions`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(toInsert) });
  console.log('insert:', res.status, '| nouvelles questions:', toInsert.length);
  const byNiveau = {};
  for (const r of uniq) byNiveau[r.niveau] = (byNiveau[r.niveau] ?? 0) + 1;
  console.log('total banque par niveau (après seed):', byNiveau);
}
main();
```

- [ ] **Step 2 : Exécuter** (après migration Task 1 appliquée) :

```bash
cd scraper && set -a && source .env.local && set +a
KEY="$SUPABASE_SERVICE_ROLE_KEY" node scripts/seed-exam-bank.mjs
```

Attendu : `insert: 201` puis le total par niveau (≥ ~5 par niveau selon le nb de leçons). Relancer une 2ᵉ fois → `banque à jour, rien à insérer` (idempotence).

- [ ] **Step 3 : Commit** — `git add scraper/scripts/seed-exam-bank.mjs && git commit -m "feat(academy): seed banque examen — qcm lecons + questions inedites, idempotent"`

---

### Task 5 : Routes start & submit

**Files:** Create `frontend/app/api/academy/exam/[niveau]/start/route.ts`, `frontend/app/api/academy/exam/[niveau]/submit/route.ts`

- [ ] **Step 1 : `start/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/server/featureAccess';
import { assembleExam } from '@/lib/academy/exam';
import { loadBank, niveauLessonsDone, isNiveau } from '@/lib/academy/examServer';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { niveau: string } }) {
  const niveau = params.niveau;
  if (!isNiveau(niveau)) return NextResponse.json({ error: 'Niveau inconnu' }, { status: 404 });

  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  const gate = await canAccess('formations');
  if (!gate.allowed) return NextResponse.json({ error: 'premium', required: gate.required }, { status: 403 });

  const done = await niveauLessonsDone(niveau);
  if (!done.ok) return NextResponse.json({ error: 'Terminez les leçons de ce niveau avant l’examen.' }, { status: 409 });

  const bank = await loadBank(niveau);
  if (bank.length < 5) return NextResponse.json({ error: 'Banque de questions indisponible.' }, { status: 503 });

  // Seed unique par tentative → tirage différent à chaque fois.
  const seed = `${user.id}:${niveau}:${Date.now()}:${Math.random()}`;
  const exam = assembleExam(bank, seed);
  return NextResponse.json({ niveau, questions: exam.questions }); // sans `correct`
}
```

- [ ] **Step 2 : `submit/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/server/featureAccess';
import { gradeExam } from '@/lib/academy/exam';
import { loadBank, isNiveau } from '@/lib/academy/examServer';

export const dynamic = 'force-dynamic';

interface SubmitBody {
  answers: { id: string; options: string[]; choix: number }[];
}

export async function POST(req: NextRequest, { params }: { params: { niveau: string } }) {
  const niveau = params.niveau;
  if (!isNiveau(niveau)) return NextResponse.json({ error: 'Niveau inconnu' }, { status: 404 });

  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  const gate = await canAccess('formations');
  if (!gate.allowed) return NextResponse.json({ error: 'premium' }, { status: 403 });

  const body = (await req.json()) as SubmitBody;
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: 'Réponses manquantes' }, { status: 400 });
  }

  const bank = await loadBank(niveau);
  const grade = gradeExam(bank, body.answers);

  // Enregistre la tentative (RLS owner : insert via session).
  await db.from('academy_exam_attempts').insert({
    user_id: user.id,
    niveau,
    question_ids: body.answers.map((a) => a.id),
    score: grade.score,
    passed: grade.passed,
  });

  return NextResponse.json({ score: grade.score, passed: grade.passed, corrige: grade.corrige });
}
```

- [ ] **Step 3 : Vérifier** — `npx tsc --noEmit` (0 erreur). `npm run build` (les 2 routes compilent).

- [ ] **Step 4 : Commit** — `git add frontend/app/api/academy/exam && git commit -m "feat(academy): routes examen start/submit — assemblage + correction serveur, attempt owner"`

---

### Task 6 : UI d'examen

**Files:** Create `frontend/components/academy/ExamRunner.tsx`, `frontend/app/formations/academy/examen/[niveau]/page.tsx`

- [ ] **Step 1 : `ExamRunner.tsx`** (client — enchaîne start → questions → submit → résultat)

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Q { id: string; question: string; options: string[] }
interface Corrige { id: string; correct: number; explication: string }
const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation', intermediaire: 'Fondamental', avance: 'Technique', expert: 'Expert' };

export default function ExamRunner({ niveau }: { niveau: string }) {
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [choix, setChoix] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; corrige: Corrige[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/academy/exam/${niveau}/start`, { method: 'POST' });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
    setQuestions(d.questions); setChoix({}); setIdx(0); setPhase('run');
  }

  async function submit() {
    setBusy(true);
    const answers = questions.map((q) => ({ id: q.id, options: q.options, choix: choix[q.id] ?? -1 }));
    const r = await fetch(`/api/academy/exam/${niveau}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
    });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
    setResult(d); setPhase('result');
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Link href="/formations/academy" className="text-sm text-muted hover:text-white">← Academy</Link>
        <h1 className="font-display text-2xl text-white">Examen · {NIVEAU_LABEL[niveau] ?? niveau}</h1>
        <p className="text-sm text-muted">20 questions tirées au hasard. Réussite à partir de 70 %. Tentatives illimitées.</p>
        {error && <p className="rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-down">{error}</p>}
        <button type="button" onClick={start} disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">
          {busy ? '…' : 'Commencer l’examen'}
        </button>
      </div>
    );
  }

  if (phase === 'run') {
    const q = questions[idx]!;
    const answered = choix[q.id] != null;
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
        <div className="flex items-center justify-between text-xs text-faint">
          <span>Question {idx + 1} / {questions.length}</span>
          <span>{Object.keys(choix).length} répondues</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full bg-accent" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
        <h2 className="text-lg font-semibold text-ivory">{q.question}</h2>
        <div className="space-y-2">
          {q.options.map((o, i) => (
            <button key={i} type="button" onClick={() => setChoix((c) => ({ ...c, [q.id]: i }))}
              className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                choix[q.id] === i ? 'border-accent bg-accent/10 text-white' : 'border-border bg-surface text-muted hover:border-accent/40'}`}>
              {o}
            </button>
          ))}
        </div>
        <div className="flex justify-between pt-2">
          <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted disabled:opacity-30">← Précédent</button>
          {idx + 1 < questions.length ? (
            <button type="button" onClick={() => setIdx((i) => i + 1)} disabled={!answered}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">Suivant →</button>
          ) : (
            <button type="button" onClick={submit} disabled={Object.keys(choix).length < questions.length || busy}
              className="rounded-lg bg-up px-5 py-2 text-sm font-semibold text-bg disabled:opacity-40">Terminer</button>
          )}
        </div>
      </div>
    );
  }

  // result
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <div className={`rounded-xl border p-5 ${result!.passed ? 'border-up/40 bg-up/10' : 'border-down/40 bg-down/10'}`}>
        <p className="font-display text-2xl text-white">{result!.passed ? '✓ Réussi' : '✗ Non validé'}</p>
        <p className="tabular mt-1 text-sm text-muted">Score : {result!.score} % (seuil 70 %)</p>
      </div>
      {result!.passed && (
        <Link href={`/formations/academy/certificat?niveau=${niveau}`}
          className="inline-block rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-bg">Générer mon certificat →</Link>
      )}
      {!result!.passed && (
        <button type="button" onClick={() => { setPhase('intro'); setResult(null); }}
          className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted hover:text-white">Repasser l’examen</button>
      )}
      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm text-muted">Voir le corrigé</summary>
        <ul className="mt-3 space-y-2">
          {result!.corrige.map((c) => (
            <li key={c.id} className="border-b border-border/40 pb-2 text-xs text-faint last:border-0">{c.explication}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
```

- [ ] **Step 2 : Page examen**

```tsx
// frontend/app/formations/academy/examen/[niveau]/page.tsx
import { redirect } from 'next/navigation';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { isNiveau } from '@/lib/academy/examServer';
import ExamRunner from '@/components/academy/ExamRunner';

export const dynamic = 'force-dynamic';

export default async function ExamenPage({ params }: { params: { niveau: string } }) {
  if (!isNiveau(params.niveau)) redirect('/formations/academy');
  const gate = await canAccess('formations');
  if (!gate.allowed) {
    return <AccessGate required={gate.required === 'free' ? 'premium' : gate.required} feature="Les examens de l’Academy" hint="Validez vos acquis et obtenez un certificat." />;
  }
  return <ExamRunner niveau={params.niveau} />;
}
```

- [ ] **Step 3 : Vérifier** — `npx tsc --noEmit`, `npm run build`. Vérifier que `AccessGate` accepte les props `required/feature/hint` (cf. `app/formations/academy/page.tsx`). Le middleware ne doit PAS rendre `/formations/academy/examen` public (l'app authentifiée le sert déjà).

- [ ] **Step 4 : Commit** — `git add frontend/components/academy/ExamRunner.tsx frontend/app/formations/academy/examen && git commit -m "feat(academy): UI examen — questions une a une, resultat, corrige"`

---

### Task 7 : Génération du certificat (route + écran)

**Files:** Create `frontend/app/api/academy/certificate/route.ts`, `frontend/app/formations/academy/certificat/page.tsx`, `frontend/components/academy/CertificateActions.tsx`

- [ ] **Step 1 : Route POST (génération, exige consentement)**

```ts
// frontend/app/api/academy/certificate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isNiveau } from '@/lib/academy/examServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  const body = (await req.json()) as { niveau?: string; display_name?: string; consent?: boolean };
  if (!body.niveau || !isNiveau(body.niveau)) return NextResponse.json({ error: 'Niveau inconnu' }, { status: 400 });
  const name = (body.display_name ?? '').trim();
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Nom invalide' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: 'Consentement requis' }, { status: 400 });

  // Exiger un examen réussi pour ce niveau (RLS owner : ne voit que ses attempts).
  const { data: pass } = await db
    .from('academy_exam_attempts')
    .select('id')
    .eq('niveau', body.niveau)
    .eq('passed', true)
    .limit(1);
  if (!pass || pass.length === 0) return NextResponse.json({ error: 'Examen non validé' }, { status: 403 });

  // Upsert (un certificat par niveau) ; réactive si révoqué.
  const { data, error } = await db
    .from('academy_certificates')
    .upsert(
      { user_id: user.id, niveau: body.niveau, display_name: name, consent_at: new Date().toISOString(), revoked: false },
      { onConflict: 'user_id,niveau' },
    )
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'Échec de génération' }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
```

- [ ] **Step 2 : `CertificateActions.tsx`** (client : nom + consentement → génère → liens de partage)

```tsx
'use client';
import { useState } from 'react';

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation', intermediaire: 'Fondamental', avance: 'Technique', expert: 'Expert' };

export default function CertificateActions({ niveau, defaultName }: { niveau: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [consent, setConsent] = useState(false);
  const [certId, setCertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true); setError(null);
    const r = await fetch('/api/academy/certificate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niveau, display_name: name, consent }),
    });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
    setCertId(d.id);
  }

  if (certId) {
    const url = `${window.location.origin}/certificat/${certId}`;
    const now = new Date();
    const linkedin = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent('Academy WESTBOURSE · ' + (NIVEAU_LABEL[niveau] ?? niveau))}&organizationName=WESTBOURSE&issueYear=${now.getFullYear()}&issueMonth=${now.getMonth() + 1}&certUrl=${encodeURIComponent(url)}&certId=${certId}`;
    return (
      <div className="space-y-3">
        <p className="text-sm text-up">✓ Certificat généré.</p>
        <a href={url} className="block text-sm text-accent hover:underline">Voir mon certificat →</a>
        <div className="flex flex-wrap gap-2">
          <a href={linkedin} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white">Ajouter à LinkedIn</a>
          <button type="button" onClick={() => navigator.clipboard.writeText(url)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white">Copier le lien</button>
          <a href={`https://wa.me/?text=${encodeURIComponent('Mon certificat WESTBOURSE : ' + url)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white">WhatsApp</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-muted">Nom affiché sur le certificat
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-white" />
      </label>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>J’accepte que mon nom et ce certificat figurent sur une page publique vérifiable, et je peux le révoquer à tout moment.</span>
      </label>
      {error && <p className="text-sm text-down">{error}</p>}
      <button type="button" onClick={generate} disabled={!consent || name.trim().length < 2 || busy}
        className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">
        {busy ? '…' : 'Générer le certificat'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3 : Page de génération** (pré-remplit le nom depuis `profiles`)

```tsx
// frontend/app/formations/academy/certificat/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isNiveau } from '@/lib/academy/examServer';
import CertificateActions from '@/components/academy/CertificateActions';

export const dynamic = 'force-dynamic';

export default async function CertificatPage({ searchParams }: { searchParams: { niveau?: string } }) {
  const niveau = searchParams.niveau ?? '';
  if (!isNiveau(niveau)) redirect('/formations/academy');
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login?next=/formations/academy');
  const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const defaultName = (profile as { full_name?: string } | null)?.full_name ?? '';

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-10">
      <h1 className="font-display text-2xl text-white">Votre certificat</h1>
      <p className="text-sm text-muted">Confirmez le nom qui apparaîtra sur le certificat public.</p>
      <CertificateActions niveau={niveau} defaultName={defaultName} />
    </div>
  );
}
```

Vérifier la colonne réelle du nom dans `profiles` (peut être `full_name`, `name` ou absente) : `grep -n "full_name\|name" supabase/migrations/*profil* supabase/migrations/0001*` — adapter le `.select(...)` ; si aucune colonne nom, laisser `defaultName = ''` (l'utilisateur saisit).

- [ ] **Step 4 : Vérifier** — `npx tsc --noEmit`, `npm run build`.

- [ ] **Step 5 : Commit** — `git add frontend/app/api/academy/certificate/route.ts frontend/app/formations/academy/certificat frontend/components/academy/CertificateActions.tsx && git commit -m "feat(academy): generation certificat avec consentement + partage LinkedIn/WhatsApp"`

---

### Task 8 : Page publique + OG + révocation

**Files:** Create `frontend/app/certificat/[id]/page.tsx`, `frontend/app/certificat/[id]/opengraph-image.tsx`, `frontend/app/api/academy/certificate/[id]/route.ts`; Modify `frontend/lib/supabase/middleware.ts`

- [ ] **Step 1 : Page publique** (lit la vue, jamais `user_id`)

```tsx
// frontend/app/certificat/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation à la BRVM', intermediaire: 'Fondamental', avance: 'Analyse technique', expert: 'Expert' };

async function load(id: string) {
  const db = createPublicClient();
  const { data } = await db.from('academy_certificates_public').select('id, niveau, display_name, issued_at').eq('id', id).maybeSingle();
  return data as { id: string; niveau: string; display_name: string; issued_at: string } | null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await load(params.id);
  if (!c) return { title: 'Certificat introuvable' };
  const t = `${c.display_name} — Certificat ${NIVEAU_LABEL[c.niveau] ?? c.niveau} · WESTBOURSE Academy`;
  return { title: t, description: 'Certificat de formation BRVM délivré par WESTBOURSE Academy.' };
}

export default async function CertificatPublicPage({ params }: { params: { id: string } }) {
  const c = await load(params.id);
  if (!c) notFound();
  const date = new Date(c.issued_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-gold/30 bg-surface p-10 text-center shadow-card">
        <p className="overline text-gold">WESTBOURSE Academy</p>
        <p className="mt-6 text-sm text-muted">Ce certificat atteste que</p>
        <p className="mt-2 font-display text-3xl text-white">{c.display_name}</p>
        <p className="mt-4 text-sm text-muted">a validé le niveau</p>
        <p className="mt-1 font-display text-xl text-gold">{NIVEAU_LABEL[c.niveau] ?? c.niveau}</p>
        <p className="mt-6 text-xs text-faint">Délivré le {date} · Réf. {c.id.slice(0, 8)}</p>
        <p className="mt-8 text-[11px] text-faint">Vérifiable sur westbourse.com/certificat/{c.id.slice(0, 8)}…</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : OG image** (pattern `app/api/og/societe/route.tsx`)

```tsx
// frontend/app/certificat/[id]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation à la BRVM', intermediaire: 'Fondamental', avance: 'Analyse technique', expert: 'Expert' };

export default async function Image({ params }: { params: { id: string } }) {
  const db = createPublicClient();
  const { data } = await db.from('academy_certificates_public').select('niveau, display_name').eq('id', params.id).maybeSingle();
  const name = (data as { display_name?: string } | null)?.display_name ?? 'Certificat';
  const niveau = NIVEAU_LABEL[(data as { niveau?: string } | null)?.niveau ?? ''] ?? 'WESTBOURSE Academy';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#030303', color: '#FCFCFC' }}>
        <div style={{ color: '#56D7FD', fontSize: 28, letterSpacing: 4 }}>WESTBOURSE ACADEMY</div>
        <div style={{ fontSize: 30, marginTop: 40, color: '#7a9ea8' }}>Certificat délivré à</div>
        <div style={{ fontSize: 64, marginTop: 12, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 36, marginTop: 24, color: '#e8b54d' }}>{niveau}</div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 3 : Route révocation (PATCH)**

```ts
// frontend/app/api/academy/certificate/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  // RLS owner : ne peut révoquer que son propre certificat.
  const { error } = await db.from('academy_certificates').update({ revoked: true }).eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Échec' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4 : Middleware — rendre `/certificat` public.** Dans `frontend/lib/supabase/middleware.ts`, ajouter `'/certificat'` aux `PUBLIC_PREFIXES` (la page de vérification doit être accessible sans login pour les recruteurs).

- [ ] **Step 5 : Vérifier** — `npx tsc --noEmit`, `npm run build`. En dev, générer un certificat puis ouvrir `/certificat/<id>` **en navigation privée** (non connecté) → doit s'afficher. Révoquer → 404.

- [ ] **Step 6 : Commit** — `git add "frontend/app/certificat/[id]" "frontend/app/api/academy/certificate/[id]" frontend/lib/supabase/middleware.ts && git commit -m "feat(academy): page publique certificat + OG image + revocation, /certificat public"`

---

### Task 9 : Entrée examen dans le hub Academy

**Files:** Modify `frontend/app/formations/academy/page.tsx`

- [ ] **Step 1 : Ajouter un bouton « Passer l'examen » par cours-niveau.** Dans la carte de chaque cours du hub (là où `p.pct` est calculé), ajouter sous la barre de progression :

```tsx
{c.niveau && (
  p.pct === 100 ? (
    <Link href={`/formations/academy/examen/${c.niveau}`}
      className="mt-3 inline-block rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20">
      Passer l’examen →
    </Link>
  ) : (
    <span className="mt-3 inline-block text-[11px] text-faint">Terminez les leçons pour débloquer l’examen</span>
  )
)}
```

(Le `<Link>` remplace un éventuel besoin d'import ; `Link` est déjà importé dans ce fichier. `c.niveau` fait partie de `HubCourse` — vérifier et l'ajouter au type/mapping si absent.)

- [ ] **Step 2 : Vérifier** — `npx tsc --noEmit`, `npm run build`. Le hub montre le bouton sur un cours 100 %, le texte grisé sinon.

- [ ] **Step 3 : Commit** — `git add frontend/app/formations/academy/page.tsx && git commit -m "feat(academy): entree examen dans le hub (debloque a 100 % des lecons)"`

---

### Task 10 : RGPD — export & delete

**Files:** Modify `frontend/app/api/account/export/route.ts`, `frontend/app/api/account/delete/route.ts`

- [ ] **Step 1 : Export.** Dans le tableau de requêtes `Promise.all([...])` de `export/route.ts`, ajouter :

```ts
    supabase.from('academy_progress').select('*').eq('user_id', user.id),
    supabase.from('academy_notes').select('*').eq('user_id', user.id),
    supabase.from('academy_exam_attempts').select('*').eq('user_id', user.id),
    supabase.from('academy_certificates').select('*').eq('user_id', user.id),
```

et brancher les résultats dans l'objet JSON exporté avec les clés `academy_progress`, `academy_notes`, `academy_exam_attempts`, `academy_certificates` (suivre le motif des entrées existantes — chaque `.select` correspond à une clé de sortie destructurée du `Promise.all`).

- [ ] **Step 2 : Delete.** Dans `delete/route.ts`, ajouter au tableau `tables` :

```ts
    'academy_progress',
    'academy_notes',
    'academy_exam_attempts',
    'academy_certificates',
```

(Les FK `on delete cascade` couvrent déjà la suppression du compte, mais la liste explicite garantit le nettoyage même hors suppression `auth.users`, et documente la couverture.)

- [ ] **Step 3 : Vérifier** — `npx tsc --noEmit`, `npm run build`. Lire la réponse de `GET /api/account/export` en dev (compte de test) : les 4 clés `academy_*` présentes.

- [ ] **Step 4 : Commit** — `git add frontend/app/api/account/export/route.ts frontend/app/api/account/delete/route.ts && git commit -m "feat(rgpd): export+delete couvrent academy (progress, notes, attempts, certificats)"`

---

### Task 11 : Vérifications finales

- [ ] **Step 1 : Frontend** — `cd frontend && npx tsx --test lib/academy/exam.test.mjs && npx tsc --noEmit && npm run build` → tout vert.
- [ ] **Step 2 : RLS** — rejouer les sondes anon de la Task 1 Step 3 (banque illisible, vue sans `user_id`, table certificats non lisible anon). Scan `get_advisors` (type security) → aucun nouvel avis critique sur les 3 tables/la vue.
- [ ] **Step 3 : Bout en bout (dev, compte premium de test)** — finir les leçons d'un niveau → « Passer l'examen » actif → réussir → générer certificat (avec consentement) → ouvrir `/certificat/<id>` déconnecté → révoquer → 404.
- [ ] **Step 4 : Docs** — ajouter à `CLAUDE.md` §8 une ligne « Academy P2 : examens de niveau + certificats (0112, lib/academy/exam, /certificat, RGPD export/delete complété) ». Commit final :

```bash
git add CLAUDE.md docs/superpowers/plans/2026-07-21-academy-examens-certificats.md
git commit -m "docs: academy P2 execute, etat CLAUDE.md"
git push
```

---

## Self-review (fait à la rédaction)

- **Couverture spec** : migration §2 → Task 1 ; assemblage/correction §3.1 → Task 2 ; banque/déblocage §3.1 → Task 3 ; seed §2.1 → Task 4 ; routes §3.2 → Task 5 ; UI examen §3.3 → Task 6 ; génération+consentement §4.1 → Task 7 ; page publique/OG/LinkedIn/révocation §4.2-4.3 → Task 8 ; entrée hub §3.3 → Task 9 ; RGPD §5 → Task 10 ; tests §6 → Tasks 2, 11.
- **Placeholders** : aucun TBD. Deux points « à vérifier au réel » explicitement bornés : colonne nom de `profiles` (Task 7 Step 3) et présence de `c.niveau` dans `HubCourse` (Task 9) — l'action est décrite, le fichier fait foi.
- **Cohérence de types** : `BankQuestion`/`ExamQuestion`/`AssembledExam`/`ExamGrade` (Tasks 2, 3, 5) ; `gradeExam(bank, answers:{id,options,choix}[])` — signature FINALE unifiée entre Task 2 (impl), Task 5 (submit) et Task 6 (le client envoie `{id, options, choix}`). `Niveau`/`isNiveau`/`loadBank`/`niveauLessonsDone` (Tasks 3, 5, 7). `academy_certificates_public(id, niveau, display_name, issued_at)` (Tasks 1, 8).
- **Piège corrigé** : la 1ʳᵉ version de `gradeExam` rejouait le rng — remplacée par la version « le client renvoie l'ordre d'options vu », alignée dans start (renvoie `questions.options` mélangées), submit (reçoit `answers[].options`) et le test.
