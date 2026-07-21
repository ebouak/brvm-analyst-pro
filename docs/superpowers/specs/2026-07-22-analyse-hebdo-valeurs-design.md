# Analyse hebdomadaire des valeurs en vogue

**Date** : 2026-07-22 · **Statut** : approuvé (brainstorming)

Décisions utilisateur : narratif **hybride** (squelette déterministe + reformulation LLM
des liaisons) · sélection **auto 3-5 valeurs** multi-critères avec **override manuel** en
admin · publication **page publique SEO + image OG + PNG haute-rés téléchargeable** ·
**auto-publication directe** le vendredi **avec alerte** (canaux existants) pour révision/
dépublication a posteriori · PNG = **carte satori soignée** (copie pixel du double-graphe
annoté = phase 2 optionnelle).

## 1. Principe directeur : honnêteté des données

Contrairement à l'exemple ETIT (marqué « illustratif »), **tout dérive du réel** :

- Courbe = clôtures réelles de `brvm_actions_daily` (la BRVM ne publie que la clôture →
  courbe + RSI, jamais de bougies inventées).
- RSI(14) = `rsiSeries(closes)` ; MACD, MA20/MA50 = indicateurs réels (`lib/indicators.ts`).
- Niveaux support/résistance/cassure = `detect(closes)` (champs `breakoutUp/Down`, bornes
  `hi`/`lo` du canal 20 séances) — **jamais un niveau saisi à la main**.
- Chiffres du narratif = calculés. Chaque édition affiche « Analyse technique sur données
  réelles au [date] » + disclaimer (pas « illustratif »).

## 2. Sélection — `frontend/lib/hebdo/select.ts` (PUR, testé)

`selectHebdo(rows, opts)` : à partir des lignes de séance de la semaine + historique par
titre, score chaque code sur quatre axes et retient 3 à 5 valeurs.

- **Entrée** : `{ code, closesSemaine, closesHistorique, volume, avgVolume20, variationHebdo }[]`.
- **Score de notabilité** = combinaison de : |variation hebdo|, ratio volume/avgVolume20
  (≥ 2 = anormal), cassure (`detect().breakoutUp || breakoutDown`), changement de signal.
- **Règles** : dédupliqué ; plafonné à 5 ; **au moins une baisse** garantie si au moins un
  titre a baissé sur la semaine (honnêteté — pas que du haussier) ; ignore les titres sans
  assez d'historique (< 30 séances) ou non traités.
- **Sortie** : `{ code, sens: 'hausse'|'baisse', raison: string, score: number }[]`.
- Fonction pure : aucune I/O, testable avec des fixtures.

## 3. Narratif hybride — `frontend/lib/hebdo/narrative.ts`

### 3.1 Squelette déterministe (pur, testé)

`buildSkeleton(metrics)` → `{ sections: {titre, texte}[], niveaux, verdict, chiffres }`.
Chaque section dérive d'une métrique, façon `technicalSummary.ts` :

- **Signal** : régime MA20/MA50 + succession de plus hauts.
- **Momentum** : valeur RSI (zones 70/30 nommées) + signe MACD.
- **Cassure** : `breakoutUp/Down` × ratio de volume (« cassure des {hi} FCFA confirmée par
  un volume {ratio}× la moyenne »).
- **Niveaux à surveiller** : support = `lo`/plus bas récent, résistance/objectifs = `hi` et
  extensions, invalidation = plus bas de sécurité — tous issus des séries, jamais inventés.

`chiffres` liste TOUS les nombres autorisés (cours, variation, RSI, ratio volume, niveaux)
— sert de whitelist au garde-fou LLM.

### 3.2 Reformulation LLM contrainte

`polishNarrative(skeleton)` : DeepSeek→Mistral via `resolveApiKey` reformule les phrases de
**liaison** pour un rendu fluide style ETIT. Prompt : « reformule sans ajouter aucun
chiffre ni fait ; utilise uniquement ces valeurs : {chiffres} ». **Garde-fou** :
`assertNoForeignNumber(sortie, chiffres)` extrait tous les nombres de la sortie ; si l'un
n'est pas dans la whitelist (tolérance d'arrondi), on **rejette et retombe sur le squelette
brut**. Le LLM ne peut jamais introduire un fait. Testé (rejet d'un nombre étranger).

## 4. Stockage — migration `0113_hebdo_analyses.sql`

- `hebdo_editions` : `id, date_edition (unique), statut ('brouillon'|'publie'), auto (bool),
  created_at, published_at`. RLS : lecture publique des `statut='publie'` ; écriture
  service_role.
- `hebdo_items` : `id, edition_id (fk), code, sens, raison, metrics jsonb (SNAPSHOT figé :
  closes[], rsi[], volume, niveaux, verdict), narratif_md, ordre`. RLS lecture publique via
  jointure édition publiée (policy `exists(select 1 from hebdo_editions e where e.id =
  edition_id and e.statut='publie')`). Le snapshot fige les données du graphique → page
  stable et citable même si la base évolue.
- Discipline RLS §11 : policies explicites + `revoke … from public, anon, authenticated` ;
  test curl anon après application ; `get_advisors`.

## 5. Génération, cron & admin — `scraper/src/hebdo/`

- `runHebdo.ts` (CLI `hebdo[:mock]`, instrumenté `withMonitoring`) : charge la semaine +
  historique, `selectHebdo`, `buildSkeleton` + `polishNarrative` par valeur, upsert une
  `hebdo_edition` **directement en `statut='publie'`** (`auto=true`) + ses items.
- **Alerte** : après publication, `dispatch({ subject: 'Édition hebdo publiée',
  body: '<n valeurs> · <lien> · révisez/dépubliez dans /admin/hebdo', … })` via
  `scraper/src/alerts/channels.ts` (email/telegram/console). Tu es prévenu à chaque
  publication et peux intervenir.
- Cron `.github/workflows/hebdo.yml` : vendredi après clôture (samedi 06:00 UTC pour laisser
  passer la séance de vendredi + le scoring).
- Admin `/admin/hebdo` (`requirePermission`) : liste des éditions ; édition d'un brouillon
  OU d'une édition publiée (retirer/ajouter une valeur, corriger le narratif, dépublier).
  L'**override manuel** : tu peux créer/curer une édition à la main quand tu veux ; sinon le
  cron s'en charge automatiquement.

## 6. Publication & partage

- Page **`/analyses/hebdo/[date]`** (publique, `force-dynamic`, `generateMetadata` + SEO ;
  ajoutée aux `PUBLIC_PREFIXES` du middleware sous `/analyses` déjà public) : par valeur, un
  graphe Recharts **cours + RSI** (annotations depuis les niveaux détectés : résistance,
  signal, cassure), le narratif, un lexique repliable (RSI/MACD), les niveaux à surveiller,
  le disclaimer. Index `/analyses/hebdo` listant les éditions publiées.
- **Image OG** `app/analyses/hebdo/[date]/opengraph-image.tsx` (satori, 1200×630, pattern
  `app/api/og/*`) : titre, cours, variation, RSI, verdict + **sparkline réelle** (SVG des
  closes). Une image par édition (valeur vedette).
- **PNG haute-rés** : route `app/api/hebdo/[date]/image/route.tsx` (ImageResponse, 2400×1500,
  `?code=` pour une valeur précise) ; bouton « Télécharger l'image » sur la page. Même
  renderer satori que l'OG, à l'échelle 2×.
- Phase 2 (hors scope) : copie pixel du double-graphe annoté via rendu headless (screenshot).

## 7. Tests

- `select.test.mjs` : tri par notabilité, dédup, plafond 5, **au moins une baisse**, seuil
  volume ×2, exclusion historique court.
- `narrative.test.mjs` : `buildSkeleton` (chiffres cohérents avec les métriques), garde-fou
  `assertNoForeignNumber` (rejette une sortie contenant un nombre hors whitelist → fallback
  squelette).
- Sondes RLS anon : `hebdo_editions`/`hebdo_items` d'un brouillon **non lisibles** ;
  éditions publiées lisibles.
- `npm run hebdo:mock` (fixtures), tsc, build.

## 8. Hors scope

- Copie pixel exacte du double-graphe annoté (phase 2, rendu headless).
- Analyse fondamentale/valorisation dans l'hebdo (reste technique).
- Newsletter/diffusion automatique au-delà de l'alerte admin (réutiliser plus tard
  `newsletter/send.ts` si voulu).
