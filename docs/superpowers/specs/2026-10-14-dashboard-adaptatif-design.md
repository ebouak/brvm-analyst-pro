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
  `portfolios_positions` avec `quantite > 0` (hors ligne `is_liquidites`) ;
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

### 4.1 `agenda` — 30 prochains jours

- **Sources** : `dividends` (`ex_date`, `payment_date` ≥ aujourd'hui, ≤ +30 j ;
  `montant`, `base_fiscale`, `source`), `market_events` (`event_type =
  'assemblee'`, `event_date` à venir), `market_calendar`
  (`is_trading_day = false`, jours de fermeture).
- **Profil actif** : ses valeurs en tête, avec le **montant à percevoir** =
  quantité × dividende (net si `base_fiscale = 'net'`, sinon « base non
  précisée »).
- **Honnêteté** : aucune source officielle ne publie l'ex-date ; elle est
  libellée « annoncée par <source> ». Le paiement issu du Bulletin officiel
  (`source = 'brvm-boc'`) est libellé comme tel.
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
  `spread_source = 'roll'`), et **séances pour écouler la position** =
  valeur de la position ÷ `valeur_moyenne_30j`, arrondi à la séance. Au-delà
  de 20 séances : pastille d'avertissement.
- **Profil débutant** : 5 valeurs les plus faciles et 5 les plus difficiles à
  échanger (par `score`), avec une phrase d'explication de la fourchette.
- **Vide / manquant** : valeur sans ligne de liquidité → « liquidité non
  mesurée » (jamais 0).

### 4.4 `comprendre` — la séance en mots simples

- **Contenu** : 4 à 5 constats **déterministes** (aucun modèle de langage),
  chacun suivi d'une ligne « ce que cela veut dire » : largeur du marché
  (hausses / baisses / stables), variation du BRVM Composite, secteur qui
  mène, valeur échangée face à la veille, valeur la plus échangée.
- **Garde-fou** : module pur `lib/dashboard/comprendre.ts`, testé ; chaque
  phrase est construite à partir des métriques passées en entrée ; un test
  échoue si une phrase contient un chiffre absent des entrées.
- **Lien** : vers l'Academy (`/formations`) — il n'existe pas de page lexique.

### 4.5 `portefeuille` — enrichi

- **Ajout** : performance **du jour** du portefeuille (variations pondérées
  par la valeur des positions) **face au BRVM Composite** du jour, et
  plus-ou-moins-value latente depuis le prix de revient, calculé par
  `derivePortfolio` (`lib/portfolio/derive.ts`) à partir de
  `portfolio_movements`. Pas de nouveau calcul de PRU.
- **Hors périmètre** : performance depuis la date d'achat face à l'indice
  (exige l'historique des mouvements par position).
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
- `liquidite` : séances pour écouler (position 0, valeur moyenne absente,
  > 20 séances).
- `agenda` : montant perçu net / base inconnue ; tri mes valeurs d'abord.
- `brief` : les deux corrections du §5.
- E2E : `/dashboard` rend sans erreur pour un compte avec positions et un
  compte sans position (états vides compris).

## 7. Hors périmètre (étape 2)

Radar technique du marché, valorisation du marché (PER / rendement médians
face au taux directeur et aux obligations), obligations du jour, matières
premières, scores quantitatifs. Indices africains : réparer la collecte ou
retirer le bloc (source figée au 03/07/2026).

## 8. RGPD

Aucune nouvelle donnée personnelle : le profil est déduit des positions
existantes à chaque rendu, rien n'est stocké. Les blocs lisent sous RLS avec la
session de l'utilisateur.
