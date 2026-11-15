# Système de moyennes mobiles adapté à la BRVM

## Contexte et objectif

Le projet calcule déjà des SMA 20/50/200, des EMA 12/26 et les croisements
SMA20/SMA50. Ces mesures alimentent des graphiques et quelques détections, mais
ne constituent pas une lecture structurée de la tendance. La note A–F, elle,
vient du score global de `signals_daily` : elle ne doit pas être modifiée par
ce chantier.

La première version ajoute à la fiche action une lecture descriptive,
reproductible et compréhensible des moyennes mobiles, adaptée à un marché où les
séances et la liquidité diffèrent fortement d'un titre à l'autre. Elle ne
présente pas un croisement comme une prévision ou une recommandation.

## Décisions de conception

1. **Unité de temps : séances BRVM.** Les fenêtres SMA20, SMA50 et SMA200
   comptent des clôtures de séances, jamais des jours calendaires.
2. **Indicateurs principaux : SMA20, SMA50 et SMA200.** Elles donnent une
   lecture courte, intermédiaire et longue, et sont déjà calculées et
   persistées par le scraper. Les EMA12/26 restent visibles dans les outils
   techniques existants, mais ne sont pas un second vote de tendance dans ce
   nouveau module.
3. **Pas de note agrégée ni de seuil optimisé à la main.** La lecture présente
   le cours par rapport à chaque moyenne, les écarts en pourcentage, la pente
   récente et la structure des moyennes. Elle distingue une structure
   haussière, baissière, mixte ou incomplète. Elle ne produit ni BUY/SELL ni
   lettre A–F.
4. **Croisements comme événements descriptifs.** Un croisement SMA20/SMA50
   indique ce qui vient d'être observé et sa séance. Il ne déclenche pas
   d'ordre ni d'alerte dans cette version.
5. **Contexte sectoriel séparé.** La fiche peut afficher la largeur du secteur :
   la part des titres du même secteur dont le cours est au-dessus de la SMA50
   et de la SMA200 à la même séance, avec le nombre de titres disponibles.
   C'est un contexte collectif, pas un ajustement du score de la valeur. Si le
   secteur est inconnu ou si moins de trois titres ont une clôture publiée pour
   la séance analysée et la moyenne requise, afficher « données sectorielles
   insuffisantes ». Une clôture périmée ne compte pas comme une observation de
   cette séance.
6. **Données manquantes visibles.** Une moyenne nécessite autant de clôtures
   valides que sa fenêtre. Ne pas remplacer une moyenne indisponible par une
   valeur estimée, ni assimiler une absence de cours à une clôture nulle.

## Expérience utilisateur

Ajouter un bloc « Moyennes mobiles » à la lecture technique de la fiche action.
Il présente :

- le cours de référence et la séance utilisée ;
- SMA20, SMA50 et SMA200 : valeur, écart relatif du cours, et pente sur les
  cinq dernières séances où la moyenne est calculable ;
- un résumé de structure explicitement limité aux horizons calculables ;
- un croisement 20/50 s'il a eu lieu sur la dernière séance ;
- la largeur sectorielle SMA50/SMA200 et son effectif, quand calculable ;
- un avertissement concis : « Indicateurs descriptifs, non prédictifs. Les
  moyennes mobiles retardent par construction les mouvements de cours. »

Lorsque l'historique ne permet pas la SMA200, le bloc continue d'afficher les
informations 20/50 et annonce que la tendance longue est indisponible. Lorsque
les cours sont trop espacés faute d'échanges, l'interface affiche la date du
dernier cours et le nombre de séances; elle ne suggère pas que la dernière
observation est une cotation du jour.

## Architecture et flux de données

- Extraire les calculs de lecture dans une fonction pure côté frontend, séparée
  du score d'opportunité. L'entrée contient des clôtures positives, ordonnées
  par date de séance, avec leur date et code.
- Réutiliser les conventions SMA déjà établies dans `lib/indicators.ts`;
  éviter de faire diverger les résultats de la fiche et du scraper. Les tests
  compareront les dernières valeurs à `smaSeries`.
- Calculer le signal propre à la valeur à partir de la série déjà chargée par
  la fiche.
- Pour la largeur sectorielle, le chargeur serveur lit les titres ayant un
  secteur renseigné et leurs clôtures jusqu'à la séance analysée, en une
  requête paginée sur une fenêtre maximale de 400 jours calendaires. Pour
  chaque titre, les SMA sont calculées sur ses 200 dernières clôtures valides
  au plus à cette séance. Seuls les titres dont la clôture la plus récente est
  précisément celle de la séance analysée participent à la largeur; un titre
  sans SMA suffisante est exclu du dénominateur de la moyenne concernée. Les
  lectures incomplètes ou en erreur doivent échouer explicitement; elles ne
  deviennent pas un secteur à 0 % haussier. L'interface peut afficher
  « données insuffisantes » seulement si le chargement a réussi mais que les
  données ne satisfont pas les seuils documentés ci-dessus.
- Le module ne modifie ni `signals_daily`, ni `computeScore`, ni les seuils,
  ni le barème `scoreToRating`. Aucune migration n'est requise.

## Définitions calculatoires

- SMA(n) : moyenne arithmétique des n dernières clôtures de séance valides.
- Écart du cours à la SMA : `(cours / SMA - 1) × 100`, seulement si cours et
  SMA sont strictement positifs.
- Pente observée : `(SMA courante / SMA cinq séances auparavant - 1) × 100`,
  si les deux valeurs existent. C'est une mesure, pas une classification de
  pente « forte ».
- Structure haussière complète : `cours > SMA20 > SMA50 > SMA200`.
  Structure baissière complète : `cours < SMA20 < SMA50 < SMA200`.
  Sans SMA200, appliquer la même comparaison avec le triplet disponible
  `cours/SMA20/SMA50`, mais étiqueter explicitement la lecture « court et moyen
  terme seulement ». Toute autre configuration avec au moins SMA20 et SMA50
  calculables est « mixte ». Avec SMA20 seule, ne pas qualifier le régime :
  montrer uniquement le cours au-dessus/sous cette moyenne et signaler que la
  structure de tendance est incomplète.
- Croisement haussier 20/50 : SMA20 courante supérieure à SMA50 courante et
  SMA20 précédente inférieure ou égale à SMA50 précédente. Le croisement
  baissier est défini symétriquement. Aucun croisement n'est déclaré si une
  des quatre valeurs manque.
- Largeur sectorielle d'une moyenne : nombre de titres secteur avec clôture
  publiée à la séance analysée et au-dessus de la moyenne, divisé par le nombre
  de titres du secteur avec clôture publiée à cette même séance et disposant de
  cette moyenne, multiplié par 100. Afficher numérateur et dénominateur, sans
  seuil de jugement du type « bon secteur ».

## Données BRVM et précautions

- Les fenêtres sont en séances, car les jours sans cotation ne sont pas des
  observations.
- Les cours de clôture peuvent être répétés ou stables dans un marché peu
  liquide. L'affichage contextualise la fraîcheur et ne présente pas les
  répétitions comme une confirmation de tendance.
- Les prix historiques peuvent être affectés par des opérations sur titres.
  Avant d'interpréter les ruptures autour d'un fractionnement, il faut vérifier
  le traitement de l'historique dans la source; aucune correction historique
  non sourcée n'est inventée par ce module.
- Le secteur vient de `frontend/lib/brvmSectors.json`, référentiel curé déjà
  utilisé par la heatmap et les tableaux sectoriels. La colonne
  `brvm_instruments.secteur` n'est pas une source fiable (elle est quasi vide
  et emploie une ancienne classification). Un code absent du JSON reste sans
  secteur; aucune inférence par nom ou ticker.
- Les secteurs peu fournis restent affichables uniquement avec l'effectif
  disponible, et le minimum de trois titres s'applique à la largeur agrégée.

## Validation et critères d'acceptation

1. Tests purs : historique vide/court, exactement 20/50/200 clôtures,
   moyennes nulles/non positives, dates ordonnées, gaps, écarts, pentes et
   structures haussière/baissière/mixte.
2. Tests de croisements : franchissement haussier, baissier, absence de
   franchissement et valeur précédente manquante.
3. Tests sectoriels : largeur exacte, titres sans secteur, SMA indisponible,
   moins de trois pairs et absence de biais lorsqu'un titre ne dispose pas
   d'une observation.
4. Test de chargeur : pagination de toutes les pages et échec explicite si une
   requête de données échoue.
5. Vérification du rendu : cas SMA200 disponible, indisponible, données
   sectorielles disponibles et insuffisantes.
6. Vérifier que la valeur d'une SMA de la nouvelle lecture est égale à celle
   de la fiche actuelle sur les mêmes clôtures.
7. Le score, le signal et la note A–F restent inchangés.

Ce chantier ne valide pas un pouvoir prédictif. Une éventuelle utilisation
future dans le score ou pour des alertes exigera un rejeu hors échantillon par
secteur et aux horizons 5/20/60 séances, cas indépendants et intervalles de
confiance, avant toute modification des pondérations.

## Hors périmètre

- Modifier la note A–F, les signaux BUY/HOLD/SELL, leurs pondérations ou leurs
  seuils.
- Présenter les croisements comme des recommandations, objectifs de cours ou
  garanties de performance.
- Créer des moyennes sectorielles synthétiques ou imputer des données absentes.
- Ajouter des alertes automatiques, des ordres ou une migration SQL.
- Introduire une EMA comme deuxième vote de tendance dans cette première
  version.
