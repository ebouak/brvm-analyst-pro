# Portefeuille virtuel BRVM et défis par équipes

Date : 2026-11-15  
Statut : proposition de conception, à valider avant implémentation

## 1. Objectif

Faire évoluer le paper trading actuel — un compte individuel où l'on ouvre ou
ferme immédiatement une position au dernier cours connu — vers un outil
pédagogique permettant de simuler des ordres sur des valeurs BRVM et de
participer à des défis individuels, d'équipe ou d'établissement.

Le produit ne passe aucun ordre réel et ne doit jamais laisser croire qu'une
exécution simulée est une exécution BRVM garantie.

## 2. État de départ et données disponibles

- `paper_trading_accounts` impose actuellement un compte par utilisateur ;
  `paper_trading_positions` enregistre des positions, pas un journal d'ordres.
- L'ouverture prend le dernier cours connu et la clôture valorise au dernier
  cours connu. Les écritures de métriques sont protégées côté serveur.
- Un classement individuel public anonymisé existe, avec participation
  facultative.
- `brvm_carnet_daily` contient, par code et date de séance, les meilleures
  limites d'achat et de vente publiées au Bulletin Officiel de la Cote, leurs
  quantités résiduelles et le cours de référence. Une limite ou une quantité
  absente reste `NULL`.
- Le bulletin est publié après la séance ; il représente un relevé daté, pas
  un flux d'ordres complet, horodaté et exécutable. Les cours de clôture et
  volumes proviennent des tables quotidiennes du marché.
- Les règles BRVM consultées décrivent le marché au comptant et la cotation
  par fixing. Les pas de cotation, frais et paramètres d'exécution applicables
  doivent être confirmés sur les règles en vigueur avant leur codification.

## 3. Produit proposé

### 3.1 Portefeuilles et ordres simulés

Un membre conserve un portefeuille personnel, avec plusieurs scénarios
nommés possibles à terme. Un défi utilise un portefeuille isolé et un capital
virtuel identique pour tous ses participants. L'interface ajoute un ticket
d'ordre, un portefeuille valorisé, les liquidités disponibles, les positions,
les ordres en attente et un journal auditable des exécutions simulées.

Types d'ordre de la première version :

- **Au mieux simulé** : instruction sans limite de prix, exécutée au fixing
  d'une séance future disponible selon le modèle choisi.
- **À cours limité** : achat exécutable seulement si le fixing futur est au
  plus égal à la limite ; vente seulement si le fixing est au moins égal à la
  limite.
- Une quantité non exécutée peut rester en attente jusqu'à son échéance,
  être annulée, ou être exécutée partiellement par le mode prudent.
- Pas de vente à découvert ni de portefeuille sur marge. Les ordres d'achat
  ne peuvent engager plus que les liquidités disponibles ; les ventes ne
  peuvent dépasser les titres détenus. Les liquidités réservées à des ordres
  ouverts ne sont pas réutilisables.

Chaque ordre conserve le cours source, la date de la séance évaluée, la
quantité demandée, exécutée et restante, la règle appliquée, les éventuels
frais, et la raison de non-exécution. Une correction ou relance du traitement
ne doit pas produire un second remplissage.

### 3.2 Deux modèles de simulation

1. **Fixing** (mode accessible) : évalue l'ordre contre le cours de clôture
   publié à la première séance admissible après sa saisie. Si la limite est
   respectée, l'ordre est rempli au fixing, sous réserve du solde disponible.
   Il s'agit d'une simulation simplifiée, pas d'une reconstitution de la
   séance.
2. **Prudent avec indication BOC** (mode recommandé pour les défis) : reprend
   la même règle de prix au fixing, et utilise le dernier BOC disponible avant
   la séance comme signal de liquidité/opposition. Si le carnet manque,
   comporte une limite au marché ou ne donne pas les données nécessaires,
   l'interface l'indique et n'invente pas de profondeur. Le moteur peut laisser
   l'ordre en attente ou limiter sa quantité simulée selon la règle qui sera
   explicitement approuvée et testée. Toute exécution partielle est étiquetée
   « estimée ».

Les quantités résiduelles du BOC ne sont jamais présentées comme les quantités
effectivement exécutées par un ordre hypothétique. Le bulletin ne révèle ni la
file complète, ni son horodatage intraday, ni les ordres ajoutés/modifiés
après sa publication. Le volume journalier est également un total observé, pas
une promesse de capacité disponible à cet ordre. Il ne faut donc pas prétendre
simuler exactement la priorité, le prorata ou l'appariement BRVM.

La règle quantitative de remplissage partiel du mode prudent (notamment
l'usage éventuel du volume échangé et de la quantité résiduelle opposée) est un
point de décision à confirmer avant l'implémentation. En l'absence de règle
validée, le mode prudent ne doit pas fabriquer de taux de participation.

### 3.3 BOC dans l'expérience

Sur le ticket d'ordre et la fiche valeur, montrer la dernière séance BOC
disponible, la meilleure limite et quantité résiduelle de chaque côté, le
spread uniquement si les deux cours limites sont présents, et un indicateur
de déséquilibre seulement si les quantités des deux côtés sont exploitables.
Afficher aussi l'âge de l'information et un libellé explicite du type
« Bulletin de la séance du JJ/MM — publié après clôture ». Le carnet est un
contexte pédagogique ; il ne remplace ni le cours de fixing ni les règles de
simulation.

## 4. Défis, équipes et établissements

- Un utilisateur peut créer/rejoindre une équipe ou être invité dans un
  établissement.
- Un établissement est un espace privé comportant des responsables et des
  équipes/cohortes ; un responsable crée un défi avec dates, capital initial,
  univers de valeurs et règle de simulation. Les membres rejoignent par
  invitation à durée limitée.
- Chaque participant prend ses propres décisions et possède son portefeuille
  privé de défi. Un portefeuille collectif avec ordres décidés à plusieurs
  n'entre pas dans la première livraison.
- Le classement compare les participants d'un même défi, avec mêmes dates,
  capital virtuel et règles. Le rang n'est pas basé uniquement sur le gain :
  afficher rendement, drawdown maximal, nombre d'ordres et respect du cadre.
- Le score d'équipe est une moyenne équipondérée des rendements des membres
  ayant commencé le défi, sans pondération par leur capital réel ou virtuel.
  La formule est visible aux participants.
- Par défaut, un coach voit la participation et la progression pédagogique,
  pas les ordres individuels ni les gains détaillés d'un membre. Une vue
  financière nominative nécessite le consentement explicite de ce membre.
- Le classement individuel public existant reste distinct des défis privés ;
  rejoindre un défi ne vaut pas consentement à figurer dans le classement
  public.

## 5. Architecture et sécurité

### Données et services

Séparer les ordres simulés des positions matérialisées :

- un journal d'ordres, append-only pour les transitions importantes, avec
  utilisateur, compte/défi, code, sens, type, limite, quantité, échéance,
  statut et dates ;
- des exécutions simulées idempotentes, rattachées à un ordre et à la séance,
  portant le prix et la quantité simulés et les sources ayant justifié le
  résultat ;
- des portefeuilles de défi, adhésions, équipes, établissements, rôles et
  invitations, avec relations explicites et contraintes d'unicité ;
- un moteur pur de décision d'exécution, séparé de l'adaptateur Supabase.

Les ouvertures, annulations, évaluations de séance et remplissages passent par
des routes/services serveur et fonctions SQL transactionnelles avec
verrouillage du portefeuille. Une seule transaction réserve le cash/titres,
crée l'exécution et met à jour les positions ; les clés uniques rendent les
reprises idempotentes. Seul le serveur écrit les soldes, exécutions et métriques
de classement. Les clients ne soumettent jamais un `user_id` fiable : l'identité
vient de la session.

RLS obligatoire pour chaque nouvelle table. L'accès aux espaces d'établissement
est borné par adhésion et rôle ; les invitations sont à usage limité, expirables
et non devinables. Aucune donnée d'établissement, adhésion ou performance
nominative n'est publique. Prévoir export et suppression RGPD, rétention des
invitations et journal d'audit des actions d'administration.

### Évaluation des ordres

Évaluer les ordres après l'ingestion d'une nouvelle séance, jamais sur une
séance antérieure à la soumission. Le traitement sélectionne explicitement la
dernière séance admissible de chaque valeur et le BOC antérieur à cette séance.
Une absence de cours ou d'information requise donne un état explicite « en
attente de données » ou « non exécuté », jamais une réussite silencieuse.

## 6. Déploiement par étapes

1. **Fondations individuelles** : états de compte, ordres au fixing, cash/titres
   réservés, historique et audit ; conserver l'expérience individuelle existante
   pendant une migration contrôlée.
2. **Simulation enrichie BOC** : affichage du BOC horodaté par séance et modèle
   prudent après validation de sa règle quantitative ; tests de non-fuite
   temporelle et d'absence de données.
3. **Défis privés et équipes** : portefeuilles isolés, invitations, classement
   d'équipe équipondéré et paramètres de défi.
4. **Espaces d'établissement** : rôles responsables/coachs/membres, cohortes,
   gestion d'invitations, vues pédagogiques minimales ; pilote limité avant
   ouverture générale.

Les étapes 1 et 2 constituent le premier lot d'implémentation. Les étapes 3 et
4 suivent après validation du modèle d'ordres et du pilote. Aucun ordre réel,
intégration SGI, exécution intraday ou portefeuille collectif n'est inclus.

## 7. Frais, benchmark et avertissements

Ne pas inventer commissions, taxes, pas de cotation ou dates de règlement.
Tant que le barème officiel applicable n'est pas confirmé, afficher les
performances avant frais et signaler que les coûts ne sont pas modélisés.
L'indice de référence est affiché séparément et aligné sur la période du défi ;
il ne modifie pas le classement par défaut. Les écrans, exports et règlements
de défi rappellent qu'il s'agit d'un outil de simulation et d'apprentissage,
pas d'un conseil en investissement.

## 8. Vérifications et tests attendus

- Tests purs : sens achat/vente, fixing vs cours limite, ordre au mieux,
  échéance, partiel, solde insuffisant, titres insuffisants, cours absent,
  carnet absent ou incomplet, ordre au marché, idempotence.
- Tests temporels : ordre saisi après une séance jamais évalué sur cette séance ;
  le BOC utilisé doit précéder la séance évaluée.
- Tests de concurrence : deux ordres parallèles ne dépassent jamais cash ou
  titres disponibles ; une reprise ne duplique pas un remplissage.
- Tests RLS avec clé anon, membre d'une autre équipe, coach et responsable ;
  vérifier l'isolation des portefeuilles et le consentement sur la vue
  nominative.
- Tests de migration : l'ancien compte et ses positions restent lisibles et
  cohérents ; pas de double comptage au passage au journal d'ordres.
- Tests de produit : défis aux mêmes dates/règles, calcul d'équipe à poids égal,
  retrait/révocation d'invitation et suppression/export des données personnelles.

## 9. Décisions restant à valider

1. La règle quantitative exacte du mode prudent : le seul carnet BOC ne permet
   pas d'en déduire une exécution. Une option simple et vérifiable est d'utiliser
   le BOC comme indicateur seulement et de remplir au fixing ; une option plus
   conservatrice laisse l'ordre en attente lorsqu'il manque une donnée, mais
   n'est toujours pas une simulation de file exacte.
2. Le public pilote et le modèle d'accès des établissements (gratuit, Premium
   ou offre institutionnelle).
3. Le barème de frais et les règles de pas/validité applicables, à confirmer
   auprès d'une source officielle avant simulation nette de frais.
4. La visibilité des métriques détaillées au coach ; la présente proposition
   privilégie la confidentialité par défaut.
