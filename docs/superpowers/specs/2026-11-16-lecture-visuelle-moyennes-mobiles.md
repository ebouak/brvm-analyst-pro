# Lecture visuelle des moyennes mobiles

## Objectif

Rendre la section « Moyennes mobiles » de la fiche action compréhensible sans
connaissance préalable des SMA. La lecture doit expliquer en termes simples
comment le cours se situe par rapport aux moyennes de 20, 50 et 200 séances,
avec un graphique construit exclusivement depuis l’historique réel du titre.
Cette lecture reste descriptive et ne modifie ni le score, ni la note A–F, ni
les signaux existants.

## Constat

La fiche affiche déjà les dernières clôtures, les SMA, les écarts en
pourcentage, la pente sur cinq séances, un résumé de régime et la largeur
sectorielle. Toutefois, les notions ne sont pas définies et la mention
« Structure mixte » n’explique pas le constat lisible dans les chiffres.
L’historique chargé par la page contient jusqu’à 600 séances et alimente déjà
`analyzeMovingAverages`.

## Expérience proposée

1. Ajouter un graphique compact des 120 dernières clôtures valides, avec les
   séries réelles du cours et des SMA 20, 50 et 200. Le calcul des moyennes est
   effectué avant le découpage des 120 points affichés, afin que la SMA 200
   reste correcte dès le début de la fenêtre.
2. Donner une légende persistante et distincte pour chaque ligne : « Cours de
   clôture », « Moyenne 20 séances · récent », « Moyenne 50 séances ·
   intermédiaire » et « Moyenne 200 séances · long terme ». Une couleur n’est
   jamais le seul identifiant.
3. Produire une phrase déterministe depuis les écarts déjà calculés : cours
   au-dessus, en dessous ou au niveau de chaque moyenne disponible, puis
   synthèse concordante, contrastée ou incomplète. Les positions observées
   priment sur les étiquettes abstraites « haussière/baissière ».
4. Ajouter une explication d’une phrase sur le sens des horizons, puis
   reformuler « Écart du cours » et « Pente sur 5 séances » en libellés lisibles
   et munis d’une aide courte.
5. Présenter l’échelle de temps et le périmètre analysé; si l’historique ou une
   moyenne manque, conserver les valeurs indisponibles comme telles et expliquer
   pourquoi. Ne jamais dessiner une série inventée ni interpoler une clôture
   absente.

## Calcul et source des données

- Réutiliser les 600 lignes de `brvm_actions_daily` déjà chargées par la fiche.
- Construire les SMA avec `smaSeries`, la même fonction que le calcul existant,
  sur les clôtures valides triées chronologiquement.
- Calculer chaque moyenne avant de ne garder que les 120 observations récentes
  du graphique. Une SMA apparaît uniquement après assez de clôtures valides.
- Réutiliser `MovingAverageReading` pour le dernier cours, les écarts, les
  pentes et la disponibilité. Extraire au besoin une fonction pure testable pour
  construire les points du graphique et le texte de lecture.
- Garder la largeur sectorielle existante inchangée.

## Présentation et accessibilité

- Respecter les jetons et conventions visuelles déjà utilisés sur la fiche
  action; ne pas introduire de palette étrangère ni de nouvelle dépendance.
- Montrer le graphique avant les cartes chiffrées, en gardant les détails et
  la largeur sectorielle comme lecture complémentaire.
- Fournir une description accessible contenant les dates et l’explication;
  la légende doit rester lisible sans différenciation par couleur seulement.
- Préserver une mise en page étroite mobile, les contrastes et les états de
  focus existants; aucun mouvement animé n’est nécessaire.

## Garde-fous et cas limites

- Un cours au-dessus d’une moyenne signifie seulement que sa clôture est
  supérieure à cette moyenne calculée; ce n’est ni une prévision, ni un signal
  d’achat ou de vente.
- Les données absentes, nulles, non finies ou non positives ne
  deviennent pas des points de cours. Les moyennes insuffisamment alimentées
  restent absentes et sont nommées comme telles.
- Le texte de synthèse doit couvrir toutes les configurations de disponibilité
  et de position, sans prétendre qu’un croisement vient d’avoir lieu si le
  calcul existant ne l’a pas établi.
- L’historique vide ou insuffisant produit un état pédagogique explicite plutôt
  qu’un graphique vide ou une erreur.

## Validation

- Tests purs : ordre chronologique, fenêtre affichée de 120 points, SMA calculée
  avant découpage, valeurs manquantes, historique trop court et phrases pour
  cours au-dessus/sous/à des positions contradictoires.
- Tests du composant : légende et explication présentes, avertissement
  descriptif, état incomplet correctement annoncé.
- Vérifier le typecheck frontend et les tests ciblés, puis visualiser la fiche
  à une largeur bureau et mobile.
