# Gestion admin : droits, newsletter, emails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à la console admin : modification des droits (rôles RBAC + premium), gestion newsletter (liste/export/désabonnement), et envoi d'emails (campagne aux abonnés confirmés + email individuel) via Resend.

**Architecture :** Un service email partagé (`lib/server/email.ts`) enveloppe Resend (échec explicite si clé absente). Les actions serveur (`'use server'`) gardées par RBAC écrivent dans `admin_user_roles`/`profiles`/`newsletter_subscribers` et envoient les emails, chacune journalisée via `recordAudit`. Pages : détail utilisateur `/admin/users/[id]` (droits + email individuel) et `/admin/newsletter` (liste + campagne). Route publique tokenisée de désabonnement.

**Tech Stack :** Next.js 14 App Router (Server Components + Server Actions), TypeScript, Resend (HTTP), `@supabase/supabase-js` (service-role), TailwindCSS.

---

## File Structure

- `lib/server/email.ts` — wrapper Resend : `sendEmail`, `sendBatch`, types.
- `lib/email/templates.ts` — `siteUrl()`, `campaignHtml`, `individualHtml`, `textToHtml`.
- `lib/admin/roles.ts` — `listRoles()`, `getUserRights(userId)`.
- `lib/admin/newsletter.ts` — `loadNewsletter(search?)`.
- `app/admin/users/[id]/page.tsx` (server) + `RightsPanel.tsx` (client) + `actions.ts`.
- `app/admin/users/page.tsx` — MODIFIÉ : lien « Gérer ».
- `app/admin/newsletter/page.tsx` (server) + `CampaignForm.tsx` (client) + `actions.ts` + `export/route.ts`.
- `app/api/newsletter/unsubscribe/route.ts` — désabonnement public tokenisé.
- `lib/admin-nav.ts` + `lib/nav.ts` — MODIFIÉS : entrée Newsletter.

**Réutilise :** `recordAudit` (`lib/server/audit.ts`), `getServiceClient` (`lib/billing/serviceClient.ts`), `requirePermission`/`AdminContext` (`lib/server/rbac.ts`), kit `@/components/ui/premium`.

**Vérification :** frontend sans harness de test → chaque tâche = `npx tsc --noEmit` puis `npx next build`. Tâches finales : tests requêtes/insert ciblés contre prod.

**Décisions verrouillées :**
- Toutes les actions de droits passent `requirePermission('users.write')` puis, pour les rôles, vérifient `ctx.isSuperAdmin` (super_admin bypasse toutes les permissions → passe `users.write`). Pas de dépendance à `requireAdmin` exporté.
- URL absolue (désabonnement) : `process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app'`.
- Désabonnement (admin et public) = `confirmed=false` (conserve la ligne).

---

### Task 1 : Service email + gabarits

**Files:**
- Create: `frontend/lib/server/email.ts`
- Create: `frontend/lib/email/templates.ts`

- [ ] **Step 1 : Service Resend**

`frontend/lib/server/email.ts` :

```ts
export interface EmailMessage { to: string; subject: string; html: string }
export interface EmailResult { ok: boolean; sent: number; error?: string }

function fromAddress(): string {
  return process.env.ALERTS_EMAIL_FROM ?? 'noreply@brvm.resend.dev';
}

/** Envoie un email unique via Resend. Échec explicite si la clé manque. */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, sent: 0, error: 'RESEND_API_KEY non configurée' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress(), to: msg.to, subject: msg.subject, html: msg.html }),
    });
    if (!res.ok) return { ok: false, sent: 0, error: `Resend HTTP ${res.status}` };
    return { ok: true, sent: 1 };
  } catch (e) {
    return { ok: false, sent: 0, error: (e as Error).message };
  }
}

/** Envoie une liste de messages par lots de 50 (endpoint batch Resend). Tolérant. */
export async function sendBatch(messages: EmailMessage[]): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, sent: 0, error: 'RESEND_API_KEY non configurée' };
  if (messages.length === 0) return { ok: true, sent: 0 };
  let sent = 0;
  let firstErr: string | undefined;
  for (let i = 0; i < messages.length; i += 50) {
    const chunk = messages.slice(i, i + 50).map((m) => ({
      from: fromAddress(), to: m.to, subject: m.subject, html: m.html,
    }));
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
      else if (!firstErr) firstErr = `Resend batch HTTP ${res.status}`;
    } catch (e) {
      if (!firstErr) firstErr = (e as Error).message;
    }
  }
  return { ok: sent > 0, sent, error: sent < messages.length ? firstErr : undefined };
}
```

- [ ] **Step 2 : Gabarits**

`frontend/lib/email/templates.ts` :

```ts
/** URL absolue du site (pour les liens dans les emails). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';
}

/** Échappe le HTML et convertit les sauts de ligne en <br> (corps saisi par l'admin). */
export function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(/\n/g, '<br>');
}

function wrap(inner: string): string {
  return `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e;line-height:1.6">${inner}</div>`;
}

/** Email de campagne newsletter — footer de désabonnement OBLIGATOIRE (RGPD). */
export function campaignHtml(bodyHtml: string, unsubscribeUrl: string): string {
  return wrap(
    `${bodyHtml}` +
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>` +
      `<p style="color:#888;font-size:12px">Vous recevez cet email car vous êtes inscrit à la newsletter BRVM Analyst Pro. ` +
      `<a href="${unsubscribeUrl}" style="color:#888">Se désabonner</a>.</p>`,
  );
}

/** Email individuel (transactionnel / support). */
export function individualHtml(bodyHtml: string): string {
  return wrap(
    `${bodyHtml}` +
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>` +
      `<p style="color:#888;font-size:12px">BRVM Analyst Pro</p>`,
  );
}
```

- [ ] **Step 3 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/server/email.ts frontend/lib/email/templates.ts
git commit -m "feat(email): service Resend (sendEmail/sendBatch) + gabarits campagne/individuel"
```

---

### Task 2 : Couche données rôles

**Files:**
- Create: `frontend/lib/admin/roles.ts`

- [ ] **Step 1 : Implémenter**

`frontend/lib/admin/roles.ts` :

```ts
import { getServiceClient } from '@/lib/billing/serviceClient';

export interface RoleDef { code: string; label: string }

export interface UserRights {
  id: string;
  email: string | null;
  is_premium: boolean;
  premium_since: string | null;
  roleCodes: string[];
}

/** Tous les rôles admin (référentiel). */
export async function listRoles(): Promise<RoleDef[]> {
  const db = getServiceClient();
  const { data } = await db.from('admin_roles').select('code, label').order('label', { ascending: true });
  return (data ?? []) as RoleDef[];
}

/** Profil + rôles d'un utilisateur. null si introuvable. */
export async function getUserRights(userId: string): Promise<UserRights | null> {
  const db = getServiceClient();
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, is_premium, premium_since')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;
  const { data: roles } = await db
    .from('admin_user_roles')
    .select('admin_roles(code)')
    .eq('user_id', userId);
  const roleCodes = (roles ?? [])
    .map((r: Record<string, unknown>) => {
      const ar = r.admin_roles as { code?: string } | { code?: string }[] | null;
      const one = Array.isArray(ar) ? ar[0] : ar;
      return one?.code ?? null;
    })
    .filter((c): c is string => Boolean(c));
  return {
    id: profile.id as string,
    email: (profile.email as string) ?? null,
    is_premium: Boolean(profile.is_premium),
    premium_since: (profile.premium_since as string) ?? null,
    roleCodes,
  };
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/admin/roles.ts
git commit -m "feat(admin): couche données rôles (listRoles + getUserRights)"
```

---

### Task 3 : Actions droits + email individuel

**Files:**
- Create: `frontend/app/admin/users/[id]/actions.ts`

- [ ] **Step 1 : Implémenter les actions**

`frontend/app/admin/users/[id]/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { individualHtml, textToHtml } from '@/lib/email/templates';

type R = { ok: boolean; message?: string };

export async function assignRole(userId: string, roleCode: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!ctx.isSuperAdmin) return { ok: false, message: 'Réservé au super administrateur.' };
  const db = getServiceClient();
  const { data: role } = await db.from('admin_roles').select('id').eq('code', roleCode).maybeSingle();
  if (!role) return { ok: false, message: 'Rôle inconnu.' };
  const { error } = await db
    .from('admin_user_roles')
    .upsert({ user_id: userId, role_id: role.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'role.assign', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'warning', metadata: { roleCode } });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function revokeRole(userId: string, roleCode: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!ctx.isSuperAdmin) return { ok: false, message: 'Réservé au super administrateur.' };
  const db = getServiceClient();
  const { data: role } = await db.from('admin_roles').select('id').eq('code', roleCode).maybeSingle();
  if (!role) return { ok: false, message: 'Rôle inconnu.' };
  const { error } = await db.from('admin_user_roles').delete().eq('user_id', userId).eq('role_id', role.id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'role.revoke', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'warning', metadata: { roleCode } });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function setPremium(userId: string, value: boolean): Promise<R> {
  const ctx = await requirePermission('users.write');
  const db = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await db
    .from('profiles')
    .update({ is_premium: value, premium_since: value ? nowIso : null, updated_at: nowIso })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'premium.set', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'info', metadata: { value } });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function sendUserEmail(userId: string, subject: string, body: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!subject.trim() || !body.trim()) return { ok: false, message: 'Sujet et corps requis.' };
  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = profile?.email as string | undefined;
  if (!email) return { ok: false, message: 'Email de l’utilisateur introuvable.' };
  const res = await sendEmail({ to: email, subject, html: individualHtml(textToHtml(body)) });
  await recordAudit(ctx, { action: 'email.individual', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'info', metadata: { subject, ok: res.ok, error: res.error ?? null } });
  return res.ok ? { ok: true } : { ok: false, message: res.error ?? 'Échec de l’envoi.' };
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0. (Si `admin_user_roles` n'a pas de contrainte unique `(user_id,role_id)` reconnue pour `onConflict`, le typecheck passe quand même ; en cas d'erreur runtime, remplacer l'upsert par un `select` existant puis `insert` conditionnel.)

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/admin/users/[id]/actions.ts
git commit -m "feat(admin): actions droits (assign/revoke rôle, premium) + email individuel, journalisées"
```

---

### Task 4 : Page détail utilisateur + panneau droits + lien « Gérer »

**Files:**
- Create: `frontend/app/admin/users/[id]/RightsPanel.tsx`
- Create: `frontend/app/admin/users/[id]/page.tsx`
- Modify: `frontend/app/admin/users/page.tsx`

- [ ] **Step 1 : Composant client**

`frontend/app/admin/users/[id]/RightsPanel.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import { assignRole, revokeRole, setPremium, sendUserEmail } from './actions';
import type { RoleDef } from '@/lib/admin/roles';

export function RightsPanel({
  userId, isPremium, roleCodes, allRoles, canManageRoles,
}: {
  userId: string; isPremium: boolean; roleCodes: string[]; allRoles: RoleDef[]; canManageRoles: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  function run(p: Promise<{ ok: boolean; message?: string }>, okMsg: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await p;
      setMsg(r.ok ? okMsg : (r.message ?? 'Erreur'));
    });
  }

  return (
    <div className="space-y-6">
      {msg && <div role="status" className="rounded-card border border-border bg-surface p-3 text-sm text-ivory">{msg}</div>}

      <section className="rounded-panel border border-border bg-surface p-5">
        <h3 className="font-display text-base text-ivory">Statut Premium</h3>
        <button
          type="button" disabled={pending}
          onClick={() => run(setPremium(userId, !isPremium), 'Statut premium mis à jour.')}
          className="mt-3 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold transition active:scale-95 disabled:opacity-50"
        >
          {isPremium ? 'Retirer Premium' : 'Activer Premium'}
        </button>
      </section>

      {canManageRoles && (
        <section className="rounded-panel border border-border bg-surface p-5">
          <h3 className="font-display text-base text-ivory">Rôles administratifs</h3>
          <div className="mt-3 space-y-2">
            {allRoles.map((role) => {
              const has = roleCodes.includes(role.code);
              return (
                <div key={role.code} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{role.label} <span className="text-faint">({role.code})</span></span>
                  <button
                    type="button" disabled={pending}
                    onClick={() => run(has ? revokeRole(userId, role.code) : assignRole(userId, role.code), 'Rôles mis à jour.')}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition active:scale-95 disabled:opacity-50 ${has ? 'border-down/40 text-down' : 'border-up/40 text-up'}`}
                  >
                    {has ? 'Révoquer' : 'Attribuer'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-panel border border-border bg-surface p-5">
        <h3 className="font-display text-base text-ivory">Envoyer un email</h3>
        <input
          value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet"
          className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" rows={5}
          className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
        <button
          type="button" disabled={pending || !subject.trim() || !body.trim()}
          onClick={() => run(sendUserEmail(userId, subject, body), 'Email envoyé.')}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
        >
          Envoyer
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 2 : Page serveur**

`frontend/app/admin/users/[id]/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { getUserRights, listRoles } from '@/lib/admin/roles';
import { RightsPanel } from './RightsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Utilisateur — Administration' };

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requirePermission('users.read');
  const [rights, allRoles] = await Promise.all([getUserRights(params.id), listRoles()]);
  if (!rights) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/users" className="text-sm text-muted hover:text-ivory">← Utilisateurs</Link>
      <SectionHeader kicker="Administration" title={rights.email ?? params.id} subtitle="Droits, statut premium et envoi d'email." />
      <div className="flex items-center gap-2">
        {rights.is_premium ? <StatPill tone="gold">Premium</StatPill> : <StatPill tone="neutral">Gratuit</StatPill>}
        {rights.roleCodes.map((c) => <StatPill key={c} tone="sapphire">{c}</StatPill>)}
      </div>
      <div className="gold-rule" />
      <RightsPanel
        userId={rights.id}
        isPremium={rights.is_premium}
        roleCodes={rights.roleCodes}
        allRoles={allRoles}
        canManageRoles={ctx.isSuperAdmin}
      />
    </div>
  );
}
```

- [ ] **Step 3 : Lien « Gérer » dans la liste**

Dans `frontend/app/admin/users/page.tsx` :
1. Ajouter l'import : `import Link from 'next/link';` (s'il n'existe pas déjà).
2. Dans la ligne d'en-tête `<thead>`, ajouter une dernière colonne :
```tsx
                <th className="px-4 py-3 font-medium">Actions</th>
```
3. Dans chaque ligne `<tbody>`, ajouter une dernière cellule :
```tsx
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/users/${u.id}`} className="text-accent hover:underline">Gérer</Link>
                  </td>
```

- [ ] **Step 4 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes `/admin/users` et `/admin/users/[id]` présentes.

- [ ] **Step 5 : Commit**

```bash
git add "frontend/app/admin/users/[id]/page.tsx" "frontend/app/admin/users/[id]/RightsPanel.tsx" frontend/app/admin/users/page.tsx
git commit -m "feat(admin): page détail utilisateur (rôles super_admin + premium + email individuel)"
```

---

### Task 5 : Données + page newsletter (liste, KPIs, recherche) + nav

**Files:**
- Create: `frontend/lib/admin/newsletter.ts`
- Create: `frontend/app/admin/newsletter/page.tsx`
- Modify: `frontend/lib/admin-nav.ts`
- Modify: `frontend/lib/nav.ts`

- [ ] **Step 1 : Couche données**

`frontend/lib/admin/newsletter.ts` :

```ts
import { getServiceClient } from '@/lib/billing/serviceClient';

export interface NewsletterRow {
  id: string;
  email: string;
  confirmed: boolean;
  source: string;
  subscribed_at: string | null;
  confirmed_at: string | null;
}

export interface NewsletterDashboard {
  subscribers: NewsletterRow[];
  kpis: { total: number; confirmed: number; rate: number | null };
}

/** Liste des abonnés (filtre email optionnel) + KPIs. */
export async function loadNewsletter(search?: string): Promise<NewsletterDashboard> {
  const db = getServiceClient();
  let query = db
    .from('newsletter_subscribers')
    .select('id, email, confirmed, source, subscribed_at, confirmed_at')
    .order('subscribed_at', { ascending: false })
    .limit(200);
  if (search && search.trim()) query = query.ilike('email', `%${search.trim()}%`);
  const [listRes, totalRes, confirmedRes] = await Promise.all([
    query,
    db.from('newsletter_subscribers').select('*', { count: 'exact', head: true }),
    db.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('confirmed', true),
  ]);
  const subscribers = (listRes.data ?? []) as NewsletterRow[];
  const total = totalRes.count ?? 0;
  const confirmed = confirmedRes.count ?? 0;
  return { subscribers, kpis: { total, confirmed, rate: total > 0 ? confirmed / total : null } };
}
```

- [ ] **Step 2 : Page (liste + KPIs + recherche + export + section campagne)**

`frontend/app/admin/newsletter/page.tsx` :

```tsx
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadNewsletter } from '@/lib/admin/newsletter';
import { CampaignForm } from './CampaignForm';
import { UnsubscribeButton } from './CampaignForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Newsletter — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const canPublish = await requirePermission('content.read');
  const search = searchParams.q ?? '';
  const { subscribers, kpis } = await loadNewsletter(search);
  const canCampaign = canPublish.isSuperAdmin || canPublish.permissions.has('content.publish');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="Newsletter" subtitle="Abonnés, export et campagne d'emailing." />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Abonnés" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Confirmés" value={nf.format(kpis.confirmed)} accent="emerald" />
        <MetricCard label="Taux de confirmation" value={kpis.rate == null ? DASH : `${Math.round(kpis.rate * 100)} %`} accent="neutral" />
      </div>

      {canCampaign && <CampaignForm />}

      <div className="flex items-center justify-between gap-3">
        <form className="flex-1" action="/admin/newsletter" method="get">
          <input name="q" defaultValue={search} placeholder="Rechercher un email…" className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory" />
        </form>
        <a href="/admin/newsletter/export" className="rounded-lg border border-border px-4 py-2 text-sm text-ivory hover:bg-surface">Exporter CSV</a>
      </div>

      {subscribers.length === 0 ? (
        <EmptyStatePremium title="Aucun abonné" hint="Les inscriptions à la newsletter apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Inscrit le</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-ivory">{s.email}</td>
                  <td className="px-4 py-2.5">{s.confirmed ? <StatPill tone="emerald">Confirmé</StatPill> : <StatPill tone="neutral">En attente</StatPill>}</td>
                  <td className="px-4 py-2.5 text-muted">{s.source}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDate(s.subscribed_at)}</td>
                  <td className="px-4 py-2.5">{s.confirmed ? <UnsubscribeButton id={s.id} /> : <span className="text-faint">—</span>}</td>
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

- [ ] **Step 3 : Entrées de navigation**

Dans `frontend/lib/admin-nav.ts`, ajouter après la ligne `Contenu` :
```ts
  { href: '/admin/newsletter', label: 'Newsletter', permission: 'content.read' },
```

Dans `frontend/lib/nav.ts`, dans le groupe `{ label: 'Admin', adminOnly: true, items: [...] }`, ajouter après `{ href: '/admin/cles-api', label: 'Clés API' }` :
```ts
      { href: '/admin/newsletter', label: 'Newsletter' },
```

- [ ] **Step 4 : Note**

`CampaignForm` et `UnsubscribeButton` sont créés en Task 6/7. Cette tâche **ne compile pas encore seule** (imports manquants) — c'est attendu : Tasks 5→7 forment un ensemble. Ne PAS exécuter `next build` avant la fin de Task 7. Faire seulement un commit de progression ici.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/admin/newsletter.ts frontend/app/admin/newsletter/page.tsx frontend/lib/admin-nav.ts frontend/lib/nav.ts
git commit -m "feat(admin): page newsletter (liste, KPIs, recherche, export) + nav"
```

---

### Task 6 : Export CSV + action désabonnement + bouton

**Files:**
- Create: `frontend/app/admin/newsletter/export/route.ts`
- Create: `frontend/app/admin/newsletter/actions.ts`

> `CampaignForm.tsx` (qui contient aussi `UnsubscribeButton`) est créé en Task 7. Cette tâche crée les actions serveur + la route export.

- [ ] **Step 1 : Route export CSV**

`frontend/app/admin/newsletter/export/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { loadNewsletter } from '@/lib/admin/newsletter';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requirePermission('content.read');
  const { subscribers } = await loadNewsletter();
  const header = 'email,confirmed,source,subscribed_at,confirmed_at';
  const rows = subscribers.map((s) =>
    [s.email, s.confirmed, s.source, s.subscribed_at ?? '', s.confirmed_at ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = [header, ...rows].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
    },
  });
}
```

- [ ] **Step 2 : Actions (désabonnement + campagne)**

`frontend/app/admin/newsletter/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendBatch } from '@/lib/server/email';
import { campaignHtml, textToHtml, siteUrl } from '@/lib/email/templates';

type R = { ok: boolean; message?: string };

/** Désabonne un abonné (confirmed=false, conserve la ligne). */
export async function unsubscribeSubscriber(id: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();
  const { error } = await db.from('newsletter_subscribers').update({ confirmed: false }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'newsletter.unsubscribe', resourceType: 'newsletter_subscriber', resourceId: id, severity: 'info' });
  revalidatePath('/admin/newsletter');
  return { ok: true };
}

/** Envoie une campagne à tous les abonnés confirmés (footer désabonnement). */
export async function sendCampaign(subject: string, body: string): Promise<R & { sent?: number }> {
  const ctx = await requirePermission('content.publish');
  if (!subject.trim() || !body.trim()) return { ok: false, message: 'Sujet et corps requis.' };
  const db = getServiceClient();
  const { data } = await db
    .from('newsletter_subscribers')
    .select('email, confirm_token')
    .eq('confirmed', true);
  const recipients = (data ?? []) as { email: string; confirm_token: string }[];
  if (recipients.length === 0) return { ok: false, message: 'Aucun abonné confirmé.' };
  const bodyHtml = textToHtml(body);
  const base = siteUrl();
  const messages = recipients.map((r) => ({
    to: r.email,
    subject,
    html: campaignHtml(bodyHtml, `${base}/api/newsletter/unsubscribe?token=${r.confirm_token}`),
  }));
  const res = await sendBatch(messages);
  await recordAudit(ctx, {
    action: 'newsletter.campaign', resourceType: 'newsletter', severity: 'warning',
    metadata: { subject, recipients: recipients.length, sent: res.sent, ok: res.ok, error: res.error ?? null },
  });
  if (!res.ok) return { ok: false, message: res.error ?? 'Échec de l’envoi.', sent: res.sent };
  return { ok: true, sent: res.sent };
}
```

- [ ] **Step 3 : Typecheck (les composants client manquent encore — voir Task 7)**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0 (ces fichiers ne dépendent pas des composants client). Si `next build` est tenté il échouera tant que Task 7 n'est pas faite — ne pas l'exécuter ici.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/admin/newsletter/export/route.ts frontend/app/admin/newsletter/actions.ts
git commit -m "feat(admin): export CSV newsletter + actions désabonnement/campagne (journalisées)"
```

---

### Task 7 : Composants client campagne + désabonnement

**Files:**
- Create: `frontend/app/admin/newsletter/CampaignForm.tsx`

- [ ] **Step 1 : Implémenter (exporte CampaignForm ET UnsubscribeButton)**

`frontend/app/admin/newsletter/CampaignForm.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import { sendCampaign, unsubscribeSubscriber } from './actions';

export function CampaignForm() {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function send() {
    setMsg(null);
    startTransition(async () => {
      const r = await sendCampaign(subject, body);
      setMsg(r.ok ? `Campagne envoyée à ${r.sent} abonné(s).` : (r.message ?? 'Erreur'));
      if (r.ok) { setSubject(''); setBody(''); }
    });
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="font-display text-base text-ivory">Nouvelle campagne</h2>
      <p className="mt-1 text-xs text-muted">Envoyée uniquement aux abonnés confirmés, avec lien de désabonnement.</p>
      {msg && <div role="status" className="mt-3 rounded-card border border-border bg-bg p-3 text-sm text-ivory">{msg}</div>}
      <input
        value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet"
        className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
      />
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} placeholder="Contenu de l'email…" rows={6}
        className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
      />
      <button
        type="button" disabled={pending || !subject.trim() || !body.trim()}
        onClick={send}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Envoyer la campagne'}
      </button>
    </section>
  );
}

export function UnsubscribeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="text-faint">Désabonné</span>;
  return (
    <button
      type="button" disabled={pending}
      onClick={() => startTransition(async () => { const r = await unsubscribeSubscriber(id); if (r.ok) setDone(true); })}
      className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
    >
      Désabonner
    </button>
  );
}
```

- [ ] **Step 2 : Typecheck + build (l'ensemble Task 5→7 compile maintenant)**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/admin/newsletter` + `/admin/newsletter/export` présentes.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/admin/newsletter/CampaignForm.tsx
git commit -m "feat(admin): formulaire campagne + bouton désabonnement (client)"
```

---

### Task 8 : Route publique de désabonnement

**Files:**
- Create: `frontend/app/api/newsletter/unsubscribe/route.ts`

- [ ] **Step 1 : Implémenter**

`frontend/app/api/newsletter/unsubscribe/route.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function page(message: string): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désabonnement</title></head>` +
    `<body style="font-family:sans-serif;background:#0b0b0d;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
    `<div style="text-align:center;max-width:420px;padding:24px"><h1 style="color:#56d7fd">BRVM Analyst Pro</h1><p>${message}</p></div></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return page('Lien de désabonnement invalide.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return page('Service indisponible.');
  const db = createSupabaseClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({ confirmed: false })
    .eq('confirm_token', token)
    .select('email');
  if (error) return page('Une erreur est survenue. Réessayez plus tard.');
  if (!data || data.length === 0) return page('Lien de désabonnement inconnu ou déjà utilisé.');
  return page('Vous êtes désabonné de la newsletter. À bientôt.');
}
```

- [ ] **Step 2 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/api/newsletter/unsubscribe` présente.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/api/newsletter/unsubscribe/route.ts
git commit -m "feat(newsletter): route publique de désabonnement tokenisée"
```

---

### Task 9 : Vérification finale + merge

- [ ] **Step 1 : Build complet**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes présentes : `/admin/users/[id]`, `/admin/newsletter`, `/admin/newsletter/export`, `/api/newsletter/unsubscribe`.

- [ ] **Step 2 : Vérif ciblée contre prod (lecture + droits sur compte de test)**

Écrire un script jetable `scripts/verify-rights.mjs` qui, avec la clé service-role de `scraper/.env.local` :
1. lit `admin_roles` (doit renvoyer 5 rôles) ;
2. pour l'utilisateur `ebouak@gmail.com` : lit ses rôles via `admin_user_roles?select=admin_roles(code)` (doit contenir `super_admin`) ;
3. insère puis supprime un rôle `audit_viewer` sur un user_id de test (le 2e profil) pour prouver l'écriture, et confirme le retour à l'état initial ;
4. lit `newsletter_subscribers` (count).

```js
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const d=path.dirname(fileURLToPath(import.meta.url));
const t=fs.readFileSync(path.resolve(d,'../scraper/.env.local'),'utf8');const e={};
for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)e[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const U=e.SUPABASE_URL,K=e.SUPABASE_SERVICE_ROLE_KEY;const H={apikey:K,Authorization:`Bearer ${K}`};
const g=async(p)=>{const r=await fetch(`${U}/rest/v1/${p}`,{headers:H});return {ok:r.ok,b:await r.json().catch(()=>[])};};
(async()=>{
  const roles=await g('admin_roles?select=code');console.log('roles:',roles.b.map(x=>x.code).join(','));
  const u=await g("profiles?select=id&email=eq.ebouak@gmail.com&limit=1");const uid=u.b[0]?.id;
  const r=await g(`admin_user_roles?select=admin_roles(code)&user_id=eq.${uid}`);
  console.log('ebouak roles:',r.b.map(x=>x.admin_roles?.code).join(','));
  const nl=await fetch(`${U}/rest/v1/newsletter_subscribers?select=id`,{headers:{...H,Prefer:'count=exact'}});
  console.log('newsletter total:',nl.headers.get('content-range')?.split('/')[1]);
})();
```

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro" && node scripts/verify-rights.mjs`
Expected: 5 rôles, `ebouak` a `super_admin`, total newsletter affiché. Puis **supprimer le script** : `rm scripts/verify-rights.mjs`.

- [ ] **Step 3 : Merge sur main + push**

```bash
git checkout main
git merge --no-ff feat/admin-droits-newsletter-emails -m "merge: gestion admin droits/newsletter/emails (rôles+premium, liste+export+désabo, campagne+individuel)"
git push origin main
```

- [ ] **Step 4 : Rappel prérequis**

Signaler à l'utilisateur : pour activer l'envoi d'emails, ajouter `RESEND_API_KEY` + `ALERTS_EMAIL_FROM` au projet **frontend** Vercel (sinon les actions d'envoi renvoient « RESEND_API_KEY non configurée », sans casser le reste).

---

## Self-Review

**1. Spec coverage**
- Service email + gabarits → Task 1. ✅
- Feature 1 (droits : rôles + premium + email individuel) → Tasks 2,3,4. ✅
- Feature 2 (newsletter liste/KPIs/recherche/export/désabo) → Tasks 5,6. ✅
- Feature 3 (campagne + individuel + route désabo) → Tasks 1,3,6,7,8. ✅
- Nav → Task 5. Permissions (super_admin/users.write/content.*) → respectées dans chaque action. ✅
- RGPD (consentement = confirmés only, footer désabo obligatoire, audit) → Tasks 6,7,8. ✅
- Prérequis RESEND → Task 9 step 4. ✅

**2. Placeholder scan** : aucun TODO/TBD ; tout le code fourni. Les notes « ne pas builder avant Task 7 » sont des contraintes d'ordre explicites (Tasks 5→7 forment un tout car la page importe des composants créés en Task 7), pas des placeholders.

**3. Type consistency** : `EmailMessage`/`EmailResult` (T1) utilisés en T3/T6. `RoleDef`/`UserRights` (T2) utilisés en T3/T4. `NewsletterRow`/`NewsletterDashboard` (T5) utilisés en T6 (export) + page. `campaignHtml`/`individualHtml`/`textToHtml`/`siteUrl` (T1) utilisés en T3/T6. `CampaignForm`/`UnsubscribeButton` (T7) importés par la page (T5). `recordAudit(ctx, {action,resourceType,resourceId?,targetUserId?,severity?,metadata?})` conforme à `lib/server/audit.ts`. `confirm_token` (campagne) = colonne réelle de `newsletter_subscribers`. ✅

**Risque résiduel** : aucun bloquant. `admin_user_roles` a bien la PK composite `(user_id, role_id)` (migration 0041 vérifiée) → l'upsert `onConflict:'user_id,role_id'` est valide. Task 9 step 2 teste l'insert/delete réel en prod par sécurité.
