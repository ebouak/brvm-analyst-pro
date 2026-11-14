# Documentation : espace Rapports

Refonte du 2026-11-12 (lots 1 et 2). Quatre produits, chacun nommé par la
question du lecteur. Le frontend ne lit que Supabase.

| Produit | Question | Route |
|---|---|---|
| Dossier valeur (A4) | Que vaut cette société ? | `/rapports/dossier/[code]`, bibliothèque `/rapports/dossiers` |
| Revue de résultats | Que disent les derniers comptes ? | `/actions/[code]/revue`, bibliothèque `/rapports/revues` |
| Événements et impact | Qu'est-ce qui vient de sortir, comment le cours a réagi ? | `/dashboard/reports/events`, fiche `/dashboard/reports/events/[id]` |
| Relevé mensuel | Où en est mon portefeuille ? | `/premium/reports` (refonte au lot 6) |

Onglets communs : `lib/reportTabs.ts`. Les anciennes pages (`/reports`,
`/dashboard/reports`, rapports instrument, secteur et séance, `/rapports/builder`,
`/rapports/print`, `/actions/[code]/rapport`) redirigent en 308
(`next.config.js`). La table `report_snapshots` reste en base (export et
suppression RGPD la couvrent) ; son interface est retirée.

## 1. Modèle de données (migration 0005_events.sql)

- **market_events** : un événement (publication, communiqué, avis…).
  `dedupe_hash` garantit l'idempotence. Types : `resultats`, `dividende`,
  `assemblee`, `notation`, `liquidite`, `gouvernance`, `admission`,
  `suspension`, `autre` (reclassement : migration `0214`).
- **market_event_instruments** : pivot événement ↔ titres. Le worker le
  SYNCHRONISE sur `related_codes` (il ne faisait qu'ajouter : une publication
  réattribuée gardait son ancien lien, « BIIC BN » rattachée à BICC).

## 2. Ingestion (scraper/src/events/)

`npm run events[:mock]`. Source principale : `fromPublications.ts` (table
`publications`). Classification `classify.ts` (familles précises d'abord :
notation, contrat de liquidité, dividende, gouvernance), résolution `resolve.ts`,
upsert `repository.ts`. Tests : `tests/eventsClassify.test.ts`.

## 3. Étude d'impact (frontend/lib/eventStudy.ts)

- Données chargées sur la seule fenêtre utile (`fenetreChargement` : 40 jours
  avant, 30 après), jamais l'historique entier par ordre croissant.
- Fenêtre post de 5 séances ; si moins de séances ont suivi J0, la mesure le dit
  (« fenêtre incomplète : n séances sur 5 ») et les horizons non atteints valent
  `null`.
- Écart au BRVM Composite `null` quand l'indice manque (historique BRVMC depuis
  le 2026-05-26).
- Les clôtures ne sont pas ajustées du dividende : un détachement dans la
  fenêtre est signalé sur la fiche (`detachementsDansFenetre`).

## 4. Liste des événements

Regroupement À L'AFFICHAGE (`lib/evenements/regroupement.ts`) : une publication
= société + période (`periodeDuTitre`) + famille ; les pièces (comptes, rapport
d'activités, attestation des commissaires aux comptes) sont listées sur la
fiche. Libellés français uniques : `lib/evenements/libelles.ts`.

### 4 bis. Événements et impact (lot 5, refonte Rapports)

- **Liste** : une ligne par publication regroupée (date, société avec logo, type
  en français, titre) et une colonne « Réaction à 5 séances » = écart du titre au
  BRVM Composite, calculé UNIQUEMENT par le contrat commun
  (`lib/reactionPublication.ts`). Un seul appel groupé pour la page
  (`chargerReactions`), mis en cache une heure
  (`reactionsCachees`, `lib/server/evenementsDonnees.ts`, clé = couples
  code|date). « en cours » si la fenêtre n'est pas close, « — » si non mesurable ;
  la réserve `RESERVE_REACTION` figure sous le tableau et sur la fiche.
- **En-tête « Séance du jour »** : indices BRVMC et BRVM30, nombre de hausses et
  de baisses (`souffleMarche`), publications de la dernière séance connue.
- **Filtres** : type, période (30 j, 90 j, 12 mois, tout), code, « mes valeurs »
  (listes de suivi + portefeuille, lus avec la SESSION de l'utilisateur, jamais
  mis en cache partagé, affichés seulement à un utilisateur connecté).
- **Fiche** : titre-constat dérivé de la mesure (`constatEvenement`, sans cause),
  chiffre géant (écart à l'indice), courbe J−10/J+10 base 100 en J0
  (`fenetreCourbe`, SVG serveur), tableau des horizons (`tableauHorizons`, via
  `eventStudy`), lien vers la source officielle, historique de la réaction du
  titre à ses publications du même type avec médiane (≥ 3 mesures).
- **Saison des résultats** `/rapports/saison` : la période « en cours » est
  celle qui a reçu le plus de publications de résultats sur 120 jours
  (`periodeDeSaison`) ; « N sociétés sur M ont publié » avec M = sociétés actives
  de `brvm_instruments`. Variation du CA et du résultat net seulement pour un
  exercice annuel dont les deux exercices sont extraits (`variationsComptes`) ;
  « non extrait » sinon (la base ne porte pas de comptes trimestriels).
- **Cartes de partage 1080 × 1080** (`next/og`, route Edge, clé anonyme,
  aucune donnée personnelle, 404 si l'objet n'existe pas) :
  `/api/evenements/[id]/carte` et `/api/dossier/[code]/carte` (données de marché
  publiques seulement, rien du contenu du dossier).

## 5. Textes générés

`narrative.ts` (titre de l'étude) et `reportCommentary.ts` (constats) : accords
et élisions testés sur 0, 1 et 2 titres, pourcentages à la française
(`fmtPctSigneTexte` : moins typographique, espace insécable). Aucune cause
affirmée : « mesuré autour de la date, non attribué à la publication ».

## 6. Revue de résultats

`lib/reports/server.ts` (`getRevue`) : 5 exercices comme le Dossier
(`EXERCICES_REVUE`), constat mesuré du dernier détachement
(`lib/reports/detachementRevue.ts`, même calcul que le Dossier).

## 7. Contrôle des dates de détachement

`scraper/scripts/controle-ex-dates.sql` (lecture seule) liste les ex-dates que
la baisse du cours ne confirme pas (règle `controleExDate`). Aucune correction
sans source.

## 8. API

| Endpoint | Rôle |
|---|---|
| `GET /api/events…` | Listing et détail des événements |
| `GET /api/reports/event/[id]?window=5` | Rapport d'événement + impact |
| `GET /api/reports/monthly/[month]` | Relevé mensuel |

## 9. Marché obligataire (§5.3)

Page `/obligations` + lib `frontend/lib/bonds.ts` (testée) :

- **YTM** par bisection (robuste, plage 0–100%), **duration de Macaulay** et
  **duration modifiée**, prix théorique.
- **Hypothèses** (documentées car BDFIN ne détaille pas toutes les
  caractéristiques) : valeur nominale 10 000 FCFA, coupon annuel = taux nominal,
  fréquence 1/an, maturité en années = (date maturité − aujourd'hui)/365,25.
  Toutes ajustables dans `BondInputs`.
- **Courbe des taux** (`YieldCurveChart`) : YTM vs maturité, une série par
  émetteur.
- **Comparatif obligation vs rendement dividende actions** : le côté
  obligataire (YTM) est fourni ; le rendement dividende des actions nécessite
  l'ingestion des dividendes (brique future §6.8) — signalé honnêtement dans
  l'UI plutôt qu'inventé.
