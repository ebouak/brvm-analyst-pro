# Dossiers valeur à l’unité — design

## Décision

Les dossiers A4 WESTBOURSE deviennent des articles de recherche payants à
l’unité pour les visiteurs non Premium. Le prix est de **1 500 FCFA par
société**. Les abonnés Premium conservent l’accès à tous les dossiers.

L’aperçu public contient exactement **les deux premières pages** du dossier.
Il est composé et écrit par WESTBOURSE depuis les données déjà utilisées pour
le rapport. Il peut citer des sources publiées, mais ne reprend ni capture ni
mise en page d’un média, éditeur ou prestataire tiers.

## Expérience éditoriale

### Catalogue

Nouvelle page publique : `/analyses/dossiers`.

Elle présente les dossiers comme des dossiers de presse financière :

- une ligne éditoriale « Recherche & valeur » ;
- une société par carte, avec code, désignation, date de mise à jour,
  secteur, miniature de couverture et prix ;
- un filtre par nom/code/secteur ;
- un ordre mis à jour récemment, puis alphabétique ;
- les états « à jour », « actualisation en cours » et « indisponible » ;
- aucune carte sans vraie donnée de marché ou sans PDF récent.

### Article

Nouvelle page : `/analyses/dossiers/[code]`.

La page comporte :

1. un en-tête de revue — catégorie, date, société, code, temps de lecture ;
2. un titre et un chapô rédigés depuis le dossier, sans promesse de rendement ;
3. une page 1 visuelle : couverture, identité et trois faits vérifiables ;
4. une page 2 visuelle : chiffres clés, prix, variation, dividende connu et
   qualité des données ;
5. une transition de lecture nette entre contenu public et contenu verrouillé ;
6. le prix, les bénéfices inclus et le bouton d’achat à 1 500 FCFA ;
7. une mention `Inclus avec Premium` avec un accès direct au rapport complet ;
8. une note méthodologique et les sources de la base WESTBOURSE ;
9. une liste de dossiers proches, uniquement si des données existent.

Le rendu est responsive. Sur mobile, les deux pages deviennent des panneaux
verticaux ; la version A4 complète reste le PDF de référence.

### Accès

Trois cas :

- **Premium** : article complet, PDF et page A4 intégrale disponibles.
- **Compte gratuit ayant acheté ce code** : même accès, rattaché définitivement
  à ce code.
- **Visiteur ou compte gratuit sans achat** : uniquement les deux pages
  publiques, puis l’offre d’achat.

Un droit sur `SNTS` ne donne aucun droit sur `PALC`. Les droits sont révocables
par remboursement.

## Commerce

Un seul produit Chariow :

- nom : `Dossier valeur WESTBOURSE — 1 société` ;
- prix : `1 500 FCFA` ;
- paiement unique ;
- produit numérique masqué de la boutique publique ;
- le parcours d’achat part du site, avec session WESTBOURSE obligatoire ;
- aucun PDF attaché chez Chariow.

Chariow connaît une vente de `dossier:a4`. WESTBOURSE conserve le code de
société dans la transaction, puis accorde le droit exact après la validation du
webhook. Une vente ne donne jamais immédiatement accès avant confirmation.

Le produit générique évite 48 configurations Chariow, 48 prix à maintenir et
48 identifiants à réconcilier.

## Données et droits

`chariow_products` reçoit une ligne générique :

```text
product_code: dossier:a4
kind: dossier
libelle: Dossier valeur WESTBOURSE — 1 société
amount: 1500
currency: XOF
```

`billing_transactions` reçoit `subject_code`, validé comme code BRVM de 2 à
8 caractères. Le webhook utilise le produit pour vérifier l’identifiant
Chariow, mais ne publie pas la vente avant confirmation de la signature et de
la vente distante.

À l’accord :

- `user_entitlements.product_code = dossier:<CODE>` ;
- `user_entitlements.niveau = null` ;
- la source reste `chariow` et la référence reste l’identifiant de vente ;
- la transaction garde le code sujet pour l’audit et le support.

## Verrouillage serveur

La règle d’accès est une source unique :

- Premium ;
- ou droit actif `dossier:<CODE>`.

Elle est appliquée sur :

- `/rapports/dossier/[code]` ;
- `/api/dossier/[code]/pdf` ;
- les boutons de téléchargement et d’impression.

Le worker de génération PDF conserve son accès technique par
`x-dossier-render`, limité au préfixe déjà autorisé par le middleware. Ce
secret ne donne pas accès au PDF privé.

Le serveur ne rend jamais les panneaux complets dans le HTML public. Le
verrouillage ne repose pas sur un flou CSS, un `overflow` ou une règle
JavaScript.

## Catalogue et qualité

La fiche exposée au visiteur porte toujours :

- date du dossier et âge du PDF ;
- source des données ;
- état de fraîcheur ;
- avertissement « information, pas conseil en investissement ».

Un PDF absent, trop ancien ou sans données essentielles n’est pas achetable.
La carte peut rester visible avec `indisponible`, sans bouton Chariow.

## Gestion d’erreurs

- Produit catalogue absent ou inactif : la vente est refusée en `404`.
- Code société invalide ou absent de l’univers : `404`.
- Dossier périmé : `409`, aucun paiement démarré.
- Signature Chariow invalide : `401`, aucun droit accordé.
- Vente Chariow déjà traitée : idempotence, aucun second droit.
- Paiement abandonné : transaction échouée, droit inexistant.
- Base indisponible : écran explicite et journal serveur, aucun accès par repli.
- PDF absent : retour JSON `404` avec lien vers l’article et message visible.

## Tests

Les tests couvrent :

- accès Premium, acheté, révoqué, absent et anonyme ;
- séparation stricte entre deux codes de sociétés ;
- validation du `subject_code` ;
- prix imposé à 1 500 FCFA côté serveur ;
- produit non disponible ou PDF périmé ;
- webhook accordant le droit du seul code acheté ;
- replay du même événement sans doublon ;
- route PDF refusée pour un compte gratuit sans droit ;
- article public limité exactement à deux pages ;
- catalogue sans carte achetable quand le PDF manque.

## Décision visuelle

Le design suit le registre d’un grand journal financier, pas celui d’un
tableau de bord :

- typographie éditoriale `Bespoke Serif` pour titres et chapeaux ;
- corps `Supreme`, chiffres tabulaires `JetBrains Mono` ;
- grille large, bordures fines, peu d’effets décoratifs ;
- couverture crème/ivoire sur le papier, interface sombre autour ;
- accents cyan réservés aux actions et états ;
- aucune répétition de cartes génériques, aucun compteur décoratif ;
- mobile : une colonne lisible, jamais une miniature A4 inutilisable.

## Hors périmètre

- pack de crédits ;
- abonnement automatique ;
- panier de plusieurs dossiers ;
- transcription ou copie d’un rapport tiers ;
- promesse de performance ;
- exposition publique du PDF complet.
