# Lot 4 — Checkout + Account Billing (provider-agnostic) — Design

**Date :** 2026-06-16
**Statut :** approuvé (brainstorming)

## Objectif

Donner aux utilisateurs un parcours self-service pour souscrire Premium, tracé de
bout en bout dans `subscriptions` / `billing_transactions`, **sans dépendre d'un
fournisseur de paiement live**. Un provider « manuel » (confirmation admin) sert
de défaut ; CinetPay/PayDunya se branchent plus tard via la même abstraction.
Ce Lot alimente enfin les pages admin du Lot 2 (abonnements, paiements).

## Décisions structurantes (validées)

1. **Provider-agnostic + stub manuel** : abstraction `PaymentProvider`, provider
   `manual` par défaut, livrable et testable sans credentials.
2. **Souscription = intention + instructions** : le clic « Passer Premium » crée
   une `subscriptions` (`pending`) + `billing_transactions` (`manual`, `pending`),
   puis affiche les instructions. L'admin confirme → `paid`/`active`/premium.

## Contexte existant

- `/api/webhooks/payment/route.ts` : toggle `profiles.is_premium` par email +
  `WEBHOOK_SECRET`. Ne touche pas `subscriptions`/`billing_transactions`.
  **Reste inchangé** (rétro-compatible).
- Tables (migration 0041) : `subscription_plans(code,name,price_monthly,price_yearly,currency)`,
  `subscriptions(id,user_id,plan_id,status,billing_cycle,started_at,renews_at,canceled_at)`,
  `billing_transactions(id,subscription_id,user_id,provider,amount,currency,status,payment_method,paid_at)`.
  RLS : ces tables sont **service_role uniquement** (pas de lecture client directe).
- `profiles(id,email,is_premium,premium_since)`.
- Permissions RBAC : `subscriptions.read/write`, `billing.read/refund` existent.
- Pages admin Lot 2 (`/admin/subscriptions`, `/admin/payments`) : lecture seule, déjà en place.

## Architecture

### Abstraction paiement
- `lib/billing/types.ts` — interfaces :
  - `BillingCycle = 'monthly' | 'yearly'`
  - `CheckoutRequest { userId: string; email: string; planCode: string; cycle: BillingCycle }`
  - `CheckoutResult { ok: boolean; status: 'created' | 'existing' | 'error'; subscriptionId?: string; transactionId?: string; reference?: string; instructions?: string; message?: string }`
  - `PaymentProvider { code: string; createCheckout(req: CheckoutRequest): Promise<CheckoutResult> }`
- `lib/billing/manualProvider.ts` — `manualProvider: PaymentProvider` (code `'manual'`).
  `createCheckout` :
  1. résout le plan via `subscription_plans` (par `code`) ; calcule `amount` =
     `price_monthly` (mensuel) ou `price_yearly` (annuel). Si `price_yearly` est null
     pour un cycle annuel → erreur explicite (`status:'error'`).
  2. garde-fou idempotent : si l'utilisateur a déjà une `subscriptions` en
     `pending` ou `active` → renvoie `status:'existing'` (pas de doublon).
  3. insère `subscriptions` (`status:'pending'`, `started_at:null`, `renews_at:null`).
  4. insère `billing_transactions` (`provider:'manual'`, `status:'pending'`,
     `amount`, `currency` du plan).
  5. renvoie `status:'created'`, `reference` = id transaction, `instructions`
     (texte mobile money / contact + référence).
- `lib/billing/provider.ts` — `getProvider(code = process.env.PAYMENT_PROVIDER ?? 'manual'): PaymentProvider`.
  Registry : `{ manual: manualProvider }`. Provider inconnu → `manual`.

### Logique d'activation unifiée
- `lib/billing/dates.ts` — fonction pure `computeRenewsAt(start: Date, cycle: BillingCycle): string`
  (+1 mois ou +1 an, ISO). Testable par inspection.
- `lib/billing/activate.ts` (service-role, server-only) :
  - `activateSubscription(subscriptionId: string): Promise<{ ok: boolean; message?: string }>` :
    charge la subscription ; passe la dernière `billing_transactions` liée à `paid`
    (`paid_at=now`) ; subscription → `active` (`started_at=now`,
    `renews_at=computeRenewsAt(now,cycle)`) ; `profiles.is_premium=true`,
    `premium_since=now`. Idempotent (si déjà active, ne casse rien).
  - `cancelSubscription(subscriptionId: string)` : transaction liée → `failed` ;
    subscription → `canceled` (`canceled_at=now`). Ne touche pas premium si une
    autre subscription active existe.
  - Réutilisable par un futur webhook provider live.

### Server action checkout
- `lib/billing/checkout.ts` — `'use server'` action
  `startCheckout(planCode: string, cycle: BillingCycle): Promise<CheckoutResult>` :
  récupère l'utilisateur authentifié (`createClient()` SSR + `auth.getUser()`),
  refuse si non connecté, délègue à `getProvider().createCheckout({...})`.

### Pages /account
- `app/account/plan/page.tsx` (Server Component) : charge l'utilisateur, son profil
  (`is_premium`), son éventuelle subscription courante (`pending`/`active`) et les
  plans actifs. Rend `PlanClient`.
- `app/account/plan/PlanClient.tsx` (`'use client'`) : affiche le plan courant
  (Premium actif / en attente / gratuit) ; boutons « Passer Premium (mensuel) /
  (annuel) » appelant `startCheckout` (transition `useTransition`) ; affiche les
  instructions retournées. Copy factuelle (jamais « gestion automatique »).
- `app/account/billing/page.tsx` (Server Component) : historique des
  `billing_transactions` de l'utilisateur courant — **service-role filtré par
  `user_id`** (jamais exposé au client). Table : date, plan/réf, montant, statut.

### Admin — confirmation paiement
- `lib/admin/billingActions.ts` — `'use server'` actions
  `confirmPayment(subscriptionId)` / `rejectPayment(subscriptionId)` :
  `await requirePermission('subscriptions.write')` puis appellent
  `activateSubscription` / `cancelSubscription` ; `revalidatePath('/admin/payments')`.
- `app/admin/payments/page.tsx` : sur chaque ligne `pending`, rendre un petit
  composant client `PaymentRowActions` (boutons Confirmer / Rejeter) liés aux
  actions. Le reste de la page (Lot 2) inchangé. La couche données
  `lib/admin/payments.ts` expose en plus `subscription_id` pour relier l'action.

## Flux de données (résumé)

```
[Account /plan] --startCheckout--> manualProvider.createCheckout
   -> subscriptions(pending) + billing_transactions(manual,pending)
   -> instructions affichées (réf = txn id)
[Admin /payments] --confirmPayment--> activateSubscription
   -> txn=paid, sub=active(renews_at), profiles.is_premium=true
[Account /billing] <- lecture des txns de l'utilisateur (service-role filtré)
```

## Gestion d'erreurs

- Non connecté sur `startCheckout` → `status:'error'`, message « Connectez-vous ».
- Plan introuvable / `price_yearly` manquant pour cycle annuel → `status:'error'`.
- Abonnement déjà `pending`/`active` → `status:'existing'` (pas de doublon).
- Actions admin sans permission → `requirePermission` redirige (déjà géré).
- Toutes les écritures DB vérifient `error` et renvoient un message, jamais de throw non géré côté action.

## Sécurité

- Clé `service_role` : uniquement dans les modules server (`activate.ts`,
  `manualProvider.ts`, pages serveur, actions). Jamais dans un composant client.
- `/account/billing` filtre par l'`user.id` authentifié → un utilisateur ne voit
  que ses transactions.
- Actions admin gardées par `subscriptions.write`.

## Tests

Le frontend n'a pas de harness de test (vitest = scraper uniquement). Vérification
par tâche = `npx tsc --noEmit` + `npx next build`. La logique sensible est isolée
en fonctions pures simples (`computeRenewsAt`, sélection du montant) vérifiables
par inspection. Pas de tests unitaires frontend (conforme à la convention du repo).

## Hors-scope (YAGNI)

- Intégration provider live (CinetPay/PayDunya) — branchable plus tard via `provider.ts`.
- Webhooks signés provider, réconciliation automatique.
- Proration, upgrade/downgrade en cours de période, remboursements (`billing.refund`
  reste non câblé ici).
- Nouvelle migration RLS (on lit via service-role filtré côté serveur).
