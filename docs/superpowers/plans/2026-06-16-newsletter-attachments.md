# Newsletter & email : pièces jointes + images inline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Joindre des fichiers (PDF/images) à une campagne newsletter et à un email individuel, et intégrer des images dans le corps d'une campagne, via Resend + un bucket Supabase Storage.

**Architecture :** Le service email (`lib/server/email.ts`) gagne un champ `attachments` (base64) transmis à Resend. Les images inline sont uploadées dans un bucket public `newsletter-assets` puis insérées en `<img>` dans le corps. Les actions serveur passent en `FormData` (fichiers) ; un helper pur `validateUploads` borne types/tailles ; `next.config.js` relève la limite de corps des Server Actions à 10 Mo.

**Tech Stack :** Next.js 14.2.15 (Server Actions + FormData), TypeScript, Resend (HTTP), Supabase Storage (service-role), TailwindCSS.

---

## File Structure

- `frontend/lib/server/email.ts` — MODIFIÉ : `EmailAttachment`, `EmailMessage.attachments`, transmission Resend.
- `frontend/lib/email/uploads.ts` — CRÉÉ : `validateUploads` (pur).
- `frontend/lib/server/storage.ts` — CRÉÉ : `uploadInlineImage` (service-role).
- `supabase/migrations/0043_newsletter_assets.sql` — CRÉÉ : bucket `newsletter-assets`.
- `frontend/next.config.js` — MODIFIÉ : `serverActions.bodySizeLimit`.
- `frontend/app/admin/newsletter/actions.ts` — MODIFIÉ : `sendCampaign(formData)`.
- `frontend/app/admin/newsletter/CampaignForm.tsx` — MODIFIÉ : 2 zones d'upload + FormData.
- `frontend/app/admin/users/[id]/actions.ts` — MODIFIÉ : `sendUserEmail(formData)`.
- `frontend/app/admin/users/[id]/RightsPanel.tsx` — MODIFIÉ : upload pièces jointes.

**Réutilise :** `campaignHtml`/`individualHtml`/`textToHtml`/`siteUrl` (`lib/email/templates.ts`), `sendEmail`/`sendBatch` (`lib/server/email.ts`), `getServiceClient`, `recordAudit`, `requirePermission`.

**Vérification :** frontend sans harness de test → `npx tsc --noEmit` + `npx next build`. La logique pure `validateUploads` est vérifiée par inspection. Envoi réel testable seulement après `RESEND_API_KEY`.

**Constante partagée (limites)** utilisée par les actions :
- types pièces jointes : `application/pdf`, `image/png`, `image/jpeg`
- types images inline : `image/png`, `image/jpeg`
- total upload ≤ 8 Mo · ≤ 5 fichiers · image inline ≤ 2 Mo

---

### Task 1 : Service email — pièces jointes

**Files:**
- Modify: `frontend/lib/server/email.ts`

- [ ] **Step 1 : Ajouter le type et le champ**

Dans `frontend/lib/server/email.ts`, remplacer les deux premières lignes :
```ts
export interface EmailMessage { to: string; subject: string; html: string }
export interface EmailResult { ok: boolean; sent: number; error?: string }
```
par :
```ts
export interface EmailAttachment {
  filename: string;
  /** Contenu encodé en base64. */
  content: string;
}
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}
export interface EmailResult { ok: boolean; sent: number; error?: string }
```

- [ ] **Step 2 : Transmettre les pièces jointes dans `sendEmail`**

Dans `sendEmail`, remplacer le `body: JSON.stringify({ from: fromAddress(), to: msg.to, subject: msg.subject, html: msg.html }),` par :
```ts
      body: JSON.stringify({
        from: fromAddress(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        ...(msg.attachments && msg.attachments.length ? { attachments: msg.attachments } : {}),
      }),
```

- [ ] **Step 3 : Transmettre les pièces jointes dans `sendBatch`**

Dans `sendBatch`, remplacer le `.map((m) => ({ from, to: m.to, subject: m.subject, html: m.html, }));` (la construction de `chunk`) par :
```ts
    const chunk = messages.slice(i, i + 50).map((m) => ({
      from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      ...(m.attachments && m.attachments.length ? { attachments: m.attachments } : {}),
    }));
```

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/server/email.ts
git commit -m "feat(email): pièces jointes (EmailAttachment base64) dans sendEmail/sendBatch"
```

---

### Task 2 : Helper pur de validation des uploads

**Files:**
- Create: `frontend/lib/email/uploads.ts`

- [ ] **Step 1 : Implémenter**

`frontend/lib/email/uploads.ts` :
```ts
export interface UploadFileMeta { name: string; type: string; size: number }

export interface UploadLimits {
  maxFiles: number;
  maxTotalBytes: number;
  allowed: string[];
  /** Taille max par fichier (octets), optionnel. */
  maxFileBytes?: number;
}

export interface ValidationResult { ok: boolean; message?: string }

const mb = (n: number) => Math.round(n / (1024 * 1024));

/** Valide une liste de fichiers (types + tailles). Pur, testable. */
export function validateUploads(files: UploadFileMeta[], limits: UploadLimits): ValidationResult {
  if (files.length === 0) return { ok: true };
  if (files.length > limits.maxFiles) {
    return { ok: false, message: `Trop de fichiers (max ${limits.maxFiles}).` };
  }
  let total = 0;
  for (const f of files) {
    if (!limits.allowed.includes(f.type)) {
      return { ok: false, message: `Type non autorisé : ${f.name} (${f.type || 'inconnu'}).` };
    }
    if (limits.maxFileBytes && f.size > limits.maxFileBytes) {
      return { ok: false, message: `${f.name} dépasse ${mb(limits.maxFileBytes)} Mo.` };
    }
    total += f.size;
  }
  if (total > limits.maxTotalBytes) {
    return { ok: false, message: `Taille totale dépasse ${mb(limits.maxTotalBytes)} Mo.` };
  }
  return { ok: true };
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/email/uploads.ts
git commit -m "feat(email): validateUploads (types + tailles, pur)"
```

---

### Task 3 : Bucket Storage + helper d'upload image inline

**Files:**
- Create: `supabase/migrations/0043_newsletter_assets.sql`
- Create: `frontend/lib/server/storage.ts`

- [ ] **Step 1 : Migration bucket**

`supabase/migrations/0043_newsletter_assets.sql` :
```sql
-- supabase/migrations/0043_newsletter_assets.sql
-- Bucket public pour les images intégrées aux campagnes newsletter.
-- Lecture publique (les clients mail chargent les <img>), écriture service-role
-- uniquement (la service_role bypasse la RLS de storage.objects).
insert into storage.buckets (id, name, public)
values ('newsletter-assets', 'newsletter-assets', true)
on conflict (id) do nothing;
```

- [ ] **Step 2 : Helper d'upload**

`frontend/lib/server/storage.ts` :
```ts
import { getServiceClient } from '@/lib/billing/serviceClient';

const BUCKET = 'newsletter-assets';

/**
 * Upload une image dans le bucket public `newsletter-assets` (service-role) et
 * renvoie son URL publique. Lève en cas d'échec. Server-only.
 */
export async function uploadInlineImage(file: File): Promise<string> {
  const db = getServiceClient();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const month = new Date().toISOString().slice(0, 7);
  const path = `campaigns/${month}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'image/png', upsert: false });
  if (error) throw new Error(`upload image inline: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 3 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0043_newsletter_assets.sql frontend/lib/server/storage.ts
git commit -m "feat(storage): bucket newsletter-assets + uploadInlineImage (service-role)"
```

> NOTE : la migration `0043` doit être appliquée en prod (`supabase db push` ou éditeur SQL). Non bloquant pour le build.

---

### Task 4 : Limite de corps des Server Actions

**Files:**
- Modify: `frontend/next.config.js`

- [ ] **Step 1 : Relever la limite**

Dans `frontend/next.config.js`, remplacer le bloc `experimental` :
```js
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'docx'],
  },
```
par :
```js
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'docx'],
    // Permet l'upload de PDF/images via Server Action (défaut 1 Mo trop bas).
    serverActions: { bodySizeLimit: '10mb' },
  },
```

- [ ] **Step 2 : Build (vérifie que la config est valide)**

Run: `cd frontend && npx next build`
Expected: « ✓ Compiled successfully » (aucune erreur de config). Ignorer l'avertissement bénin `/api/paper-trading/stats`.

- [ ] **Step 3 : Commit**

```bash
git add frontend/next.config.js
git commit -m "chore(next): serverActions bodySizeLimit 10mb (upload pièces jointes)"
```

---

### Task 5 : Campagne — `sendCampaign(formData)` + formulaire d'upload

**Files:**
- Modify: `frontend/app/admin/newsletter/actions.ts`
- Modify: `frontend/app/admin/newsletter/CampaignForm.tsx`

- [ ] **Step 1 : Réécrire `sendCampaign` en FormData**

Dans `frontend/app/admin/newsletter/actions.ts`, ajouter les imports en tête (après les imports existants) :
```ts
import { validateUploads } from '@/lib/email/uploads';
import { uploadInlineImage } from '@/lib/server/storage';
```
Puis remplacer **entièrement** la fonction `sendCampaign` existante par :
```ts
const ATTACH_ALLOWED = ['application/pdf', 'image/png', 'image/jpeg'];
const INLINE_ALLOWED = ['image/png', 'image/jpeg'];
const MAX_TOTAL = 8 * 1024 * 1024;
const MAX_INLINE = 2 * 1024 * 1024;
const MAX_FILES = 5;

/** Envoie une campagne (abonnés confirmés) avec pièces jointes + images inline. */
export async function sendCampaign(formData: FormData): Promise<R & { sent?: number }> {
  const ctx = await requirePermission('content.publish');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!subject || !body) return { ok: false, message: 'Sujet et corps requis.' };

  const attachFiles = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  const inlineFiles = formData.getAll('inlineImages').filter((f): f is File => f instanceof File && f.size > 0);

  const meta = (f: File) => ({ name: f.name, type: f.type, size: f.size });
  const vAll = validateUploads([...attachFiles, ...inlineFiles].map(meta), {
    maxFiles: MAX_FILES, maxTotalBytes: MAX_TOTAL, allowed: ATTACH_ALLOWED,
  });
  if (!vAll.ok) return { ok: false, message: vAll.message };
  const vInline = validateUploads(inlineFiles.map(meta), {
    maxFiles: MAX_FILES, maxTotalBytes: MAX_TOTAL, maxFileBytes: MAX_INLINE, allowed: INLINE_ALLOWED,
  });
  if (!vInline.ok) return { ok: false, message: vInline.message };

  const db = getServiceClient();
  const { data } = await db.from('newsletter_subscribers').select('email, confirm_token').eq('confirmed', true);
  const recipients = (data ?? []) as { email: string; confirm_token: string }[];
  if (recipients.length === 0) return { ok: false, message: 'Aucun abonné confirmé.' };

  // Images inline : upload → URLs → ajout au corps.
  let imagesHtml = '';
  for (const img of inlineFiles) {
    const url = await uploadInlineImage(img);
    imagesHtml += `<img src="${url}" alt="" style="max-width:100%;margin-top:16px" />`;
  }
  const bodyHtml = textToHtml(body) + imagesHtml;

  // Pièces jointes : base64.
  const attachments = await Promise.all(
    attachFiles.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })),
  );

  const base = siteUrl();
  const messages = recipients.map((r) => ({
    to: r.email,
    subject,
    html: campaignHtml(bodyHtml, `${base}/api/newsletter/unsubscribe?token=${r.confirm_token}`),
    ...(attachments.length ? { attachments } : {}),
  }));
  const res = await sendBatch(messages);
  await recordAudit(ctx, {
    action: 'newsletter.campaign', resourceType: 'newsletter', severity: 'warning',
    metadata: {
      subject, recipients: recipients.length, sent: res.sent,
      attachments: attachFiles.map((f) => f.name), inlineImages: inlineFiles.length,
      ok: res.ok, error: res.error ?? null,
    },
  });
  if (!res.ok) {
    const partial = res.sent > 0
      ? `Envoi partiel : ${res.sent}/${recipients.length} envoyés. ${res.error ?? ''}`.trim()
      : (res.error ?? "Échec de l'envoi.");
    return { ok: false, message: partial, sent: res.sent };
  }
  return { ok: true, sent: res.sent };
}
```

> Le `unsubscribeSubscriber` existant et les imports `requirePermission`, `recordAudit`, `getServiceClient`, `sendBatch`, `campaignHtml`, `textToHtml`, `siteUrl`, le type `R` restent inchangés.

- [ ] **Step 2 : Réécrire `CampaignForm` avec deux zones d'upload**

Remplacer **entièrement** le composant `CampaignForm` dans `frontend/app/admin/newsletter/CampaignForm.tsx` (garder `UnsubscribeButton` inchangé en dessous) par :
```tsx
export function CampaignForm() {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);

  function send() {
    setMsg(null);
    const fd = new FormData();
    fd.set('subject', subject);
    fd.set('body', body);
    for (const f of Array.from(attachRef.current?.files ?? [])) fd.append('attachments', f);
    for (const f of Array.from(inlineRef.current?.files ?? [])) fd.append('inlineImages', f);
    startTransition(async () => {
      const r = await sendCampaign(fd);
      setMsg(r.ok ? `Campagne envoyée à ${r.sent} abonné(s).` : (r.message ?? 'Erreur'));
      if (r.ok) {
        setSubject(''); setBody('');
        if (attachRef.current) attachRef.current.value = '';
        if (inlineRef.current) inlineRef.current.value = '';
      }
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
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Pièces jointes (PDF, images)
          <input ref={attachRef} type="file" multiple accept="application/pdf,image/png,image/jpeg"
            className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-border file:px-2 file:py-1 file:text-ivory" />
        </label>
        <label className="text-xs text-muted">
          Images intégrées au corps
          <input ref={inlineRef} type="file" multiple accept="image/png,image/jpeg"
            className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-border file:px-2 file:py-1 file:text-ivory" />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-faint">Total ≤ 8 Mo, 5 fichiers max ; image intégrée ≤ 2 Mo.</p>
      <button
        type="button" disabled={pending || !subject.trim() || !body.trim()}
        onClick={send}
        className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Envoyer la campagne'}
      </button>
    </section>
  );
}
```
Et ajouter `useRef` à l'import React en tête du fichier : `import { useState, useTransition, useRef } from 'react';`

- [ ] **Step 3 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/admin/newsletter` présente.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/admin/newsletter/actions.ts frontend/app/admin/newsletter/CampaignForm.tsx
git commit -m "feat(admin): campagne newsletter avec pièces jointes + images inline (upload FormData)"
```

---

### Task 6 : Email individuel — pièces jointes

**Files:**
- Modify: `frontend/app/admin/users/[id]/actions.ts`
- Modify: `frontend/app/admin/users/[id]/RightsPanel.tsx`

- [ ] **Step 1 : Réécrire `sendUserEmail` en FormData**

Dans `frontend/app/admin/users/[id]/actions.ts`, ajouter l'import en tête :
```ts
import { validateUploads } from '@/lib/email/uploads';
```
Puis remplacer **entièrement** la fonction `sendUserEmail` existante par :
```ts
const USER_EMAIL_ALLOWED = ['application/pdf', 'image/png', 'image/jpeg'];
const USER_EMAIL_MAX_TOTAL = 8 * 1024 * 1024;
const USER_EMAIL_MAX_FILES = 5;

export async function sendUserEmail(formData: FormData): Promise<R> {
  const ctx = await requirePermission('users.write');
  const userId = String(formData.get('userId') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!userId) return { ok: false, message: 'Utilisateur manquant.' };
  if (!subject || !body) return { ok: false, message: 'Sujet et corps requis.' };

  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  const v = validateUploads(files.map((f) => ({ name: f.name, type: f.type, size: f.size })), {
    maxFiles: USER_EMAIL_MAX_FILES, maxTotalBytes: USER_EMAIL_MAX_TOTAL, allowed: USER_EMAIL_ALLOWED,
  });
  if (!v.ok) return { ok: false, message: v.message };

  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = profile?.email as string | undefined;
  if (!email) return { ok: false, message: 'Email de l’utilisateur introuvable.' };

  const attachments = await Promise.all(
    files.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()).toString('base64') })),
  );
  const res = await sendEmail({
    to: email, subject, html: individualHtml(textToHtml(body)),
    ...(attachments.length ? { attachments } : {}),
  });
  await recordAudit(ctx, {
    action: 'email.individual', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'info',
    metadata: { subject, attachments: files.map((f) => f.name), ok: res.ok, error: res.error ?? null },
  });
  return res.ok ? { ok: true } : { ok: false, message: res.error ?? 'Échec de l’envoi.' };
}
```

> Les imports existants (`requirePermission`, `recordAudit`, `getServiceClient`, `sendEmail`, `individualHtml`, `textToHtml`, le type `R`) restent. La fonction `changeRole`, `assignRole`, `revokeRole`, `setPremium` ne changent pas.

- [ ] **Step 2 : Ajouter l'upload dans `RightsPanel`**

Dans `frontend/app/admin/users/[id]/RightsPanel.tsx` :
1. Ajouter `useRef` à l'import React : `import { useState, useTransition, useRef } from 'react';`
2. Dans le composant, ajouter une ref après les `useState` : `const attachRef = useRef<HTMLInputElement>(null);`
3. Remplacer **entièrement** la section « Envoyer un email » (le dernier `<section>` du composant) par :
```tsx
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
        <label className="mt-2 block text-xs text-muted">
          Pièces jointes (PDF, images)
          <input ref={attachRef} type="file" multiple accept="application/pdf,image/png,image/jpeg"
            className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-border file:px-2 file:py-1 file:text-ivory" />
        </label>
        <button
          type="button" disabled={pending || !subject.trim() || !body.trim()}
          onClick={() => {
            const fd = new FormData();
            fd.set('userId', userId);
            fd.set('subject', subject);
            fd.set('body', body);
            for (const f of Array.from(attachRef.current?.files ?? [])) fd.append('attachments', f);
            run(sendUserEmail(fd), 'Email envoyé.');
          }}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
        >
          Envoyer
        </button>
      </section>
```

> `run(promise, okMsg)` est l'helper déjà défini dans `RightsPanel`. `sendUserEmail` est déjà importé depuis `./actions` — sa nouvelle signature `(formData)` est compatible avec cet appel.

- [ ] **Step 3 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes `/admin/users/[id]` + `/admin/newsletter` présentes.

- [ ] **Step 4 : Commit**

```bash
git add "frontend/app/admin/users/[id]/actions.ts" "frontend/app/admin/users/[id]/RightsPanel.tsx"
git commit -m "feat(admin): pièces jointes sur l'email individuel (upload FormData)"
```

---

### Task 7 : Vérification finale + merge

- [ ] **Step 1 : Build complet**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; « ✓ Compiled successfully » ; routes `/admin/newsletter`, `/admin/users/[id]` présentes.

- [ ] **Step 2 : Merge sur main + push**

```bash
git checkout main
git merge --no-ff feat/newsletter-attachments -m "merge: newsletter/email pièces jointes + images inline (sous-projet b)"
git push origin main
```

- [ ] **Step 3 : Rappel à l'utilisateur**

Signaler : (1) appliquer la migration `0043_newsletter_assets.sql` en prod (`supabase db push`) ; (2) l'envoi réel nécessite `RESEND_API_KEY` sur le projet frontend Vercel ; (3) anomalie séparée notée : deux `next.config` coexistent (`.js` actif, `.mjs` ignoré) — à consolider hors de ce lot.

---

## Self-Review

**1. Spec coverage**
- Service email attachments → Task 1. ✅
- Bucket + uploadInlineImage → Task 3. ✅
- validateUploads (garde-fous) → Task 2, utilisé en Tasks 5 & 6. ✅
- Campagne (2 zones upload, inline + attachments) → Task 5. ✅
- Email individuel (attachments) → Task 6. ✅
- bodySizeLimit → Task 4. ✅
- RGPD (confirmés + désabo inchangés, flux base64, bucket public) → préservé (Task 5 réutilise `campaignHtml` + `confirmed=true`). ✅

**2. Placeholder scan** : aucun TODO/TBD ; code complet partout. Les « remplacer entièrement la fonction » indiquent une substitution exacte avec le code fourni.

**3. Type consistency** : `EmailAttachment`/`EmailMessage.attachments` (T1) consommés en T5/T6 via `{ filename, content }`. `validateUploads(files, limits)` (T2) appelé en T5/T6 avec `{name,type,size}`. `uploadInlineImage(file)` (T3) appelé en T5. `sendCampaign(formData)` (T5) appelé par `CampaignForm` (T5). `sendUserEmail(formData)` (T6) appelé par `RightsPanel` (T6) avec `userId` dans le FormData. `Buffer` disponible (runtime Node des Server Actions). `crypto.randomUUID()` disponible (Node 20). ✅

**Risque résiduel** : `next.config.js` est supposé la config active (Next résout `.js` avant `.mjs`). Task 4 step 2 (build) valide que la config est acceptée ; si le `bodySizeLimit` n'était pas pris en compte, un upload > 1 Mo échouerait à l'exécution (testable seulement avec un dev server) — l'anomalie des deux configs est signalée pour traitement séparé.
