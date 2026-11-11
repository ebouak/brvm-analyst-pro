# Saisonnalité v2, lot 4 : marché, liquidité, « Ce mois-ci », bilan figé, alertes

Spec : `docs/superpowers/specs/2026-11-10-saisonnalite-v2.md` §5 (F8 à F12) et §6 lot 4.
Lots 1-3 fusionnés (PR #217, #218, #219).

## Sans écriture nouvelle (frontend seul)

- **F8 Vue Marché** en tête de `/saisonnalite` : matrice de `rdt_marche` (même
  moteur, même verdict). Dans chaque cellule d'une valeur : « dont marché X »,
  médiane de `rdt_marche` sur les mêmes mois.
- **F9 Liquidité** : par mois, valeur échangée rapportée à la moyenne annuelle
  de la valeur (et du marché), part des séances avec échange
  (`seances_cotees / seances_marche`). Colonnes déjà en base.

## Avec écriture (scraper, même job `saisonnalite`)

### Table `saisonnalite_etat` (migration 0208) — F10, F12
Une ligne par valeur : état du mois en cours au même rang de séance (logique
F1 portée côté scraper), verdict de la cellule du mois (fenêtre 10 ans),
`etat_depuis` (première séance où l'état actuel a été observé).
Écrasée à chaque passage. Lue par `/saisonnalite/ce-mois-ci` (F10) et par les
alertes (F12).

### Table `saisonnalite_bilans` (migration 0208) — F11
`(code, annee, mois)` : profil connu au DÉBUT du mois (médiane, q25, q75 des
rendements totaux du même mois sur les 10 années précédentes, verdict, n),
`ecrit_le` ; puis `realise`, `realise_le` une fois le mois terminé.
- Profil inséré en `ignoreDuplicates` : la première écriture fait foi.
- Profil écrit SEULEMENT si la dernière séance chargée est au plus la 5e du
  mois ; sinon le mois n'a pas de bilan (pas d'écriture tardive qui pourrait
  connaître une partie du mois).
- `realise` écrit une seule fois (`realise is null`), quand le mois est complet.
- Bilan public sur `/saisonnalite` : « sur N mois, la saison au moins
  indicative s'est vérifiée k fois », avec le détail mois par mois.

### Alertes — F12
- `dividende_proche` existe déjà (seuil en jours) : rien à créer, il suffit de
  le présenter depuis la page.
- Nouveau type `saison_hors_fourchette` : se déclenche quand l'état passe de
  « dans la fourchette » à « au-dessus » ou « en dessous », pas tant qu'il y
  reste (sinon un message par jour pendant des semaines).

### Duplication assumée
`trajectoireMois`, `bandeHistorique`, `etatMois` et `verdictCellule` existent dans
`frontend/lib/seasonality/`. Le scraper en a besoin : copie dans
`scraper/src/saisonnalite/pure/` avec commentaire d'en-tête, comme
`scraper/src/hebdo/pure/`. Toute correction est à reporter des deux côtés.

## Questions soumises à fable-advisor
1. Course entre `score.yml` (16:00, chaîne de 5 jobs) et `alerts.yml` (16:30),
   les deux décalables de plusieurs heures par GitHub.
2. Bilan figé : la règle « 5e séance au plus, sinon pas de bilan » est-elle la
   bonne défense contre le biais de lecture ?
3. Alerte sur transition : où garder l'état précédent.

## Points à vérifier par la donnée
Bilan : nombre de profils écrits ce mois-ci (attendu 0 au 11 novembre, rang 7 :
la règle des 5 séances interdit d'écrire novembre ; premier bilan en décembre).
