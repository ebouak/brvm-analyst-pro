# Dividendes — étape 1 : le calendrier officiel de paiement BRVM

Date : 2026-10-20 · Statut : validé par le propriétaire (« go », puis
« Spécification validée »). Révisé le même jour pendant la rédaction du plan :
découverte du PDF (§2), recoupement des dates (§4), double retenue (§5) — voir
« Révisions » en fin de document.

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
  personnes morales — ce que rappelle chaque calendrier BRVM.
- **Double retenue (constatée en rédigeant le plan).** `montant` est NET, mais
  trois écrans lui retirent encore l'IRVM : le bouton « Afficher net d'IRVM »
  de `/dividendes`, la mesure « Rdt net d'IRVM » de la fiche action, et la case
  « Dividendes nets d'IRVM (10 %) » de `/simulateur-budget`. Passer le taux à
  12 % sans corriger cela aggraverait l'erreur.

## 2. La source

- **Le PDF** : `…/sites/default/files/AAAAMMJJ_-_calendrier_de_paiement_des_dividendes_-_exercice_AAAA.pdf`.
  Colonnes : titre · montant par action (FCFA) · numéro de l'avis
  (`102-2026 BRVMDG`) · date de publication au BOC · ex-dividende (T−1) · date
  de paiement (T). Note : « (*) Dividende brut ; IRVM applicable de 12 % pour
  les personnes physiques et 10 % pour les personnes morales ». **L'en-tête dit
  « net » mais les lignes (*) sont brutes** ; le marqueur prime, et le taux est
  lu dans la note, pas codé en dur. Seul le PDF porte ce marqueur.
- **La table HTML** `https://www.brvm.org/fr/esv/paiement-de-dividendes`
  (paginée `?page=N`, 10 lignes, la plus récente d'abord) : émetteur, exercice,
  dates ISO en attribut `content`, montant, lien vers l'avis individuel
  (`AAAAMMJJ_-_avis_ndegNNN_brvmdg_…pdf`). Les avis individuels sont des
  **scans sans texte** : inexploitables sans OCR, on ne les lit pas.
- **Découverte du dernier PDF.** La page de liste
  (`/fr/avis-calendrier-de-paiement-de-dividendes`) ne pointe que la version du
  31/03/2026 : s'y fier lirait un calendrier périmé de six mois. Chaque mise à
  jour du calendrier porte la date d'un avis : on tire les dates d'avis de la
  table HTML, de la plus récente à la plus ancienne, et l'on teste l'URL du
  calendrier correspondante (HEAD, au plus 5 essais). Vérifié : 09/10, 06/10,
  04/09 et 06/08/2026 répondent 200. Repli : le lien de la page de liste.
- **Politesse** : `Crawl-delay: 10` dans le robots.txt de brvm.org → 10 s entre
  deux requêtes ; au plus 6 pages de table + 5 essais + 1 PDF par exécution.

### Pièges relevés sur les PDF du 06/10 et du 09/10/2026

1. **Mise en page désalignée** : un nom sur deux lignes, un montant au-dessus
   de son nom. Lecture **par position** (x, y), ancrée sur le fragment
   `BRVMDG` de chaque ligne — jamais par ordre des cellules. Prototype vérifié :
   33 lignes + 1 rejet le 06/10, 35 lignes le 09/10.
2. **Nombres** : « 594,528 », « 0,9184 », « 145,3214 » sont des décimaux,
   « 1 740 » porte un espace de milliers. `parseFrNumber`. Contrairement au
   carnet d'ordres, la virgule est ici un vrai séparateur décimal.
3. **Dates contradictoires** : le PDF du 06/10 donnait à TRACTAFRIC
   ex-dividende 23/10 et paiement 22/10 ; celui du 09/10 l'a corrigé (22/10,
   23/10). Une ligne dont l'ex-date dépasse le paiement est **rejetée et nommée**.
4. **Noms abrégés et variables** : « SODE CI », « SOCIETE GENERALE C I »,
   « Ecobank Transnational Incorporated TG ». Table curée sur une clé compacte
   (sans accents, espaces ni ponctuation) ; un nom inconnu va dans
   `non_rapproches`, aucun repli flou (leçon TTLC/BOABF du 2026-09-08).

### Erreurs relevées dans la table HTML (d'où un recoupement, pas une confiance)

SOGB : ex-dividende 05/07 contre 05/08 dans le PDF. LNB : avis numéroté
« 211-2025 » au lieu de 2026. SERVAIR : la table pointe encore l'avis 193
(124 FCFA) quand le PDF porte l'avis 244 (229 FCFA). BOA CI absente.

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

**`montant` reste le NET pour une personne physique**, comme aujourd'hui.

- Ligne (*) : `montant_brut` = valeur lue, `taux_retenue` = taux personnes
  physiques lu dans la note, `montant` = brut × (1 − taux) arrondi à 4
  décimales, `base_fiscale` = `net`. Sans taux lisible dans la note : la ligne
  est rejetée, jamais calculée avec un taux supposé.
- Ligne sans (*) : `montant` = valeur lue, `base_fiscale` = `net`,
  `montant_brut` et `taux_retenue` **restent nuls**.
- `ex_date`, `payment_date`, `avis_brvm` renseignés ; `source` =
  `brvm-calendrier`, `source_url` = l'URL du PDF.
- Exercice = celui du titre du PDF (« ANNEE : 2025 ») ; il doit concorder avec
  celui de l'URL, sinon rien n'est fait.

## 4. Collecte

Calqué sur `dividends/runDividendesBoc.ts` :

- `scraper/src/dividends/calendrier.ts` — **pur** : fragments PDF →
  `{ exercice, tauxPersonnePhysique, tauxPersonneMorale, lignes, rejets }`.
- `scraper/src/dividends/calendrierCodes.ts` — table curée nom → code (35).
- `scraper/src/dividends/esv.ts` — **pur** : HTML de la table →
  `PaiementEsv[]` ; URL candidates du calendrier.
- `scraper/src/dividends/rapprochementCalendrier.ts` — **pur** : montants pour
  la base, recoupement des dates, classement.
- `scraper/src/dividends/runCalendrier.ts` — réseau + base. Classe chaque ligne
  `concordant` · `date_ajoutee` · `montant_different` · `absent` ; rejets à
  part. **À blanc par défaut** ; `--ecrire` fait l'upsert sur `(code, exercice)`.
  Moins de 20 lignes retenues → rien n'est fait (lecture suspecte).
- CLI : `dividends:calendrier [--ecrire]` dans `src/index.ts`.

### Recoupement des dates

Une ligne du PDF dont l'avis figure dans la table HTML est comparée à elle :
ex-dividende ou paiement divergents → **rejet** (« dates divergentes entre
calendrier et table BRVM »), aucune date écrite. Deux sources officielles qui
se contredisent ne permettent pas de trancher ; un trou déclaré vaut mieux
qu'une date fausse. Une ligne absente de la table est retenue, marquée
`recoupee: false` dans le rapport.

### Priorité entre sources

- **Calendrier > BOC > richbourse > sikafinance.**
- Écart avec une ligne `brvm-boc` : le calendrier écrit, l'écart est **imprimé**
  avec les deux valeurs. Cas connus : BOAC 594,528 (calendrier) contre 597,53
  (BOC) ; **SGBC 2 293,28 (2 606 × 0,88) contre 2 298,75** — le commit qui
  avait fait du BOC la référence contre RichBourse (2 293,28) est ainsi
  renversé, sur la foi du brut officiel.
- Les trois autres écrivains de `dividends` respectent cette priorité :
  `runDividends` (déjà protégé pour `brvm-boc`, étendu à `brvm-calendrier`),
  `runDividendHistory` (`dividends:history`, manuel, **sans protection
  aujourd'hui** — corrigé), `runDividendesBoc` (n'écrase plus une ligne
  `brvm-calendrier`).

## 5. Correction fiscale et fin de la double retenue

- `frontend/lib/tax/rates.ts` : `CI.dividende_cote` passe à 12 %. Le type
  `TauxFiscal` gagne un champ facultatif `tauxPersonneMorale` (10 % pour la
  CI). Source : annexe fiscale LF 2025 (DGBF) et calendrier BRVM du 09/10/2026,
  `verifieLe: '2026-10-20'`.
- `lib/tax/compute.ts` gagne `rendementNetSelonBase(rendement, base, pays)` :
  base `net` → rendement inchangé (`deja_net: true`) ; base `brut` → retenue du
  barème ; base inconnue → indisponible. Testé.
- `/dividendes` (`DividendsTable`) et la fiche action l'emploient : un montant
  déjà net n'est plus retaxé ; la fiche affiche « Rdt dividende net » et retire
  la seconde mesure quand la base est nette.
- `/simulateur-budget` : `SimAction` gagne `rendementDejaNet` (vrai quand toutes
  les lignes du dernier exercice sont en base `net`) ; `computeStrategy` ne
  retient l'IRVM que sur les autres. Libellés « 10 % » en dur remplacés par le
  taux du barème.
- Vérifié le 2026-10-20 : le scraper ne contient aucune copie du taux.

## 6. Planification et contrôle

- Nouvelle étape dans `.github/workflows/dividends.yml`, **après**
  `npm run dividends`, pour que le calendrier soit le dernier à écrire.
  Timeout du job porté de 10 à 15 min (délais de politesse).
- `scripts/verify-data.ts dividends-calendrier` **relit la base** : échec sous
  20 lignes `brvm-calendrier` datées des deux derniers exercices.
- PDF introuvable ou illisible : échec bruyant, aucune donnée effacée.
- **Ordre de mise en production** : migration 0157 appliquée AVANT la fusion
  (sinon l'upsert échoue sur des colonnes inconnues), puis exécution à blanc,
  puis `--ecrire` sur accord du propriétaire, puis le cron prend le relais.

## 7. Critères d'acceptation

1. Tests purs verts : lecture par position sur les deux PDF réels, (*) → brut,
   décimales, rejet TRACTAFRIC du 06/10, nom inconnu non rapproché, dates HTML
   ISO, divergence SOGB rejetée, priorité des sources, rendement selon la base,
   simulateur sans double retenue.
2. Exécution à blanc : rapport lisible, écarts BOAC et SGBC imprimés, aucun
   code deviné.
3. Après `--ecrire` : dates de détachement de l'exercice 2025 renseignées pour
   l'essentiel des 35 lignes (contre 2) ; ORANGE CI 704 net / 800 brut / 0,12 ;
   SONATEL 1 740 net, brut nul.
4. `npm run typecheck` + `npm test` (scraper), `tsc` + vitest frontend verts.
5. `/dividendes`, la fiche SNTS et `/simulateur-budget` relus après coup.

## 8. Hors périmètre

- La page Revenus (Radar, Simulateur, Objectif) : spec suivante.
- Le choix personne physique / morale dans l'interface : il viendra avec le
  simulateur ; la donnée porte déjà le brut et le taux.
- Les exercices antérieurs à 2025 (la table HTML en remonte 43 pages) : reprise
  à décider après cette étape.

## Révisions (2026-10-20, rédaction du plan)

- §2 : la page de liste est figée au 31/03 → découverte par les dates d'avis.
- §4 : recoupement des dates avec la table HTML, qui a ses propres erreurs.
- §4 : `runDividendHistory` n'était pas protégé ; renversement assumé de SGBC.
- §5 : la double retenue sur trois écrans, que le passage à 12 % aggravait.
- AFRICA GLOBAL LOGISTICS CI (SDSC) ajoutée : 35 lignes au 09/10.
