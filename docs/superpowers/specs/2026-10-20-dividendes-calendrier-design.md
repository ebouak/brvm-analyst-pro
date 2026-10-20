# Dividendes — étape 1 : le calendrier officiel de paiement BRVM

Date : 2026-10-20 · Statut : validé par le propriétaire (« go »)

Première des trois étapes du module dividendes demandé le 2026-10-20 (étude des
actions à dividendes, simulateur de revenus, calculateur d'objectif). Ordre
retenu : **données d'abord**, puis la page Revenus (Radar + Simulateur +
Objectif, spec séparée), puis le backtest, qui relie `/rendement-vrai` et
`/simulateur` au lieu d'en refaire un.

## 1. Pourquoi cette étape d'abord

Mesuré le 2026-10-20, en lecture seule sur la table `dividends` :

- **Dates de détachement : 2 sur 36** dividendes de l'exercice 2025 ;
  dates de paiement : 15 sur 36. Sans date de détachement, impossible de dire
  si un achat aujourd'hui donne droit au prochain dividende, ni de répondre à
  « recevoir l'argent avant le 31/12/2026 ».
- **Brut et net mélangés à la source.** Les montants fournis par le
  propriétaire pour ORANGE CI (800), SIB (425), SODECI (525), SAPH (489) et
  SGCI (2 606) valent exactement la base ÷ 0,88 : ce sont des BRUTS, la base
  porte les NETS. SONATEL (1 740) est, lui, déjà net.
- **Taux fiscal erroné.** `frontend/lib/tax/rates.ts` applique 10 % aux
  dividendes cotés ivoiriens. Depuis l'annexe fiscale à la loi de finances 2025
  (DGBF), l'IRVM est de **12 % pour les personnes physiques** et 10 % pour les
  personnes morales — ce que rappelle chaque calendrier BRVM. `/simulateur-budget`
  surestime donc le revenu net de toute valeur ivoirienne.

## 2. La source

- Page de liste : `https://www.brvm.org/fr/avis-calendrier-de-paiement-de-dividendes`.
- Un PDF par mise à jour : `…/sites/default/files/AAAAMMJJ_-_calendrier_de_paiement_des_dividendes_-_exercice_AAAA.pdf`.
  Le plus récent se choisit par la date du nom de fichier, jamais par sa
  position dans la page.
- Colonnes : titre · montant du dividende par action (FCFA) · numéro de l'avis
  (`102-2026 BRVMDG`) · date de publication au BOC · ex-dividende (T−1) · date
  de paiement (T).
- Note de bas de page : « (*) Dividende brut ; IRVM applicable de 12 % pour
  les personnes physiques et 10 % pour les personnes morales ». **L'en-tête
  dit « net » mais les lignes marquées (*) sont brutes** : le marqueur prime
  sur l'en-tête.

### Pièges relevés sur le PDF du 06/10/2026

1. **Mise en page désalignée** : nom, montant et dates ne tombent pas sur la
   même ligne de texte (un nom sur deux lignes, un montant au-dessus de son
   nom). Lecture **par position** (x, y) des fragments, comme
   `dividends/boc.ts` et `carnet/parse.ts` — jamais par ordre des cellules.
2. **Nombres** : « 594,528 », « 0,9184 » et « 145,3214 » sont des décimaux,
   « 1 740 » porte un espace de milliers. Passer par `parseFrNumber`.
   Contrairement au carnet d'ordres, la virgule est ici un vrai séparateur
   décimal (montants unitaires : 0,9184 FCFA pour CORIS est plausible, une
   lecture « 9 184 » ne l'est pas — un test le fige).
3. **Dates contradictoires** : TRACTAFRIC porte ex-dividende 23/10/2026 et
   paiement 22/10/2026. Une ligne dont l'ex-date est postérieure au paiement
   est **rejetée et nommée**, jamais écrite.
4. **Noms abrégés et variables** : « SODE CI », « SOCIETE IVOIRIENNE DE
   BANQUE », « Ecobank Transnational Incorporated TG », « LOTERIE NATIONALE DU
   BENIN ». Correspondance par **table curée** stricte ; un nom inconnu va dans
   `non_rapproches`, aucun repli flou (leçon TTLC/BOABF du 2026-09-08).

## 3. Stockage — la table existante, étendue

Migration `0157_dividendes_calendrier.sql` (numéro libre sur toutes les
branches au 2026-10-20), **additive uniquement** :

| Colonne | Type | Sens |
|---|---|---|
| `montant_brut` | `numeric null` | brut par action, quand la source le donne |
| `taux_retenue` | `numeric null` | retenue appliquée pour passer au net (0,12) |
| `avis_brvm` | `text null` | numéro de l'avis, ex. `102-2026 BRVMDG` |

Commentaires SQL sur chaque colonne. Aucune donnée personnelle : pas d'impact
RGPD, la RLS de `dividends` (lecture publique, écriture service_role) couvre
les nouvelles colonnes.

**`montant` reste le NET pour une personne physique**, comme aujourd'hui :
`/dividendes`, `lib/citable/dividendYield.ts`, l'agent et le dossier valeur
continuent de fonctionner sans changement.

- Ligne (*) : `montant_brut` = valeur lue, `taux_retenue` = 0,12,
  `montant` = brut × 0,88 arrondi à 4 décimales, `base_fiscale` = `net`.
- Ligne sans (*) : `montant` = valeur lue, `base_fiscale` = `net`,
  `montant_brut` et `taux_retenue` **restent nuls** — on ne reconstitue pas un
  brut en devinant le taux du pays.
- `ex_date`, `payment_date`, `avis_brvm` renseignés ; `source` =
  `brvm-calendrier`, `source_url` = l'URL du PDF.
- Exercice = celui du titre du PDF (« ANNEE : 2025 »), pas l'année de paiement.

## 4. Collecte

Calqué sur `dividends/runDividendesBoc.ts` :

- `scraper/src/dividends/calendrier.ts` — **pur** : fragments PDF → lignes
  `{ nom, montant, brut, avis, publication, ex_date, paiement }` + rejets
  motivés. Testé sur une fixture du PDF du 06/10/2026 (fragments extraits,
  `tests/fixtures/calendrier-dividendes-20261006.json`).
- `scraper/src/dividends/calendrierCodes.ts` — table curée nom → code, testée.
- `scraper/src/dividends/runCalendrier.ts` — liste, télécharge le plus récent,
  rapproche avec la base et classe chaque ligne :
  `concordant` · `date_ajoutee` · `montant_different` · `absent` · `rejete`.
  **À blanc par défaut** ; `--ecrire` fait l'upsert sur `(code, exercice)`.
- CLI : `dividendes-calendrier [--ecrire]` dans `src/index.ts`, script npm
  `dividendes:calendrier`.

### Priorité entre sources

- **Calendrier > BOC > richbourse > sikafinance.** Le calendrier est l'avis
  officiel de l'émetteur relayé par la BRVM.
- En cas d'écart avec une ligne `brvm-boc` (BOAC : 594,528 contre 597,53), le
  calendrier écrit, et l'écart est **imprimé dans le rapport** avec les deux
  valeurs — jamais tranché en silence.
- `runDividends` protège déjà les lignes `brvm-boc` d'un écrasement par la
  collecte hebdomadaire ; la même protection s'étend à `brvm-calendrier`.

## 5. Correction fiscale

- `frontend/lib/tax/rates.ts` : `CI.dividende_cote` passe à 12 % (personnes
  physiques). Le type `TauxFiscal` gagne un champ facultatif
  `tauxPersonneMorale` (10 % pour la CI) plutôt que de dédoubler le barème.
  Source : annexe fiscale LF 2025 (DGBF) et calendrier BRVM du 06/10/2026,
  `verifieLe: '2026-10-20'`.
- `lib/budgetSimulator.ts` dérive déjà `IRVM` du barème : il passe à 12 % sans
  autre modification. `lib/budgetSimulator.test.mjs` est ajusté s'il fige 10 %.
- Vérifié le 2026-10-20 : le scraper ne contient aucune copie du taux.

## 6. Planification et contrôle

- Nouvelle étape dans `.github/workflows/dividends.yml`, **après**
  `npm run dividends`, pour que le calendrier soit le dernier à écrire.
- Étape de vérification qui **relit la base** : échec si aucune ligne
  `brvm-calendrier` de l'exercice courant n'a d'`ex_date`. Un run vert ne
  prouve rien (leçon des emails muets).
- Un PDF introuvable ou illisible fait échouer l'étape bruyamment ; il n'efface
  jamais une donnée existante.

## 7. Critères d'acceptation

1. Tests purs verts : lecture par position, (*) → brut, décimales, rejet des
   dates contradictoires, nom inconnu non rapproché.
2. Exécution à blanc sur le PDF du 06/10/2026 : rapport lisible, TRACTAFRIC
   rejetée, écart BOAC signalé, aucun code deviné.
3. Après `--ecrire` (sur accord du propriétaire, migration 0157 appliquée) :
   dates de détachement de l'exercice 2025 renseignées pour l'essentiel des
   ~40 lignes du calendrier (contre 2) ; ORANGE CI à 704 net / 800 brut / 0,12 ;
   SONATEL à 1 740 net, brut nul.
4. `npm run typecheck` + `npm test` (scraper), `tsc` frontend verts.
5. `/dividendes` et `/simulateur-budget` relus après coup : aucun affichage cassé.

## 8. Hors périmètre

- La page Revenus (Radar, Simulateur, Objectif) : spec suivante.
- Le choix personne physique / morale dans l'interface : il viendra avec le
  simulateur ; la donnée porte déjà le brut et le taux pour le permettre.
- Les exercices antérieurs à 2025 : les PDF anciens restent listés sur la
  page ; une reprise éventuelle sera décidée après mesure de leur format.
