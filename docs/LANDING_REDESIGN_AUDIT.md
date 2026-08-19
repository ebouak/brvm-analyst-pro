# Audit de la landing page — préparation refonte visuelle

Phase 0 + Phase 1 du processus de refonte mandaté. **Audit en lecture seule** :
aucun fichier de production n'a été modifié pour produire ce document. Les
phases suivantes (critique UX, architecture cible, plan de refonte) sont à
faire par la session de contrôle, pas par ce document.

Date de l'audit : voir date du commit. Fichiers lus intégralement (chemins
absolus indiqués dans chaque section).

---

## 1. Architecture actuelle

- **Framework** : Next.js 14 (App Router), React 18, TypeScript, Tailwind.
  Route racine : `frontend/app/page.tsx` (Server Component async).
- **Rendu de `/` — tension ISR/dynamique réelle** : `page.tsx` exporte
  `export const revalidate = 300;` (ligne 29), ce qui *suggère* une génération
  statique régénérée toutes les 5 minutes (ISR classique). Mais
  `frontend/app/layout.tsx` (racine, englobe toutes les routes) appelle
  `createClient()` (client Supabase **avec cookies**, `lib/supabase/server`)
  et `supabase.auth.getUser()` à chaque requête (lignes 244-263) pour
  déterminer `hasUser`/`isAdmin`/`isPremium`/`onboardingDone`. La lecture de
  cookies dans un layout englobant force Next à rendre **toute la route en
  dynamique** (`force-dynamic` implicite) — le `revalidate = 300` du HTML de
  `page.tsx` est donc **sans effet réel** : chaque visite regénère le HTML
  côté serveur. Le code le documente lui-même en commentaire (lignes 190-195
  de `page.tsx`) : *« Le layout racine lit la session (cookies) → la route
  est rendue dynamique et l'ISR (revalidate=300) est sans effet sur le HTML.
  On met donc les DONNÉES en cache serveur 5 min »*. Le vrai mécanisme de
  cache est `unstable_cache(getData, ['landing-data'], { revalidate: 300 })`
  (ligne 195) : ce sont les ~10 requêtes Supabase qui sont mises en cache
  serveur 5 min, pas le HTML. **Implication pour la refonte** : toute
  section ajoutée qui ferait un nouvel appel Supabase doit passer par ce même
  `getCachedData()`/`unstable_cache`, sinon elle re-requête à chaque visite.
- **Couche de données** : `createPublicClient()` (`frontend/lib/supabase/public.ts`)
  — client Supabase créé avec la clé **anon**, `persistSession: false`,
  `autoRefreshToken: false`, sans cookies. Le commentaire du fichier est
  explicite : *« N'utilise jamais la session : uniquement les tables en
  lecture publique (RLS using(true)) »*. Confirme la règle CLAUDE.md
  (frontend ne lit que Supabase, jamais BRVM directement) et l'absence de
  fuite de session utilisateur sur la landing.
  Tables/vues touchées par `getData()` dans `page.tsx` : `brvm_actions_daily`,
  `brvm_indices_daily`, `signals_daily`, `brief_daily`, `dividends`,
  `brvm_news`. Plus, hors `getData()` : `getSgiDirectory()`
  (`frontend/lib/sgi-frais/queries.ts`, tables SGI avec repli TS) et
  `loadHeatmap()` (`frontend/lib/heatmapData.ts`, tables `brvm_instruments` +
  `brvm_actions_daily`, partagée avec `/heatmap`). `NewsTicker` (Server
  Component autonome) refait sa propre requête `brvm_news` (non mutualisée
  avec celle de `getData()` — deux requêtes distinctes sur la même table).
- **Auth** : pas de logique d'auth dans la landing elle-même ; le layout
  racine lit la session pour décider du chrome (`ConditionalShell`), la
  landing ne fait qu'exposer des liens `/login` et `/signup`.
- **Système Premium** : pas de logique Premium sur `/` — un simple lien vers
  `/pricing`. La page `/pricing` (`frontend/app/pricing/page.tsx`) lit
  `subscription_plans` (table réelle, `is_active=true`, triée par
  `sort_order`) et rend `<PricingClient plans={plans} />` ; son `metadata`
  annonce 3 formules : **Gratuit, Premium et Platinium**. Ne pas inventer
  d'autres noms de plan dans la refonte.
- **Thème clair/sombre** : **réellement implémenté**, pas seulement dark. Un
  script anti-flash synchrone dans `layout.tsx` (lignes 272-277) pose
  `data-theme="light"` sur `<html>` avant le premier paint selon
  `localStorage['westbourse-theme']` ou `prefers-color-scheme`. Le bouton
  `frontend/components/ThemeToggle.tsx` bascule et persiste ce choix.
  `frontend/app/globals.css` définit un vrai jeu de tokens sous
  `:root[data-theme="light"]` (ligne 63 et suivantes). **Nuance** : plusieurs
  composants de la landing (Hero, Footer, CookieBanner, badges) utilisent
  volontairement des couleurs **littérales fixes** (`#fff`, `#030303`, etc.)
  au lieu des tokens de thème, avec des commentaires explicites du type
  *« Couleurs de texte FIXES … le fond reste volontairement sombre quel que
  soit le thème »* (`HeroSpotlight.tsx` lignes 18-22, `Footer.tsx` lignes
  52-54, `CookieBanner.tsx` lignes 15-16). Donc : le **site** a un vrai mode
  clair, mais le **Hero et le Footer de la landing sont sombres dans les deux
  thèmes par choix assumé** — à documenter explicitement si la refonte touche
  ces zones, pour ne pas « corriger » un choix intentionnel.
- **Analytics/consent** : PostHog (`frontend/components/analytics/PostHogInit.tsx`)
  strictement conditionné au consentement « analytics » du bandeau cookies
  (`useConsent().has('analytics')`) — aucun script chargé sans accord, purge
  immédiate au retrait. Sentry est aussi en dépendance (`@sentry/nextjs`) mais
  non observé dans le rendu de la landing elle-même. `ConsentProvider` +
  `CookieBanner` + `CookiePreferences` (`frontend/components/consent/`) sont
  montés globalement dans `layout.tsx` et donc actifs sur `/`.
- **SEO** : `export const metadata` dans `page.tsx` (title + description).
  `frontend/app/opengraph-image.tsx` génère une image OG 1200×630 par code
  (edge runtime, reprend le vrai logo mark + wordmark). `frontend/app/sitemap.ts`
  liste les pages statiques + pages société dynamiques (`brvm_instruments`) +
  briefs (`brief_daily`) + pages citables (`citable_pages`). `frontend/app/robots.ts`
  autorise tout sauf `/api/`, `/dashboard`, `/portefeuille`, `/parametres`,
  `/account`, `/admin`, `/premium`, `/print`. JSON-LD Schema.org
  (Organization/WebSite/WebApplication/FinancialService/FAQPage) injecté dans
  `layout.tsx` — le bloc FAQPage doit rester synchronisé avec
  `LandingFaq.tsx` (commentaire explicite dans le code, ligne 189).
- **Dépendances pertinentes pour la landing** (`frontend/package.json`) :
  `framer-motion` (utilisé par `BeginnerBanner.tsx` et par `PulseBeams`, sous
  `HeroPulseCTA`), `next/image` (Hero), `next/og` (image OG). `echarts`,
  `recharts`, `lightweight-charts` sont présents mais **pas utilisés par les
  composants de la landing lus** (probablement dashboard/fiches société) —
  ne pas supposer qu'un graphique de la landing utilise l'un d'eux sans
  vérifier le composant précis.

---

## 2. Inventaire fonctionnel complet

| # | Fonctionnalité | Composant(s) | Route liée | Source de données | Dynamique ? | Recommandation |
|---|---|---|---|---|---|---|
| 1 | Bandeau « niveau débutant » | `components/BeginnerBanner.tsx` | `/debutant` | localStorage (`brvm_level_seen`, `brvm_beginner_banner_dismissed`) | Non (logique d'affichage dynamique, contenu statique) | Conserver — logique de ciblage réelle, absente des maquettes connues |
| 2 | Topbar flottante + logo + ticker + nav rapide | `components/landing/taste/TasteTopbar.tsx` | `/societes`, `/comparateur-sgi`, `/simulateur`, `/brief`, `/login`, `/premium/diagnostic`, `/` | `ticks`/`liveRows` calculés dans `getData()` (`brvm_actions_daily`, `signals_daily`) + Supabase Realtime via `LiveTicker` | Oui (SSR + realtime) | Conserver — c'est le header spécifique à la landing |
| 3 | Toggle thème clair/sombre | `components/ThemeToggle.tsx` (dans TasteTopbar) | — | localStorage | Oui (état client) | Conserver — fonctionnalité réelle, pas un gadget de maquette |
| 4 | CTA « Diagnostic IA » (topbar) | lien direct dans `TasteTopbar.tsx` | `/premium/diagnostic` | statique | Non | Conserver |
| 5 | Hero immersif (photo + carte Afrique + logo BRVM clignotant + cotations flottantes) | `components/landing/HeroSpotlight.tsx` | `/societes` (lien secondaire) | `ticks` réels pour les 4 cotations flottantes ; reste = habillage visuel statique | Partiellement (cotations réelles, décor statique) | Repenser UI possible mais **garder les cotations réelles et le vrai logo BRVM** (`/brand/brvm-logo.png`), ne pas les remplacer par une image composite figée |
| 6 | CTA hero avec effet « PulseBeams » | `components/landing/HeroPulseCTA.tsx` (rendu dans HeroSpotlight) | `/signup` | statique (framer-motion) | Non | Conserver ou simplifier, mais CTA principal du site |
| 7 | Bandeau de preuve produit (4 métriques) | `components/landing/ProofBand.tsx` | — | **Codées en dur** dans le composant (`48`, `15 min`, `A–F`, `100%`) — pas de requête Supabase malgré le commentaire « métriques vraies et vérifiables » | Non | Repenser : soit brancher `nbActions`/etc. réels (déjà calculés dans `page.tsx`) au lieu de dupliquer `'48'` en dur, soit assumer explicitement que ce sont des constantes de positionnement |
| 8 | Ticker d'actualités défilant | `components/NewsTicker.tsx` | liens externes (`source_url`) | `brvm_news` (requête Supabase **indépendante** de celle de `getData()`) | Oui | Conserver ; mutualiser la requête avec celle de `news` dans `getData()` serait une optimisation possible |
| 9 | Bloc « Marché en direct » — 3 tuiles statistiques (sociétés, fréquence, volume) | inline dans `page.tsx` (lignes 296-308) | — | `nbActions`, `volumeTotal` calculés depuis `brvm_actions_daily` du jour ; `'15 min'` en dur | Oui (2 sur 3 chiffres) | Conserver — remplacer par un composant si extrait, mais garder le calcul réel |
| 10 | Carte « La séance, en direct » (movers hausses/baisses ou top volumes) | inline (`MoverLine`) + `RatingBadge` | `/societes/{code}`, `/societes` | `brvm_actions_daily` + `signals_daily` du jour, avec repli « top volumes » si aucune variation signée | Oui | Conserver — logique de repli honnête (jamais de bloc vide) à préserver telle quelle |
| 11 | Badge de notation A–F | `components/RatingBadge.tsx` | — | `scoreToRating()` (`lib/rating.ts`) à partir de `score_total`/`confiance` réels | Oui | Conserver tel quel, composant partagé avec le reste du site |
| 12 | Indices BRVM (4 principaux + 7 sectoriels) | `components/landing/LandingIndices.tsx` | — | `brvm_indices_daily` (11 indices) | Oui | Conserver — section masquée automatiquement si aucune donnée |
| 13 | Cartographie du marché (heatmap/treemap) | `components/landing/LandingHeatmap.tsx` + `components/HeatmapTreemapLazy` | `/heatmap` | `loadHeatmap()` — même loader que la page `/heatmap` (`brvm_instruments` + `brvm_actions_daily`) | Oui | Conserver — composant substantiel (taille = capitalisation, couleur = variation), pas remplaçable par une image |
| 14 | Aperçu plateforme (« Ce que vous débloquez », 6 cartes fonctionnalités) | `components/landing/AppPreview.tsx` | `/signup`, `/pricing`, `/obligations`, `/societes` | **Contenu statique** (icônes emoji, textes, badges GRATUIT/PREMIUM/UNIQUE codés en dur) — chiffres cités (« 48 titres », « 260+ obligations ») non recalculés dynamiquement | Non | Repenser UI librement — mais si des chiffres sont conservés dans le texte, les vérifier/brancher plutôt que les laisser en dur indéfiniment |
| 15 | Section 3 étapes (« Consultez la note », « Vérifiez les fondamentaux », « Entraînez-vous ») | inline (`STEPS` const) dans `page.tsx` | `/societes` ×2, `/signup` | Statique | Non | Repenser librement, contenu éditorial |
| 16 | Comparateur SGI (bandeau, pas le composant complet) | inline dans `page.tsx` (lignes 375-405) | `/comparateur-sgi` | `getSgiDirectory()` — nombre réel de SGI + répartition par pays calculée à la volée (`sgiCount`, `sgiPaysLines`) | Oui | **Risque de régression identifié** — voir section 8. Conserver le calcul dynamique, ne jamais coder « 41 SGI » en dur |
| 17 | Preuve sociale (communauté + logos sources) | `components/landing/SocialProof.tsx` | — | Compteur « 2 000+ » **codé en dur** (assumé honnête par commentaire, pas une requête) ; logo BRVM réel (`/brand/brvm-logo.png`) + labels texte des sources (`BDFIN`, `BCEAO`, `BloomField`, `GitHub brvm-data-public`) également en dur | Non | Conserver le principe (logo réel + sources vraies), mais signaler que le chiffre communautaire est une constante éditoriale à tenir à jour manuellement, pas une donnée live |
| 18 | Simulateur (résultat 1M FCFA sur SNTS sur 5 ans) | inline dans `page.tsx` (lignes 411-449) + `lib/simulate.ts` | `/simulateur` | Calcul réel sur `brvm_actions_daily` (code SNTS, 5 ans d'historique) + `dividends` via `simulateInvestment()` (fonction pure documentée : pas de fractions d'action, dividendes en cash, pas d'extrapolation) | Oui | Conserver impérativement — c'est un calcul réel sur données réelles, pas un exemple fictif |
| 19 | Brief du jour (extrait) | inline dans `page.tsx` (lignes 452-475) | `/brief` | `brief_daily` (dernière séance), contenu réel tronqué à 7 lignes | Oui (section masquée si aucun brief) | Conserver |
| 20 | Carte « Analyse exclusive » | inline (carte 1/3) | `/signup` | Statique | Non | Repenser librement |
| 21 | Carte « Premium » | inline (carte 2/3) | `/pricing` | Statique (texte évoquant Diagnostic IA, rapports PDF, paper trading) | Non | Repenser librement, vérifier que le texte reste cohérent avec l'offre réelle de `/pricing` |
| 22 | Carte « Actualités du Marché » (3 dernières news) | inline (carte 3/3) | `/actualites`, liens externes `source_url` | `brvm_news` (requête **encore différente**, 4 lignes récupérées dans `getData()`, 3 affichées) | Oui | Conserver — 3e requête distincte vers `brvm_news` sur la même page (NewsTicker, carte news, potentiel doublon d'appel à mutualiser) |
| 23 | FAQ (4 questions) | `components/landing/LandingFaq.tsx` | `/pricing` (lien inline dans une réponse) | Statique, mais **dupliqué** dans le JSON-LD `FAQPage` de `layout.tsx` (doit rester synchronisé manuellement — commentaire explicite dans le code) | Non | Repenser UI librement, mais toute modification du texte doit être répercutée dans `layout.tsx` |
| 24 | Formulaire newsletter | `components/NewsletterForm.tsx` (`source="landing"`) | `POST /api/newsletter/subscribe` | Formulaire réel avec appel API (pas un mock) | Oui | Conserver — fonctionnel, pas décoratif |
| 25 | CTA final | inline dans `page.tsx` | `/signup` | Statique | Non | Repenser librement |
| 26 | Footer global | `components/Footer.tsx` | multiples (voir §4) | Liens statiques + année courante calculée (`new Date().getFullYear()`) | Partiel | Conserver structure, voir §4 pour contenu exact |
| 27 | Bandeau cookies + préférences | `components/consent/CookieBanner.tsx` + `CookiePreferences.tsx` | `/confidentialite` | État de consentement réel (`ConsentProvider`), catégories définies dans `lib/consent/registry.ts` | Oui | Ne pas toucher sans revalider RGPD — composant transverse, pas spécifique à la landing mais actif dessus |

**26 lignes fonctionnelles réelles** identifiées sur la landing (hors bandeau cookies qui est transverse à tout le site mais bien actif sur `/`, compté en #27 pour traçabilité). Toutes correspondent à un composant/bloc effectivement rendu par `frontend/app/page.tsx` ou par le chrome global actif sur `/`.

---

## 3. Logo et identité de marque

**Composant à réutiliser sans modification** : `frontend/components/brand/AnimatedLogo.tsx`.

- SVG inline (pas de fichier image), `viewBox="0 0 130 105"` : un rectangle
  navy arrondi (`#0c1d2e`) en fond, un tracé blanc en forme de « W »
  (`d="M16 24 L40 82 L58 48 L76 82"`), un trait teal (`#16b6a4`) formant une
  flèche montante (`d="M76 82 L100 33"`) surmonté d'un triangle teal
  (`points="110,12 117,40 86,28"`).
- Props : `size` (px), `variant` (`'mark'` seul ou `'lockup'` = mark +
  wordmark « WESTBOURSE » en lettres espacées), `animate` (dessin du tracé au
  montage), `loop`, `background` (rect navy de fond activable/désactivable),
  `className`.
- **Utilisations actuelles constatées** :
  - `TasteTopbar.tsx` ligne 25 : `<AnimatedLogo size={42} variant="mark" animate={false} />`
  - `Footer.tsx` ligne 69 : `<AnimatedLogo size={34} variant="mark" animate={false} />`
  - `frontend/app/pricing/page.tsx` ligne 33 : `<AnimatedLogo size={32} variant="mark" animate={false} />`
  - `frontend/app/opengraph-image.tsx` : **ne réutilise pas le composant**
    (contrainte edge runtime/`ImageResponse`) mais **redéfinit le même SVG en
    dur**, lignes 40-45 — les deux tracés doivent rester identiques si le
    logo change un jour (source dupliquée à surveiller).
  - Il existe aussi une variante `wslogo-anim`/`wslogo-loop` (classes CSS,
    probablement définies dans `globals.css`) pour un dessin animé du tracé —
    non observée en usage actif sur la landing (`animate={false}` partout
    dans les usages ci-dessus), potentiellement utilisée ailleurs (splash
    screen `components/brand/SplashScreen.tsx`, non lu en détail ici).

**Composant orphelin à ne PAS confondre avec le logo réel** :
`frontend/components/landing/taste/BrandLogo.tsx` — un second composant SVG
avec un tracé légèrement différent (mêmes couleurs, `viewBox` identique) mais
**non importé nulle part dans le code** (recherche exhaustive : aucune
occurrence de `BrandLogo` en dehors de sa propre définition). Vestige d'une
itération antérieure de la landing. À ignorer dans la refonte, ou à
supprimer si le ménage du code est dans le périmètre d'une phase ultérieure.

**Logo BRVM (institution boursière, distinct du logo WESTBOURSE)** :
`frontend/public/brand/brvm-logo.png` — image PNG, utilisé à deux endroits :
clignotant sur la carte d'Afrique du Hero (`HeroSpotlight.tsx` ligne 97,
classe `brvm-blink`) et dans la bande « sources officielles » de
`SocialProof.tsx` (ligne 36, grayscale au repos). Ne pas confondre avec le
logo WESTBOURSE lors de la refonte — ce sont deux marques distinctes
affichées côte à côte à dessein (preuve de source officielle).

---

## 4. Header/nav et footer réels

### Header — deux systèmes distincts confirmés

- **Landing (`/`)** : `TasteTopbar` (`frontend/components/landing/taste/TasteTopbar.tsx`)
  est bien le header *spécifique* à la landing — pilule flottante
  (`sticky top-3`, `rounded-full`), pas une sidebar. Contient : logo +
  wordmark, ticker (live ou statique selon les props), 4 liens rapides
  (Sociétés, SGI, Simulateur, Brief — masqués en dessous de certains
  breakpoints `lg`/`xl`), lien Connexion, `ThemeToggle`, CTA Diagnostic IA.
- **Reste de l'app (authentifié)** : `Sidebar` desktop +
  `MobileNav`/`BottomNav` mobile, pilotés par `frontend/lib/nav.ts` (source
  unique de navigation, 7 groupes : Marché, Intelligence, Analyse, Revenus…
  — lu partiellement, structure confirmée). C'est un système **complètement
  différent** de `TasteTopbar`, pas une variante responsive du même
  composant. `ConditionalShell.tsx` décide lequel des deux s'affiche : les
  routes dans `BARE_ROUTES`/`BARE_PREFIXES` (dont `/`) n'ont ni `Sidebar` ni
  `MobileNav`/`BottomNav` — elles gèrent leur propre header (ici,
  `TasteTopbar`, rendu par `page.tsx` lui-même, pas par `ConditionalShell`).

### Footer — contenu exact

Composant : `frontend/components/Footer.tsx`. Rendu sur `/` (et sur les
routes publiques listées dans `BARE_PREFIXES`/`LEGAL_PREFIXES`, jamais sur
`/login`, `/signup`, `/debutant`, `/embed/*`, ni dans l'app authentifiée).

Structure réelle (4 colonnes) :

1. **Colonne marque** : logo (`AnimatedLogo` mark, 34px) + wordmark
   « WESTBOURSE », description *« Analyse et aide à la décision
   d'investissement sur la BRVM (UEMOA). »*, bloc « Suivez-nous »
   (`SocialLinks`), bouton d'installation PWA conditionnel
   (`InstallPwaButton`, non lu en détail — affiché seulement si le
   navigateur propose l'installation).
2. **Colonne « Produit »** (`PRODUIT`, `Footer.tsx` lignes 8-18) :
   - Sociétés → `/societes`
   - Simulateur → `/simulateur`
   - Classement papier → `/classement`
   - Brief du jour → `/brief`
   - Méthodologie → `/methodologie`
   - Fiscalité UEMOA → `/fiscalite`
   - Tarifs → `/pricing`
   - API développeurs → `/developers`
   - Flux RSS → `/api/rss`
3. **Colonne « Légal »** (`LEGAL`, lignes 20-24) :
   - Mentions légales → `/mentions-legales`
   - Conditions d'utilisation → `/cgu`
   - Confidentialité → `/confidentialite`
   - « Gérer mes cookies » (`FooterCookieLink`, bouton qui rouvre les
     préférences de consentement, pas un lien)
4. **Colonne « Compte »** : Connexion → `/login`, Créer un compte → `/signup`.

Bas de page (verbatim, `Footer.tsx` lignes 121-122, via
`frontend/lib/legal/disclaimer.ts`) :

> « Les analyses, notes, signaux et simulations présentés sur WESTBOURSE
> sont fournis à titre informatif et pédagogique. Ils ne constituent pas un
> conseil en investissement, une recommandation personnalisée, ni une
> incitation à acheter ou vendre. Tout investissement comporte un risque de
> perte en capital. »

Suivi de « © {année courante} WESTBOURSE. Tous droits réservés. » (année
calculée dynamiquement, pas codée en dur).

**Réseaux sociaux — placeholders non résolus** : `frontend/components/SocialLinks.tsx`
définit 6 icônes (LinkedIn, X, Instagram, Facebook, YouTube, WhatsApp) mais
**5 des 6 liens pointent vers `href: '#'`** (lignes 14-18) — seul WhatsApp a
une vraie URL (`wa.me/<numéro>`, dérivée de `NEXT_PUBLIC_WHATSAPP_NUMBER`,
défaut `+225 07 07 11 51 15`). Le code contient même le commentaire
explicite : *« ⚠️ Remplacer les URLs « # » par les vrais profils WESTBOURSE »*
(ligne 5). Il existe pourtant deux profils LinkedIn réels déclarés dans le
JSON-LD de `layout.tsx` (`sameAs`, lignes 116-119) qui **ne sont pas
répercutés** dans `SocialLinks.tsx`. À signaler pour une correction (hors
scope visuel pur, mais c'est un vrai bug de contenu découvert pendant
l'audit).

---

## 5. Thème clair/sombre

**Réponse factuelle : le mode clair est réellement implémenté au niveau
site**, pas une fonctionnalité de maquette sans substance :

- Script anti-flash synchrone dans `<head>` (`layout.tsx` lignes 272-277)
  pose `data-theme="light"` sur `<html>` avant hydratation, avec priorité
  choix utilisateur (localStorage `westbourse-theme`) > préférence système
  (`prefers-color-scheme: light`) > sombre par défaut.
- `frontend/components/ThemeToggle.tsx` : bouton pilule fonctionnel,
  bascule `data-theme`, persiste dans localStorage, état lu au montage pour
  rester synchronisé avec le script anti-flash.
- `frontend/app/globals.css` définit un jeu de tokens complet sous
  `:root[data-theme="light"]` (au moins 4 occurrences distinctes confirmées :
  tokens de couleur ligne 63, opacité de motifs de fond lignes 130/152/493).
- **Mais** : plusieurs blocs de la landing (Hero, Footer, bandeau cookies,
  badges du Hero) utilisent des couleurs **littérales fixes**, pas les
  tokens de thème, avec commentaires assumant ce choix explicitement. Le
  thème clair existe donc bien globalement, mais **le Hero et le Footer de
  la landing restent visuellement sombres dans les deux modes** — un choix
  de design assumé, pas un bug ni une fonctionnalité à moitié câblée.

Conclusion pour la refonte : le toggle visible dans les maquettes générées
correspond à une vraie fonctionnalité — le conserver est légitime. Mais si la
refonte veut un Hero/Footer qui *change* réellement selon le thème, c'est un
changement de comportement (pas juste un reskin) à valider explicitement.

---

## 6. Systèmes transverses

- **Entrées d'authentification** : `/login` et `/signup` existent
  (confirmé par leur présence dans `sitemap.ts`, `robots.ts`, et les
  nombreux liens de la landing). Le CTA principal de la landing (`HeroPulseCTA`,
  CTA final, cartes « Analyse exclusive » et « Aperçu plateforme ») pointe
  systématiquement vers `/signup`. `/login` est accessible via la topbar et
  le footer.
- **Système Premium** : pas de logique dédiée sur la landing — un lien vers
  `/pricing`, qui lit `subscription_plans` en base et affiche dynamiquement
  les formules actives (**Gratuit / Premium / Platinium**, confirmé par le
  `metadata.description` de la page). Le composant `PricingClient` n'a pas
  été audité en détail (hors périmètre demandé).
- **SEO** : `metadata` par page, `opengraph-image.tsx` (image générée par
  code, reprend le vrai logo), `sitemap.ts` (statique + dynamique :
  sociétés, briefs, pages citables), `robots.ts` (bloque les zones privées).
  JSON-LD Schema.org riche dans `layout.tsx` (Organization, WebSite,
  WebApplication, FinancialService, FAQPage) — le bloc `FAQPage` doit rester
  synchronisé manuellement avec `LandingFaq.tsx`.
- **Analytics** : PostHog, strictement conditionné au consentement
  « analytics » (opt-in réel, pas de tracking par défaut). `respect_dnt: true`,
  session replay avec `maskAllInputs: true`. Sentry présent en dépendance
  mais son intégration dans la landing n'a pas été observée directement dans
  les fichiers lus.
- **Consentement cookies** : `ConsentProvider` + `CookieBanner` +
  `CookiePreferences` montés globalement dans `layout.tsx`, donc actifs sur
  `/`. 3 catégories définies dans `lib/consent/registry.ts` : essentiels
  (session Supabase, non désactivable), mesure d'audience (PostHog, opt-in),
  marketing (déclarée mais **aucun outil actif aujourd'hui** — le registre
  le dit explicitement). `CONSENT_VERSION = 2` avec commentaire daté
  expliquant le changement (activation PostHog le 2026-07-06).
- **Dépendances landing-pertinentes** : `framer-motion` (BeginnerBanner,
  PulseBeams du CTA hero), `next/image` (photo hero optimisée AVIF/WebP,
  `priority`, `quality={70}`), `next/og` (image OG). Aucune preuve que
  `echarts`/`recharts`/`lightweight-charts` soient utilisés par un
  composant de la landing — à vérifier composant par composant si la
  refonte veut ajouter un graphique, plutôt que de supposer une lib précise.

---

## 7. Responsive actuel

Résumé par section (classes Tailwind observées directement dans le code) :

| Section | Responsive déjà géré | Détail |
|---|---|---|
| TasteTopbar | Oui | Liens rapides masqués progressivement (`hidden lg:inline-flex`, `hidden xl:inline-flex`), wordmark masqué sous `sm` (`hidden sm:block`), ThemeToggle masqué sous `sm` |
| HeroSpotlight | Oui | Hauteur fluide `clamp(420px,56vw,480px)`, cotations flottantes masquées sous `sm` (`hidden … sm:block`), carte Afrique masquée sous `md` (`hidden … md:block`), largeur du contenu `max-w-[58%]`, typographie en `clamp()` |
| ProofBand | Oui | Grille `grid-cols-2` → `sm:grid-cols-4` |
| Bloc « Marché en direct » (tuiles + séance live) | Oui | `grid-cols-1` → `lg:grid-cols-[1.05fr_0.95fr]` |
| LandingIndices | Oui | Cartes principales `grid-cols-2` → `lg:grid-cols-4` ; sectorielles `grid-cols-2` → `sm:grid-cols-3` → `lg:grid-cols-4` |
| LandingHeatmap | Partiel | Le conteneur est responsive (`flex-wrap`), la hauteur du treemap est fixée en dur (`height={420}`) côté composant — comportement du treemap lui-même en mobile non vérifié en détail (composant lazy non ouvert) |
| AppPreview | Oui | `grid-cols-1` → `md:grid-cols-2` |
| Section 3 étapes | Oui | `grid-cols-1` → `md:grid-cols-3` |
| Bandeau SGI | Oui | `grid-cols-1` → `md:grid-cols-[1.4fr_auto]`, colonne pays masquée sous `md` (`hidden md:flex`) |
| SocialProof | Oui | `flex-col` → `sm:flex-row`, wrap sur les logos sources |
| Simulateur | Oui | `grid-cols-1` → `md:grid-cols-2`, typographie en `clamp` implicite via classes `text-4xl md:text-5xl` |
| Brief du jour | Oui | `grid-cols-1` → `md:grid-cols-[0.9fr_1.1fr]` |
| 3 cartes (Analyse/Premium/Actualités) | Oui | `grid-cols-1` → `md:grid-cols-3` |
| LandingFaq | Oui | `grid-cols-1` → `md:grid-cols-2` |
| NewsletterForm | Oui | `flex-col` → `sm:flex-row` pour le formulaire |
| Footer | Oui | `grid-cols-2` → `md:grid-cols-4`, colonne marque en `col-span-2 md:col-span-1` |

Constat général : la landing actuelle est déjà largement responsive avec des
breakpoints Tailwind cohérents (`sm`/`md`/`lg`/`xl`) et un usage fréquent de
`clamp()` pour la typographie fluide. Une refonte visuelle n'a pas à repartir
de zéro sur ce plan — le risque est plutôt de **perdre** cette couverture en
remplaçant un composant par un bloc moins travaillé.

---

## 8. Risques de régression identifiés

Chaque risque ci-dessous est ancré dans un fait constaté pendant la lecture
du code, pas générique.

1. **Le compte de SGI (`sgiCount`) et sa répartition par pays sont calculés
   côté serveur à chaque rendu** (`page.tsx` lignes 248-256, via
   `getSgiDirectory()`) — jamais codés en dur. Une maquette qui affiche
   « 41 SGI » en texte statique romprait cette exactitude dès qu'une SGI est
   ajoutée/retirée de l'annuaire Supabase. Toute refonte de cette section
   doit continuer à consommer `sgiCount`/`sgiPaysLines` calculés, pas un
   texte figé.
2. **La cartographie du marché (`LandingHeatmap`) délègue à
   `loadHeatmap()`, la même fonction que la page `/heatmap` dédiée**
   (commentaire explicite : *« Logique partagée entre la page /heatmap et la
   section de la landing pour éviter toute divergence »*). La remplacer par
   une image statique ou un composant différent romprait cette garantie de
   cohérence entre landing et page dédiée, et ferait perdre la logique de
   capitalisation calculée (`shares × cours_jour`, jamais inventée si
   `shares` est inconnu — `capitalisation` reste `null` plutôt que d'être
   estimée).
3. **Le simulateur affiche un résultat calculé en temps réel sur l'historique
   réel de SNTS** (`lib/simulate.ts`, fonction pure documentée : pas de
   fraction d'action, dividendes en cash non réinvestis automatiquement, pas
   d'extrapolation si l'historique est incomplet). Remplacer ce bloc par un
   chiffre d'exemple fixe transformerait une preuve factuelle en allégation
   marketing non vérifiable — risque produit et de conformité (le footer
   affiche justement un disclaimer sur les simulations).
4. **Trois requêtes distinctes vers `brvm_news` coexistent déjà sur la même
   page** (`NewsTicker` en Server Component autonome, plus la requête `news`
   dans `getData()` pour la carte « Actualités du Marché »). Une refonte qui
   ajoute encore un composant d'actualités sans remarquer cette duplication
   existante alourdirait le nombre de requêtes par visite sans bénéfice.
5. **`ProofBand` et `SocialProof` contiennent déjà des constantes codées en
   dur** (`'48'`, `'2 000+'`) présentées comme des métriques honnêtes malgré
   l'absence de requête Supabase réelle derrière elles. Une refonte visuelle
   pourrait facilement dupliquer ce même chiffre `'48'` une troisième fois
   ailleurs (il existe déjà en dur dans `ProofBand`, en repli dans le bloc
   « Marché en direct » de `page.tsx` ligne 298 (`nbActions > 0 ? … : '48'`),
   et évoqué dans `AppPreview`) — sans jamais le brancher sur le
   `nbActions` réel déjà calculé dans `getData()`. Bonne occasion pour la
   refonte de **réduire**, pas d'ajouter, ce genre de duplication.
6. **Le mécanisme de cache (`unstable_cache` sur `getData`, revalidation 5
   min) dépend du fait que `getData()` n'utilise que le client public** (le
   commentaire de `page.tsx` le dit explicitement : « Sûr : getData n'utilise
   que le client public (aucun cookie, aucune donnée personnalisée) »). Si
   une refonte ajoute une section qui a besoin d'une donnée liée à
   l'utilisateur (ex. état de connexion, préférence) DANS `getData()`, cela
   casserait silencieusement le cache partagé entre visiteurs (un visiteur
   verrait les données mises en cache pour un autre). Toute nouvelle section
   personnalisée doit rester hors de `getCachedData()`.
7. **`SocialLinks.tsx` a 5 liens sur 6 encore en placeholder `href="#"`**
   (seul WhatsApp est réel) malgré un commentaire d'avertissement explicite
   dans le code, et malgré l'existence de vraies URLs LinkedIn déclarées dans
   le JSON-LD de `layout.tsx` qui ne sont pas reprises ici. Une refonte
   purement visuelle du footer qui ne remarque pas ce détail perpétuerait des
   liens morts (`#`) dans un design plus soigné.
8. **Le Hero et le Footer utilisent des couleurs littérales fixes,
   volontairement indépendantes du thème clair/sombre** (commentaires
   explicites dans le code aux deux endroits). Un reskin qui « harmoniserait »
   ces couleurs avec les tokens de thème changerait un comportement voulu
   (fond toujours sombre sur ces deux zones, y compris en mode clair) sans
   que ce soit un simple ajustement visuel.
9. **Le bloc `FAQPage` du JSON-LD (`layout.tsx`) duplique manuellement le
   contenu de `LandingFaq.tsx`**, avec un commentaire imposant de les garder
   synchronisés. Toute réécriture du texte de la FAQ dans le cadre de la
   refonte doit être répercutée dans `layout.tsx`, sans quoi les rich
   snippets Google afficheraient un contenu obsolète ou incohérent avec la
   page.
10. **Des composants « taste/ » et « landing/ » supplémentaires existent dans
    le code mais ne sont PAS rendus par la landing actuelle** :
    `ScreensShowcase.tsx`, `MarketSessionBanner.tsx` (utilisé sur
    `/dashboard`, pas `/`), `SignalDeskPremium.tsx`, `SovereignIndexCards.tsx`,
    `TopMoversGallery.tsx`, `PremiumCircle.tsx`, `LandingTicker.tsx` — aucun
    n'est importé par `frontend/app/page.tsx` (vérifié par recherche globale
    des occurrences d'import). `SgiComparator.tsx` existe et est complet,
    mais il alimente la page dédiée `/comparateur-sgi`, **pas** la landing
    (qui a sa propre section SGI simplifiée inline). **Risque direct pour ce
    projet de refonte** : si les maquettes générées se sont inspirées de
    fichiers du dossier `components/landing/` sans vérifier lesquels sont
    réellement montés sur `/`, elles peuvent avoir halluciné des sections
    inexistantes sur la landing actuelle en confondant composants vivants et
    composants orphelins.
11. **Le détail de la note A–F affiché dans les maquettes de référence
    (barres « Fondamentaux / Momentum / Dividende / Valorisation / Risque »)
    ne correspond à AUCUN champ réel.** `SignalDaily` (`frontend/lib/types.ts`
    lignes 30-42) expose `score_variation`, `score_volume`, `score_rsi`,
    `bonus_tendance`, `penalite_liquidite`, `confiance`, `explication` — une
    décomposition **technique/quantitative** (variation, volume, RSI,
    tendance, pénalité de liquidité), pas une décomposition
    fondamentale/dividende/valorisation. Construire la section « Note A–F »
    cible avec les libellés exacts des maquettes serait inventer une donnée
    qui n'existe pas côté base — contraire à la règle Phase 6 du mandat et à
    la règle CLAUDE.md « pas de texte analytique inventé ». **Décision prise
    pour la section 12 ci-dessous** : réutiliser les vrais champs
    (`score_variation`/`score_volume`/`score_rsi`/`bonus_tendance`/
    `penalite_liquidite`) avec leurs vrais libellés, pas ceux des maquettes.

---

## 9. Critique UX/UI de l'existant (Phase 2)

Analyse en tant que product designer senior, ancrée dans le code lu ci-dessus
— pas une liste générique.

**Navigation** : `TasteTopbar` fonctionne bien (pilule flottante, logo réel,
ticker, theme toggle réel, CTA Diagnostic IA) — aucun problème structurel.
Seul point mineur : les liens rapides disparaissent progressivement sous
`lg`/`xl`, donc sur tablette la nav perd de la substance sans repli visible
(pas de menu burger constaté dans `TasteTopbar` — à vérifier au moment du
build si un repli existe réellement).

**Hero** : la proposition de valeur est déjà bonne et quasi identique au
texte cible du mandat (« Décidez sur la BRVM avec des données, pas des
rumeurs »). Le problème n'est pas le texte, c'est le **traitement visuel** —
`HeroSpotlight` mise sur une photo + carte Afrique + logo BRVM clignotant,
alors que le mandat (Phase 03) et les 4 images de référence montrent
unanimement un **mockup d'interface réelle** (device frame avec BRVM-C,
top variations, diagnostic, note A–F) comme élément visuel principal. C'est
le changement de plus fort impact du mandat, et il est cohérent avec la
préconisation « le produit réel doit être le principal élément graphique,
éviter les photos stock ». Les cotations flottantes réelles (`ticks`)
doivent être conservées mais réintégrées DANS le mockup d'interface plutôt
qu'en habillage flottant sur une photo.

**Répétitions identifiées** : `'48'` apparaît en dur dans `ProofBand`, en
repli dans le bloc « Marché en direct » de `page.tsx`, et évoqué dans
`AppPreview` — trois sources de vérité pour le même chiffre, dont une seule
(`nbActions` dans `page.tsx`) est réellement calculée. `brvm_news` est
requêté 3 fois sur la même page. Ces répétitions doivent être **réduites**,
pas simplement redessinées.

**Sections enterrées vs. mandat** : le mandat veut des sections dédiées et
mises en avant pour Note A–F (Phase 08), Diagnostic IA (Phase 09) et Premium
vs Gratuit (Phase 13). Aucune des trois n'existe aujourd'hui comme section
autonome — la note A–F n'apparaît qu'en badge inline dans les lignes de
movers, le Diagnostic IA n'a qu'un lien dans la topbar et une mention dans
la carte Premium, et la distinction Gratuit/Premium se limite à une seule
carte parmi trois. C'est un vrai écart fonctionnel entre l'existant et le
mandat, pas juste un problème de style — ces trois blocs sont à **créer**,
pas à redessiner.

**Preuve sociale et confiance** : `ProofBand` et `SocialProof` existent déjà
(bandeau de confiance + logos sources + compteur communauté) et couvrent
l'esprit de la Phase 04 du mandat (« Trust/Data bar »). Le seul vrai défaut
est que `ProofBand` prétend afficher des « métriques vraies et vérifiables »
(commentaire dans le code) sans réellement interroger Supabase pour au moins
2 des 4 chiffres — à corriger en branchant `nbActions`/`volumeTotal` déjà
calculés dans `page.tsx`, plutôt qu'en dupliquant encore une fois `'48'`.

**Conversion** : CTA principal cohérent (`/signup` partout), pas de friction
identifiée dans le tunnel visible depuis la landing. Le mandat demande un
sous-texte de réassurance (« aucune carte bancaire · compte en 1 minute ·
sans engagement ») — déjà présent quasi mot pour mot dans `HeroSpotlight`
(à confirmer visuellement au moment du build, non lu ligne à ligne ici).

**Mobile** : voir §7 — déjà largement géré, risque principal = régression en
remplaçant un composant responsive existant par un bloc moins travaillé, pas
un manque de couverture actuel.

---

## 10. Identité cible confirmée (Phase 3)

Le mandat original demandait d'éviter « esthétique générée par IA, gradients
excessifs, effets futuristes inutiles » et de positionner WESTBOURSE comme
une vraie plateforme de marché. L'utilisateur a ensuite tranché explicitement
la direction visuelle à partir de 4 images de référence :

- **Référence n°1 (« Landing reference full page »)** = direction cible
  principale — structure et hiérarchie de bout en bout (hero mockup, data
  bar, marché en direct en cartes, heatmap, grille d'outils par catégorie,
  spotlight A–F, spotlight Diagnostic IA, simulateur, SGI, communauté,
  Premium, brief, newsletter, footer).
- **Référence n°2 (« Landing premium clean »)** = traitement du mode clair
  (cartes, espaces blancs, hiérarchie typographique).
- **Référence n°3 (« Landing premium dark »)** = traitement du Hero et des
  zones « terminal financier » en mode sombre.
- **Référence n°4** = comparatif informatif seulement, pas une direction à
  suivre isolément.

**Règle explicite de l'utilisateur, reprise ici** : ces images guident la
hiérarchie, la composition, le traitement du Hero, la structure des cartes,
le contraste et la place du footer — **pas** le contenu. Le logo utilisé
dans les images générées (carré « W ») n'est PAS le vrai logo WESTBOURSE et
ne doit jamais remplacer `AnimatedLogo` (§3). Tout chiffre, cours, note ou
diagnostic visible dans une référence doit être remplacé par le composant et
la donnée réels quand ils existent (c'est le cas pour la quasi-totalité des
sections, voir §2).

---

## 11. Direction artistique (Phase 4) — réutilisation des tokens existants

Aucun nouveau token de couleur ou de typographie n'est nécessaire : le
système existant (`frontend/tailwind.config.ts` + `globals.css`) couvre déjà
ce que le mandat demande.

- **Couleurs** : `bg`/`surface`/`elevated` (surfaces), `accent`/`gold`
  (alias du même cyan `#56d7fd` — nom historique « gold » à ne pas prendre au
  pied de la lettre, ce n'est pas un doré littéral), `gold-2` (nuance
  secondaire du même accent), `up`/`down` (vert/rouge sémantiques),
  `ivory`/`muted`/`faint` (hiérarchie de texte). **Nuance de marque à
  documenter, pas à corriger dans cette refonte** : le logo réel
  (`AnimatedLogo`) utilise un navy `#0c1d2e` + un teal `#16b6a4` légèrement
  différents de l'accent cyan `#56d7fd` du reste du site — deux familles de
  couleur cohabitent déjà aujourd'hui (logo vs. UI). Unifier ces deux teintes
  serait un changement de identité de marque plus large que « refonte de
  hiérarchie visuelle » — hors périmètre de ce mandat sauf demande explicite.
- **Typographie** : `font-display` (titres éditoriaux, serif), `font-sans`
  (texte courant), `font-mono` (`.tabular`, JetBrains-like pour les
  chiffres) — correspond exactement à la hiérarchie voulue par le mandat
  (« typographie éditoriale pour les titres, sans-serif lisible pour les
  données, tabulaire pour les chiffres financiers »). Échelle déjà définie :
  `display-xl`/`display-lg`/`heading-lg/md/sm`/`body-md/sm`/`mono-lg/sm`/
  `overline`.
- **Radius/ombres/espacements** : `rounded-panel`/`rounded-card`,
  `shadow-panel`/`shadow-card`/`shadow-gold`, `spacing.section/card/gutter` —
  déjà cohérents sur l'ensemble du site, à réutiliser tels quels.

**Conclusion** : la Phase 4 du mandat est déjà satisfaite par le design
system existant. Le travail de refonte est un travail de **composition et de
hiérarchie**, pas de fondation visuelle nouvelle.

---

## 12. Nouvelle architecture recommandée (Phase 5) — mapping section par section

Pour chacune des 18 sections du mandat, statut réel et action recommandée.
« Réutiliser » signifie : même composant, même données, retouche de style
seulement. « Restructurer » signifie : mêmes données, nouvelle disposition/
composition visuelle. « Créer » signifie : section absente aujourd'hui,
nouveau composant nécessaire, mais alimenté exclusivement par des données ou
routes déjà réelles (jamais de contenu inventé).

| # | Section du mandat | Statut réel | Action |
|---|---|---|---|
| 01 | Header | `TasteTopbar` déjà conforme | Réutiliser |
| 02 | Market ticker | `TasteTopbar` (ticks) + `NewsTicker` déjà séparés du menu | Réutiliser |
| 03 | Hero | Existe (`HeroSpotlight`, photo + carte) mais traitement visuel à l'opposé du mandat | **Restructurer** — remplacer photo/carte par un mockup de la vraie interface (BRVM-C, top variations, diagnostic, note A–F), en conservant les `ticks` réels déjà calculés |
| 04 | Trust/Data bar | `ProofBand` existe, 2 chiffres sur 4 non branchés | Réutiliser + **corriger** (brancher `nbActions`/`volumeTotal`) |
| 05 | Marché en direct | Existe (bloc inline + `LandingIndices`), disposition 2 colonnes plutôt que 4 cartes | Restructurer en grille de cartes (Top hausses / BRVM-C / Top baisses / Indices), mêmes données |
| 06 | Heatmap | `LandingHeatmap` déjà conforme à l'esprit du mandat | Réutiliser, mise en valeur visuelle (taille, emplacement) seulement |
| 07 | Outils (grille par catégorie) | N'existe pas sous cette forme — `AppPreview` s'en approche (6 cartes) sans la taxonomie ANALYSER/COMPRENDRE/SIMULER-SUIVRE/COMPARER | **Créer** — nouveau composant, liens vers routes réelles uniquement (voir §13, liste vérifiée) |
| 08 | Note A–F (spotlight) | N'existe pas comme section dédiée | **Créer** — utiliser `RatingBadge` + les vrais champs `SignalDaily` (voir risque §8.11), jamais les libellés des maquettes |
| 09 | Diagnostic IA (spotlight) | N'existe pas comme section dédiée | **Créer** — voir §13 pour la contrainte de coût/perf (ne pas régénérer un diagnostic IA à chaque visite de la landing) |
| 10 | Simulateur | Existe, conforme | Réutiliser |
| 11 | SGI | Existe (bandeau inline), conforme dans l'esprit | Réutiliser, restyle optionnel |
| 12 | Brief quotidien | Existe, conforme | Réutiliser |
| 13 | Premium (Gratuit vs Premium) | N'existe pas comme comparatif — une seule carte parmi trois | **Créer** — alimenter depuis `subscription_plans` (même source que `/pricing`), jamais une liste d'avantages dupliquée à la main |
| 14 | Communauté | `SocialProof` existe | Réutiliser — le chiffre « 2 000+ » reste une constante éditoriale (déjà le cas aujourd'hui), à faire confirmer par l'utilisateur si le nombre a changé, pas à romancer davantage |
| 15 | Newsletter | `NewsletterForm` existe, fonctionnel | Réutiliser, restyle seulement |
| 16 | FAQ | `LandingFaq` existe | Réutiliser, restyle seulement — **toute modification du texte doit être répercutée dans le JSON-LD `FAQPage` de `layout.tsx`** (risque §8.9) |
| 17 | CTA final | Existe, texte déjà identique au mandat (« Votre prochaine décision mérite mieux qu'une intuition ») | Réutiliser tel quel, aucun changement de contenu nécessaire |
| 18 | Footer | `Footer.tsx` existe, structure déjà proche du mandat (Produit/Légal/Compte + disclaimer) | Réutiliser structure ; **corriger au passage** le bug réel des liens sociaux (`href="#"` ×5, risque §8.7) si l'utilisateur fournit les vraies URLs — sinon laisser tel quel, hors périmètre visuel pur |

---

## 13. Composants à créer

Trois nouveaux composants, tous alimentés par des données ou routes déjà
réelles :

1. **Grille d'outils par catégorie** (section 07) — 4 groupes
   (ANALYSER/COMPRENDRE/SIMULER-SUIVRE/COMPARER), chaque lien vérifié contre
   les routes réelles de `frontend/app/` : Screener → `/screener`, RSI/MACD
   → fiche société `/actions/[code]` (pas de route dédiée séparée), Note A–F
   → `/notations` ou `/societes`, Dividendes → `/dividendes`, Diagnostic IA →
   `/premium/diagnostic`, Brief → `/brief`, Actualités → `/actualites`,
   Analyses → `/analyses`, Conseiller unifié → `/conseiller`, Simulateur →
   `/simulateur`, Paper trading → `/premium/paper-trading`, Alertes →
   `/parametres/alertes`, SGI → `/comparateur-sgi`, Obligations →
   `/obligations`, Matières premières → `/weekly`, Liquidité → `/liquidite`.
   **Un lien reste à vérifier avant implémentation** : « Watchlist » n'a pas
   de route dédiée trouvée (`/portefeuille` et `/dashboard` sont les
   candidats les plus proches) — à confirmer en lisant le composant
   concerné avant de le lier, plutôt que d'inventer `/watchlist`.
2. **Spotlight Note A–F** (section 08) — un exemple réel (ex. une action
   suivie), `RatingBadge` + décomposition réelle
   `score_variation`/`score_volume`/`score_rsi`/`bonus_tendance`/
   `penalite_liquidite` avec leurs vrais libellés (pas ceux des maquettes),
   lien vers `/notations` ou `/societes`.
3. **Spotlight Diagnostic IA** (section 09) — **contrainte de coût/perf à
   trancher avant implémentation** : le vrai Diagnostic IA
   (`/api/diagnostic/[code]`) appelle une cascade LLM payante en streaming
   (DeepSeek→Mistral, voir `docs/ADMIN_BILLING.md`) — le régénérer à chaque
   chargement de la landing publique serait un coût et une latence
   inacceptables sur une page à fort trafic anonyme. Deux options réalistes,
   à valider avec l'utilisateur au moment du build : (a) afficher un exemple
   figé, construit à partir d'un vrai rapport `diagnostic_reports` existant
   en base (donnée réelle, mais non régénérée à la volée), avec une mention
   explicite « exemple réel, votre analyse est personnalisée » ; (b) ne
   montrer qu'un teaser visuel (mise en page du composant réel avec labels
   Forces/Risques/Signal/Confiance) sans texte généré, renvoyant vers
   `/premium/diagnostic` pour l'analyse réelle. Aucune des deux n'invente de
   texte analytique — la différence est juste la fraîcheur de l'exemple.
4. **Comparatif Gratuit vs Premium** (section 13) — lit `subscription_plans`
   (même requête que `/pricing`), affiche les fonctionnalités réellement
   marquées par plan en base, pas une liste éditoriale statique dupliquée.

---

## 14. Composants à modifier

- `frontend/components/landing/HeroSpotlight.tsx` — remplacement du
  traitement visuel (photo + carte → mockup d'interface), **en conservant**
  les props `dateLabel`/`ticks` et le CTA `HeroPulseCTA` existant.
- `frontend/components/landing/ProofBand.tsx` — brancher les 2 chiffres
  actuellement en dur sur `nbActions`/`volumeTotal` déjà calculés dans
  `page.tsx` (nécessite de faire remonter ces props, aujourd'hui non
  transmises à `ProofBand`).
- `frontend/app/page.tsx` — réorganisation de la disposition du bloc
  « Marché en direct » (2 colonnes → grille de 4 cartes), insertion des 3
  nouveaux composants créés, sans toucher à `getData()`/`getCachedData()`
  (risque §8.6 — ne rien y ajouter qui dépende de l'utilisateur connecté).

---

## 15. Composants à NE PAS modifier

Ces composants sont déjà conformes à l'esprit du mandat et présentent un
risque de régression documenté (§8) s'ils sont touchés sans précaution :

- `frontend/components/landing/LandingHeatmap.tsx` et
  `frontend/lib/heatmapData.ts` (`loadHeatmap`) — logique partagée avec
  `/heatmap`, ne jamais diverger.
- `frontend/lib/simulate.ts` (`simulateInvestment`) et le bloc simulateur de
  `page.tsx` — calcul réel documenté, pas un exemple.
- `frontend/lib/sgi-frais/queries.ts` (`getSgiDirectory`) et le calcul de
  `sgiCount`/`sgiPaysLines` — jamais remplacer par un texte figé.
- `frontend/components/RatingBadge.tsx`, `frontend/components/AnimatedLogo.tsx`
  (`frontend/components/brand/AnimatedLogo.tsx`) — composants partagés avec
  le reste du site, aucune raison de les modifier pour cette refonte.
- `frontend/app/layout.tsx` (script anti-flash thème, JSON-LD, montage
  `ConsentProvider`) — transverse à tout le site, hors périmètre landing.
- Couleurs littérales fixes du Hero et du Footer (§5, §8.8) — comportement
  assumé, pas un bug à corriger silencieusement.

---

## 16. Stratégie responsive (Phase 7)

Comme documenté en §7, la couverture responsive actuelle est déjà bonne
(breakpoints Tailwind cohérents, `clamp()` pour la typographie fluide). La
stratégie pour la refonte est donc : **préserver au moins le même niveau de
couverture par section**, en particulier pour les 3 nouveaux composants
(§13) qui devront suivre le même pattern `grid-cols-1` → `md:`/`lg:` déjà
utilisé partout ailleurs sur la page. Aucune section existante identifiée
comme mal gérée en mobile aujourd'hui (seul point à vérifier au build : le
comportement du treemap `LandingHeatmap` en mobile, composant lazy non
ouvert pendant cet audit — voir §7).

## 17. Stratégie SEO (Phase 8, volet SEO)

Aucun changement structurel nécessaire : `metadata`, `opengraph-image.tsx`,
`sitemap.ts`, `robots.ts` et le JSON-LD restent valables tant que le contenu
textuel de la FAQ et le titre/description de `page.tsx` ne changent pas de
sens. Point de vigilance unique et déjà identifié (§8.9) : si le texte de la
FAQ est retouché visuellement avec un nouveau contenu, répercuter le
changement dans le bloc `FAQPage` du JSON-LD de `layout.tsx`.

## 18. Stratégie performance (Phase 8, volet performance)

- Le mécanisme de cache existant (`unstable_cache` 5 min sur `getData`) doit
  rester la seule source de données côté serveur pour tout ce qui est
  public — voir contrainte §8.6.
- Le nouveau Hero (mockup d'interface) ne doit pas ajouter de nouvelle
  requête réseau/Supabase : il doit consommer les `ticks` déjà calculés dans
  `getData()`, pas recalculer.
- Le spotlight Diagnostic IA (§13.3) ne doit **jamais** déclencher un appel
  LLM en temps réel sur une visite anonyme — c'est la contrainte de
  performance/coût la plus critique de toute cette refonte.
- `next/image` est déjà utilisé pour la photo hero actuelle (AVIF/WebP,
  `priority`, `quality={70}`) — si le nouveau Hero conserve une image
  d'arrière-plan (device frame, texture), appliquer la même discipline.

## 19. Plan de tests (Phase 8, volet plan de tests)

- **Fonctionnels** : chaque lien de la nouvelle grille d'outils (§13.1) doit
  être testé manuellement pour confirmer qu'il pointe vers une route qui
  existe réellement (liste à vérifier une dernière fois au moment du build,
  en particulier « Watchlist »).
- **Données** : comparer visuellement `nbActions`/`sgiCount`/heatmap/
  simulateur avant/après refonte pour confirmer que les mêmes chiffres
  s'affichent (aucune divergence de valeur, seulement de mise en page).
- **Non-régression** : `npx tsc --noEmit` (frontend) après chaque
  modification de composant ; vérification visuelle du mode clair ET sombre
  pour chaque section touchée (le mode clair est réel, §5) ; vérification
  que le JSON-LD `FAQPage` reste synchronisé si la FAQ est retouchée.
- **Preview isolée** (Phase 10) : la route `/landing-preview` doit être
  testée indépendamment de `/`, avec les mêmes données réelles, avant toute
  bascule.

## 20. Plan de rollback (Phase 8, volet rollback)

La stratégie de preview isolée (route séparée, aucune modification de
`frontend/app/page.tsx` avant validation explicite) rend le rollback trivial
tant que l'implémentation reste en Phase 10 : supprimer la route
`/landing-preview` et les nouveaux composants ne touche à rien de
production. Une fois la bascule effective décidée (Phase 13 du mandat,
après validation), le rollback redevient un rollback Git standard (revert
du commit de bascule) — aucune migration de données n'est impliquée dans
cette refonte (uniquement du code frontend et de la mise en page).

## 21. Estimation de complexité par composant

| Composant | Complexité | Justification |
|---|---|---|
| Hero (mockup d'interface) | **HIGH** | Refonte visuelle complète, doit rester fidèle aux vraies données, nécessite un travail de composition (device frame + vraies mini-cartes) |
| Grille d'outils par catégorie | MEDIUM | Nouveau composant mais purement de la mise en page + liens, aucune nouvelle donnée |
| Spotlight Note A–F | MEDIUM | Nouveau composant, données déjà disponibles (`SignalDaily`), mais nécessite un choix éditorial sur les libellés réels (§8.11) |
| Spotlight Diagnostic IA | **HIGH** | Nouveau composant + décision produit non triviale sur la fraîcheur de l'exemple (§13.3), risque de coût si mal implémenté |
| Comparatif Gratuit/Premium | MEDIUM | Nouveau composant, mais lit une table déjà utilisée par `/pricing` (`subscription_plans`) |
| ProofBand (branchement données réelles) | LOW | Props déjà calculées dans `page.tsx`, juste à transmettre |
| Bloc « Marché en direct » (restructuration en cartes) | MEDIUM | Même données, nouvelle disposition en grille |
| Heatmap, Simulateur, SGI, Brief, FAQ, Newsletter, CTA final, Footer | LOW | Réutilisation quasi telle quelle, retouche de style uniquement |

---

**Phase 9 (production du document) : terminée.** Prochaine étape : Phase 10
— construire une preview isolée (`/landing-preview` ou équivalent non
publique), sans toucher à `frontend/app/page.tsx` ni à aucun composant de
production, puis Phase 11 (comparaison avant/après), puis Phase 12 (arrêt
et présentation pour validation).
