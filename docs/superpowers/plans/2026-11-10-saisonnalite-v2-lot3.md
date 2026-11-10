# Saisonnalité v2, lot 3 : événements

Spec : `docs/superpowers/specs/2026-11-10-saisonnalite-v2.md` §5 (F5, F6, F7) et §6 lot 3.
Lot 2 : PR #218 (fusionnée le 2026-11-10).

## Données disponibles (mesurées le 2026-11-10)

| Événement | Source | Volume | Usage |
|---|---|---|---|
| Détachement | `dividends.ex_date` réelle ou reconstituée | 145 | fenêtre + frise |
| Comptes annuels | `publications`, titre « exercice AAAA » sans semestre/trimestre | 845 | fenêtre + frise |
| Comptes semestriels | `publications`, titre « semestr » | 970 | fenêtre + frise |
| Avis de convocation à l'AG | `publications` type `ag`, titre « convocation » | ≈ 800 | fenêtre + frise |
| Suspension | `market_events` type `suspension`, hors avis de reprise | 8 (2009-2011) | difficulté seulement |
| Avertissement sur résultat | `publications`, titre « avertissement » / « profit warning » | 3 | difficulté seulement |

La date d'un avis de convocation n'est PAS celle de l'assemblée : l'interface dit
« avis de convocation », jamais « assemblée ».

## Tâches

1. `scraper/src/saisonnalite/evenements.ts` (pur) : `classerPublication(libelle, type)`,
   `suspensionsUtiles(titres)`. Tests sur des titres réels.
2. `mensuel.ts` : `evenements` porte aussi comptes, convocations, suspensions,
   avertissements ; `anneesDifficiles` ajoute les années de suspension et
   d'avertissement (critères 3 et 4 de la spec).
3. `fenetres.ts` (pur) : rendement total quotidien, marché quotidien équipondéré
   écrêté ±30 %, parcours de l'écart au marché de −20 à +40 séances (base : la
   séance qui précède la fenêtre), agrégé par rang ; délai de retour au cours
   d'avant détachement à 20, 60 et 250 séances. Fenêtre écartée si incomplète ou
   traversée par une rupture non expliquée.
4. Migration `0207_saisonnalite_fenetres.sql` : `(code, type_evenement, rang)`,
   `code` vaut un code de valeur ou `MARCHE` (pas de clé étrangère), RLS lecture
   publique, écriture service_role. Lignes `retour_coupon` : `rang` = horizon,
   `part_positifs` = part des détachements revenus au cours de la veille.
5. Runner : publications et suspensions lues en plus, fenêtres écrites dans le même
   passage (même job, mêmes garde-fous) ; contrôle : fenêtre MARCHE du détachement
   avec n ≥ 100 ; suppression des lignes périmées plafonnée.
6. Frontend : `FriseEvenements` (F5 : mois habituel de chaque événement, « en mai
   4 années sur 5 », prochain détachement connu, liens `/calendrier` et
   `/dividendes`) ; `FenetreEvenement` (F6 : parcours par valeur si n ≥ 4, sinon
   celui du marché, dit comme tel).

Pas de nouveau cron : le job `saisonnalite` revu au lot 2 calcule aussi les fenêtres.
