# Tableau de bord adaptatif au profil — conception

Date : 2026-10-14 · Statut : validé en brainstorming, à relire avant plan.
Maquette de référence : https://claude.ai/artifact/92wqhGaB78UhV7DrBKWmy9 (séance du 12/10/2026).

## 1. Objectif

Un même `/dashboard` qui sert deux publics, par ordre de priorité :

1. **L'investisseur actif** qui suit son portefeuille : il doit voir d'abord ce
   qui le concerne (ses positions, ses alertes, l'agenda et les publications de
   ses valeurs, la facilité à vendre ce qu'il détient).
2. **Le particulier qui débute** : il doit comprendre la séance avant d'en voir
   le détail.

Non-objectif : refaire la logique de données. La refonte visuelle (maquette)
est un chantier distinct ; cette conception porte sur l'ORDRE des blocs et sur
QUATRE nouveaux blocs plus l'enrichissement du bloc portefeuille.

## 2. Règle de profil

- `profil = 'actif'` si l'utilisateur a **au moins une position** dans
  `portfolios_positions` avec `quantite > 0`, hors ligne de liquidités
  (`code = 'LIQUIDITES'` : le cash y est une ligne sentinelle ; la colonne
  `is_liquidites` appartient à une autre table, `portfolio_positions`) ;
  sinon `'debutant'`. Une ligne soldée à zéro ne compte pas.
- Un layout **sauvegardé** par l'utilisateur (`/dashboard/personnaliser`) passe
  TOUJOURS devant l'ordre par défaut du profil.
- Pas de nouveau champ en base : le profil se déduit à chaque rendu.

### Changement technique

`frontend/lib/dashboard/widgets.ts` :

- `resolveLayout(saved)` devient `resolveLayout(saved, profil)`. Fonction pure,
  testée. Sans layout sauvegardé, elle renvoie `ORDRE_ACTIF` ou
  `ORDRE_DEBUTANT`. Avec un layout sauvegardé, comportement inchangé (clés
  inconnues ignorées, widgets nouveaux ajoutés en fin, sauf masqués).
- `WidgetKey` gagne : `agenda`, `publications`, `liquidite`, `comprendre`.
  `alertes` reste le bandeau existant, hors layout (affiché seulement s'il y a
  des alertes déclenchées).
- `comprendre` est **masqué par défaut** pour le profil actif (présent dans le
  registre, donc réactivable depuis `/dashboard/personnaliser`).

## 3. Ordres par défaut

| Rang | `ORDRE_ACTIF` | `ORDRE_DEBUTANT` |
|---|---|---|
| — | Bandeau alertes (si déclenchées) | Bandeau alertes (si déclenchées) |
| 1 | `portefeuille` (enrichi, §4.5) | `etat` (séance racontée + largeur) |
| 2 | `agenda` (mes valeurs d'abord) | `comprendre` |
| 3 | `publications` (mes valeurs d'abord) | `seance` (indices, hausses / baisses) |
| 4 | `etat` | `agenda` (marché) |
| 5 | `seance` | `publications` |
| 6 | `liquidite` (mes positions) | `portefeuille` (invitation, §4.5) |
| 7 | `signaux`, `secteurs`, `indices` | `signaux`, `secteurs`, `indices`, `liquidite` |
| 8 | `actus` | `actus` |

## 4. Les blocs

Règles communes : chaque donnée affiche sa **date** ; une donnée ancienne est
signalée **dans la forme** (pastille « données du … »), pas seulement en note ;
aucun bloc vide sans phrase d'état ; aucun chiffre hors base ; jamais de
conseil.

### 4.0 Hiérarchie visuelle

Les blocs n'ont pas tous le même poids. Trois niveaux de lecture :

| Niveau | Blocs | Traitement |
|---|---|---|
| 1 — mon portefeuille / la séance | `portefeuille` (actif), `etat` + `comprendre` (débutant) | Pleine largeur, chiffres en grand, graphe |
| 2 — à surveiller | `agenda`, `publications` | Demi-largeur côte à côte, listes compactes avec pastilles de statut |
| 3 — détail | `seance`, `liquidite`, `signaux`, `secteurs`, `indices`, `actus` | Tiers de largeur, tableaux denses |

Direction artistique : les **jetons existants du site** (thème sombre par
défaut, thème clair « Warm Ivory » : ivoire, sarcelle pour les actions et
repères, vert et rouge réservés aux variations). Pas de nouvelle couleur de
charte dans ce chantier (voir §9).

### États vides orientés action

| Bloc | Message | Action proposée |
|---|---|---|
| `portefeuille` (aucune position) | « Vous ne suivez encore aucune position. » | Créer mon portefeuille · Importer un relevé · Suivre des valeurs |
| `agenda` | « Aucun dividende ni assemblée annoncés dans les 30 prochains jours. » | Voir le calendrier complet |
| `publications` | « Aucune publication d'émetteur ces 7 derniers jours. » | Voir toutes les publications |
| `liquidite` (valeur non mesurée) | « Liquidité non mesurée pour cette valeur. » | Voir la fiche de la valeur |
| `comprendre` (séance incomplète) | « La séance n'est pas encore close ; l'explication paraît après la clôture. » | — |

### 4.1 `agenda` — 30 prochains jours

- **Sources** : `dividends` (`ex_date`, `payment_date` ≥ aujourd'hui, ≤ +30 j ;
  `montant`, `base_fiscale`, `source`), `market_events` (`event_type =
  'assemblee'`, clé `instrument_code`), `market_calendar`
  (`is_trading_day = false`, jours de fermeture — le module filtre lui-même).
- **Assemblées : bloc VIDE tant qu'aucune date de réunion n'existe** (décision
  du 2026-10-14, revue finale du plan 1). `market_events.event_date` est la
  date de PUBLICATION de l'avis (`scraper/src/events/parser.ts` lit la date de
  la liste), pas celle de la réunion : l'afficher comme date d'assemblée
  serait faux. Le module attend un champ `date_reunion` et l'appelant passe une
  liste vide jusqu'à ce qu'une source de date de réunion soit collectée (titre
  ou résumé de l'avis à analyser, ou colonne dédiée). Statut `officiel` pour
  `source = 'BRVM'` (avis publiés par la Bourse) ou `'bdfin'`.
- **Profil actif** : ses valeurs en tête. Deux montants distincts, jamais
  confondus : le **dividende par action**, et le **total indicatif** =
  quantité détenue AUJOURD'HUI × dividende, libellé « pour vos N titres, s'ils
  sont détenus à la date de détachement » (la quantité éligible est celle du
  jour de détachement, que l'on ne connaît pas d'avance). Le mot « net »
  n'apparaît que si `base_fiscale = 'net'` ; sinon « base fiscale non
  précisée ».
- **Trois statuts, dans la forme (pastille)** :
  `officiel` (paiement lu au Bulletin officiel, `source = 'brvm-boc'`),
  `annoncé` (source tierce, par ex. RichBourse — toutes les ex-dates, aucune
  source officielle n'en publie), `fermeture` (jour non ouvré du
  `market_calendar`). Aucune date estimée par nous : pas de statut
  « estimation ».
- **Vide** : « Aucun dividende ni assemblée annoncés dans les 30 prochains jours. »

### 4.2 `publications` — 7 derniers jours

- **Source** : `publications` (`date_publication` ≥ J−7 ; `type_publication`,
  `libelle`, `source_url`, `code`).
- **Affichage** : type en pastille (états financiers, rapport d'activité, AG,
  notation, communiqué), émetteur, date, lien vers le PDF BDFIN.
- **Profil actif** : publications de ses valeurs en tête, marquées.
- **Distinct** du bloc `actus` (presse) : ici, sources officielles uniquement.
- **Vide** : « Aucune publication d'émetteur ces 7 derniers jours. »

### 4.3 `liquidite`

- **Sources** : `liquidity_daily` (dernière date : `score`, `classe`,
  `spread_pct`, `spread_source`, `valeur_moyenne_30j`).
- **Profil actif** : par position, classe (A–D), fourchette (« ≈ » si
  `spread_source = 'roll'`), et **durée théorique indicative** pour écouler la
  position = valeur de la position ÷ (`valeur_moyenne_30j` × taux de
  participation), arrondie à la séance supérieure.
  - **Taux de participation : 20 %** par défaut, constante nommée et
    documentée (`PARTICIPATION_VOLUME`). Supposer qu'on absorbe 100 % des
    échanges quotidiens serait irréaliste sur un marché étroit.
  - Libellé : « Durée théorique indicative, en supposant que vos ventes
    représentent 20 % des échanges quotidiens moyens (30 séances au JJ/MM).
    Ce n'est pas une garantie d'exécution. »
  - Au-delà de 20 séances : pastille d'avertissement.
- **Profil débutant** : 5 valeurs les plus faciles et 5 les plus difficiles à
  échanger (par `score`), avec une phrase d'explication de la fourchette.
- **Vide / manquant** : valeur sans ligne de liquidité → « liquidité non
  mesurée » (jamais 0).

### 4.4 `comprendre` — la séance en mots simples

- **Contenu** : 4 à 5 constats **déterministes** (aucun modèle de langage),
  chacun suivi d'une ligne « ce que cela veut dire » : largeur du marché
  (hausses / baisses / stables), variation du BRVM Composite, secteur qui
  mène, valeur échangée face à la veille, valeur la plus échangée.
- **Garde-fou** : module pur `lib/dashboard/comprendre.ts`, testé.
  - Entrée = un objet de métriques **explicites et nommées** (hausses,
    baisses, stables, variation du Composite, secteur meneur et sa variation,
    valeur échangée du jour et de la veille, valeur la plus échangée,
    `date_marche`). Rien n'est lu ailleurs.
  - Chaque phrase a une **condition d'existence** : une métrique manquante
    supprime la phrase, elle ne devient jamais 0 ni une formulation vague.
  - Formulations neutres, au passé, sans cause affirmée, sans prédiction,
    sans conseil.
  - Tests : signe et verbe cohérents (« recule » ⇒ valeur affichée en valeur
    absolue), unités (FCFA, %, points), arrondis identiques aux panneaux,
    aucun chiffre absent des entrées, phrase omise si sa métrique manque.
- **Lien** : vers l'Academy (`/formations`) — il n'existe pas de page lexique.

### 4.5 `portefeuille` — enrichi

Tout vient de `derivePortfolio` (`lib/portfolio/derive.ts`), source unique :
`positions` (PRU, valeur, plus-value latente, poids), `equityCurve`,
`sectors`. Aucun nouveau calcul financier.

Structure, du plus important au détail (inspirée du tableau de bord de
portefeuille de référence, adaptée à nos données) :

1. **Bandeau de 3 chiffres** : valeur du portefeuille · plus-value latente
   (FCFA et %) · variation du jour (FCFA et %), avec à côté la variation du
   BRVM Composite **de la même séance**.
2. **Courbe de valeur** (`equityCurve` : valeur et capital investi), avec la
   limite écrite sous le graphe : « suppose une détention continue depuis la
   date d'entrée de chaque position ». Pas de superposition de l'indice : les
   entrées successives de capital la rendraient trompeuse.
3. **Positions** : valeur, cours, variation du jour, poids, PRU, plus-value
   latente.
4. **Répartition par secteur** (`sectors`) et **contribution de chaque
   position à la plus-value** (barres de part et d'autre de zéro).

- **Cohérence temporelle** : la variation du jour du portefeuille et celle de
  l'indice portent sur la **même `date_marche`**. Si une position n'a pas de
  cours à cette date, la comparaison affiche « non comparable » au lieu de
  mélanger deux séances. Chaque série affiche sa date de référence.
- **Écarté** : regroupement par notation (la notation n'existe que pour une
  partie des émetteurs) ; comparaison à l'indice depuis la date d'achat
  (historique des ventes partielles absent).
- **Profil débutant (aucune position)** : invitation « Créer mon premier
  portefeuille » ou « Suivre des valeurs (watchlist) », pas de tableau vide.

## 5. Corrections intégrées au passage

Défauts relevés sur le tableau de bord actuel (`frontend/lib/brief.ts`) :

- « recule de **−0,26 %** » : le verbe porte le sens, la variation doit être
  affichée en valeur absolue (`motVariation` + `fmtVar`).
- « volume total de **0 FCFA (−100 %)** » : le volume additionné vaut 0 alors
  que la séance a échangé plus de 2,9 Md. **Cause à établir d'abord**
  (systematic-debugging : quel champ `generateBrief` additionne-t-il, et sur
  quelles lignes ?). Correction attendue : lire
  `brvm_market_summary.valeur_transactions` ou la somme de `valeur_echangee`,
  et taire la comparaison quand la base de comparaison est nulle.

## 6. Tests

- `widgets.test` : ordre actif, ordre débutant, layout sauvegardé prioritaire,
  `comprendre` masqué par défaut pour l'actif, clés inconnues ignorées.
- `comprendre.test` : constats sur la séance réelle du 12/10/2026 ; aucun
  chiffre étranger aux entrées.
- `liquidite` : durée théorique avec `PARTICIPATION_VOLUME` = 20 % (position
  nulle, valeur moyenne absente → « non mesurée », > 20 séances → pastille).
- `agenda` : statut `officiel` / `annoncé` / `fermeture` ; dividende par action
  et total indicatif distincts ; « net » seulement si `base_fiscale = 'net'` ;
  mes valeurs d'abord.
- `portefeuille` : variation du jour et indice sur la même `date_marche` ;
  « non comparable » si un cours manque à cette date.
- `brief` : les deux corrections du §5.
- E2E : `/dashboard` rend sans erreur pour un compte avec positions et un
  compte sans position (états vides compris).

## 7. Hors périmètre (étape 2)

Radar technique du marché, valorisation du marché (PER / rendement médians
face au taux directeur et aux obligations), obligations du jour, matières
premières, scores quantitatifs. Indices africains : réparer la collecte ou
retirer le bloc (source figée au 03/07/2026).

## 8. Critères d'acceptation

La fonctionnalité est prête lorsque :

- un compte avec positions voit son portefeuille en premier ;
- un compte sans position découvre la séance et son explication avant les détails ;
- un agencement personnalisé n'est jamais remplacé silencieusement par l'ordre du profil ;
- les alertes restent un bandeau distinct, hors des blocs réorganisables ;
- les événements et publications concernant les valeurs détenues sont prioritaires ;
- chaque chiffre, date et lien est traçable à sa source, avec sa date de référence ;
- aucune absence de donnée n'est convertie en zéro ;
- aucun montant de dividende ni aucune durée de liquidité n'est présenté comme garanti ;
- le tableau de bord fonctionne sans erreur pour les deux profils, sur ordinateur et mobile ;
- les tests couvrent les règles métier et les corrections du brief.

## 9. Revue du 2026-10-14 : ce qui a été retenu

Une revue externe de cette spécification a été vérifiée point par point contre
le code.

- **Retenu** : portefeuille structuré en bandeau de chiffres, courbe,
  positions, répartition (§4.5, données déjà fournies par `derivePortfolio`) ;
  hiérarchie à trois niveaux (§4.0) ; agenda à statuts distincts et montants
  par action / total séparés (§4.1) ; durée de liquidité « théorique
  indicative » avec taux de participation (§4.3) ; cohérence temporelle
  portefeuille / indice (§4.5) ; garde-fous de `comprendre` (§4.4) ; états
  vides orientés action (§4.0) ; critères d'acceptation (§8).
- **Ajusté** : le statut « estimation » de l'agenda n'est pas créé, car nous
  n'estimons aucune date ; regroupement par notation écarté (couverture
  partielle) au profit des secteurs.
- **Non retenu (décision du 2026-10-14, option A)** : « bleu nuit » comme
  couleur d'identité. Il n'existe dans aucun jeton du site (`globals.css` :
  sombre noir + cyan, clair ivoire + sarcelle). La refonte garde les jetons
  actuels.

### Visuel cible du 2026-10-14 (deux colonnes « actif » / « débutant »)

Retenu comme **référence de structure**, pas comme maquette finale :

- **Repris** : bandeau d'alertes détaillé (valeur, motif) ; bloc portefeuille
  avec valeur totale, performance du jour face au BRVM Composite, plus-value
  latente, répartition en anneau et tableau des positions ; agenda filtrable
  (Mes valeurs · Dividendes · Assemblées · Jours fermés) avec pastilles de
  statut ; publications filtrables ; tableau de liquidité (valeur de la
  position, classe, fourchette, valeur moyenne 30 j, séances) ; « Comprendre
  la séance » en cinq constats numérotés avec lien vers l'Academy ; invitation
  « Créer mon portefeuille / Suivre des valeurs » pour le débutant ; bande
  macro UEMOA.
- **Écarté** :
  - boutons **« Vendre »** sur chaque position : la plateforme ne passe pas
    d'ordres, et un bouton de vente par ligne se lit comme une incitation ;
    remplacés par un lien vers la fiche de la valeur ;
  - **jauge « Sentiment du marché 52/100 »** : aucune mesure derrière ;
  - **quatre cartes d'état de séance** (Ouvert, Négociation en continu,
    Prochaine ouverture, Fuseau) : condensées en une pastille ;
  - bloc **« Publications »** de l'actif, qui affiche en réalité un tableau de
    cours : il doit lister des documents ;
  - **couleurs bleu nuit** de l'en-tête et de la barre latérale (option A).
- **À vérifier avant de reprendre** : graphe en bougies intraday (seulement si
  les relevés toutes les 15 minutes, `brvm_intraday_candles_15m`, sont
  fiables) ; vignettes photo des actualités (seulement si la source fournit
  une image) ; indices africains présentés comme frais alors que la source est
  figée au 03/07/2026.
- **Chiffres du visuel** : illustratifs et souvent incohérents entre eux
  (liquidité de SNTS à 14 séances pour une position de 4,5 M face à 325 M
  échangés par jour ; fourchette à 0,8 % contre 0,01 % mesuré). Les écrans
  finaux utilisent les données réelles.

## 10. RGPD

Aucune nouvelle donnée personnelle : le profil est déduit des positions
existantes à chaque rendu, rien n'est stocké. Les blocs lisent sous RLS avec la
session de l'utilisateur.

## 11. Notes d'intégration pour le plan 2 (revue finale du plan 1)

- **§8, premier critère NON atteint par le plan 1** : `ORDRE_ACTIF` ne
  réordonne que les widgets configurables ; les sections fixes (macro, indices
  africains, motifs intraday) restent au-dessus. La mise en page à trois
  niveaux (§4.0) est l'objet du plan 2.
- **`comprendre`** : hausses / baisses / stables à compter sur les
  `variation_pct` NON nulles — le code actuel de la page et du brief compte un
  nul comme « stable » (`?? 0`), ce qui transformerait une inconnue en
  stabilité. `secteurMeneur` : le lire dans les indices sectoriels de
  `brvm_indices_daily`, ou reformuler l'explication (« Les indices
  sectoriels… ») si l'on garde la moyenne équipondérée de `computeTopSectorPerfs`.
- **`performanceJour`** : `EnrichedPosition` (`lib/portfolio/derive.ts`) ne
  porte ni variation ni date ; lire `brvm_actions_daily(code, cours_jour,
  variation_pct, date_marche)` pour la séance affichée.
- **`liquidite`** : `liquidity_daily.valeur_moyenne_30j` vaut `0` par défaut
  (migration 0111) ; `dureeTheorique` traite ≤ 0 comme « non mesurée », à
  conserver.
- **Formatage** : `pctSigne` existe en deux copies (`lib/brief.ts`,
  `lib/dashboard/comprendre.ts`) ; `fmtFcfa` émet un « - » ASCII alors que les
  pourcentages utilisent « − » (U+2212). Avant d'afficher `variationFcfa`,
  regrouper ces aides dans `lib/format.ts` avec un montant FCFA signé.
