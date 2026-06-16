# Module Contenu (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin de modération + édition + création des contenus scrapés (actualités, communiqués, bulletins) avec masquage filtré par RLS.

**Architecture :** Migration ajoutant `hidden`/`created_by` aux 3 tables + RLS publique `using(hidden=false)`. Une config unifiée `CONTENT_KINDS` (kind → table/champs) pilote une couche données, des actions serveur (hide/delete/upsert) gardées par RBAC + audit, et des composants client (table + formulaire) sur une page à onglets `/admin/content`.

**Tech Stack :** Next.js 14 App Router (Server Components + Server Actions), TypeScript, Supabase (service-role), TailwindCSS.

---

## File Structure

- `supabase/migrations/0044_content_moderation.sql` — CRÉÉ : colonnes + RLS.
- `frontend/lib/admin/content.ts` — CRÉÉ : `ContentKind`, `CONTENT_KINDS`, `ContentRow`, `loadContent`.
- `frontend/app/admin/content/actions.ts` — CRÉÉ : `setHidden`, `deleteContent`, `upsertContent`.
- `frontend/app/admin/content/ContentForm.tsx` — CRÉÉ : formulaire créer/éditer (client).
- `frontend/app/admin/content/ContentTable.tsx` — CRÉÉ : table + actions (client).
- `frontend/app/admin/content/page.tsx` — REMPLACE le stub : onglets + KPIs + wire.

**Réutilise :** `requirePermission`/`AdminContext` (`lib/server/rbac.ts`), `recordAudit` (`lib/server/audit.ts`), `getServiceClient` (`lib/billing/serviceClient.ts`), kit `@/components/ui/premium`. `/admin/content` est déjà dans `ADMIN_NAV` (`content.read`) → pas de changement nav.

**Vérification :** frontend sans harness → `npx tsc --noEmit` + `npx next build`. Tâche finale : appliquer la migration + test prod (créer→masquer→vérifier RLS→afficher→supprimer).

---

### Task 1 : Migration — colonnes + RLS

**Files:**
- Create: `supabase/migrations/0044_content_moderation.sql`

- [ ] **Step 1 : Écrire la migration**

`supabase/migrations/0044_content_moderation.sql` :
```sql
-- supabase/migrations/0044_content_moderation.sql
-- Modération du contenu scrapé : flag `hidden` (filtré côté public via RLS) +
-- `created_by` (auteur des entrées créées à la main). 3 tables : news, communiqués, bulletins.

alter table public.brvm_news        add column if not exists hidden boolean not null default false;
alter table public.brvm_news        add column if not exists created_by uuid references auth.users(id);
alter table public.brvm_communiques add column if not exists hidden boolean not null default false;
alter table public.brvm_communiques add column if not exists created_by uuid references auth.users(id);
alter table public.brvm_bulletins   add column if not exists hidden boolean not null default false;
alter table public.brvm_bulletins   add column if not exists created_by uuid references auth.users(id);

-- Filtrage public : on REMPLACE chaque policy SELECT permissive par une policy
-- qui n'expose que les entrées non masquées. (La service-role bypasse la RLS.)
drop policy if exists "actualites publiques" on public.brvm_news;
create policy "actualites publiques" on public.brvm_news for select using (hidden = false);

drop policy if exists "Public read communiques" on public.brvm_communiques;
create policy "Public read communiques" on public.brvm_communiques for select using (hidden = false);

drop policy if exists "Public read bulletins" on public.brvm_bulletins;
create policy "Public read bulletins" on public.brvm_bulletins for select using (hidden = false);
```

- [ ] **Step 2 : Commit**

```bash
git add supabase/migrations/0044_content_moderation.sql
git commit -m "feat(db): modération contenu — hidden + created_by + RLS publique hidden=false (0044)"
```
> NOTE : appliquée en Task 6 (`supabase db push`). Pas d'impact build.

---

### Task 2 : Couche données + config unifiée

**Files:**
- Create: `frontend/lib/admin/content.ts`

- [ ] **Step 1 : Implémenter**

`frontend/lib/admin/content.ts` :
```ts
import { getServiceClient } from '@/lib/billing/serviceClient';

export type ContentKind = 'news' | 'communique' | 'bulletin';

export interface ContentField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea';
  required?: boolean;
}

export interface KindConfig {
  table: string;
  label: string;
  dateCol: string;
  titleCol: string;
  fields: ContentField[];
}

export const CONTENT_KINDS: Record<ContentKind, KindConfig> = {
  news: {
    table: 'brvm_news', label: 'Actualités', dateCol: 'date_publication', titleCol: 'titre',
    fields: [
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'date_publication', label: 'Date', type: 'date', required: true },
      { key: 'resume', label: 'Résumé', type: 'textarea' },
      { key: 'source_url', label: 'Source (URL)', type: 'text' },
      { key: 'secteur', label: 'Secteur', type: 'text' },
    ],
  },
  communique: {
    table: 'brvm_communiques', label: 'Communiqués', dateCol: 'date_publication', titleCol: 'titre',
    fields: [
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'date_publication', label: 'Date', type: 'date', required: true },
      { key: 'emetteur', label: 'Émetteur', type: 'text' },
      { key: 'categorie', label: 'Catégorie', type: 'text' },
      { key: 'source_url', label: 'Source (URL)', type: 'text' },
      { key: 'document_url', label: 'Document (URL)', type: 'text' },
      { key: 'resume', label: 'Résumé', type: 'textarea' },
    ],
  },
  bulletin: {
    table: 'brvm_bulletins', label: 'Bulletins', dateCol: 'date_bulletin', titleCol: 'numero',
    fields: [
      { key: 'numero', label: 'Numéro', type: 'text' },
      { key: 'date_bulletin', label: 'Date', type: 'date', required: true },
      { key: 'source_url', label: 'Source (URL)', type: 'text' },
      { key: 'document_url', label: 'Document (URL)', type: 'text' },
      { key: 'resume', label: 'Résumé', type: 'textarea' },
    ],
  },
};

export interface ContentRow {
  id: string;
  title: string;
  date: string | null;
  hidden: boolean;
  source_url: string | null;
  document_url: string | null;
  /** Valeurs des champs éditables (clé→texte) pour préremplir le formulaire d'édition. */
  values: Record<string, string>;
}

export interface ContentDashboard {
  rows: ContentRow[];
  kpis: { total: number; hidden: number; lastDate: string | null };
}

/** Charge une liste de contenu (service-role, inclut les masqués) + KPIs. */
export async function loadContent(kind: ContentKind, search?: string): Promise<ContentDashboard> {
  const cfg = CONTENT_KINDS[kind];
  const db = getServiceClient();
  let q = db.from(cfg.table).select('*').order(cfg.dateCol, { ascending: false }).limit(200);
  if (search && search.trim()) q = q.ilike(cfg.titleCol, `%${search.trim()}%`);
  const { data } = await q;
  const raw = (data ?? []) as Record<string, unknown>[];
  const rows: ContentRow[] = raw.map((r) => ({
    id: r.id as string,
    title: (r[cfg.titleCol] as string) || '(sans titre)',
    date: (r[cfg.dateCol] as string) ?? null,
    hidden: Boolean(r.hidden),
    source_url: (r.source_url as string) ?? null,
    document_url: (r.document_url as string) ?? null,
    values: Object.fromEntries(cfg.fields.map((f) => [f.key, r[f.key] != null ? String(r[f.key]) : ''])),
  }));
  return {
    rows,
    kpis: { total: rows.length, hidden: rows.filter((r) => r.hidden).length, lastDate: rows[0]?.date ?? null },
  };
}
```

- [ ] **Step 2 : Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` → exit 0.
```bash
git add frontend/lib/admin/content.ts
git commit -m "feat(admin): couche données contenu (CONTENT_KINDS + loadContent)"
```

---

### Task 3 : Actions serveur

**Files:**
- Create: `frontend/app/admin/content/actions.ts`

- [ ] **Step 1 : Implémenter**

`frontend/app/admin/content/actions.ts` :
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { CONTENT_KINDS, type ContentKind } from '@/lib/admin/content';

type R = { ok: boolean; message?: string };

export async function setHidden(kind: ContentKind, id: string, hidden: boolean): Promise<R> {
  const ctx = await requirePermission('content.write');
  const cfg = CONTENT_KINDS[kind];
  if (!cfg) return { ok: false, message: 'Type inconnu.' };
  const { error } = await getServiceClient().from(cfg.table).update({ hidden }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: hidden ? 'content.hide' : 'content.show', resourceType: kind, resourceId: id, severity: 'info' });
  revalidatePath('/admin/content');
  return { ok: true };
}

export async function deleteContent(kind: ContentKind, id: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const cfg = CONTENT_KINDS[kind];
  if (!cfg) return { ok: false, message: 'Type inconnu.' };
  const { error } = await getServiceClient().from(cfg.table).delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'content.delete', resourceType: kind, resourceId: id, severity: 'warning' });
  revalidatePath('/admin/content');
  return { ok: true };
}

/** Édite (id) ou crée (id=null) une entrée. Crée : created_by + dedupe_hash + défauts. */
export async function upsertContent(kind: ContentKind, id: string | null, fields: Record<string, string>): Promise<R> {
  const cfg = CONTENT_KINDS[kind];
  if (!cfg) return { ok: false, message: 'Type inconnu.' };
  for (const f of cfg.fields) {
    if (f.required && !(fields[f.key] ?? '').trim()) return { ok: false, message: `${f.label} requis.` };
  }
  const payload: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    const v = fields[f.key];
    if (v !== undefined) payload[f.key] = v === '' ? null : v;
  }
  const db = getServiceClient();
  if (id) {
    const ctx = await requirePermission('content.write');
    const { error } = await db.from(cfg.table).update(payload).eq('id', id);
    if (error) return { ok: false, message: error.message };
    await recordAudit(ctx, { action: 'content.update', resourceType: kind, resourceId: id, severity: 'info' });
  } else {
    const ctx = await requirePermission('content.publish');
    payload.created_by = ctx.userId;
    payload.dedupe_hash = `manual-${crypto.randomUUID()}`;
    if (kind === 'news') payload.source = 'autre';
    if (kind === 'communique' || kind === 'bulletin') payload.source_url = payload.source_url ?? ''; // NOT NULL
    const { error } = await db.from(cfg.table).insert(payload);
    if (error) return { ok: false, message: error.message };
    await recordAudit(ctx, { action: 'content.create', resourceType: kind, severity: 'info' });
  }
  revalidatePath('/admin/content');
  return { ok: true };
}
```

- [ ] **Step 2 : Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` → exit 0.
```bash
git add frontend/app/admin/content/actions.ts
git commit -m "feat(admin): actions contenu (setHidden/deleteContent/upsertContent, journalisées)"
```

---

### Task 4 : Composants client — formulaire + table

**Files:**
- Create: `frontend/app/admin/content/ContentForm.tsx`
- Create: `frontend/app/admin/content/ContentTable.tsx`

- [ ] **Step 1 : Formulaire**

`frontend/app/admin/content/ContentForm.tsx` :
```tsx
'use client';

import { useState, useTransition } from 'react';
import { upsertContent } from './actions';
import { CONTENT_KINDS, type ContentKind, type ContentRow } from '@/lib/admin/content';

export function ContentForm({ kind, row, onClose }: { kind: ContentKind; row?: ContentRow; onClose?: () => void }) {
  const cfg = CONTENT_KINDS[kind];
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cfg.fields.map((f) => [f.key, row?.values[f.key] ?? ''])),
  );
  const [msg, setMsg] = useState<string | null>(null);

  function set(k: string, v: string) { setValues((s) => ({ ...s, [k]: v })); }

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const r = await upsertContent(kind, row?.id ?? null, values);
      if (r.ok) {
        setMsg(null);
        if (onClose) onClose();
      } else {
        setMsg(r.message ?? 'Erreur');
      }
    });
  }

  return (
    <div className="rounded-card border border-border bg-bg p-4 space-y-2">
      <p className="text-xs font-medium text-ivory">{row ? 'Éditer' : 'Créer'} — {cfg.label}</p>
      {msg && <div role="status" className="rounded border border-down/40 bg-down/5 p-2 text-xs text-down">{msg}</div>}
      {cfg.fields.map((f) => (
        <label key={f.key} className="block text-xs text-muted">
          {f.label}{f.required ? ' *' : ''}
          {f.type === 'textarea' ? (
            <textarea
              value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ivory"
            />
          ) : (
            <input
              type={f.type === 'date' ? 'date' : 'text'} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ivory"
            />
          )}
        </label>
      ))}
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={pending} onClick={submit}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-obsidian transition active:scale-95 disabled:opacity-50">
          {pending ? '…' : (row ? 'Enregistrer' : 'Créer')}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted">Annuler</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Table**

`frontend/app/admin/content/ContentTable.tsx` :
```tsx
'use client';

import { useState, useTransition } from 'react';
import { setHidden, deleteContent } from './actions';
import type { ContentKind, ContentRow } from '@/lib/admin/content';
import { ContentForm } from './ContentForm';

const DASH = '—';
function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ContentTable({ kind, rows }: { kind: ContentKind; rows: ContentRow[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="rounded-panel border border-border bg-surface p-6 text-center text-sm text-muted">Aucune entrée.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
            <th className="px-4 py-3 font-medium">Titre</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">État</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
              <td className="px-4 py-2.5 text-ivory">
                {r.title}
                {editing === r.id && (
                  <div className="mt-2 max-w-xl"><ContentForm kind={kind} row={r} onClose={() => setEditing(null)} /></div>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted tabular">{fmtDate(r.date)}</td>
              <td className="px-4 py-2.5">
                {r.hidden ? <span className="text-down">Masqué</span> : <span className="text-up">Public</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap gap-2">
                  <button type="button" disabled={pending}
                    onClick={() => startTransition(async () => { await setHidden(kind, r.id, !r.hidden); })}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted transition active:scale-95 disabled:opacity-50">
                    {r.hidden ? 'Afficher' : 'Masquer'}
                  </button>
                  <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted">Éditer</button>
                  <button type="button" disabled={pending}
                    onClick={() => { if (confirm('Supprimer cette entrée ?')) startTransition(async () => { await deleteContent(kind, r.id); }); }}
                    className="rounded-md border border-down/40 px-2 py-1 text-xs text-down transition active:scale-95 disabled:opacity-50">
                    Supprimer
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` → exit 0. (Le build complet est en Task 5 avec la page qui importe ces composants.)
```bash
git add frontend/app/admin/content/ContentForm.tsx frontend/app/admin/content/ContentTable.tsx
git commit -m "feat(admin): composants contenu (formulaire créer/éditer + table + actions)"
```

---

### Task 5 : Page à onglets + vérif + migration + merge

**Files:**
- Modify: `frontend/app/admin/content/page.tsx` (remplace le stub)

- [ ] **Step 1 : Page**

Écrire `frontend/app/admin/content/page.tsx` :
```tsx
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard } from '@/components/ui/premium';
import { CONTENT_KINDS, loadContent, type ContentKind } from '@/lib/admin/content';
import { ContentTable } from './ContentTable';
import { CreateToggle } from './ContentTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contenu — Administration' };

const KINDS: ContentKind[] = ['news', 'communique', 'bulletin'];
const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isKind(v: string | undefined): v is ContentKind {
  return v === 'news' || v === 'communique' || v === 'bulletin';
}

export default async function Page({ searchParams }: { searchParams: { kind?: string; q?: string } }) {
  await requirePermission('content.read');
  const kind: ContentKind = isKind(searchParams.kind) ? searchParams.kind : 'news';
  const search = searchParams.q ?? '';
  const { rows, kpis } = await loadContent(kind, search);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="Contenu" subtitle="Actualités, communiqués et bulletins — modération, édition, création." />
      <div className="gold-rule" />

      <nav className="flex gap-2">
        {KINDS.map((k) => (
          <Link key={k} href={`/admin/content?kind=${k}`}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${k === kind ? 'bg-accent text-obsidian font-semibold' : 'border border-border text-muted hover:text-ivory'}`}>
            {CONTENT_KINDS[k].label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Entrées" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Masquées" value={nf.format(kpis.hidden)} accent={kpis.hidden > 0 ? 'gold' : 'neutral'} />
        <MetricCard label="Dernière date" value={fmtDate(kpis.lastDate)} accent="neutral" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <form action="/admin/content" method="get" className="flex-1">
          <input type="hidden" name="kind" value={kind} />
          <input name="q" defaultValue={search} placeholder="Rechercher…" className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory" />
        </form>
        <CreateToggle kind={kind} />
      </div>

      <ContentTable kind={kind} rows={rows} />
    </div>
  );
}
```

- [ ] **Step 2 : Ajouter `CreateToggle` dans `ContentTable.tsx`**

Dans `frontend/app/admin/content/ContentTable.tsx`, ajouter ce composant exporté à la fin du fichier :
```tsx
export function CreateToggle({ kind }: { kind: ContentKind }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition active:scale-95">
        {open ? 'Fermer' : '+ Créer'}
      </button>
      {open && <div className="mt-3 max-w-xl"><ContentForm kind={kind} onClose={() => setOpen(false)} /></div>}
    </div>
  );
}
```
(Le fichier importe déjà `useState`, `ContentForm`, et le type `ContentKind` — réutilisés tels quels.)

- [ ] **Step 3 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/admin/content` présente. (Ignorer l'avertissement bénin `/api/paper-trading/stats`.)

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/admin/content/page.tsx frontend/app/admin/content/ContentTable.tsx
git commit -m "feat(admin): page Contenu à onglets (actualités/communiqués/bulletins) + création"
```

- [ ] **Step 5 : Merge sur main + push + appliquer la migration**

```bash
git checkout main
git merge --no-ff feat/admin-contenu -m "merge: module Contenu admin (modération + édition + création) — sous-projet c2"
git push origin main
printf 'y\n' | supabase db push
```
Expected: `db push` applique `0044_content_moderation.sql` (les migrations antérieures sont déjà dans l'historique → seule 0044 tourne).

- [ ] **Step 6 : Vérification ciblée prod (par le contrôleur)**

Confirmer que la migration a pris : les colonnes `hidden`/`created_by` existent et la RLS publique filtre. (Le contrôleur exécute un test REST : créer une entrée news de test via insert service-role, vérifier qu'une lecture anon filtrée `hidden=false` la voit, la passer `hidden=true`, vérifier qu'elle disparaît côté anon, puis la supprimer.)

---

## Self-Review

**1. Spec coverage**
- Migration hidden/created_by + RLS → Task 1. ✅
- Config unifiée + loadContent → Task 2. ✅
- Actions hide/delete/upsert (create+edit) → Task 3. ✅
- UI formulaire + table + page à onglets + création → Tasks 4, 5. ✅
- Permissions (`content.read/write/publish`) + audit → Tasks 3, 5. ✅
- RGPD (RLS masquage, service-role server-only) → Tasks 1, 2, 3. ✅

**2. Placeholder scan** : aucun TODO/TBD ; code complet. « remplacer la policy » = SQL exact fourni avec les noms réels (`actualites publiques`, `Public read communiques`, `Public read bulletins`).

**3. Type consistency** : `ContentKind`, `CONTENT_KINDS`, `ContentRow`, `ContentField`, `KindConfig`, `loadContent` (T2) consommés en T3/T4/T5. `setHidden`/`deleteContent`/`upsertContent` (T3) appelés par `ContentTable`/`ContentForm` (T4). `ContentForm`/`ContentTable`/`CreateToggle` (T4/T5) importés par la page (T5). `crypto.randomUUID()` dispo (runtime Node des Server Actions). Champs `created_by`/`dedupe_hash`/`source`/`source_url` cohérents avec les contraintes des tables (CHECK source news, NOT NULL source_url communiqué/bulletin gérés en T3). ✅

**Risque résiduel** : la RLS dépend du drop des policies SELECT existantes par leur **nom exact** (vérifiés dans 0028/0032). Si une policy permissive résiduelle subsistait sous un autre nom, le masquage serait inopérant — Task 5 step 6 le teste (lecture anon d'une entrée masquée doit être vide).
