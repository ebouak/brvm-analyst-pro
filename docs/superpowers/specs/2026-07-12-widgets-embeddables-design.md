# Widgets embeddables BRVM — Design

**Date** : 2026-07-12 · **Statut** : validé (user) · **Approche retenue** : A (iframe)

## 1. Objectif

Permettre aux médias économiques ivoiriens/UEMOA et aux blogs financiers
d'intégrer des données BRVM en direct sur leur site en copiant un `<iframe>`.
Chaque widget affiche un lien retour vers WESTBOURSE → **backlinks** (SEO) et
notoriété. Aucun concurrent régional ne le propose.

## 2. Socle existant (à ne pas refaire)

- **API publique v1 opérationnelle** : `/api/public/v1/actions`, `/indices`,
  `/obligations` — CORS déjà ouvert (`Access-Control-Allow-Origin: *`),
  rate-limit best-effort (`lib/publicApi.ts`), ISR 300 s.
- Page **`/developers`** documentant l'API (socle de la doc widgets).
- Client Supabase **anon public** (`lib/supabase/public.ts`) : RLS lecture
  publique sur les tables marché.

## 3. Contrainte structurante : la CSP bloque l'embarquement

`next.config.js` envoie aujourd'hui, sur **toutes** les routes :
`frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`.
→ Un tiers **ne peut pas** embarquer le site. C'est le blocage n°1.

**Correctif ciblé (chirurgical)** :
1. La règle stricte actuelle passe de `source: '/(.*)'` à
   `source: '/((?!embed).*)'` — tout le site garde `frame-ancestors 'self'`
   et `X-Frame-Options: SAMEORIGIN` (anti-clickjacking **intact**).
2. Nouvelle règle `source: '/embed/:path*'` : CSP avec `frame-ancestors *`
   et **aucun `X-Frame-Options`** (l'en-tête legacy prime sur la CSP dans les
   navigateurs : le laisser annulerait l'ouverture).

**Analyse de risque** : les pages `/embed/*` sont en lecture seule, sans
session, sans formulaire, sans action mutative → le clickjacking n'a rien à
détourner. Risque accepté et documenté.

## 4. Les 3 widgets (V1)

| Route | Contenu | Hauteur conseillée |
|---|---|---|
| `/embed/ticker` | Bandeau des cours qui défile (code, cours, variation colorée) | 56 px |
| `/embed/heatmap` | Grille des variations du jour (toutes les actions) | 420 px |
| `/embed/valeur/[code]` | Carte d'une valeur : cours, variation, volume, sparkline 30 j | 180 px |

**Paramètres d'URL** (tous optionnels) :
- `?theme=dark` (défaut) `| light`
- `?codes=SNTS,ETIT,SGBC` (ticker uniquement — défaut : toutes les actions)

## 5. RGPD / sécurité — non négociable

Les pages `/embed/*` sont **sans cookie, sans analytics, sans session** :
- client Supabase **anon** uniquement (aucun cookie d'auth) ;
- **pas** de bandeau consentement, **pas** de PostHog/Sentry côté client ;
- aucune donnée personnelle traitée (données de marché publiques).

→ Un média peut les intégrer sans déclencher d'obligation de consentement
chez lui. C'est l'argument commercial autant que la règle technique.

Implémentation : les routes `/embed/*` sont rendues **hors du shell applicatif**
(ajout à `BARE_PREFIXES` de `ConditionalShell`) et les composants clients de
tracking/consentement sont exclus sur ce préfixe.

## 6. Architecture

```
app/embed/layout.tsx          → layout minimal (fond transparent/opaque, pas de chrome)
app/embed/ticker/page.tsx     → server component, ISR 300 s
app/embed/heatmap/page.tsx    → server component, ISR 300 s
app/embed/valeur/[code]/page.tsx → server component, ISR 300 s
components/embed/EmbedFrame.tsx  → coque commune (thème, lien retour « Données · WESTBOURSE »)
components/embed/TickerStrip.tsx → défilement CSS pur (pas de JS, respecte prefers-reduced-motion)
lib/embed/theme.ts            → parse `theme`/`codes` (fonction pure + tests)
```

Les pages lisent **directement Supabase (anon)** plutôt que d'appeler notre
propre API en HTTP : moins de latence, pas de dépendance réseau interne.

## 7. Distribution

Section « Widgets » sur `/developers` : aperçu live de chaque widget + le code
`<iframe>` à copier (bouton copier), avec les hauteurs conseillées et la liste
des paramètres. Chaque widget porte le lien retour (backlink `dofollow`).

## 8. Erreurs & états vides

Aucune séance / code inconnu → la carte affiche « Données indisponibles » avec
le lien WESTBOURSE (jamais d'iframe blanche : un widget cassé chez un média est
pire que pas de widget).

## 9. Tests

- `lib/embed/theme.test.mjs` : parsing `theme` (valeur inconnue → dark) et
  `codes` (liste vide, casse, codes inconnus filtrés).
- Vérification manuelle : page HTML locale hors origine embarquant les 3 iframes
  → doit s'afficher (prouve que la CSP est bien ouverte sur `/embed` seulement),
  et un `<iframe src="/dashboard">` depuis la même page HTML → doit **rester
  bloqué** (prouve que l'anti-clickjacking du reste du site est intact).

## 10. Hors périmètre V1

Widget script/Web Component (approche B), auto-resize par `postMessage`, clés
d'API par partenaire, statistiques d'affichage par média, widget obligations.
