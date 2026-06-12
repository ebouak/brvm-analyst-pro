# Audit du corps du site (hors Dashboard) — réorganisation, style, technique

**Date :** 2026-06-12 · **Méthode :** uiux-pro-max (7 axes) + revue d'architecture
**Périmètre :** toutes les pages sauf `/dashboard` (29 routes membres + 3 publiques)

---

## 1. Constat global

Le site a grandi par accrétion : **3 calendriers, 2 outils de filtrage concurrents, 3 entrées « rapports », 1 page orpheline** et un groupe Premium dilué en 9 entrées dont 5 squelettes (< 100 lignes). La navigation compte **29 entrées** — un nouvel utilisateur ne sait pas où aller. À l'inverse, les pages publiques récentes (sociétés, simulateur, brief) sont **invisibles pour les membres connectés**.

Côté technique, **tout le site est en `force-dynamic`** : zéro cache, chaque visite re-frappe Supabase, alors que les données changent au plus toutes les 15 minutes.

---

## 2. P0 — Architecture de l'information (le vrai problème)

### 2.1 Doublons à fusionner

| Doublon | Pages concernées | Proposition |
|---|---|---|
| **Filtrage** | `/scanner` (228 l.) + `/screener` (156 l.) | Fusionner dans **/screener** (le plus récent, audité a11y). Le scanner devient un préréglage « Signaux techniques » du screener. Redirection 301. |
| **Backtest** | `/backtest` (406 l.) + `/premium/backtesting` (67 l. — squelette) | Garder **/backtest**, supprimer le squelette premium (rediriger). Le gating premium se fait sur les fonctionnalités avancées dans la page, pas par une 2ᵉ page. |
| **Calendriers ×3** | `/calendrier` + `/dividendes/calendrier` + `/premium/calendrier` (« Dates clés ») | Un seul **/calendrier** avec filtres (Dividendes · Résultats · Assemblées · Dates clés premium). Redirections. |
| **Rapports ×3** | `/reports` (163 l., **orphelin — absent de la nav**) + `/dashboard/reports` + `/premium/reports` | Un hub **/reports** à onglets : « Mes rapports », « Générer », « Mensuels (premium) ». |

### 2.2 Pages orphelines / mal rangées

- **`/actualites` est absente de la nav** → inaccessible au menu alors que le scraper l'alimente quotidiennement. À ajouter au groupe Marché.
- **`/methodologie` rangée dans « Admin »** → c'est une page de confiance utilisateur ; la déplacer en pied de sidebar (avec Mentions légales).
- **Groupe « Admin » visible dans la nav commune** → à n'afficher que pour le super-admin (filtrage sur l'email dans Sidebar).
- **Pages publiques** (Sociétés · Simulateur · Brief) : ajouter un groupe « Découverte » en bas de sidebar — les membres sont les meilleurs partageurs du simulateur.

### 2.3 Navigation cible (29 → 21 entrées)

```
MARCHÉ      Dashboard · Actions · Obligations · Secteurs · Heatmap · Actualités
ANALYSE     Signaux · Screener · Fondamentaux · Notations · Backtest
REVENUS     Dividendes · Calendrier
GESTION     Portefeuille · Paper Trading · Rapports
PREMIUM     Diagnostic IA · Assistant IA · Classements & Anomalies · Outils Pro
DÉCOUVERTE  Sociétés · Simulateur · Brief          (liens publics)
─────────   Méthodologie · Paramètres              (pied de sidebar)
ADMIN       (super-admin uniquement)
```

Fusion également proposée : `/premium/classements` (79 l.) + `/premium/anomalies` (96 l.) + `/premium/correlations` (68 l.) → une page **« Radar premium »** à onglets (3 squelettes → 1 page substantielle).

---

## 3. P1 — Technique

### 3.1 Cache : sortir du tout-`force-dynamic`
Les données marché changent toutes les 15 min (intraday). Pages à passer en **ISR `revalidate = 300`** (5 min) : `/actions`, `/signaux`, `/secteurs`, `/heatmap`, `/obligations`, `/dividendes`, `/actualites`, `/fondamentaux`, `/notations`, `/actions/[code]`.
Restent dynamiques (user-scopé) : portefeuille, paramètres, reports, premium/*, admin/*.
**Gain : TTFB divisé par 5-10 sur les pages chaudes + réduction drastique des requêtes Supabase.**
⚠️ Prérequis : remplacer `createClient()` (cookies → force dynamic) par `createPublicClient()` sur ces pages — les tables lues sont déjà en RLS lecture publique.

### 3.2 Surfetch
- `/signaux` : `select('*')` sur signals_daily + **table instruments entière** à chaque visite → sélectionner les colonnes utilisées, et joindre secteur/pays depuis la requête actions (déjà chargée).
- `/actualites` : `limit(100)` sans pagination → pagination « charger plus » ou par mois.

### 3.3 Monolithes à découper (maintenabilité)
| Page | Taille | Découpage proposé |
|---|---|---|
| `/actions/[code]` | ~900 l. | `InstrumentHeader`, `SignalPanel`, `FundamentalsSection`, `EventsSection` (déjà partiellement composants — finir l'extraction) |
| `/portefeuille` | 666 l. | `PositionsTable`, `PerformancePanel`, `MovementsHistory` |
| `/backtest` | 406 l. | `BacktestForm`, `BacktestResults`, `EquityChart` |

### 3.4 Divers
- `metadataBase` absent du layout racine → warnings OG ; à ajouter (`NEXT_PUBLIC_SITE_URL`).
- Loading states : vérifier `loading.tsx` sur actions/signaux/screener (skeletons du kit premium).

---

## 4. P1 — Style / cohérence

1. **Texte développeur exposé aux utilisateurs** : l'état vide de `/actualites` affiche « `npm run news` dans le scraper pour alimenter le fil ». À remplacer partout par un message utilisateur (« Le fil se met à jour automatiquement chaque jour ouvré. »). **Greper `npm run` dans app/ et purger.**
2. **Tokens divergents** : `/actualites` (et d'autres pages de la même génération) utilisent `text-cyan`, `border-cyan/30`, `text-gold` là où les pages récentes utilisent `accent`. Choisir **`accent`** comme alias canonique et migrer (cyan/gold restent des alias de compat dans tailwind.config).
3. **Dates brutes** : `/actualites` affiche `2026-06-12` au lieu de `fmtDateFR()`. Auditer les `date_marche`/`date_publication` rendus sans formatage.
4. **`transition` nu** → `transition-colors` (perf + cohérence avec l'audit screener déjà fait).
5. **Note A–F absente du corps du site** : intégrer `<RatingBadge>` dans `/actions` (tableau), `/signaux` et `/screener` — c'est la signature produit, elle doit être partout où il y a un score.

## 5. P2 — Backlog

- Heatmap : cliquer une tuile → fiche société publique (lien de partage).
- `/secteurs` : ajouter la performance sectorielle 30 j (données déjà en base).
- `/notations` : croiser note agence (Bloomfield/GCR) avec la note BRVM A–F sur une même vue.
- Breadcrumbs JSON-LD sur les pages publiques.
- `/assistant` (46 l.) : soit le brancher réellement (cascade LLM existante), soit le retirer de la nav tant qu'il est vide.

---

## 6. Ordre d'implémentation recommandé

1. **Nav cible + redirections** (2.1–2.3) — impact immédiat, risque faible
2. **Purge textes dev + dates FR + tokens** (4.1–4.4) — mécanique
3. **ISR + createPublicClient sur pages marché** (3.1) — gros gain perf
4. **RatingBadge partout** (4.5)
5. **Fusion Radar premium** + hub Rapports
6. Découpage des monolithes (au fil des prochaines retouches de ces pages)

Chaque lot = un commit déployable indépendamment.
