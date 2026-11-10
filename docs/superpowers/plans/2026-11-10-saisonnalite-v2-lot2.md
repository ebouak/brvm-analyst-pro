# Saisonnalité v2, lot 2 : faits mensuels en base, rendement total, confrontation

Spec : `docs/superpowers/specs/2026-11-10-saisonnalite-v2.md` §6, lot 2.
Lot 1 : PR #217 (calcul corrigé, verdict par cellule). Ce plan n'est pas commencé.

## But

Le calcul quitte le frontend. Un job du scraper écrit une ligne par valeur et par
mois dans `saisonnalite_mensuelle` ; la page lit cette table et confronte le mois
en cours à son habitude (F1), montre chaque année réelle (F2) et bascule entre
rendement total et cours seul (F4).

## Écarts avec la spec, à valider avant de coder

1. **Numéro de migration : `0206`, pas `0204`.** `0204` (NEIC) et `0205` (SAFC)
   ont été pris le 2026-11-10.
2. **Verdict : une seule source.** `verdictCellule` vit dans
   `frontend/lib/seasonality/compute.ts` (lot 1). Le scraper ne le recopie pas :
   il écrit des FAITS (rendements), le verdict reste calculé à la lecture, sur la
   fenêtre choisie par l'utilisateur. Seul le lot 4 (bilan figé, F11) aura besoin
   du verdict côté scraper ; la duplication se décidera alors.
3. **Seuil `établi`** : table de Student exacte (voir PR #217), pas 3,1.
4. **`difficulte` au lot 2 : deux critères sur quatre.** Résultat net négatif de
   l'exercice et dividende supprimé après une année payée viennent de tables
   fiables. Suspension et avertissement dépendent de `market_events`, dont la
   couverture est à mesurer (9 publications repérables selon la spec) : ils
   entrent au lot 3 avec les événements. La colonne existe dès maintenant.
5. **`evenements` au lot 2 : détachements seulement.** Comptes et assemblées
   arrivent au lot 3 (classement des publications à valider).
6. **Étape de cron** : nouveau job dans `score.yml` après `conseiller`. C'est une
   routine non surveillée : consultation `fable-advisor` AVANT de l'ajouter
   (règle du dépôt), une seule fois, sur ce plan.

## Tâches

Chaque tâche : tests vitest d'abord, puis le code, puis `npm run typecheck`.

### T1. Migration `0206_saisonnalite_mensuelle.sql`
- Table de la spec, PK `(code, annee, mois)`, RLS activée, policy de lecture
  publique, aucune policy d'écriture (service_role seul).
- Contrainte ajoutée : `rdt_total >= rdt_prix` quand les deux sont renseignés.
- Après application (avec accord) : test à la clé anon (lecture 200, insertion
  refusée) et scan des avis de sécurité.

### T2. `scraper/src/saisonnalite/mensuel.ts` (pur)
- `faitsMensuels(serie, dividendes, comptes, calendrierMarche, asOf)` → lignes.
- Entrées : `Serie` nettoyée par `nettoyerAllersRetours`, ruptures par
  `detecterRuptures`, rendement total par `rendementTotal` (importés du
  Conseiller, jamais recopiés).
- `exclu` : `sans_echange` (aucune séance cotée), `reprise` (mois qui suit un
  mois sans échange), `saut` (rupture non expliquée dans le mois).
- `complet = false` pour le mois de `asOf`.
- Tests : mois partiel ; mois sans échange puis reprise ; détachement (total >
  prix, écart = coupon / cours) ; rupture ; année de perte → `difficulte`.

### T3. Rendement du marché (pur, même fichier)
- `rdtMarche(faitsParValeur)` : moyenne équipondérée écrêtée à ±30 % des
  `rdt_total` non exclus. Même règle que `marketMonthlyReturns` du frontend.
- Test : égalité avec un cas calculé à la main.

### T4. `trajectoire.ts` et `confrontation.ts` (purs)
- `trajectoireMois`, `bandeHistorique`, `etatMois` selon la spec ;
  `trop_tot` avant la 5e séance, `historique_insuffisant` sous 5 années.
- Ces deux modules servent au frontend (trajectoire du mois en cours). Ils sont
  donc écrits dans `frontend/lib/seasonality/`, pas dans le scraper : le
  frontend ne recalcule pas ce que le scraper produit, mais la trajectoire
  séance par séance n'est pas stockée. À confirmer.

### T5. `horsEchantillon.ts` (pur, frontend)
- `bilanHorsEchantillon(faits, fenetre = 10)` : par mois, nombre d'années où le
  signe du profil des années précédentes s'est vérifié.

### T6. `runSaisonnalite.ts` + CLI
- `chargerHistorique()` du Conseiller (lecture paginée déjà faite), calcul,
  upsert par lots `onConflict: 'code,annee,mois'`, sous `monitored`.
- `npm run saisonnalite` ; sans `--ecrire` : passe à blanc qui imprime les
  contrôles. Sort en code 1 si un contrôle échoue.
- Contrôles par la donnée, imprimés et consignés dans la PR : ~9 000 lignes ;
  aucun `rdt_total < rdt_prix` ; détachements retrouvés (145 attendus) ;
  moyenne de `rdt_marche` en décembre proche de +3,5 %.

### T7. Frontend
- `lib/seasonality/server.ts` : lit `saisonnalite_mensuelle` (pagination), et
  les cours quotidiens seulement pour le mois en cours et les mêmes mois passés.
  Repli sur le calcul du lot 1 si la table est vide.
- `ConfrontationMois.tsx` (F1), `GrilleAnnees.tsx` (F2, option « hors années de
  difficulté »), bascule total / prix (F4), repères de détachement.
- Aperçu gratuit : l'état F1 en une phrase.
- `lib/premium/outils.ts` : lit `rdt_marche` sur tout l'historique (lève la
  limite des 5 ans du lot 1).
- Vérification dans un vrai navigateur (session locale, voir la mémoire).

### T8. Cron
- Après accord sur la consultation : job `saisonnalite` dans `score.yml`,
  `needs: conseiller`, puis `verify-data.ts saisonnalite` (échoue si la table
  est vide ou si le mois en cours manque).

## Hors lot 2
Fenêtres d'événement, frise des habitudes, suspensions et avertissements
(lot 3) ; vue Marché décomposée, liquidité, « Ce mois-ci », bilan figé, alertes
(lot 4).

## Points à trancher par l'exploitant
- T4 : trajectoire calculée côté frontend (proposé) ou stockée par le scraper ?
- Écart 4 : `difficulte` partielle au lot 2, acceptable ?
- Application de `0206` en production : à quel moment ?
