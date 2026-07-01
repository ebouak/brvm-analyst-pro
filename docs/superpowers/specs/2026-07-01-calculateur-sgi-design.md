# Calculateur de coût SGI — Design

**Date :** 2026-07-01
**Statut :** Spec validée (source des frais : hybride) — non implémentée

## Contexte

`/comparateur-sgi` existe déjà : annuaire des SGI par pays UEMOA (nom, type,
groupe, dépôt minimum indicatif) + 6 critères de choix + FAQ. Le critère n°1
(« Le coût réel ») énonce déjà ce qu'il faut comparer : *« le courtage en
pourcentage, mais aussi les frais fixes par ordre, les droits de garde annuels
et les frais de virement. Pour de petits montants, un minimum de perception
pèse souvent plus lourd que le taux affiché »* — mais aujourd'hui rien ne le
calcule : un seul ordre de grandeur générique marché est affiché (« ≈ 1–1,5 %
indic. »), identique pour toutes les SGI.

`/simulateur-budget` (lien déjà posé depuis le comparateur) fait autre chose :
compose des portefeuilles types (dividende/croissance/équilibré) à partir d'un
montant et de frais **saisis manuellement**. Ce n'est pas un comparateur de
coût entre SGI.

**Gap réel** : aucun outil ne répond à *« pour tel montant, chez quelle SGI
est-ce le moins cher, et pourquoi ? »*.

## Contrainte fondatrice : pas de barème de frais fiable en base

Il n'existe aujourd'hui aucune donnée de frais (courtage %, frais fixes,
droits de garde) par SGI individuelle — seulement l'ordre de grandeur marché
générique cité plus haut. Inventer des barèmes précis par SGI serait une
violation directe de la règle du produit (aucune donnée non vérifiée
présentée comme un fait).

**Décision validée : approche hybride.**
- Quand un barème réel est confirmé (site officiel, document SGI, contact
  direct), il est saisi une fois par un administrateur, avec sa source et sa
  date de vérification, et devient la valeur par défaut affichée pour cette SGI.
- Tant qu'aucun barème n'est confirmé, le champ reste vide et **l'utilisateur
  le renseigne lui-même** pour lancer le calcul — jamais de valeur inventée
  affichée comme un fait.
- Chaque ligne de résultat porte un badge explicite : **« Barème confirmé
  (date) »** ou **« Estimation saisie par vous »**. Aucune ambiguïté possible
  entre les deux.

## Modèle de données

Nouvelle table (extension de l'annuaire SGI existant, actuellement en dur dans
`SgiComparator.tsx` — voir note migration ci-dessous) :

```sql
create table public.sgi_frais (
  id                  uuid primary key default gen_random_uuid(),
  sgi_nom             text not null,            -- clé naturelle vers l'annuaire SGI (nom)
  courtage_pct        numeric(5,3),              -- ex. 1.200 = 1,2 %
  frais_fixe_ordre    numeric(12,2),             -- FCFA, par ordre (achat ou vente)
  droits_garde_pct_an numeric(5,3),              -- % annuel de la valorisation du portefeuille
  minimum_perception  numeric(12,2),             -- FCFA minimum facturé par transaction
  frais_virement      numeric(12,2),             -- FCFA, forfait retrait/virement
  source_url          text,                      -- lien vers le document/page source
  verifie_le          date,                      -- date de vérification humaine
  notes               text,                      -- particularités (palier, promo, etc.)
  updated_at          timestamptz not null default now()
);
```

- `courtage_pct` etc. tous **nullables** : une SGI peut n'avoir aucun champ
  confirmé (le calculateur demandera alors tout à l'utilisateur pour elle).
- Table séparée de l'annuaire SGI (`SgiComparator.tsx`, données en dur) pour ne
  pas mélanger identité/contact (stable) et barème financier (à vérifier
  périodiquement, source-datée).
- **Migration de l'annuaire** : à ce jour, la liste des SGI vit en dur dans le
  composant frontend (pas en base). Pour lier `sgi_frais` proprement, il faut
  soit migrer l'annuaire en base (table `sgi` : nom, pays, type, groupe, dépôt
  min., liens), soit garder `sgi_nom` comme clé texte libre correspondant
  exactement aux noms déjà utilisés dans `SgiComparator.tsx` (plus rapide,
  moins propre). **Décision à prendre à l'implémentation** — la seconde
  option suffit pour une v1 et évite un chantier de migration non demandé ici.

## Calcul (formule transparente)

Pour un montant à investir `M`, un nombre d'ordres estimé sur l'année `N`
(achats + ventes), et une durée de détention d'un an (hypothèse affichée) :

```
coût_courtage      = M × (courtage_pct / 100) × N
coût_fixe_ordres   = max(frais_fixe_ordre, minimum_perception) × N   [si ces champs existent]
coût_garde_annuel  = M × (droits_garde_pct_an / 100)
coût_virement      = frais_virement × (nombre de virements, par défaut 1)

coût_total_an = coût_courtage + coût_fixe_ordres + coût_garde_annuel + coût_virement
```

Chaque terme est **affiché en détail** dans le résultat (pas seulement le
total) — cohérent avec le critère produit existant (« un minimum de perception
pèse souvent plus lourd que le taux affiché »). Un champ vide (ni barème
confirmé ni saisi par l'utilisateur) est traité comme 0 **et signalé** dans le
résultat (« Droits de garde non renseignés — coût réel possiblement plus
élevé »), jamais silencieusement ignoré.

## Parcours utilisateur

1. Sur `/comparateur-sgi`, un nouveau bloc **« Calculer le coût réel »** (à la
   place ou en complément du lien vers `/simulateur-budget`, qui reste pour
   la composition de portefeuille).
2. Formulaire : montant à investir (FCFA), nombre d'ordres estimé sur l'année
   (défaut 4 : ex. 2 achats + 2 ventes), sélection de 2 à 4 SGI à comparer
   (multi-select sur l'annuaire existant).
3. Pour chaque SGI sélectionnée sans barème confirmé : champs de saisie
   (courtage %, frais fixe, droits de garde %, minimum de perception) —
   pré-remplis avec l'ordre de grandeur marché générique existant (1–1,5 %)
   **à titre de point de départ modifiable**, jamais présenté comme la valeur
   réelle de cette SGI.
4. Résultat : tableau comparatif (une colonne par SGI), coût total annuel
   trié du moins cher au plus cher, détail des 4 composantes, badge de
   confiance par SGI.
5. Disclaimer permanent sous le résultat : *« Frais indicatifs sauf mention
   « barème confirmé ». Demandez toujours le barème complet écrit à la SGI
   avant d'ouvrir un compte. »* (reprend la formulation déjà utilisée dans la
   FAQ existante).

## Gouvernance des barèmes confirmés

Page admin `/admin/sgi-frais` (lecture/écriture `content.write`, cohérent avec
les autres pages admin du produit) : liste des SGI, formulaire d'édition des
5 champs + `source_url` + `verifie_le`. Aucune écriture publique — seul un
administrateur peut faire passer une SGI de « à renseigner » à « barème
confirmé ».

## RGPD

Aucune donnée personnelle : les simulations (montant, nombre d'ordres) sont
des paramètres de calcul, non liés à un compte utilisateur dans cette v1
(pas de sauvegarde de simulation). Si une v2 ajoute la sauvegarde de
simulations par utilisateur, appliquer la même checklist RGPD que pour
`investment_theses` (finalité, rétention, export/suppression).

## Hors scope (v1)

- Pas de sauvegarde de simulation par utilisateur (calcul à la volée,
  non persisté).
- Pas de migration de l'annuaire SGI vers une table dédiée (décision reportée
  à l'implémentation, cf. note ci-dessus).
- Pas de mise à jour automatique des barèmes (saisie manuelle admin
  uniquement — aucune source externe fiable identifiée pour un scraping).
- Pas de prise en compte de la fiscalité (IRVM, exonérations) — hors périmètre
  du coût de courtage.

## Critère de succès

- Un utilisateur peut comparer 2 SGI pour un montant donné et voir le coût
  total détaillé de chacune, sans qu'aucun chiffre ne soit présenté comme
  confirmé s'il ne l'est pas.
- Le badge de confiance est visible sur chaque ligne de résultat, sans
  exception.
