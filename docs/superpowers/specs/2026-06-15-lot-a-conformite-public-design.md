# Lot A — Conformité & habillage public — Design

**Date :** 2026-06-15
**Statut :** Validé (brainstorming)
**Suite :** Lot B — Tableau de bord admin (spec séparée)

## 1. Objectif

Rendre BRVM Analyst Pro conforme et présentable pour un lancement SaaS public :
consentement cookies RGPD extensible, pages légales complètes (droit
ivoirien/OHADA, abonnement premium inclus), footer global cohérent, et
clarification du bouton de connexion. Aucun chiffre/fait légal inventé :
les valeurs manquantes sont des placeholders explicites « À COMPLÉTER ».

## 2. Contexte existant (vérifié)

- **Cookies posés aujourd'hui :** uniquement essentiels (session Supabase
  `sb-*`). Aucun analytics/traceur (pas de GA, Vercel Analytics, PostHog…).
  → bandeau de consentement non strictement obligatoire en l'état, mais on le
  met en place « extensible » pour être prêt pour analytics/Stripe.
- **Pages légales :** `/mentions-legales` (~83 l.) et `/confidentialite`
  (~98 l.) existent mais sont minces. Pas de `/cgu`.
- **Footer :** seulement sur la landing (`app/page.tsx`) et `PublicShell`. Pas
  de composant footer global réutilisable.
- **Shell conditionnel :** `components/ConditionalShell.tsx` rend `/`, `/login`,
  `/signup` en plein écran ; le reste passe par le shell applicatif.
- **Admin :** `lib/server/admin-emails.ts` (`ADMIN_EMAILS=['ebouak@gmail.com']`)
  — hors périmètre Lot A (Lot B).
- **Bouton topbar :** `components/landing/taste/TasteTopbar.tsx` a un
  `BeamButton href="/login"` libellé **« Terminal »**. CTA hero principal →
  `/signup` (déjà via `HeroPulseCTA`).

## 3. Décisions de conception

| Sujet | Décision |
|---|---|
| Consentement | Bandeau **maison léger** (localStorage + context, sans dépendance) + **registre de catégories extensible**. |
| Éditeur | Société enregistrée — champs à remplir (placeholders « À COMPLÉTER »). |
| Droit applicable | OHADA / Côte d'Ivoire ; juridiction compétente Abidjan. |
| Périmètre CGU | Inclut l'abonnement premium payant. |
| Footer | Pages **publiques uniquement** (landing + légal + sociétés…), pas dans l'app authentifiée. |
| Bouton « Terminal » | **Renommé « Connexion »** (cible inchangée `/login`, qui gère connexion + inscription). |

## 4. Architecture & fichiers

### A1 — Consentement cookies

- **`frontend/lib/consent/registry.ts`** — source de vérité déclarative.
  ```ts
  export type ConsentCategoryId = 'essential' | 'analytics' | 'marketing';
  export interface ConsentCategory {
    id: ConsentCategoryId;
    label: string;          // FR
    description: string;     // FR
    required: boolean;       // essential = true (verrouillé ON)
    cookies: { name: string; purpose: string; duration: string }[];
  }
  export const CONSENT_VERSION = 1;
  export const CONSENT_STORAGE_KEY = 'brvm-consent-v1';
  export const CONSENT_CATEGORIES: ConsentCategory[];
  ```
  - `essential` : cookies `sb-access-token`, `sb-refresh-token` (session,
    `required: true`). `analytics` et `marketing` : `cookies: []` pour l'instant
    (`required: false`).
- **`frontend/lib/consent/state.ts`** — logique pure (testable) :
  ```ts
  export interface ConsentChoice {
    version: number;
    timestamp: string;       // ISO
    granted: Record<ConsentCategoryId, boolean>; // essential toujours true
  }
  export function defaultDenied(): ConsentChoice;     // tout off sauf essential
  export function acceptAll(): ConsentChoice;          // tout on
  export function serialize(c: ConsentChoice): string;
  export function parse(raw: string | null): ConsentChoice | null; // null si version périmée
  export function has(choice: ConsentChoice | null, id: ConsentCategoryId): boolean;
  ```
  - `parse` renvoie `null` si `version !== CONSENT_VERSION` → re-consentement.
- **`frontend/components/consent/ConsentProvider.tsx`** (client) — context :
  expose `{ choice, open(), save(choice), has(id) }`. Lit/écrit localStorage.
  Monté une fois dans `app/layout.tsx`.
- **`frontend/components/consent/CookieBanner.tsx`** (client) — bandeau bas
  d'écran tant qu'aucun choix valide. Boutons : **Tout accepter**,
  **Refuser (non-essentiels)**, **Personnaliser** (ouvre la modal). Style dark
  cyan, `z-50`, non bloquant (n'empêche pas la navigation).
- **`frontend/components/consent/CookiePreferences.tsx`** (client) — modal :
  un toggle par catégorie ; `essential` affiché verrouillé ON. Bouton
  « Enregistrer mes choix ». Liste les cookies de chaque catégorie depuis le
  registre.
- **Réouverture** : lien « Gérer mes cookies » dans le footer → `open()`.
- **Usage futur** : tout script analytics sera rendu conditionnellement à
  `has('analytics')` (documenté en commentaire dans `registry.ts`).

### A2 — Pages légales (droit ivoirien/OHADA)

Composant partagé **`frontend/components/legal/LegalPage.tsx`** (titre, date de
mise à jour, prose `max-w-3xl`, style cohérent) réutilisé par les 3 pages.
Helper **`frontend/components/legal/Placeholder.tsx`** : rend
`« [À COMPLÉTER : raison sociale] »` en surbrillance douce (visuellement
repérable) pour les valeurs légales manquantes.

- **`app/mentions-legales/page.tsx`** (réécrit) : Éditeur (raison sociale, forme,
  capital, RCCM, siège, n° TVA/contribuable, e-mail, téléphone), directeur de
  la publication, hébergeur (Vercel Inc. + Supabase — valeurs connues
  renseignées), propriété intellectuelle, crédits données (BRVM/BDFIN).
- **`app/cgu/page.tsx`** (nouveau) : 1) Objet & définitions ; 2) Accès au service
  & inscription ; 3) Compte utilisateur ; 4) **Abonnement premium** (offres,
  prix « À COMPLÉTER », paiement, reconduction, résiliation, remboursement) ;
  5) Disponibilité & maintenance ; 6) **Avertissement risque — « les analyses,
  notes et signaux ne constituent pas un conseil en investissement »** (encart
  visible en tête ET section dédiée) ; 7) Responsabilité & limites ; 8) Données
  personnelles (renvoi `/confidentialite`) ; 9) Propriété intellectuelle ;
  10) Droit applicable **OHADA / Côte d'Ivoire**, juridiction **Abidjan**,
  règlement amiable préalable.
- **`app/confidentialite/page.tsx`** (réécrit) : responsable de traitement
  (placeholder), données collectées (compte, e-mail, usage, paper-trading),
  finalités & base légale, durées de conservation, destinataires/sous-traitants
  (**Supabase**, **Vercel**, **Resend**), transferts hors UEMOA, droits RGPD
  (accès/rectification/effacement/opposition/portabilité) + modalités d'exercice,
  cookies (renvoi au registre A1), contact.

Liens croisés : chaque page référence les autres + le footer les expose.

### A3 — Footer global

- **`frontend/components/Footer.tsx`** (server-compatible, liens `next/link`) :
  - Colonne marque : logo « B » + nom + tagline courte.
  - Colonne **Produit** : Sociétés, Simulateur, Brief, Tarifs (si existe, sinon
    omis).
  - Colonne **Légal** : Mentions légales, CGU, Confidentialité,
    « Gérer mes cookies » (bouton client rouvrant la modal → petit wrapper
    client `FooterCookieLink.tsx`).
  - Bas : disclaimer financier court (1 ligne, centralisé) + `© {année} …`.
- **Intégration** : rendu dans `ConditionalShell` (ou directement) pour les
  routes **publiques** uniquement. La landing remplace son footer inline actuel
  par ce composant. Non rendu sur `/login`, `/signup`, ni dans l'app
  authentifiée.
- **Disclaimer centralisé** : `frontend/lib/legal/disclaimer.ts` exporte
  `FINANCIAL_DISCLAIMER` (réutilisé par footer + encart CGU + éventuellement
  réconcilié avec `RATING_DISCLAIMER` existant).

### A4 — Bouton « Terminal » → « Connexion »

- **`components/landing/taste/TasteTopbar.tsx`** : le `BeamButton href="/login"`
  passe du libellé **« Terminal »** à **« Connexion »**. Cible inchangée
  (`/login`). Le CTA d'acquisition principal reste `/signup` (hero). Vérifier
  qu'aucun autre bouton public ne mène directement au dashboard en
  court-circuitant l'inscription ; si trouvé, le rediriger vers `/signup`.

## 5. Flux de données

Consentement : `ConsentProvider` (monté dans `layout`) → lit localStorage au
montage → si pas de choix valide, `CookieBanner` visible → action utilisateur →
`save()` écrit localStorage + ferme bandeau. `has(id)` disponible partout via
context. Aucune donnée serveur ; pas d'appel réseau.

Pages légales & footer : statiques (prose), aucun fetch. Footer « Gérer mes
cookies » appelle `useConsent().open()`.

## 6. Gestion des erreurs / cas limites

- localStorage indisponible (mode privé strict) : `parse`/`save` encapsulés en
  try/catch → on retombe sur « pas de choix » (bandeau affiché, rien ne casse).
- Version de consentement incrémentée plus tard → `parse` renvoie `null` → le
  bandeau réapparaît (re-consentement propre).
- SSR : `ConsentProvider` ne touche localStorage que dans `useEffect` (pas
  d'hydratation incohérente) ; le bandeau se monte après hydratation.
- Placeholders légaux : visuellement marqués, jamais de fausse donnée.

## 7. Tests

- **Unitaires (vitest, `frontend`)** sur `lib/consent/state.ts` :
  `defaultDenied`/`acceptAll`/`serialize`/`parse` (incl. version périmée → null)
  /`has`.
- **Smoke Playwright** : la bannière apparaît à la première visite ; après
  « Tout accepter », elle disparaît et ne réapparaît pas au reload (persistance).
- Les pages légales : vérifier qu'elles rendent (smoke) et contiennent l'encart
  disclaimer.

## 8. Hors périmètre (Lot A)

- Tableau de bord admin (Lot B).
- Intégration réelle d'un analytics (on prépare seulement le registre).
- Tunnel de paiement Stripe (les CGU décrivent l'abonnement ; la mécanique de
  paiement est un autre chantier).
- Valeurs légales définitives (fournies par l'utilisateur à l'implémentation).

## 9. Livrables

Nouveaux fichiers : `lib/consent/registry.ts`, `lib/consent/state.ts`,
`components/consent/{ConsentProvider,CookieBanner,CookiePreferences}.tsx`,
`components/legal/{LegalPage,Placeholder}.tsx`, `components/Footer.tsx` (+
`FooterCookieLink.tsx`), `lib/legal/disclaimer.ts`, `app/cgu/page.tsx`,
tests `lib/consent/state.test.ts` + smoke.
Fichiers modifiés : `app/layout.tsx` (provider + bandeau), `app/page.tsx`
(footer partagé), `app/mentions-legales/page.tsx`, `app/confidentialite/page.tsx`,
`components/landing/taste/TasteTopbar.tsx`, `components/ConditionalShell.tsx`
(footer public).
