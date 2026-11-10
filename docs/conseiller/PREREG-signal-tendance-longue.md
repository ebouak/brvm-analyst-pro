# Pré-enregistrement : test confirmatoire du signal « tendance longue »

Écrit le 10 novembre 2026, avant toute donnée du test. Version de la règle : `tendance-longue-v1-2026-11-10`.
Code : `scraper/src/conseiller/signal.ts` (règle), `signalEvaluation.ts` (test), `runSignal.ts` (I/O).

## 1. Pourquoi un test confirmatoire

La règle a été trouvée en regardant l'historique 2008-2026, après une trentaine de variantes essayées. Son résultat historique est donc EXPLORATOIRE : il ne prouve rien. Seules des données que personne n'avait vues au moment de figer la règle peuvent la confirmer. Ce document fige la règle, la statistique, le seuil et le calendrier de lecture avant que ces données existent.

Ce protocole ne remplace pas celui du banc v2 (`docs/superpowers/specs/2026-11-09-conseiller-v2-design.md`) et ne modifie aucune famille de facteurs ni aucun seuil de `scoring/score.ts`.

## 2. Données du test

- Seules comptent les séances de signal STRICTEMENT postérieures au 10 novembre 2026 (première séance possible : le 11 novembre 2026).
- Les états testés sont ceux ÉCRITS dans `conseiller_signaux` le soir de chaque séance par le job quotidien. Ils ne sont jamais recalculés pour le test. Une ligne écrite plus de 4 jours après sa séance est écartée et comptée dans le rapport. Aucune commande ne réécrit une séance passée.
- Une séance sans signal d'époque (panne du job) est perdue pour le test ; le rapport en donne le nombre.
- Les cours servant à mesurer la suite passent par la chaîne de nettoyage existante (erreurs de saisie retirées, ruptures non expliquées détectées), inchangée.

## 3. Règle figée

Toutes les fenêtres se comptent en séances du calendrier du marché, cours reportés les jours sans échange.

1. Éligibilité : valeur cotée depuis 250 séances au moins et échangée (volume > 0) lors de 60 % au moins des 60 dernières séances.
2. Deux performances de cours, sur 120 et sur 250 séances. Une performance est absente si la valeur n'était pas cotée au début de la fenêtre, si une rupture non expliquée tombe dans la fenêtre ou si moins de 60 % des séances de la fenêtre ont été échangées.
3. Chaque performance est classée parmi les valeurs éligibles, rang ramené entre −1 et +1 (ex æquo : rang moyen ; moins de 6 valeurs classées : pas de rang).
4. Score = moyenne des rangs disponibles.
5. États : « À éviter » si score ≤ −1/3 ; « Favorable » si score ≥ +1/3 ; « Neutre » entre les deux ; « Pas de signal » si la valeur n'est pas éligible ou n'a aucun rang.
6. Affichage : l'état montré aux abonnés est celui de la première séance du mois civil (`revision = true`), conservé jusqu'à la révision suivante.

## 4. Hypothèse et statistique

Une seule hypothèse est testée : les valeurs « À éviter » font MOINS BIEN que l'ensemble des valeurs éligibles sur les 60 séances qui suivent.

- Pour chaque séance de signal t : moyenne des rendements des valeurs « À éviter » moins moyenne des rendements de toutes les valeurs éligibles, de la clôture de t+1 à la clôture de t+61.
- Rendement total des deux côtés (cours + dividendes détachés dans la fenêtre). Observation exclue si une rupture non expliquée tombe dans la fenêtre, ou si un dividende connu sans date de détachement peut y avoir détaché.
- Pas de frais : l'hypothèse porte sur une abstention, pas sur un achat.
- Statistique : moyenne de ces écarts sur toutes les séances de signal de la période. Les cohortes quotidiennes se chevauchent ; la dépendance est traitée par le bootstrap, pas ignorée.
- Test unilatéral (sens négatif). Bootstrap stationnaire, bloc moyen de 120 séances, 10 000 tirages, graine 20261110. Confirmé si la borne haute de l'écart moyen, au niveau de l'étape, est strictement négative.

Le cas « Favorable » n'est PAS testé : son historique n'est pas significatif (t ≈ 1,5). Il est seulement décrit dans les rapports et affiché comme « non prouvé ».

## 5. Calendrier de lecture

Deux lectures, et deux seulement. Le risque total de conclure à tort est borné à 1 % + 4 % = 5 %.

| Étape | Signaux retenus | Lue quand la cohorte du… est close | Seuil unilatéral |
|---|---|---|---|
| Intermédiaire | du 11 novembre 2026 au 10 novembre 2031 | 10 novembre 2031 | 1 % |
| Finale | du 11 novembre 2026 au 10 novembre 2036 | 10 novembre 2036 | 4 % |

- « Confirmé » à l'étape intermédiaire clôt le test. Sinon le test continue jusqu'à l'étape finale, dont le verdict est définitif.
- Entre les étapes, `npm run conseiller:confirmation` peut être lancé à volonté : il renvoie un rapport DESCRIPTIF (`verdict: "descriptif"`). Un rapport descriptif n'autorise aucune affirmation de preuve, quel que soit son contenu.
- Tout changement de la règle, de la statistique ou du calendrier crée une nouvelle version et remet le compteur à zéro.

## 6. Règle de retrait (non confirmatoire)

À tout rapport portant sur 750 séances de signal ou plus, si l'écart moyen des valeurs « À éviter » est positif ou nul (elles ont fait au moins aussi bien que le marché), l'affichage est suspendu : `feature_flags.conseiller_signal` repasse à `disabled`. Le test, lui, continue jusqu'à son terme. Cette règle ne peut qu'arrêter l'affichage ; elle n'augmente pas le risque de conclure à tort.

Sur l'historique, 12 fenêtres de trois ans sur 63 ont un écart moyen positif : même si l'effet est réel, cette règle a environ une chance sur cinq de suspendre l'affichage à tort.

## 7. Puissance : ce que ce test peut et ne peut pas montrer

Relecture exploratoire de l'historique par la chaîne du dépôt (`npm run conseiller:signal-historique`, 4 470 séances de 2008 au 10 novembre 2026) : écart moyen de −1,9 % par cohorte de 60 séances, soit −8,0 % par an, t = −3,2 ; écart négatif 63 % des séances.

Si l'effet réel était égal à cet écart historique, la probabilité de le confirmer serait d'environ :

| Durée | Seuil | Probabilité de confirmer |
|---|---|---|
| 5 ans | 1 % | 23 % |
| 5 ans | 5 % (pour mémoire) | 47 % |
| 10 ans | 4 % | 68 % |
| 12 ans | 5 % (pour mémoire) | 79 % |

Ces chiffres sont optimistes : un effet repéré après une trentaine d'essais est en général plus faible qu'il n'y paraît. Conséquences à assumer :

- Aucune confirmation n'est possible avant novembre 2031, et la plus probable n'arrive qu'en 2036.
- « Non confirmé » ne voudra pas dire « faux » : le marché compte une cinquantaine de valeurs et le test manque de puissance.
- Jusqu'au verdict, toute présentation du signal doit dire « mesure historique exploratoire, confirmation en cours ».

## 8. Rapports

`npm run conseiller:confirmation` (lecture seule) renvoie : nombre de séances attendues et de séances avec signal d'époque, lignes écartées pour retard, lecture « À éviter » (étape, verdict, borne haute, écart moyen, écart annualisé, détail par année, règle de retrait), et deux descriptifs : cohortes formées aux seules séances de révision mensuelle (ce que l'abonné a vu) et état « Favorable ».

Un rapport par an, daté, est à ranger dans `docs/conseiller/` et à publier sur la page de méthode.

## 9. Ce qui n'est pas couvert

- Le biais du survivant de l'historique (une seule valeur radiée en base) ne touche pas le test futur, mais touche les chiffres exploratoires affichés.
- Le signal est général : il ne tient compte ni du portefeuille ni de la situation de l'abonné.
- La qualification juridique de l'affichage (information ou recommandation d'investissement) relève d'un avis juridique, pas de ce protocole.
