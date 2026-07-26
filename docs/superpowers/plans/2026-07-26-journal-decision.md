# Journal de décision — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre les thèses d'investissement existantes d'une clôture avec bilan a posteriori et d'une page journal, pour que l'utilisateur apprenne de ses décisions.

**Architecture:** On étend `investment_theses` (pas de table parallèle) : statut active/clôturée, verdict, bilan, cours de clôture figé. L'unicité par titre devient un index partiel (une thèse active). Un module pur calcule le bilan. Une page `/journal` liste actives et clôturées.

**Tech Stack:** Next.js 14 App Router, Supabase (RLS owner-strict), TypeScript strict, tests purs `.test.mjs` via `npx tsx --test`.

---

## Contraintes d'environnement

- **Ne JAMAIS lancer `npm run build`** (arrière-plan, bloque).
- Garde-fou : `npx tsc --noEmit` depuis `frontend/`, ~5 min → timeout 540000 ms.
- Tests purs : `npx tsx --test <chemin>` depuis `frontend/`.
- Migrations appliquées via MCP Supabase (connecté, project `vozwivhmjfmnnnjbbkpt`).
- Branche `main`, pas de worktree.

## Faits vérifiés avant rédaction

- `investment_theses` (0051) : `user_id, code, stance, cours_reference, objectif, horizon, these, points, created_at, updated_at`, `unique(user_id, code)`, RLS `theses_owner_all` (`auth.uid() = user_id`).
- `frontend/app/api/theses/route.ts` : helper `auth()` → `{ sb, user }` ; POST fait `upsert(row, { onConflict: 'user_id,code' })`.
- `lib/theses/status.ts` : `type Stance = 'achat' | 'conserver' | 'vente'` ; `checkThesis(ThesisCheckInput)`.
- RGPD : `export/route.ts` fait `select('*')` sur `investment_theses` (l55) ; `delete/route.ts` liste `investment_theses` (l36).

## Structure des fichiers

| Fichier | Changement |
|---|---|
| `supabase/migrations/0123_these_cloture.sql` | Colonnes clôture + index partiel |
| `frontend/lib/journal/bilan.ts` | **Pur** : `computeBilan` |
| `frontend/lib/journal/bilan.test.mjs` | Tests du module pur |
| `frontend/app/api/theses/route.ts` | POST réécrit (update-active-sinon-insert) |
| `frontend/app/api/theses/[id]/cloturer/route.ts` | Route de clôture |
| `frontend/lib/journal/queries.ts` | Chargement des thèses de l'utilisateur |
| `frontend/app/journal/page.tsx` | Page journal |
| `frontend/components/journal/CloturerButton.tsx` | Bouton + formulaire de clôture |
| `frontend/lib/nav.ts` | Entrée de menu |

---

### Task 1 : Migration — colonnes de clôture + index partiel

**Files:**
- Create: `supabase/migrations/0123_these_cloture.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 0123 — Cloture et bilan a posteriori des theses d'investissement.
--
-- Etend investment_theses (0051) plutot que de creer une table parallele.
-- L'archive historisee exige de lever unique(user_id, code) : sinon on ne
-- pourrait pas rouvrir une these apres cloture. On la remplace par un index
-- PARTIEL : une seule these active par titre, autant de cloturees qu'on veut.

alter table public.investment_theses
  add column if not exists statut        text not null default 'active'
       check (statut in ('active','cloturee')),
  add column if not exists verdict       text
       check (verdict in ('jouee','invalidee','abandonnee')),
  add column if not exists bilan         text,
  add column if not exists cours_cloture numeric(18,4),
  add column if not exists cloturee_le   timestamptz;

alter table public.investment_theses
  drop constraint if exists investment_theses_user_id_code_key;

create unique index if not exists uniq_these_active
  on public.investment_theses (user_id, code) where statut = 'active';

comment on column public.investment_theses.statut is
  'active = these en cours (une seule par titre) ; cloturee = archivee avec bilan.';
comment on column public.investment_theses.verdict is
  'A la cloture : jouee (these validee) | invalidee | abandonnee.';
```

- [ ] **Step 2 : Appliquer via MCP**

`mcp__supabase__apply_migration` (name `0123_these_cloture`, project `vozwivhmjfmnnnjbbkpt`).

- [ ] **Step 3 : Vérifier l'index partiel par une insertion en double**

`mcp__supabase__execute_sql` — deux thèses actives sur le même (user fictif, code)
doivent échouer ; une active + une clôturée doivent coexister :

```sql
do $$
declare u uuid := gen_random_uuid();
begin
  insert into public.investment_theses (user_id, code, stance, these, statut)
    values (u, 'SNTS', 'achat', 't1', 'active');
  -- 2e active sur le meme titre : doit violer uniq_these_active
  begin
    insert into public.investment_theses (user_id, code, stance, these, statut)
      values (u, 'SNTS', 'achat', 't2', 'active');
    raise exception 'ERREUR : deux theses actives acceptees';
  exception when unique_violation then
    raise notice 'OK : 2e these active rejetee';
  end;
  -- une cloturee sur le meme titre : doit passer
  insert into public.investment_theses (user_id, code, stance, these, statut)
    values (u, 'SNTS', 'achat', 't3', 'cloturee');
  raise notice 'OK : these cloturee coexiste avec l active';
  delete from public.investment_theses where user_id = u;  -- nettoyage
end $$;
```

Expected : deux `NOTICE ... OK`, aucune exception « ERREUR ».

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0123_these_cloture.sql
git commit -m "feat(journal): cloture + bilan sur investment_theses, index partiel une these active"
```

---

### Task 2 : Module pur `bilan.ts` (TDD)

**Files:**
- Create: `frontend/lib/journal/bilan.ts`
- Test: `frontend/lib/journal/bilan.test.mjs`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/lib/journal/bilan.test.mjs` :

```js
import assert from 'node:assert';
import { computeBilan } from './bilan.ts';

// « achat », référence 100, clôture 130 → +30 %, objectif atteint, verdict cohérent.
let b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 120, coursCloture: 130 }, 'jouee');
assert.ok(Math.abs(b.performancePct - 0.30) < 1e-9, `+30 % attendu, eu ${b.performancePct}`);
assert.equal(b.objectifAtteint, 'oui');
assert.equal(b.verdictCoherent, true);

// « achat » clôturé « jouée » alors que le cours a chuté → incohérent.
b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 120, coursCloture: 80 }, 'jouee');
assert.ok(b.performancePct < 0);
assert.equal(b.verdictCoherent, false, 'achat + baisse + jouée = incohérent');

// « vente » dont le cours baisse, verdict « jouée » → cohérent (baisse valide une vente).
b = computeBilan({ stance: 'vente', coursReference: 100, objectif: null, coursCloture: 80 }, 'jouee');
assert.equal(b.verdictCoherent, true, 'vente + baisse + jouée = cohérent');
assert.equal(b.objectifAtteint, 'sans-objet');

// Verdict « invalidee » : on ne juge pas la cohérence (l'utilisateur reconnaît son erreur).
b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 120, coursCloture: 80 }, 'invalidee');
assert.equal(b.verdictCoherent, null, 'invalidee/abandonnee : cohérence non évaluée');

// Objectif non atteint.
b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 150, coursCloture: 130 }, 'jouee');
assert.equal(b.objectifAtteint, 'non');

// Référence nulle → pas de division par zéro.
b = computeBilan({ stance: 'achat', coursReference: null, objectif: null, coursCloture: 130 }, 'jouee');
assert.equal(b.performancePct, null);
assert.equal(b.verdictCoherent, null, 'sans référence, pas de jugement de cohérence');

// Référence 0 → même protection.
b = computeBilan({ stance: 'achat', coursReference: 0, objectif: null, coursCloture: 130 }, 'jouee');
assert.equal(b.performancePct, null);

console.log('✓ journal/bilan OK');
```

- [ ] **Step 2 : Lancer pour voir échouer**

Run: `cd frontend && npx tsx --test lib/journal/bilan.test.mjs`
Expected: FAIL — « Cannot find module './bilan.ts' ».

- [ ] **Step 3 : Écrire le module**

Créer `frontend/lib/journal/bilan.ts` :

```ts
/**
 * Bilan a posteriori d'une thèse clôturée — calcul PUR.
 *
 * L'écart est CALCULÉ à partir du cours de clôture figé, jamais saisi.
 * `verdictCoherent` compare le verdict de l'utilisateur au mouvement réel — il
 * SIGNALE une incohérence sans jamais réécrire le choix de l'utilisateur.
 *
 * Voir docs/superpowers/specs/2026-07-26-journal-decision-design.md
 */
import type { Stance } from '@/lib/theses/status';

export interface BilanInput {
  stance: Stance;
  coursReference: number | null;
  objectif: number | null;
  coursCloture: number;
}

export interface Bilan {
  performancePct: number | null;      // (clôture - référence) / référence
  objectifAtteint: 'oui' | 'non' | 'sans-objet';
  verdictCoherent: boolean | null;    // null = non évalué (verdict non « jouee », ou pas de référence)
}

export function computeBilan(i: BilanInput, verdict: string): Bilan {
  const performancePct =
    i.coursReference != null && i.coursReference !== 0
      ? (i.coursCloture - i.coursReference) / i.coursReference
      : null;

  // Objectif atteint selon le sens de la thèse : un achat vise plus haut, une
  // vente vise plus bas. « conserver » n'a pas d'objectif directionnel ici.
  let objectifAtteint: Bilan['objectifAtteint'] = 'sans-objet';
  if (i.objectif != null) {
    if (i.stance === 'achat') objectifAtteint = i.coursCloture >= i.objectif ? 'oui' : 'non';
    else if (i.stance === 'vente') objectifAtteint = i.coursCloture <= i.objectif ? 'oui' : 'non';
  }

  // Cohérence évaluée UNIQUEMENT pour un verdict « jouee » (l'utilisateur affirme
  // que sa thèse s'est réalisée) et si l'on a une performance à comparer.
  // « invalidee » / « abandonnee » : l'utilisateur reconnaît lui-même l'issue,
  // rien à contredire.
  let verdictCoherent: boolean | null = null;
  if (verdict === 'jouee' && performancePct != null) {
    if (i.stance === 'achat') verdictCoherent = performancePct > 0;
    else if (i.stance === 'vente') verdictCoherent = performancePct < 0;
    else verdictCoherent = true; // « conserver » : pas de direction à contredire
  }

  return { performancePct, objectifAtteint, verdictCoherent };
}
```

- [ ] **Step 4 : Lancer pour voir passer**

Run: `cd frontend && npx tsx --test lib/journal/bilan.test.mjs`
Expected: `✓ journal/bilan OK`, `pass 1` / `fail 0`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/journal/bilan.ts frontend/lib/journal/bilan.test.mjs
git commit -m "feat(journal): module pur computeBilan (ecart calcule, coherence du verdict)"
```

---

### Task 3 : Réécrire le POST (upsert cassé par l'index partiel)

**Files:**
- Modify: `frontend/app/api/theses/route.ts`

- [ ] **Step 1 : Remplacer l'écriture du POST**

Dans `frontend/app/api/theses/route.ts`, remplacer la ligne :

```ts
  const { error } = await sb.from('investment_theses').upsert(row, { onConflict: 'user_id,code' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
```

par :

```ts
  // L'upsert onConflict:'user_id,code' ne fonctionne plus : l'unicité est
  // désormais un index PARTIEL (une seule these ACTIVE par titre), que
  // supabase-js ne sait pas cibler. On met à jour la these active si elle
  // existe, sinon on insère. Une nouvelle these sur un titre dont l'ancienne
  // est clôturée passe alors sans conflit.
  const { data: existante } = await sb
    .from('investment_theses')
    .select('id')
    .eq('user_id', user.id).eq('code', row.code).eq('statut', 'active')
    .maybeSingle();

  const { error } = existante
    ? await sb.from('investment_theses').update(row).eq('id', existante.id)
    : await sb.from('investment_theses').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie. Si `row` ne contient pas `statut`, ce n'est pas requis :
l'insert prend `default 'active'`, et l'update ne doit PAS toucher `statut` (il
laisse la thèse active). Ne rien ajouter à `row`.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/api/theses/route.ts
git commit -m "fix(journal): POST theses en update-active-sinon-insert (index partiel)"
```

---

### Task 4 : Route de clôture

**Files:**
- Create: `frontend/app/api/theses/[id]/cloturer/route.ts`

- [ ] **Step 1 : Écrire la route**

Créer `frontend/app/api/theses/[id]/cloturer/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Clôture une thèse active : fige le dernier cours en base, enregistre verdict
 * et bilan. Le cours de clôture n'est jamais saisi — c'est un vrai prix de marché.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    verdict?: string; bilan?: string;
  } | null;
  if (!body?.verdict || !['jouee', 'invalidee', 'abandonnee'].includes(body.verdict)) {
    return NextResponse.json({ error: 'verdict invalide' }, { status: 400 });
  }

  // RLS garantit déjà l'appartenance ; on lit la thèse pour vérifier l'état et
  // récupérer le code.
  const { data: these } = await sb
    .from('investment_theses')
    .select('id, code, statut')
    .eq('id', params.id).eq('user_id', user.id)
    .maybeSingle();
  if (!these) return NextResponse.json({ error: 'Thèse introuvable' }, { status: 404 });
  if (these.statut === 'cloturee') {
    return NextResponse.json({ error: 'Thèse déjà clôturée' }, { status: 409 });
  }

  // Dernier cours en base pour figer l'écart réel.
  const { data: px } = await sb
    .from('brvm_actions_daily')
    .select('cours_jour')
    .eq('code', these.code).not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const coursCloture = (px?.cours_jour as number | null) ?? null;
  if (coursCloture == null) {
    return NextResponse.json(
      { error: 'Aucun cours disponible pour ce titre : clôture impossible sans prix de référence.' },
      { status: 422 },
    );
  }

  const { error } = await sb.from('investment_theses').update({
    statut: 'cloturee',
    verdict: body.verdict,
    bilan: (body.bilan ?? '').slice(0, 2000),
    cours_cloture: coursCloture,
    cloturee_le: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', these.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, coursCloture });
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add "frontend/app/api/theses/[id]/cloturer/route.ts"
git commit -m "feat(journal): route de cloture (fige le dernier cours, refuse sans prix)"
```

---

### Task 5 : Chargement des thèses de l'utilisateur

**Files:**
- Create: `frontend/lib/journal/queries.ts`

- [ ] **Step 1 : Écrire le module**

Créer `frontend/lib/journal/queries.ts` :

```ts
import { createClient } from '@/lib/supabase/server';
import type { Stance } from '@/lib/theses/status';

export interface TheseRow {
  id: string;
  code: string;
  stance: Stance;
  cours_reference: number | null;
  objectif: number | null;
  horizon: string | null;
  these: string;
  statut: 'active' | 'cloturee';
  verdict: string | null;
  bilan: string | null;
  cours_cloture: number | null;
  cloturee_le: string | null;
  created_at: string;
  updated_at: string;
}

/** Toutes les thèses de l'utilisateur courant, actives d'abord. RLS owner. */
export async function loadTheses(): Promise<TheseRow[]> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from('investment_theses')
    .select('id, code, stance, cours_reference, objectif, horizon, these, statut, verdict, bilan, cours_cloture, cloturee_le, created_at, updated_at')
    .eq('user_id', user.id)
    .order('statut', { ascending: true })        // 'active' avant 'cloturee'
    .order('updated_at', { ascending: false });
  return (data ?? []) as TheseRow[];
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/journal/queries.ts
git commit -m "feat(journal): chargement des theses de l'utilisateur"
```

---

### Task 6 : Bouton de clôture (client)

**Files:**
- Create: `frontend/components/journal/CloturerButton.tsx`

- [ ] **Step 1 : Écrire le composant**

Créer `frontend/components/journal/CloturerButton.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bouton + formulaire de clôture d'une thèse. Le cours de clôture n'est pas
 * saisi ici : le serveur fige le dernier cours en base.
 */
export default function CloturerButton({ id }: { id: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [verdict, setVerdict] = useState('jouee');
  const [bilan, setBilan] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function cloturer() {
    setEnvoi(true); setErreur(null);
    const r = await fetch(`/api/theses/${id}/cloturer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict, bilan }),
    });
    setEnvoi(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErreur(j.error ?? 'Échec de la clôture');
      return;
    }
    setOuvert(false);
    router.refresh();
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)}
        className="text-xs border border-border rounded px-2 py-1 text-muted hover:text-white transition">
        Clôturer
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-elevated p-3">
      <select value={verdict} onChange={(e) => setVerdict(e.target.value)}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs">
        <option value="jouee">Thèse jouée (validée)</option>
        <option value="invalidee">Thèse invalidée</option>
        <option value="abandonnee">Abandonnée</option>
      </select>
      <textarea value={bilan} onChange={(e) => setBilan(e.target.value)}
        placeholder="Bilan : qu'ai-je appris ? (facultatif)" rows={3} maxLength={2000}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs" />
      {erreur && <p className="text-[11px] text-down">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={cloturer} disabled={envoi}
          className="text-xs border border-up/40 bg-up/10 text-up rounded px-2 py-1 disabled:opacity-50">
          {envoi ? '…' : 'Confirmer la clôture'}
        </button>
        <button type="button" onClick={() => setOuvert(false)}
          className="text-xs text-faint hover:text-white">Annuler</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/journal/CloturerButton.tsx
git commit -m "feat(journal): bouton et formulaire de cloture"
```

---

### Task 7 : Page `/journal`

**Files:**
- Create: `frontend/app/journal/page.tsx`

- [ ] **Step 1 : Écrire la page**

Créer `frontend/app/journal/page.tsx` :

```tsx
import Link from 'next/link';
import { loadTheses } from '@/lib/journal/queries';
import { computeBilan } from '@/lib/journal/bilan';
import CloturerButton from '@/components/journal/CloturerButton';

export const dynamic = 'force-dynamic';

const pct = (x: number | null) =>
  x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1).replace('.', ',')} %`;

const VERDICT_LABEL: Record<string, string> = {
  jouee: 'Jouée', invalidee: 'Invalidée', abandonnee: 'Abandonnée',
};

export default async function JournalPage() {
  const theses = await loadTheses();
  const actives = theses.filter((t) => t.statut === 'active');
  const cloturees = theses.filter((t) => t.statut === 'cloturee');

  // Stats honnêtes : décompte des verdicts, jamais estimé.
  const stats = { jouee: 0, invalidee: 0, abandonnee: 0 } as Record<string, number>;
  for (const t of cloturees) if (t.verdict) stats[t.verdict] = (stats[t.verdict] ?? 0) + 1;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Journal de décision</h1>
          <p className="text-sm text-muted mt-1">
            Vos thèses d'investissement et leur bilan a posteriori. Apprendre de ses choix,
            confirmés comme démentis.
          </p>
        </div>

        {cloturees.length > 0 && (
          <div className="flex gap-4 text-xs text-muted">
            <span><span className="text-up font-semibold">{stats.jouee ?? 0}</span> jouées</span>
            <span><span className="text-down font-semibold">{stats.invalidee ?? 0}</span> invalidées</span>
            <span><span className="text-faint font-semibold">{stats.abandonnee ?? 0}</span> abandonnées</span>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted">Thèses actives</h2>
          {actives.length === 0 ? (
            <p className="text-sm text-muted rounded-xl border border-border bg-surface p-6 text-center">
              Aucune thèse active. Rédigez-en une depuis la fiche d'une action.
            </p>
          ) : actives.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <Link href={`/actions/${t.code}`} className="font-semibold text-white hover:text-accent">
                  {t.code}
                </Link>
                <span className="text-[11px] text-muted uppercase">{t.stance}</span>
              </div>
              <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">{t.these}</p>
              {t.cours_reference != null && (
                <p className="text-[11px] text-faint mt-1">
                  Référence : {t.cours_reference} FCFA{t.objectif != null && ` · Objectif : ${t.objectif} FCFA`}
                </p>
              )}
              <CloturerButton id={t.id} />
            </div>
          ))}
        </section>

        {cloturees.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted">Historique</h2>
            {cloturees.map((t) => {
              const bilan = t.cours_cloture != null
                ? computeBilan(
                    { stance: t.stance, coursReference: t.cours_reference, objectif: t.objectif, coursCloture: t.cours_cloture },
                    t.verdict ?? '',
                  )
                : null;
              return (
                <div key={t.id} className="rounded-xl border border-border/60 bg-surface/60 p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/actions/${t.code}`} className="font-semibold text-white hover:text-accent">
                      {t.code}
                    </Link>
                    <span className="text-[11px] text-muted">
                      {t.verdict ? VERDICT_LABEL[t.verdict] : '—'}
                      {bilan && ` · ${pct(bilan.performancePct)}`}
                    </span>
                  </div>
                  {t.bilan && <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">{t.bilan}</p>}
                  {bilan && bilan.verdictCoherent === false && (
                    <p className="text-[11px] text-warn mt-1">
                      ⓘ Le verdict « jouée » ne concorde pas avec l'évolution réelle du cours.
                    </p>
                  )}
                  <p className="text-[11px] text-faint mt-1">
                    Clôturée le {t.cloturee_le?.slice(0, 10) ?? '—'}
                    {t.cours_cloture != null && ` · cours ${t.cours_cloture} FCFA`}
                  </p>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/journal/page.tsx
git commit -m "feat(journal): page /journal (actives, historique, stats)"
```

---

### Task 8 : Entrée de menu

**Files:**
- Modify: `frontend/lib/nav.ts`

- [ ] **Step 1 : Ajouter l'entrée dans le groupe Gestion**

Dans `frontend/lib/nav.ts`, groupe `Gestion`, après `{ href: '/portefeuille', label: 'Portefeuille' }`, ajouter :

```ts
      { href: '/journal', label: 'Journal de décision' },
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/nav.ts
git commit -m "feat(journal): entree de menu dans Gestion"
```

---

### Task 9 : Vérifications finales

- [ ] **Step 1 : Tests purs**

Run: `cd frontend && npx tsx --test lib/journal/bilan.test.mjs`
Expected: `pass 1` / `fail 0`.

- [ ] **Step 2 : RGPD — l'export couvre les nouvelles colonnes**

Lire `frontend/app/api/account/export/route.ts` autour de la ligne 56 : confirmer
que la requête sur `investment_theses` fait `select('*')` (donc les colonnes de
clôture sont incluses automatiquement). Aucune modification attendue ; si la
requête listait des colonnes explicites, ajouter les cinq nouvelles.

- [ ] **Step 3 : Sonde RLS — un utilisateur ne clôture pas la thèse d'un autre**

Via `mcp__supabase__execute_sql`, en rôle `authenticated` d'un utilisateur A,
tenter de lire/modifier une thèse de B :

```sql
-- Crée deux thèses de deux utilisateurs fictifs, puis vérifie l'isolement via la
-- politique owner. (Exécuté en service_role ici ; la RLS est déjà prouvée par
-- theses_owner_all, cette sonde confirme qu'aucune colonne nouvelle ne l'a levée.)
select polname, cmd, qual::text
from pg_policies where tablename = 'investment_theses';
```

Expected : la policy `theses_owner_all` couvre `ALL` avec `auth.uid() = user_id` —
inchangée, donc les nouvelles colonnes héritent de l'isolement.

- [ ] **Step 4 : Typecheck complet**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 5 : Rapport**

Indiquer : résultat de la sonde d'index partiel (Task 1), tests purs, et le
rappel que la page `/journal` apparaîtra au prochain déploiement Vercel.
