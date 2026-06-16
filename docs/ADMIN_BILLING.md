# Console d'administration, RBAC, abonnements & monitoring

Documentation du sous-système admin/billing/monitoring (Lots 1–4, juin 2026).
Source de vérité DB : `supabase/migrations/0041_admin_billing_rbac.sql`.

## 1. Vue d'ensemble

Deux espaces distincts, tous deux côté **frontend Next.js** (lecture/écriture
Supabase via la clé **service-role**, jamais exposée au client) :

- **Console admin** (`/admin/*`) — réservée aux comptes admin (RBAC).
- **Espace compte** (`/account/*`) — pour tout utilisateur connecté (souscription
  Premium, facturation).

> **Prérequis prod** : la variable `SUPABASE_SERVICE_ROLE_KEY` doit être définie
> dans le projet **frontend** Vercel (les pages admin et billing l'utilisent
> côté serveur uniquement). Sans elle, le code retombe sur la clé anon → bloqué
> par la RLS (les tables admin/billing sont en `service_role` only).

## 2. RBAC

`frontend/lib/server/rbac.ts` :

- `getAdminContext()` — lit `admin_user_roles` → rôles + permissions de l'utilisateur.
- `requireAdmin()` — redirige vers `/dashboard` si non-admin.
- `requirePermission(code)` — redirige vers `/admin` si la permission manque.
- `can(ctx, code)` — `super_admin` bypasse toutes les permissions.

**Permissions** (`PermissionCode`) : `users.read/write/suspend`,
`subscriptions.read/write`, `billing.read/refund`, `scraping.read/retry/configure`,
`content.read/write/publish`, `audit.read`, `settings.read/write`.

**Rôles seedés** : `super_admin` (toutes), + 4 rôles métier. `ebouak@gmail.com`
est bootstrap `super_admin` dans la migration.

Layout : `frontend/app/admin/layout.tsx` filtre `ADMIN_NAV` (`lib/admin-nav.ts`)
par permission et rend `components/admin/AdminShell` (sidebar + breadcrumbs).

## 3. Pages admin (lecture seule sauf paiements)

Couche données isolée dans `frontend/lib/admin/` (un fichier par page), client
service-role read-only, tolérante aux pannes (renvoie vide plutôt que crash).

| Route | Permission | Source |
|---|---|---|
| `/admin` | (admin) | KPIs plateforme |
| `/admin/users` | `users.read` | `profiles` + KPIs premium/onboarding |
| `/admin/subscriptions` | `subscriptions.read` | `subscriptions` + plan + email enrichi |
| `/admin/payments` | `billing.read` | `billing_transactions` + email + actions |
| `/admin/scraping` | `scraping.read` | `scraper_runs`/`scraper_errors` |
| `/admin/audit-logs` | `audit.read` | `admin_audit_logs` |

Enrichissement email : pas de FK `subscriptions`/`billing_transactions` → `profiles`,
donc l'email est résolu par une requête séparée (`.in('id', userIds)`), pas un join.

## 4. Billing (provider-agnostic)

Module `frontend/lib/billing/` :

- `types.ts` — `PaymentProvider`, `CheckoutRequest/Result`, `BillingCycle`.
- `provider.ts` — `getProvider(code = env PAYMENT_PROVIDER ?? 'manual')`.
- `manualProvider.ts` — provider par défaut : enregistre l'intention.
- `activate.ts` — `activateSubscription` / `cancelSubscription` (logique unifiée).
- `checkout.ts` — server action `startCheckout(planCode, cycle)`.
- `dates.ts` — `computeRenewsAt(start, cycle)` (pur).
- `serviceClient.ts` — `getServiceClient()` (service-role, server-only).

### Flux

```
[/account/plan] --startCheckout--> manualProvider.createCheckout
   -> subscriptions(status=pending) + billing_transactions(provider=manual, pending)
   -> instructions affichées (réf = id transaction)
[/admin/payments] --confirmPayment(subId)--> activateSubscription
   -> billing_transactions=paid (paid_at), subscriptions=active (started_at, renews_at),
      profiles.is_premium=true (premium_since)
[/account/billing] <- transactions de l'utilisateur (service-role filtré par user_id)
```

Garde-fous : montants lus depuis `subscription_plans` (jamais codés en dur) ;
idempotence (pas de second abonnement si un `pending`/`active` existe) ;
`activateSubscription` réutilisable par un futur webhook provider live.

### Brancher un provider live (CinetPay / PayDunya)

1. Créer `lib/billing/<provider>.ts` implémentant `PaymentProvider`
   (`createCheckout` initie le paiement et renvoie une URL de redirection).
2. L'ajouter au `REGISTRY` de `provider.ts`.
3. Définir `PAYMENT_PROVIDER=<code>` dans l'env Vercel.
4. Le webhook du provider appelle `activateSubscription(subId)` après paiement
   confirmé (logique d'activation déjà centralisée).

Le webhook legacy `/api/webhooks/payment` (toggle premium par email +
`WEBHOOK_SECRET`) reste en place, indépendant de ce flux.

## 5. Monitoring du scraping

Module `scraper/src/monitoring/` :

- `recordRun.ts` — `buildRunRecord` (pur) + `withMonitoring(client, source, trigger, fn)`
  (wrapper injectable, testé sans réseau).
- `supabaseClient.ts` — adaptateur `MonitoringClient` réel (service-role).

`scraper/src/index.ts` enrobe 6 commandes cron (`intraday`, `daily`, `score`,
`events`, `dividends`, `obligations`) via un helper `monitored(...)` :
- **neutralisé en `--mock`** (aucune écriture),
- **tolérant** : une panne de monitoring ne masque jamais le résultat ni le code
  de sortie du scrape,
- flag `--trigger=cron|manual|backfill` propagé.

Chaque exécution écrit une ligne `scraper_runs` (`running`→`success`/`partial`/
`failed`, durée, lignes, métadonnées) ; les erreurs vont dans `scraper_errors` ;
`scraper_sources.last_success_at` est mis à jour. Visualisé sur `/admin/scraping`.

## 6. Tests

- **Scraper** : `buildRunRecord` + `withMonitoring` testés (vitest, client factice).
  `cd scraper && npm test`.
- **Frontend** : pas de harness de test (vitest = scraper uniquement). Vérification
  par `npx tsc --noEmit` + `npx next build`. Tests d'intégration Playwright = backlog.
