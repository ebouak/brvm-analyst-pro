# Gestion admin : droits, newsletter, emails — Design

**Date :** 2026-06-16
**Statut :** approuvé (brainstorming)

## Objectif

Doter la console admin de trois capacités de gestion absentes aujourd'hui :
1. **Modifications de droits** — attribuer/révoquer les rôles RBAC et basculer le
   statut Premium d'un utilisateur.
2. **Gestion newsletter** — lister, rechercher, exporter, désabonner les abonnés.
3. **Envoi d'emails** — campagne newsletter (abonnés confirmés) + email individuel
   à un utilisateur, via Resend.

## Décisions structurantes (validées)

- Envoi emails : **campagne + individuel** (les deux).
- Droits : **rôles admin RBAC + statut Premium**.

## Contexte existant (réutilisé)

- `recordAudit(ctx, entry)` (`lib/server/audit.ts`) — journalisation `admin_audit_logs`.
- `requirePermission(code)` + `AdminContext` + `can()` (`lib/server/rbac.ts`).
- `getServiceClient()` (`lib/billing/serviceClient.ts`) — service-role server-only.
- Kit UI `@/components/ui/premium` (SectionHeader, PremiumPanel, MetricCard, StatPill, EmptyStatePremium).
- Tables : `admin_roles(id,code,label)`, `admin_user_roles(user_id,role_id)`,
  `profiles(id,email,is_premium,premium_since)`,
  `newsletter_subscribers(id,email,confirmed,confirm_token,source,subscribed_at,confirmed_at)`.
- Resend déjà utilisé dans `app/api/newsletter/subscribe/route.ts`
  (`RESEND_API_KEY` + `ALERTS_EMAIL_FROM`, dégradation gracieuse).
- Nav admin : `lib/admin-nav.ts` (filtré par permission) + `lib/nav.ts` (sidebar).

## ⚠️ Prérequis prod

`RESEND_API_KEY` + `ALERTS_EMAIL_FROM` **absents du projet frontend Vercel** →
les envois échoueront (le service le signale explicitement) jusqu'à leur ajout.
Les Features 1 et 2 fonctionnent sans.

## Architecture

### Infra partagée

- `frontend/lib/server/email.ts` — wrapper Resend, server-only :
  - `EmailResult { ok: boolean; sent: number; error?: string }`
  - `sendEmail({ to, subject, html }): Promise<EmailResult>` — un destinataire.
  - `sendBatch(messages: { to; subject; html }[]): Promise<EmailResult>` — boucle
    par lots (≤ 50), tolérante (compte les envois réussis).
  - Si `RESEND_API_KEY` absente → `{ ok:false, sent:0, error:'RESEND_API_KEY non configurée' }`
    (échec explicite, jamais silencieux côté admin).
- `frontend/lib/email/templates.ts` — gabarits HTML FR sobres :
  - `campaignHtml(bodyHtml, unsubscribeUrl)` — footer désabonnement obligatoire.
  - `individualHtml(bodyHtml)` — email transactionnel simple.

### Feature 1 — Modifications de droits

- Page détail `frontend/app/admin/users/[id]/page.tsx` (Server Component,
  `requirePermission('users.read')`) : profil + rôles + premium + bloc email individuel.
- Composant client `RightsPanel.tsx` : toggles rôles (visibles si `isSuperAdmin`),
  toggle premium, formulaire email individuel.
- Actions `frontend/app/admin/users/[id]/actions.ts` (`'use server'`) :
  - `assignRole(userId, roleCode)` / `revokeRole(userId, roleCode)` — exigent
    `requireAdmin()` + `ctx.isSuperAdmin` (sinon refus) ; écrivent `admin_user_roles`
    (insert `on conflict do nothing` / delete) ; audit `role.assign` / `role.revoke`.
  - `setPremium(userId, value: boolean)` — `requirePermission('users.write')` ;
    met à jour `profiles.is_premium` (+ `premium_since`) ; audit `premium.set`.
  - `sendUserEmail(userId, subject, body)` — `requirePermission('users.write')` ;
    résout l'email du profil, `sendEmail(...)` ; audit `email.individual` (nb=1, ok).
- `frontend/app/admin/users/page.tsx` : ajout d'un lien « Gérer » → `/admin/users/[id]`.

### Feature 2 — Gestion newsletter

- Couche données `frontend/lib/admin/newsletter.ts` :
  - `loadNewsletter(search?): { subscribers: NewsletterRow[]; kpis: { total; confirmed; rate } }`.
  - `NewsletterRow { id; email; confirmed; source; subscribed_at; confirmed_at }`.
- Page `frontend/app/admin/newsletter/page.tsx` (`requirePermission('content.read')`) :
  KPIs + table + recherche (query param) + bouton export CSV + section campagne (F3).
- Export CSV : route `frontend/app/admin/newsletter/export/route.ts`
  (`requirePermission('content.read')`) → CSV des abonnés.
- Désabonner/supprimer : action `unsubscribeSubscriber(id)` (`content.write`),
  passe `confirmed=false` (conserve la ligne pour l'historique) ; audit `newsletter.unsubscribe`.

### Feature 3 — Envoi d'emails

- **Campagne** : action `sendCampaign(subject, body)` (`content.publish`) dans
  `frontend/app/admin/newsletter/actions.ts` :
  - charge les abonnés `confirmed=true` ;
  - construit un message par destinataire via `campaignHtml(body, unsubscribeUrl)`
    où `unsubscribeUrl = <site>/api/newsletter/unsubscribe?token=<confirm_token>` ;
  - `sendBatch(...)` ; audit `newsletter.campaign` (sujet, nb destinataires, nb envoyés).
  - Section UI sur `/admin/newsletter` (composant client `CampaignForm.tsx`).
- **Individuel** : `sendUserEmail` (Feature 1).
- **Désabonnement** : route `frontend/app/api/newsletter/unsubscribe/route.ts`
  (`GET ?token=`) → met `confirmed=false` sur la ligne au `confirm_token` donné ;
  renvoie une page HTML « Vous êtes désabonné ». Pas d'auth (lien public tokenisé).

### Navigation & permissions

- `lib/admin-nav.ts` : entrée `Newsletter` (`/admin/newsletter`, `content.read`).
- `lib/nav.ts` : `/admin/newsletter` dans le groupe Admin.
- Permissions : super_admin (rôles) ; `users.write` (premium, email individuel) ;
  `content.read` (liste, export) ; `content.write` (désabonner) ; `content.publish` (campagne).

## Flux de données

```
[/admin/users] --Gérer--> [/admin/users/[id]]
   assignRole/revokeRole (super_admin) -> admin_user_roles + audit
   setPremium (users.write)            -> profiles.is_premium + audit
   sendUserEmail (users.write)         -> email.ts sendEmail + audit
[/admin/newsletter] (content.read)
   loadNewsletter -> table + KPIs ; export CSV
   unsubscribeSubscriber (content.write) -> confirmed=false + audit
   sendCampaign (content.publish) -> confirmés -> sendBatch (footer unsubscribe) + audit
[lien email] GET /api/newsletter/unsubscribe?token= -> confirmed=false
```

## Gestion d'erreurs

- `RESEND_API_KEY` absente → `EmailResult.ok=false, error` ; l'UI affiche l'échec.
- Rôle/permission insuffisants → `requirePermission` redirige ; les actions super_admin
  vérifient `ctx.isSuperAdmin` et renvoient une erreur si faux.
- Envoi partiel de campagne → `sent < total` remonté et journalisé.
- Token désabonnement inconnu → page « lien invalide » (200, pas d'erreur 500).

## Sécurité & RGPD

- Service-role server-only (actions, email service). Jamais côté client.
- **Campagne = marketing → consentement** : destinataires `confirmed=true` uniquement ;
  **lien de désabonnement obligatoire** dans chaque campagne.
- Email individuel = intérêt légitime/contrat (support).
- Toutes les actions sensibles journalisées (`recordAudit`) : acteur, cible, IP/UA
  (purgés à 12 mois par `rgpd-retention-monthly`).
- Aucun secret ni donnée sensible en log.
- Mini-checklist newsletter : données=email ; finalité=info marketing ;
  base légale=consentement ; conservation=jusqu'au désabonnement ; droits=désabo/export/suppression ; sécurité=RLS service_role.

## Tests

Frontend sans harness (vitest=scraper). Vérification = `npx tsc --noEmit` +
`npx next build` + tests requêtes/insert ciblés contre la prod (lecture +
attribution de rôle sur un compte de test, puis révocation). **Aucun envoi de
masse réel en test** (au plus un email individuel vers une adresse de contrôle si
`RESEND_API_KEY` est configurée).

## Séquencement

F1 (droits) → F2 (newsletter liste) → F3 (envois). Un seul plan, groupes de tâches.

## Hors-scope (YAGNI)

- Éditeur d'email riche (WYSIWYG) — corps en HTML/texte simple.
- Segmentation/A-B des campagnes, statistiques d'ouverture.
- Double opt-in complet (lien de confirmation) — l'inscription reste en l'état ;
  on exploite `confirmed` tel quel et on ajoute le désabonnement.
- Gestion des templates en base.
