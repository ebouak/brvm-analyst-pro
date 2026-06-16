# Lot 4 — Checkout + Account Billing (provider-agnostic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parcours self-service de souscription Premium tracé dans `subscriptions`/`billing_transactions` via une abstraction `PaymentProvider` (provider `manual` par défaut), pages `/account/plan` + `/account/billing`, et confirmation admin sur `/admin/payments`.

**Architecture :** Une interface `PaymentProvider` isole le fournisseur. Le provider `manual` crée un abonnement `pending` + une transaction `pending` et renvoie des instructions. Une fonction d'activation unifiée (`activateSubscription`) fait passer transaction→`paid`, abonnement→`active` et `profiles.is_premium=true` ; elle est déclenchée par l'admin (et réutilisable par un futur webhook live). Lecture des données billing via client service-role **filtré côté serveur par l'utilisateur** (tables en RLS service_role).

**Tech Stack :** Next.js 14 App Router (Server Components + Server Actions), TypeScript, `@supabase/ssr` (client cookie, RLS) + `@supabase/supabase-js` (service-role), TailwindCSS.

---

## File Structure

**Module billing (`frontend/lib/billing/`) :**
- `types.ts` — `BillingCycle`, `CheckoutRequest`, `CheckoutResult`, `PaymentProvider`.
- `dates.ts` — `computeRenewsAt(start, cycle)` (pure).
- `serviceClient.ts` — `getServiceClient()` (service-role, server-only) — réutilisé partout.
- `manualProvider.ts` — `manualProvider: PaymentProvider`.
- `provider.ts` — `getProvider(code?)` registry.
- `activate.ts` — `activateSubscription(subId)` / `cancelSubscription(subId)`.
- `checkout.ts` — `'use server'` `startCheckout(planCode, cycle)`.

**Pages compte (`frontend/app/account/`) :**
- `plan/page.tsx` (server) + `plan/PlanClient.tsx` (client).
- `billing/page.tsx` (server).

**Admin (`frontend/app/admin/payments/`) :**
- `actions.ts` — `'use server'` `confirmPayment` / `rejectPayment`.
- `PaymentRowActions.tsx` (client) — boutons.
- `page.tsx` — MODIFIÉ : colonne actions sur lignes `pending`.
- `frontend/lib/admin/payments.ts` — MODIFIÉ : exposer `subscription_id`.

**Navigation :**
- `frontend/lib/nav.ts` — MODIFIÉ : groupe « Compte ».

**Vérification :** le frontend n'a pas de harness de test (vitest = scraper). Chaque tâche se vérifie par `npx tsc --noEmit` puis `npx next build`. La seule logique pure (`computeRenewsAt`) est triviale et vérifiée par inspection + tsc.

---

### Task 1 : Types + date d'échéance

**Files:**
- Create: `frontend/lib/billing/types.ts`
- Create: `frontend/lib/billing/dates.ts`

- [ ] **Step 1 : Créer les types**

`frontend/lib/billing/types.ts` :

```ts
export type BillingCycle = 'monthly' | 'yearly';

export interface CheckoutRequest {
  userId: string;
  email: string;
  planCode: string;
  cycle: BillingCycle;
}

export interface CheckoutResult {
  ok: boolean;
  status: 'created' | 'existing' | 'error';
  subscriptionId?: string;
  transactionId?: string;
  reference?: string;
  instructions?: string;
  message?: string;
}

export interface PaymentProvider {
  code: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
}
```

- [ ] **Step 2 : Créer la fonction pure de date**

`frontend/lib/billing/dates.ts` :

```ts
import type { BillingCycle } from './types';

/**
 * Date de prochaine échéance (ISO) : +1 mois (mensuel) ou +1 an (annuel)
 * à partir de `start`. Pure et déterministe.
 */
export function computeRenewsAt(start: Date, cycle: BillingCycle): string {
  const d = new Date(start.getTime());
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}
```

- [ ] **Step 3 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/billing/types.ts frontend/lib/billing/dates.ts
git commit -m "feat(billing): types PaymentProvider + computeRenewsAt"
```

---

### Task 2 : Client service-role partagé + provider manuel + registry

**Files:**
- Create: `frontend/lib/billing/serviceClient.ts`
- Create: `frontend/lib/billing/manualProvider.ts`
- Create: `frontend/lib/billing/provider.ts`

- [ ] **Step 1 : Client service-role partagé**

`frontend/lib/billing/serviceClient.ts` :

```ts
import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase service-role (bypass RLS) — SERVER-ONLY.
 * Ne JAMAIS importer depuis un composant client. Repli sur la clé anon si la
 * service_role est absente (lecture publique limitée), pour ne pas crasher en dev.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2 : Provider manuel**

`frontend/lib/billing/manualProvider.ts` :

```ts
import { getServiceClient } from './serviceClient';
import type { CheckoutRequest, CheckoutResult, PaymentProvider } from './types';

function instructions(ref: string, amount: number, currency: string): string {
  return (
    `Demande Premium enregistrée (réf. ${ref}). ` +
    `Montant : ${amount.toLocaleString('fr-FR')} ${currency}. ` +
    `Finalisez le paiement par Mobile Money ou contactez-nous — un administrateur ` +
    `confirmera votre accès Premium sous 24 h.`
  );
}

/** Provider « manuel » : enregistre l'intention, l'admin confirme ensuite. */
export const manualProvider: PaymentProvider = {
  code: 'manual',
  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const db = getServiceClient();

    const { data: plan, error: planErr } = await db
      .from('subscription_plans')
      .select('id, price_monthly, price_yearly, currency')
      .eq('code', req.planCode)
      .maybeSingle();
    if (planErr || !plan) return { ok: false, status: 'error', message: 'Plan introuvable.' };

    const amount = req.cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    if (amount == null) {
      return { ok: false, status: 'error', message: 'Tarif indisponible pour ce cycle.' };
    }

    // Idempotence : pas de second abonnement si un pending/active existe déjà.
    const { data: existing } = await db
      .from('subscriptions')
      .select('id')
      .eq('user_id', req.userId)
      .in('status', ['pending', 'active'])
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        ok: true,
        status: 'existing',
        subscriptionId: existing[0].id as string,
        message: 'Vous avez déjà un abonnement en cours.',
      };
    }

    const { data: sub, error: subErr } = await db
      .from('subscriptions')
      .insert({ user_id: req.userId, plan_id: plan.id, status: 'pending', billing_cycle: req.cycle })
      .select('id')
      .single();
    if (subErr || !sub) return { ok: false, status: 'error', message: 'Création de l’abonnement impossible.' };

    const { data: txn, error: txnErr } = await db
      .from('billing_transactions')
      .insert({
        subscription_id: sub.id,
        user_id: req.userId,
        provider: 'manual',
        amount,
        currency: plan.currency,
        status: 'pending',
      })
      .select('id')
      .single();
    if (txnErr || !txn) return { ok: false, status: 'error', message: 'Création de la transaction impossible.' };

    const ref = txn.id as string;
    return {
      ok: true,
      status: 'created',
      subscriptionId: sub.id as string,
      transactionId: ref,
      reference: ref,
      instructions: instructions(ref, Number(amount), plan.currency as string),
    };
  },
};
```

- [ ] **Step 3 : Registry**

`frontend/lib/billing/provider.ts` :

```ts
import { manualProvider } from './manualProvider';
import type { PaymentProvider } from './types';

const REGISTRY: Record<string, PaymentProvider> = {
  manual: manualProvider,
};

/** Provider configuré (env `PAYMENT_PROVIDER`, défaut `manual`). Inconnu → manual. */
export function getProvider(code: string = process.env.PAYMENT_PROVIDER ?? 'manual'): PaymentProvider {
  return REGISTRY[code] ?? manualProvider;
}
```

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/billing/serviceClient.ts frontend/lib/billing/manualProvider.ts frontend/lib/billing/provider.ts
git commit -m "feat(billing): provider manuel (intention pending) + registry + client service-role"
```

---

### Task 3 : Activation / annulation unifiée

**Files:**
- Create: `frontend/lib/billing/activate.ts`

- [ ] **Step 1 : Implémenter**

`frontend/lib/billing/activate.ts` :

```ts
import { getServiceClient } from './serviceClient';
import { computeRenewsAt } from './dates';
import type { BillingCycle } from './types';

/**
 * Active un abonnement : transactions pending → paid, abonnement → active
 * (started_at, renews_at), profil → premium. Idempotent. Réutilisable par un
 * futur webhook provider live.
 */
export async function activateSubscription(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  const db = getServiceClient();
  const { data: sub, error } = await db
    .from('subscriptions')
    .select('id, user_id, billing_cycle')
    .eq('id', subscriptionId)
    .maybeSingle();
  if (error || !sub) return { ok: false, message: 'Abonnement introuvable.' };

  const now = new Date();
  const nowIso = now.toISOString();
  const renewsAt = computeRenewsAt(now, (sub.billing_cycle as BillingCycle) ?? 'monthly');

  await db
    .from('billing_transactions')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('subscription_id', subscriptionId)
    .eq('status', 'pending');

  const { error: subErr } = await db
    .from('subscriptions')
    .update({ status: 'active', started_at: nowIso, renews_at: renewsAt, canceled_at: null })
    .eq('id', subscriptionId);
  if (subErr) return { ok: false, message: subErr.message };

  await db
    .from('profiles')
    .update({ is_premium: true, premium_since: nowIso, updated_at: nowIso })
    .eq('id', sub.user_id);

  return { ok: true };
}

/**
 * Rejette/annule un abonnement : transactions pending → failed, abonnement →
 * canceled. Ne révoque pas premium (une intention pending n'était pas premium).
 */
export async function cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  const db = getServiceClient();
  const nowIso = new Date().toISOString();

  await db
    .from('billing_transactions')
    .update({ status: 'failed' })
    .eq('subscription_id', subscriptionId)
    .eq('status', 'pending');

  const { error } = await db
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: nowIso })
    .eq('id', subscriptionId);
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/billing/activate.ts
git commit -m "feat(billing): activateSubscription/cancelSubscription (logique unifiée)"
```

---

### Task 4 : Server action checkout

**Files:**
- Create: `frontend/lib/billing/checkout.ts`

- [ ] **Step 1 : Implémenter l'action**

`frontend/lib/billing/checkout.ts` :

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { getProvider } from './provider';
import type { BillingCycle, CheckoutResult } from './types';

/** Démarre le checkout pour l'utilisateur authentifié via le provider configuré. */
export async function startCheckout(planCode: string, cycle: BillingCycle): Promise<CheckoutResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 'error', message: 'Connectez-vous pour souscrire.' };

  return getProvider().createCheckout({
    userId: user.id,
    email: user.email ?? '',
    planCode,
    cycle,
  });
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/billing/checkout.ts
git commit -m "feat(billing): server action startCheckout"
```

---

### Task 5 : Page `/account/plan` + client

**Files:**
- Create: `frontend/app/account/plan/page.tsx`
- Create: `frontend/app/account/plan/PlanClient.tsx`

- [ ] **Step 1 : Composant client**

`frontend/app/account/plan/PlanClient.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import { startCheckout } from '@/lib/billing/checkout';
import type { BillingCycle, CheckoutResult } from '@/lib/billing/types';

export interface PlanOption {
  code: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  currency: string;
}

const nf = new Intl.NumberFormat('fr-FR');

export function PlanClient({ plans, canSubscribe }: { plans: PlanOption[]; canSubscribe: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckoutResult | null>(null);

  function subscribe(planCode: string, cycle: BillingCycle) {
    setResult(null);
    startTransition(async () => {
      const r = await startCheckout(planCode, cycle);
      setResult(r);
    });
  }

  if (!canSubscribe) {
    return (
      <div className="rounded-panel border border-border bg-surface p-6 text-sm text-muted">
        Vous avez déjà un abonnement en cours. Consultez{' '}
        <a href="/account/billing" className="text-accent hover:underline">votre facturation</a>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result && (
        <div
          role="status"
          className={`rounded-card border p-4 text-sm ${
            result.status === 'error'
              ? 'border-down/40 bg-down/5 text-down'
              : 'border-up/40 bg-up/5 text-ivory'
          }`}
        >
          {result.instructions ?? result.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.code} className="rounded-panel border border-border bg-surface p-5">
            <h3 className="font-display text-lg text-ivory">{p.name}</h3>
            <p className="mt-1 tabular text-2xl font-bold text-ivory">
              {nf.format(p.price_monthly)} <span className="text-sm text-muted">{p.currency}/mois</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => subscribe(p.code, 'monthly')}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
              >
                Mensuel
              </button>
              {p.price_yearly != null && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => subscribe(p.code, 'yearly')}
                  className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition active:scale-95 disabled:opacity-50"
                >
                  Annuel · {nf.format(p.price_yearly)} {p.currency}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Page serveur**

`frontend/app/account/plan/page.tsx` :

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { PlanClient, type PlanOption } from './PlanClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mon abonnement' };

const DASH = '—';

function fmtDate(d: string | null | undefined): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const [{ data: profile }, { data: plansRaw }, { data: sub }] = await Promise.all([
    db.from('profiles').select('is_premium, premium_since').eq('id', user.id).maybeSingle(),
    db
      .from('subscription_plans')
      .select('code, name, price_monthly, price_yearly, currency')
      .eq('is_active', true)
      .neq('code', 'free')
      .order('sort_order', { ascending: true }),
    db
      .from('subscriptions')
      .select('id, status, billing_cycle, renews_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isPremium = Boolean(profile?.is_premium);
  const plans: PlanOption[] = (plansRaw ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    price_monthly: Number(p.price_monthly ?? 0),
    price_yearly: p.price_yearly == null ? null : Number(p.price_yearly),
    currency: (p.currency as string) ?? 'XOF',
  }));

  const subStatus = sub?.status as string | undefined;
  const canSubscribe = !sub; // pas d'abonnement pending/active

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Compte" title="Mon abonnement" subtitle="Votre formule et vos options Premium." />
      <div className="gold-rule" />

      <div className="rounded-panel border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Statut actuel</p>
            <p className="mt-1 font-display text-lg text-ivory">
              {isPremium ? 'Premium' : 'Gratuit'}
            </p>
          </div>
          {isPremium ? (
            <StatPill tone="gold">Actif</StatPill>
          ) : subStatus === 'pending' ? (
            <StatPill tone="sapphire">En attente</StatPill>
          ) : (
            <StatPill tone="neutral">Gratuit</StatPill>
          )}
        </div>
        {isPremium && (
          <p className="mt-3 text-sm text-muted">
            Premium depuis le {fmtDate(profile?.premium_since)}
            {sub?.renews_at ? ` · prochaine échéance le ${fmtDate(sub.renews_at)}` : ''}.
          </p>
        )}
        {subStatus === 'pending' && !isPremium && (
          <p className="mt-3 text-sm text-muted">
            Votre demande Premium est enregistrée et en attente de confirmation du paiement.
          </p>
        )}
      </div>

      <PlanClient plans={plans} canSubscribe={canSubscribe} />
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/account/plan` présente. (Ignorer l'avertissement bénin `/api/paper-trading/stats`.)

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/account/plan/page.tsx frontend/app/account/plan/PlanClient.tsx
git commit -m "feat(account): page Mon abonnement (plan courant + souscription self-service)"
```

---

### Task 6 : Page `/account/billing`

**Files:**
- Create: `frontend/app/account/billing/page.tsx`

- [ ] **Step 1 : Implémenter la page**

`frontend/app/account/billing/page.tsx` :

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Facturation' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS: Record<string, { label: string; tone: 'gold' | 'emerald' | 'sapphire' | 'neutral' }> = {
  paid: { label: 'Payé', tone: 'emerald' },
  pending: { label: 'En attente', tone: 'sapphire' },
  failed: { label: 'Échec', tone: 'gold' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
};

interface TxnRow {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string | null;
}

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Service-role filtré par l'utilisateur authentifié (RLS service_role only).
  const db = getServiceClient();
  const { data } = await db
    .from('billing_transactions')
    .select('id, provider, amount, currency, status, paid_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const txns: TxnRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    provider: r.provider as string,
    amount: Number(r.amount ?? 0),
    currency: (r.currency as string) ?? 'XOF',
    status: r.status as string,
    paid_at: (r.paid_at as string) ?? null,
    created_at: (r.created_at as string) ?? null,
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Compte" title="Facturation" subtitle="Historique de vos transactions." />
      <div className="gold-rule" />

      {txns.length === 0 ? (
        <EmptyStatePremium title="Aucune transaction" hint="Vos paiements apparaîtront ici après votre première souscription." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Référence</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const st = STATUS[t.status] ?? { label: t.status, tone: 'neutral' as const };
                return (
                  <tr key={t.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDate(t.paid_at ?? t.created_at)}</td>
                    <td className="px-4 py-2.5 text-muted">{t.id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">{nf.format(Math.round(t.amount))} {t.currency}</td>
                    <td className="px-4 py-2.5"><StatPill tone={st.tone}>{st.label}</StatPill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/account/billing` présente.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/account/billing/page.tsx
git commit -m "feat(account): page Facturation (historique transactions de l'utilisateur)"
```

---

### Task 7 : Confirmation admin sur `/admin/payments`

**Files:**
- Modify: `frontend/lib/admin/payments.ts` (ajouter `subscription_id`)
- Create: `frontend/app/admin/payments/actions.ts`
- Create: `frontend/app/admin/payments/PaymentRowActions.tsx`
- Modify: `frontend/app/admin/payments/page.tsx` (colonne actions)

- [ ] **Step 1 : Exposer `subscription_id` dans la couche données**

Dans `frontend/lib/admin/payments.ts` :

1. Ajouter `subscription_id: string | null;` à l'interface `PaymentRow` (après `id`).
2. Ajouter `subscription_id` au `.select(...)` de `billing_transactions` (la liste des colonnes).
3. Dans le `.map(...)`, ajouter `subscription_id: (r.subscription_id as string) ?? null,`.

Le `.select` devient exactement :
```ts
    .select('id, subscription_id, user_id, provider, amount, currency, status, payment_method, paid_at, created_at')
```
et l'objet mappé inclut, juste après `id: r.id as string,` :
```ts
    subscription_id: (r.subscription_id as string) ?? null,
```

- [ ] **Step 2 : Server actions admin**

`frontend/app/admin/payments/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { activateSubscription, cancelSubscription } from '@/lib/billing/activate';

export async function confirmPayment(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  await requirePermission('subscriptions.write');
  const r = await activateSubscription(subscriptionId);
  revalidatePath('/admin/payments');
  return r;
}

export async function rejectPayment(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  await requirePermission('subscriptions.write');
  const r = await cancelSubscription(subscriptionId);
  revalidatePath('/admin/payments');
  return r;
}
```

- [ ] **Step 3 : Boutons client**

`frontend/app/admin/payments/PaymentRowActions.tsx` :

```tsx
'use client';

import { useTransition } from 'react';
import { confirmPayment, rejectPayment } from './actions';

export function PaymentRowActions({ subscriptionId }: { subscriptionId: string | null }) {
  const [pending, startTransition] = useTransition();
  if (!subscriptionId) return <span className="text-faint">—</span>;

  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await confirmPayment(subscriptionId); })}
        className="rounded-md border border-up/40 px-2 py-1 text-xs font-medium text-up transition active:scale-95 disabled:opacity-50"
      >
        Confirmer
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await rejectPayment(subscriptionId); })}
        className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
      >
        Rejeter
      </button>
    </span>
  );
}
```

- [ ] **Step 4 : Brancher la colonne actions dans la page**

Dans `frontend/app/admin/payments/page.tsx` :

1. Ajouter l'import en haut : `import { PaymentRowActions } from './PaymentRowActions';`
2. Ajouter un `<th>` en fin de ligne d'en-tête (après la colonne « Date ») :
```tsx
                <th className="px-4 py-3 font-medium">Actions</th>
```
3. Ajouter une cellule en fin de chaque ligne de données (après la cellule date), qui ne montre les boutons que pour les transactions `pending` :
```tsx
                    <td className="px-4 py-2.5">
                      {p.status === 'pending'
                        ? <PaymentRowActions subscriptionId={p.subscription_id} />
                        : <span className="text-faint">—</span>}
                    </td>
```

> Le composant `PaymentRow` expose désormais `subscription_id` (Step 1). Aucune autre modification de la page.

- [ ] **Step 5 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; route `/admin/payments` toujours présente.

- [ ] **Step 6 : Commit**

```bash
git add frontend/lib/admin/payments.ts frontend/app/admin/payments/actions.ts frontend/app/admin/payments/PaymentRowActions.tsx frontend/app/admin/payments/page.tsx
git commit -m "feat(admin): confirmer/rejeter un paiement pending (active l'abonnement + premium)"
```

---

### Task 8 : Navigation « Compte » + vérification finale + merge

**Files:**
- Modify: `frontend/lib/nav.ts`

- [ ] **Step 1 : Ajouter le groupe « Compte »**

Dans `frontend/lib/nav.ts`, insérer ce groupe dans `NAV_GROUPS` **juste avant** le groupe `{ label: 'Admin', adminOnly: true, ... }` :

```ts
  {
    label: 'Compte',
    items: [
      { href: '/account/plan', label: 'Mon abonnement' },
      { href: '/account/billing', label: 'Facturation' },
    ],
  },
```

- [ ] **Step 2 : Typecheck + build complet**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes `/account/plan`, `/account/billing`, `/admin/payments` présentes ; `✓ Compiled successfully`.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/nav.ts
git commit -m "feat(nav): groupe Compte (Mon abonnement + Facturation)"
```

- [ ] **Step 4 : Merge sur main + push**

```bash
git checkout main
git merge --no-ff feat/lot4-checkout-billing -m "merge: Lot 4 — checkout + account billing provider-agnostic (provider manuel + confirmation admin)"
git push origin main
```

---

## Self-Review

**1. Spec coverage**
- Abstraction `PaymentProvider` → Task 1 (types) + Task 2 (manualProvider, registry). ✅
- Souscription = intention + instructions → Task 2 (createCheckout) + Task 4 (action) + Task 5 (UI). ✅
- Activation unifiée (admin confirme) → Task 3 (activate/cancel) + Task 7 (actions admin + boutons). ✅
- `/account/plan` → Task 5 ; `/account/billing` → Task 6. ✅
- Garde-fou idempotent (pas de doublon) → Task 2 step 2 (`existing`). ✅
- Montants depuis `subscription_plans` → Task 2 (createCheckout) + Task 5 (page). ✅
- Service-role filtré par user → Task 6 (`.eq('user_id', user.id)`). ✅
- Webhook inchangé → aucune tâche ne le modifie. ✅
- Nav pour atteindre les pages → Task 8. ✅

**2. Placeholder scan** : aucun TODO/TBD ; tout le code est fourni. Les 3 modifications décrites en prose (Task 7 step 1 et step 4) précisent les lignes exactes et le code à insérer — pas de « ajouter la gestion d'erreur » vague.

**3. Type consistency** : `BillingCycle`, `CheckoutRequest`, `CheckoutResult`, `PaymentProvider` (Task 1) réutilisés à l'identique en Tasks 2/4/5. `computeRenewsAt(start, cycle)` (Task 1) appelé en Task 3. `getServiceClient()` (Task 2) réutilisé en Tasks 3/5/6. `startCheckout(planCode, cycle)` (Task 4) appelé en Task 5 (`PlanClient`). `activateSubscription`/`cancelSubscription` (Task 3) appelés en Task 7. `PaymentRow.subscription_id` (Task 7 step 1) consommé en Task 7 step 4 (`PaymentRowActions`). `PlanOption` défini dans `PlanClient.tsx` et importé par `plan/page.tsx`. ✅

**Risque résiduel** : les pages `/account/*` lisent via service-role filtré côté serveur (jamais exposé au client) — conforme à la décision de la spec (pas de migration RLS user). Si un `next build` signale une colonne inexistante, vérifier le nom exact contre la migration 0041 (toutes les colonnes utilisées y figurent : `subscription_id`, `paid_at`, `renews_at`, `started_at`, `canceled_at`, `premium_since`).
