# Conseiller v2 — moteur à concordance de facteurs, prouvé hors échantillon

Date : 2026-11-09. Statut : conception validée par l'exploitant (approche B),
architecture relue par Fable (consultation 1/3, verdict A).

## 1. Pourquoi

Mesure du moteur v1 (`frontend/lib/advisor/recommend.ts`) sur 93 séances
(19/06 → 06/11/2026), 49 valeurs, 4 494 recommandations. Le marché (BRVMC) a
fait +17,6 % sur la période. À 20 séances :

| Reco | Cas | Bon sens absolu | Bon sens vs marché | Écart moyen au marché |
|---|---|---|---|---|
| Acheter | 363 | 50 % | 29 % | −1,1 pt |
| Vendre | 2 093 | 50 % | 63 % | −2,1 pt |
| Conserver | 985 | — | — | −5,0 pt |

(L'écart uniformément négatif vient en partie de la comparaison d'une moyenne
équipondérée à un indice pondéré par la capitalisation.)

- Acheter et Vendre ne se distinguent presque pas : environ 1 point d'écart.
- 61 % des recommandations étaient « Vendre », en plein marché haussier. Au
  06/11, 26 valeurs sur 49 sont à Vendre.
- Cause : le DCF de criblage (`lib/dcf/ranking.ts`) actualise à environ 18 %
  (rf 6 % + prime action 8,13 % + prime pays 3,9 %, bêta 1) et applique un DCF
  par flux de trésorerie aux banques. Il pèse ±30 points pour un seuil de ±22 :
  il décide donc seul.
- Le « 56 % » de `/conseiller/track-record` porte sur 16 bascules, mesurées
  jusqu'à aujourd'hui quelle que soit leur date, sans comparaison au marché.
  Sa marge est d'environ ±25 points. Il ne mesure presque rien.

**Objectif retenu par l'exploitant** : battre le marché, mesuré honnêtement.
La cible initiale de 90 % de bons appels a été écartée : aucun moteur ne la
tient sans fausser la mesure. Le levier légitime est la sélectivité.

## 2. Règle de preuve (non négociable)

1. **Unité d'indépendance = la date, pas la valeur.** À chaque date de
   rebalancement non chevauchante (toutes les 20 séances), on calcule UN
   écart : rendement moyen du tiers haut moins celui du tiers bas, en excès
   du marché. L'intervalle de confiance à 95 % se calcule par bootstrap sur
   ces dates (par blocs pour les facteurs de tendance), jamais sur les cas
   regroupés. Cela fait environ 60 observations sur 2022-2026, pas des milliers.
2. **Pré-enregistrement.** La liste des facteurs, leurs paramètres et la règle
   de décision sont figés par écrit (`scraper/src/conseiller/PREREG.md`,
   commité) AVANT toute lecture de la période de validation.
3. **Réglage sur 2012-2021, validation sur 2022-2026, une seule fois.** Si l'on
   retouche quoi que ce soit après avoir vu la validation, celle-ci ne compte
   plus comme validation : il faut le noter et ne pas publier.
4. **Tests multiples** : correction de Holm sur l'ensemble des facteurs testés.
5. **C'est la règle livrée qui est prouvée, pas seulement les facteurs.** La
   décision finale (Acheter / Conserver / Vendre) doit elle-même battre le
   marché hors échantillon : rendement des Acheter moins rendement des Vendre,
   en excès du marché, IC à 95 % qui exclut zéro.
6. **Robustesse liquidité** : le résultat est recalculé en EXCLUANT les classes
   C/D, et pas seulement en les forçant à Conserver. Un effet qui disparaît
   sans elles est un artefact de cours figés.
7. **Si rien n'est prouvé, v2 ne part pas en production.** Le Conseiller dit
   alors qu'il s'abstient. C'est une issue acceptable, décidée d'avance.
8. **Contrôle demandé par Fable** : comparer la largeur des IC obtenus par
   bootstrap sur les dates et par regroupement des cas. Les deux chiffres
   figurent dans le rapport du banc.

Le banc existant (`scraper/src/signaux/evaluation.ts`) regroupe les cas de
toutes les valeurs : ses IC sont trop étroits. Il est corrigé selon le point 1
dans le même chantier, et son premier verdict (« rien de prouvé ») est
recalculé.

## 3. Données et pièges de calendrier

| Source | Historique | Usage |
|---|---|---|
| `brvm_actions_daily` (cours, volume) | 1998 → (5 904 séances) | tendance, risque, liquidité recalculée |
| `brvm_indices_daily` BRVMC | mai 2026 seulement | affichage ; le banc reconstruit un **indice équipondéré** depuis les cours |
| `income_statements` / `balance_sheets` annuels | exercices 2012-2025, ~5 par société | résultats, ROE, PER, P/B |
| `dividends` (montant, exercice) | variable ; `ex_date` depuis 04/2026 | rendement par exercice |
| `publications` | 1998 → (4 779) | événements |

- **Comptes** : l'exercice N n'est utilisable qu'à partir du **30 juin N+1**.
  On ne lit jamais un comparatif N-1 retraité dans les comptes N : chaque
  exercice vient de sa propre ligne.
- **Dividendes** : sans date réelle avant 04/2026, le dividende de l'exercice N
  n'est connu qu'à partir du **31 juillet N+1**. Si ce décalage ne tient pas
  sur les données, le facteur est retiré.
- **Couverture** : avec ~5 comptes par société, les facteurs fondamentaux ont
  peu de données avant 2019. Le banc publie, par facteur et par année, le
  nombre de valeurs couvertes. Sous 15 valeurs couvertes à une date, cette
  date est exclue pour ce facteur.
- **Survivants** : le banc liste les codes présents dans les cours anciens et
  absents aujourd'hui. Si l'univers historique ne peut pas être reconstitué
  (sociétés radiées absentes), le rapport le dit, et le verdict porte la
  mention « biais du survivant non corrigé ».

## 4. Facteurs candidats (figés dans PREREG.md avant validation)

Chaque facteur rend un score dans [−1, +1], ou `null` si l'entrée manque.
Il n'y a jamais de valeur fabriquée.

1. **Valorisation relative** : PER et P/B rapportés à la médiane de la même
   famille comptable (banque / assurance / général) à la même date. Moins
   cher = positif. Sans résultat positif, le PER est ignoré.
2. **Résultats** : évolution du résultat net sur le dernier exercice publié,
   et ROE comparé à la médiane de la famille.
3. **Dividende** : rendement de l'exercice connu à la date.
4. **Tendance relative** : performance sur 60 et 120 séances moins celle de
   l'indice équipondéré.
5. **Risque** : volatilité sur 60 séances et plus forte baisse sur 120 séances
   (plus faible = positif).
6. **Événements** : publication de comptes dans les 20 dernières séances
   (signe = sens de l'évolution du résultat publié).

Les facteurs non prouvés restent affichés comme **contexte**, sans peser sur la
décision : détachement de dividende à venir (calendrier officiel), notation
financière, DCF de criblage.

## 5. Décision

- **Garde-fou de liquidité** : classe C ou D (moteur `scraper/src/liquidity/`,
  recalculé sur l'historique) → « Conserver », avec la raison affichée.
- **Acheter** si au moins K facteurs prouvés sont ≥ +0,33 et aucun n'est
  ≤ −0,66. **Vendre** symétriquement. Sinon, **Conserver**.
- K vaut 3 par défaut et ne peut pas dépasser le nombre de facteurs prouvés.
  **Décidé d'avance** : avec moins de 2 facteurs prouvés, v2 ne recommande
  rien (abstention).
- Conviction = nombre de facteurs concordants et intensité moyenne, affichée
  comme « 3 facteurs sur 4 concordent », pas comme un pourcentage de réussite.

## 6. Architecture (verdict Fable : A)

- `scraper/src/conseiller/` :
  - `facteurs.ts` (pur) ;
  - `decision.ts` (pur) ;
  - `historique.ts` : chargement paginé, indice équipondéré, calendrier de
    disponibilité des comptes ;
  - `banc.ts` : protocole §2 ;
  - `runConseiller.ts` : écrit la séance du jour.
- CLI : `conseiller:banc` produit le rapport (JSON + Markdown dans
  `docs/conseiller/`), `conseiller [--ecrire]` écrit la séance du jour.
- Job quotidien dans `.github/workflows/score.yml`, après `score` et
  `liquidity`. Il est instrumenté par `monitored` et échoue si moins de 40
  lignes sont écrites.
- **Migration** : `advisor_history` gagne `moteur_version text not null
  default 'v1'` et `facteurs jsonb`. La clé primaire devient `(date_marche,
  code, moteur_version)`, pour que v1 et v2 coexistent pendant la transition.
  La RLS reste en lecture publique et l'écriture réservée à service_role.
  Aucune donnée personnelle n'est concernée.
- **Frontend** : `/conseiller` et `/conseiller/track-record` LISENT la version
  active (`advisor_moteur_actif` dans `feature_flags` ou constante). La route
  `api/cron/advisor-snapshot` est retirée une fois v2 en service. Le moteur v1
  reste dans le code jusqu'à la bascule.
- **Duplication** : aucune. Le frontend ne recalcule plus rien.

## 7. Track record refait

- Mesure à **20 séances**, en excès de l'indice de marché.
- Appels non chevauchants : un appel n'est compté qu'une fois par période de
  20 séances et par valeur.
- Affichage : « Bat le marché dans X % des appels (N appels, marge ±Y pts) »,
  écart moyen, et lien vers le rapport du banc.
- Les historiques v1 et v2 sont séparés et étiquetés. v1 n'est ni effacé ni
  mélangé à v2.
- `computeStats` (frontend, pur, testé) est réécrit selon ces règles.

## 8. Livraison par étapes

1. Banc corrigé (unité = date) et re-mesure de v1 et des signaux existants.
2. PREREG.md commité. Facteurs et décision, avec tests purs.
3. Banc v2 sur 2012-2021, puis une seule lecture de 2022-2026. Rapport.
4. **Porte humaine** : l'exploitant lit le rapport. Sans preuve, on s'arrête
   et le Conseiller affiche qu'il s'abstient.
5. Si prouvé : migration, job quotidien, frontend en lecture, nouveau track
   record. Bascule par drapeau.

## 9. Hors champ

- Apprentissage automatique (trop peu de données).
- Toute cible chiffrée de réussite annoncée avant mesure.
- Modification de `scoring/score.ts` (signaux §9) : règle du banc inchangée.

## 10. RGPD

Aucune donnée personnelle collectée ni traitée : uniquement des données de
marché et des comptes publiés.
