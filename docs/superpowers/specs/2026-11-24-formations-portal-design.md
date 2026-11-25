# Portail des formations — design

## Objectif

Faire de `/formations` une porte d’entrée claire vers les formats de formation
WESTBOURSE, visuellement cohérente avec l’Academy et ses modules, sans dupliquer
le catalogue détaillé de `/formations/academy`.

## Parti pris

Portail éditorial « Academy d’abord » : l’Academy est le parcours principal,
la Leçon 0 gratuite est le premier pas immédiat, et les sessions avec formateur
ainsi que les modules vidéo sont des formats complémentaires. Les replays et
conférences ne sont présentés que lorsqu’ils sont publiés.

L’esthétique reprend le système existant de l’Academy : surfaces sombres
adaptatives, bordures sobres, typographie display, accents cyan, badges courts
et cartes interactives. Elle ne crée ni nouvelle palette ni nouvelle logique de
progression.

## Structure de page

1. En-tête éditorial avec titre, bénéfice pédagogique et appel principal vers
   `/formations/academy`.
2. Carte de la Leçon 0 gratuite, conservée comme accès visible aux visiteurs.
3. Parcours complémentaires : Academy en premier, sessions en direct et modules
   vidéo si disponibles. Leurs volumes restent calculés depuis les données déjà
   chargées.
4. Aperçu compact des cours publiés, avec lien vers le catalogue complet plutôt
   qu’une seconde navigation exhaustive.
5. Replays et conférences uniquement si des éléments publiés existent.

## Comportements à préserver

- Conserver les routes et leurs destinations actuelles.
- Garder `canAccess('formations')`, `AccessGate`, `accesAcademy`,
  `OffresNiveaux` et l’ordre de priorité des accès.
- La Leçon 0 demeure accessible même lorsque le reste de la page est bloqué.
- Ne pas fabriquer de compte, de progression, de date ni de disponibilité.
- Ne pas afficher un format absent comme s’il était disponible.
- Maintenir les états vides existants et l’affichage responsive/accessibilité
  (titres hiérarchisés, liens focalisables, contrastes du thème).

## Hors périmètre

Pas de changement aux cours, règles d’accès, tarifs, données de session,
catalogue Academy, ni contenu des replays.

## Vérification

Exécuter les tests/typecheck frontend disponibles, puis vérifier le diff de
`frontend/app/formations/page.tsx` afin de confirmer que les modifications
locales antérieures restent intactes.
