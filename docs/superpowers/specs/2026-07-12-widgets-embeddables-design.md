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
- `?lang=fr` (défaut) `| en` — libellés (Variation, Volume, « Données
  indisponibles »). La presse panafricaine anglophone est une cible réelle.
- `?codes=SNTS,ETIT,SGBC` (ticker uniquement — défaut : toutes les actions).
  **Plafonné à 20 codes** : sans borne, un tiers peut faire exploser la requête.

### 4.1 Fraîcheur sans JavaScript

Un média laisse sa page ouverte toute la journée → l'iframe se figerait.
Solution retenue : **`<meta http-equiv="refresh" content="300">`** dans les pages
embed. L'iframe se recharge seule toutes les 5 min, alignée sur l'ISR, en **pur
HTML**. Pas de polling, pas de squelette de chargement, pas de flash de contenu
vide (le HTML suivant arrive déjà rendu par le serveur).

*(Alternative écartée : polling client + skeleton — introduit du JS et un état
de chargement pour un bénéfice nul.)*

### 4.2 Hauteur automatique (facultative)

Les hauteurs conseillées seront oubliées par certains intégrateurs → iframe
tronquée. Chaque page embed publie donc sa hauteur au parent :

```js
new ResizeObserver(([e]) =>
  parent.postMessage({ type: 'wb-resize', height: e.contentRect.height }, '*')
).observe(document.body);
```

L'iframe **fonctionne sans ce mécanisme** (hauteur fixe). Le snippet hôte
documenté sur `/developers` doit **valider l'origine** — sans ce contrôle,
n'importe quelle iframe de leur page pourrait redimensionner la nôtre :

```js
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://westbourse.com') return;   // ← obligatoire
  if (e.data?.type !== 'wb-resize') return;
  document.getElementById('wb-widget').style.height = e.data.height + 'px';
});
```

### 4.3 Partage : titre et OG dynamiques

Un journaliste colle l'URL du widget dans Slack/X → aperçu vide aujourd'hui.
Les pages embed portent un `<title>` et des `og:title`/`og:description`
**dynamiques** (ex. « SNTS · 12 450 FCFA +1,4 % · WESTBOURSE »).
*Hors V1 : `og:image` dynamique (nécessite une route de génération d'image ;
l'OG statique du site est réutilisée).*

### 4.4 Anti-abus

`/embed/valeur/[code]` avec un code arbitraire génèrerait des pages ISR sans
limite. Le code est **validé contre le référentiel `brvm_instruments`** ;
inconnu → page statique « données indisponibles », **sans requête base**.

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
app/embed/layout.tsx             → layout minimal : pas de chrome, pas de consentement,
                                   pas d'analytics ; meta refresh 300 s (§4.1)
app/embed/ticker/page.tsx        → server component, ISR 300 s
app/embed/heatmap/page.tsx       → server component, ISR 300 s
app/embed/valeur/[code]/page.tsx → server component, ISR 300 s, code validé (§4.4)
components/embed/EmbedFrame.tsx  → coque commune (thème, lien retour + UTM)
components/embed/TickerStrip.tsx → défilement CSS PUR (aucun useEffect — cf. T3)
components/embed/AutoHeight.tsx  → ResizeObserver → postMessage (facultatif, §4.2)
lib/embed/params.ts              → parse theme/lang/codes (fonctions pures + tests)
lib/embed/i18n.ts                → libellés fr/en (map simple, pas de lib i18n)
```

Les pages lisent **directement Supabase (anon)** plutôt que d'appeler notre
propre API en HTTP : moins de latence, pas de dépendance réseau interne.

## 7. Distribution

Section « Widgets » sur `/developers` : aperçu live de chaque widget + le code
`<iframe>` à copier (bouton copier), les hauteurs conseillées, les paramètres,
et le snippet d'auto-hauteur facultatif (§4.2).

**Les snippets générés incluent obligatoirement `title` sur l'iframe**
(WCAG 2.1 § 4.1.2 + critère Lighthouse) — sans lui, c'est le score
d'accessibilité du média partenaire qui chute, et notre widget qu'on accuse :

```html
<iframe title="Cours SNTS — WESTBOURSE" src="https://westbourse.com/embed/valeur/SNTS"
        width="100%" height="180" frameborder="0" loading="lazy"></iframe>
```

**Backlink** : chaque widget porte le lien retour `dofollow` vers WESTBOURSE,
suffixé `?utm_source=widget&utm_medium=embed&utm_campaign=brvm-widget` pour
mesurer le ROI de la stratégie (clics réellement issus des widgets).

> ⚠️ **Dépendance à documenter** : l'UTM crée une URL distincte de la canonique.
> C'est sans effet sur le SEO **tant que la page d'atterrissage porte un
> canonical auto-référent** (assuré aujourd'hui par `metadataBase` de Next). Si
> ce canonical saute un jour, les UTM diluent le jus des backlinks.

## 8. Erreurs & états vides

Aucune séance / code inconnu → la carte affiche « Données indisponibles » avec
le lien WESTBOURSE (jamais d'iframe blanche : un widget cassé chez un média est
pire que pas de widget).

## 9. Tests

**Unitaires** — `lib/embed/params.test.mjs` (fonctions pures) : `theme`
(inconnu → dark), `lang` (inconnu → fr), `codes` (liste vide, casse, plafond de
20, codes inconnus filtrés).

**T1 — CSP : ouverture ET confinement (le test qui compte).**
Une page HTML servie **hors origine** embarque les 3 widgets *et* `/dashboard` :

- les 3 `/embed/*` **s'affichent** → l'ouverture fonctionne ;
- `/dashboard` **reste bloqué** → l'anti-clickjacking du reste du site est intact.

**T2 — RLS : sonde d'écriture inoffensive.**
Avec la **clé anon** (déjà publique dans le JS du site — les widgets n'ajoutent
aucune surface), tenter un `PATCH` sur `brvm_actions_daily` avec un filtre qui
**ne matche rien** (`?code=eq.__PROBE__`) :

- attendu : **401/403** (RLS refuse l'écriture) ;
- si 200 : **P0** — mais aucune donnée n'a été salie (0 ligne concernée), c'est
  tout l'intérêt d'un `WHERE` vide. Ne **jamais** sonder par un vrai INSERT.

**T3 — Rendu sans JavaScript.**
Charger `/embed/ticker` avec JS désactivé : le contenu et le **défilement**
doivent fonctionner (animation CSS pure — aucun `useEffect`). Garantit le rendu
chez les agrégateurs et robots. Seule l'auto-hauteur (§4.2) requiert JS, et son
absence ne casse rien.

## 10. Hors périmètre V1

Widget script/Web Component (approche B) · `og:image` dynamique (route de
génération d'image) · clés d'API par partenaire · statistiques d'affichage par
média (les métriques d'audience se liront côté serveur/CDN, jamais par un
traceur client — cf. §5) · widget obligations · version EN complète du site
(le `?lang=en` des widgets n'est qu'une map de libellés, pas de l'i18n).
