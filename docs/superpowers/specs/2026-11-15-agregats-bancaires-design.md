# Agrégats bancaires : extraction sourcée et affichage — design

Date : 2026-11-15. Statut : validé par l'exploitant section par section (approche A).

## 1. Problème

Pour les 16 banques cotées, la Revue de résultats titre sur la variation du
résultat net et affiche « chiffre d'affaires / résultat net ». Pour une banque,
ce n'est ni le bon vocabulaire (le « chiffre d'affaires » d'une banque est son
PNB) ni la bonne lecture : on suit d'abord l'activité (PNB, marge d'intérêts,
commissions), l'efficacité (coefficient d'exploitation), le risque (coût du
risque, créances en souffrance), le bilan (crédits, dépôts) et la solidité
(fonds propres, solvabilité).

État mesuré le 2026-11-15 :
- annuel 2025 : PNB 9/16, coût du risque 13/16, coefficient 10/16, crédits et
  dépôts 13/16, créances douteuses 11/16, solvabilité 10/16 (`lignes_specifiques`) ;
- semestriel : seulement PNB (2026-S1 : 11/16), crédits et dépôts (10/16) ;
- depuis juillet 2026 : 18 rapports et 8 bilans publiés pour 12 banques
  (table `publications`) — la matière existe, elle n'est pas lue en entier.

## 2. Périmètre

- Banques (famille comptable `banque`). Assureurs : chantier suivant, même mécanisme.
- Documents : tous ceux de la table `publications` pour ces banques, rapports
  semestriels ET annuels, états financiers, bilans ; communiqués en recoupement.
  On extrait toujours quand un document est disponible, historique compris.
- Surfaces : Revue de résultats, fiche société, Dossier valeur (PDF), articles de résultats.

## 3. Agrégats et définitions

Principe : un agrégat est EXTRAIT seulement s'il est publié ; un ratio n'est
JAMAIS extrait, il est CALCULÉ (une seule définition partout). Chaque valeur
porte son périmètre (individuel / consolidé) ; deux périmètres ne se comparent pas.

Extraits — compte de résultat (flux cumulés depuis le début de l'exercice) :
PNB ; produits d'intérêts ; charges d'intérêts ; marge d'intérêts ; commissions
nettes ; charges d'exploitation (frais généraux + dotations aux amortissements) ;
RBE ; coût du risque ; résultat net (recoupement avec la base).

Extraits — bilan (encours à la date d'arrêté) : total du bilan ; crédits à la
clientèle ; dépôts de la clientèle ; fonds propres ; créances en souffrance
(montant brut, taux, couverture — définitions 0147 inchangées) ; solvabilité
totale, CET1, Tier 1 (distincts, 0147).

Calculés (`lib/bank/lecture.ts`, purs, testés) :
- coefficient d'exploitation = charges d'exploitation ÷ PNB ;
- coût du risque relatif = coût du risque ÷ encours de crédits (semestre
  annualisé ×2, et l'affichage le dit) ;
- crédits ÷ dépôts ;
- ROE sur 12 mois glissants (annuel N−1 + S1 N − S1 N−1) ÷ fonds propres ;
  sinon NON affiché — pas d'annualisation naïve d'un seul semestre.

Comparaisons : un semestre contre le même semestre de N−1 ; un encours contre la
même date d'arrêté N−1, et en second contre la dernière clôture annuelle (dit).

Absence : « non publié dans le rapport semestriel », jamais 0, jamais estimé.

## 4. Extraction et contrôles

### Données
- `indicateur_source` (0147) étendue : nouveaux indicateurs autorisés (liste §3),
  champ de période (exercice, S1, T1, T3) en plus de `date_arrete`, page et
  extrait du document, document source. Statuts inchangés : `publie`,
  `non_trouve`, `non_applicable`, `publie_non_exploitable`. Valeur en FCFA.
- Une observation par valeur et par document, y compris « non trouvé ».
- RLS : aucune lecture publique, écriture service_role seule ; revoke
  `from public, anon, authenticated`. Aucune donnée personnelle.

### Lecture
Lecture des PDF par Gemini (déjà en service, lit les scans), prompt structuré
par agrégat, sortie JSON validée par zod ; unité normalisée en FCFA.

### Contrôles (fonctions pures testées) avant toute valeur retenue
1. Unité plausible pour la taille de la banque (confusions milliers / millions).
2. Égalités comptables à tolérance d'arrondi : RBE = PNB − charges
   d'exploitation ; marge d'intérêts = produits − charges d'intérêts.
3. Recoupements : résultat net = base ; crédits et dépôts rapport = bilan même date.
4. Variation extrême d'une période à l'autre → relecture (pas de rejet).
5. Périmètre : jamais de substitution consolidé ↔ individuel.

### Sélection
Règle de 0147 (`scraper/src/prudentiel/selection.ts`) étendue : valeurs
concordantes → retenue, écrite dans `lignes_specifiques` ; contradiction →
rien de retenu, file de relecture.

### File de relecture (admin)
Page listant les observations bloquées avec extrait et page ; valider, corriger,
rejeter (journal dans `admin_audit_logs`). Rien de douteux n'est publié.

### Cadence
Après l'ingestion des publications (cron existant). Alerte Telegram exploitant
(`operateur: true`) quand la file n'est pas vide, sans donnée personnelle. Une
panne d'extraction met le run en échec (pas de vert silencieux).

## 5. Affichage

Module unique `lib/bank/lecture.ts` : entrée = valeurs retenues d'une banque
pour une période ; sortie = agrégats, ratios, comparaisons, agrégats non publiés,
constat de titre. Les quatre surfaces l'appellent ; aucune ne recalcule.
Non-banques : inchangé.

- Revue de résultats : titre sur le PNB puis le constat le plus marquant parmi
  coefficient d'exploitation, coût du risque et résultat net (règle
  déterministe) ; tableau compte de résultat (PNB → résultat net) ; tableau
  encours (crédits, dépôts, crédits ÷ dépôts, créances en souffrance et
  couverture, fonds propres, solvabilité) ; ratios avec une phrase descriptive,
  jamais un verdict ; chaque valeur renvoie à sa source. « Chiffre d'affaires »
  n'apparaît plus pour une banque.
- Fiche société : mêmes agrégats et vocabulaire ; `BankScorecard` alimenté par
  les valeurs retenues.
- Dossier valeur : feuilles « trajectoire » et « origine du bénéfice » en
  version bancaire (PNB et résultat ; cascade PNB → résultat, gabarit `cascade`
  de l'Academy s'il est fusionné, sinon barres ; encours et solvabilité).
  Verrous inchangés : 17 feuilles, aucun débordement (bornes `lib/dossier/bornes.ts`).
- Articles de résultats : pour une banque, l'article porte sur ces agrégats ;
  tout chiffre passe par `Plume`.
- Données partielles : seuls les agrégats publiés s'affichent, avec la mention
  « autres agrégats non publiés pour ce semestre ». Période non encore extraite :
  ancien affichage, libellé « produit net bancaire ».

## 6. Tests

- Purs : contrôles, sélection, lecture (ratios, annualisation, ROE glissant,
  constat de titre), données partielles.
- Fixtures gelées d'extraits réels : SIB, SGBC, une banque Coris (exclusion de
  la branche islamique), un scan.
- Cohérence : les quatre surfaces affichent le même chiffre pour une même banque.
- Rendu : Revue, fiche, dossier pour 3 banques ; impression du dossier 17
  feuilles sans débordement.
- Migrations : test à la clé anonyme et `get_advisors` (sécurité) avant fusion.

## 7. Livraison (trois PR)

1. Extraction : migration, lecture, contrôles, sélection, file de relecture,
   commande de reprise à blanc.
2. Affichage : `lib/bank/lecture.ts` et les quatre surfaces.
3. Reprise de l'historique réelle — APRÈS accord de l'exploitant sur le rapport
   de la reprise à blanc (trouvées, bloquées, contradictions), qui n'écrit rien.

## 8. Hors périmètre

Assureurs ; signaux ou classements tirés de ces agrégats ; prévisions.
