# Module Organisations (admin) — Design

**Date :** 2026-06-17
**Statut :** approuvé (brainstorming)
**Sous-projet (c1)** du lot « gestion admin » (dernier module : b ✅ → Contenu ✅ → Rapports IA ✅ → Organisations).

## Objectif

Donner à l'admin la **gestion complète des comptes entreprise** : créer/éditer/
supprimer des organisations, gérer leurs membres (ajout/retrait/rôle), rattacher
un abonnement, et **propager le premium aux membres** d'une organisation dont
l'abonnement est actif. Remplace le stub `/admin/organizations`. Pas de
self-service côté client — cohérent avec le billing manuel déjà en place.

## Décisions structurantes (validées)

1. **Périmètre : CRUD admin complet** (orgs + membres + rattachement d'abonnement).
   Pas de self-service client (création d'org / invitations) — hors-scope.
2. **Les membres héritent du premium** : appartenir à une org dont l'abonnement
   est `active` octroie `is_premium=true` ; le retrait le révoque, sauf si le
   membre possède son propre abonnement actif.
3. **Réutilisation des permissions existantes** (aucune migration RBAC) :
   lecture = `users.read` ; écritures org/membres = `users.write` ;
   rattachement d'abonnement = `subscriptions.write`.

## Contexte existant (réutilisé)

- `organizations(id, name, owner_user_id→auth.users, created_at)`.
- `organization_members(organization_id, user_id, role 'owner|admin|member', created_at, pk(org,user))`.
- `subscriptions(id, user_id, organization_id nullable, plan_id, status, billing_cycle, …)`.
- `subscription_plans(id, name, …)` pour afficher le plan.
- `profiles(id, email, is_premium, premium_since)` — résolution email + flag premium.
- Premium aujourd'hui : `profiles.is_premium`, posé par `lib/billing/activate.ts`
  (activation d'abonnement → true) et par le toggle manuel admin
  (`app/admin/users/[id]/actions.ts`). **Aucune révocation automatique** ailleurs.
- `requirePermission`, `recordAudit`, `getServiceClient`, kit `@/components/ui/premium`.
- `/admin/organizations` déjà dans la nav admin (`lib/admin-nav.ts`).
- **Aucune migration** : tables présentes (RLS service-role), l'héritage premium
  n'ajoute pas de colonne.

## Architecture

### 1. Couche données — `lib/admin/organizations.ts` (service-role)

- `OrgRow { id; name; owner_email: string | null; member_count: number; subscription: { plan: string; status: string } | null; created_at: string }`.
- `OrgsDashboard { rows: OrgRow[]; kpis: { total: number; withActiveSub: number; members: number } }`.
- `loadOrganizations(): Promise<OrgsDashboard>` — orgs + email propriétaire (jointure `profiles`), comptage membres (`organization_members`), abonnement rattaché (`subscriptions.organization_id`, plan via `subscription_plans`). KPIs dérivés.
- `OrgMember { user_id; email: string | null; role: string; is_premium: boolean }`.
- `LinkableSub { id; user_email: string | null; plan: string; status: string }`.
- `OrgDetail { id; name; owner_email: string | null; created_at: string; members: OrgMember[]; subscription: { id; plan: string; status: string; user_email: string | null } | null; linkableSubs: LinkableSub[] }`.
- `loadOrganization(id): Promise<OrgDetail | null>` — détail org + membres (email + premium via `profiles`) + abonnement lié + abonnements rattachables (status `active`, `organization_id is null`).

### 2. Logique premium — `lib/admin/orgPremium.ts` (service-role)

- `orgHasActiveSubscription(orgId): Promise<boolean>` — existe `subscriptions.organization_id = orgId` en `status='active'`.
- `userHasOwnActiveSub(userId): Promise<boolean>` — existe `subscriptions.user_id = userId` AND `organization_id is null` AND `status='active'`.
- `userInActiveOrg(userId): Promise<boolean>` — l'user est membre d'une org ayant un abonnement actif.
- `recomputeMemberPremium(userId): Promise<void>` — calcule `should = userHasOwnActiveSub(userId) || userInActiveOrg(userId)` ; met `profiles.is_premium = should` (et `premium_since = now` quand on passe à true et qu'il était false, `null` quand on passe à false). Idempotent ; appelé après chaque mutation de membre ou d'abonnement.

### 3. Actions serveur — `app/admin/organizations/actions.ts`

Toutes : RBAC + `recordAudit` + `revalidatePath` (`/admin/organizations` et, si pertinent, `/admin/organizations/[id]`). Retour `{ ok: boolean; message?: string }`.

- `createOrganization({ name, ownerEmail? })` — `users.write`. Valide nom non vide.
  Insert org ; si `ownerEmail` fourni → résout l'user via `profiles` (rejet si
  introuvable), set `owner_user_id`, insert membre `owner`, `recomputeMemberPremium`.
  Audit `org.create`.
- `renameOrganization(id, name)` — `users.write`. Update `name`. Audit `org.update`.
- `deleteOrganization(id)` — `users.write`. Lit les `user_id` des membres ; delete
  org (cascade supprime les membres) ; `recomputeMemberPremium` sur chaque ex-membre.
  Audit `org.delete` (severity `warning`).
- `addMember(orgId, email, role)` — `users.write`. Valide `role ∈ {owner,admin,member}` ;
  résout l'user (rejet si introuvable) ; rejet si déjà membre ; insert membre ;
  `recomputeMemberPremium(userId)`. Audit `org.member.add`.
- `removeMember(orgId, userId)` — `users.write`. Delete membre ;
  `recomputeMemberPremium(userId)`. Audit `org.member.remove`.
- `setMemberRole(orgId, userId, role)` — `users.write`. Valide rôle ; update.
  Audit `org.member.role`.
- `linkSubscription(orgId, subscriptionId)` — `subscriptions.write`. Set
  `subscriptions.organization_id = orgId` ; recompute premium pour tous les membres
  de l'org. Audit `org.sub.link`.
- `unlinkSubscription(orgId, subscriptionId)` — `subscriptions.write`. Set
  `organization_id = null` ; recompute pour tous les membres. Audit `org.sub.unlink`.

### 4. Pages & composants — `app/admin/organizations`

- `page.tsx` (server, `users.read`) : `SectionHeader` + KPIs (`MetricCard` : orgs,
  orgs avec abonnement actif, membres cumulés) + table (`PremiumPanel`) nom /
  propriétaire / membres / abonnement+statut (`StatPill`) / date, chaque ligne
  liée à `[id]`. `CreateOrgForm` (nom + email propriétaire optionnel).
  `EmptyStatePremium` si aucune org.
- `[id]/page.tsx` (server, `users.read`) : entête (nom éditable + supprimer),
  panel **Membres** (`OrgMembersPanel`), panel **Abonnement** (`OrgSubscriptionPanel`).
  404 propre si org introuvable.
- `CreateOrgForm.tsx` (client) : formulaire création, appelle `createOrganization`.
- `OrgMembersPanel.tsx` (client) : table membres (email, rôle via select →
  `setMemberRole`, badge premium, retrait → `removeMember`) + formulaire d'ajout
  (email + rôle → `addMember`).
- `OrgSubscriptionPanel.tsx` (client) : abonnement lié (plan, statut, lien
  `/admin/subscriptions`, détacher → `unlinkSubscription`) ou sélecteur des
  `linkableSubs` → `linkSubscription`.

## Flux de données

```
[/admin/organizations] --loadOrganizations--> KPIs + table
  Créer -> createOrganization (+owner éventuel, recompute) -> users.write
[/admin/organizations/[id]] --loadOrganization--> détail
  addMember    -> insert + recomputeMemberPremium -> is_premium suit l'abo org
  removeMember -> delete + recomputeMemberPremium -> revient false sauf abo propre
  setMemberRole -> update role
  linkSubscription   -> organization_id=org + recompute tous membres
  unlinkSubscription -> organization_id=null + recompute tous membres
  deleteOrganization -> delete (cascade membres) + recompute ex-membres
```

## Gestion d'erreurs

- Email introuvable / doublon membre / rôle invalide / nom vide → `{ ok:false, message }`, aucune écriture.
- Org introuvable au détail → page 404 propre (pas de 500).
- Erreurs DB → message clair remonté, jamais de throw non géré.

## Sécurité / RGPD

- Emails des membres = PII, déjà exposée dans `/admin/users` au même niveau de
  droit (`users.read`) — cohérent, pas d'exposition nouvelle.
- Service-role server-only ; mutations gardées par `users.write` /
  `subscriptions.write` + `recordAudit` sur chaque action.
- **Limite assumée** : `recomputeMemberPremium` révoque le premium d'un membre
  retiré s'il n'a pas d'abonnement propre actif. Un premium accordé
  **manuellement** (toggle admin sans abonnement) serait donc révoqué lors d'un
  retrait d'org. Cas rare, contrôlé par l'admin qui effectue l'action.

## Tests

Frontend sans harness → `tsc` + `build`. Vérif ciblée prod : créer une org →
rattacher un abonnement actif → ajouter un membre (son `is_premium` passe à true)
→ le retirer (revient à false faute d'abo propre) → détacher l'abonnement →
supprimer l'org.

## Hors-scope (YAGNI — confirmé)

- Self-service client (création d'org, invitations par email, RLS owner-scopée).
- Champ « sièges » + quota de membres.
- Permissions dédiées `organizations.*` (réutilisation `users.*` / `subscriptions.*`).
- Facturation par siège / proration.
