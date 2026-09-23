# Formations live payantes — design

**Date** : 2026-09-23
**Statut** : validé par le responsable du projet
**Objectifs retenus** : revenu direct **et** acquisition
**Décisions cadrantes** : sessions animées en direct par le responsable ; paiement
par le flux manuel existant (intention → confirmation en console) ; réservation
réservée aux titulaires d'un compte.

## 1. Pourquoi

Le concurrent de référence (sikafinance) vend trois niveaux de formation en
direct, 4 à 5 h, à 20 000 / 30 000 / 30 000 FCFA, avec dates, lieu et formateur
annoncés. WESTBOURSE dispose déjà d'une Academy **asynchrone** (44 leçons,
4 niveaux, examens, certificats vérifiables) — mais au 2026-09-23, sur
128 comptes : **21 progressions, 0 tentative d'examen, 0 certificat délivré**.
L'actif existe et ne produit ni revenu ni inscription.

Les sessions live apportent ce que l'asynchrone ne donne pas : une date, une
rareté (places limitées), un prix qu'on peut encaisser, et une raison de créer
un compte. L'Academy reste gratuite et sert de préparation — elle nourrit les
sessions au lieu de leur faire concurrence.

**Ce que ce design ne fait pas** : vendre du conseil. Une session enseigne une
méthode ; elle ne distribue ni recommandation d'achat ni portefeuille à
répliquer. Cette limite est la même que partout ailleurs dans le produit.

## 2. Modèle de données

### `formation_sessions`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | clé primaire |
| `niveau` | text | `debutant` \| `intermediaire` \| `avance` |
| `titre`, `description` | text | |
| `debut_at` | timestamptz | date et heure de début |
| `duree_min` | int | durée en minutes |
| `modalite` | text | `presentiel` \| `visio` |
| `lieu` | text | adresse (présentiel) ou intitulé (visio) |
| `lien_visio` | text | **jamais exposé publiquement** — voir §3 |
| `places` | int | > 0 |
| `places_prises` | int | ≥ 0, contrainte `places_prises <= places` |
| `prix`, `prix_abonne` | numeric | en FCFA ; `prix_abonne` nul = pas de remise |
| `statut` | text | `brouillon` \| `ouverte` \| `complete` \| `annulee` \| `terminee` |
| `created_by`, `created_at`, `updated_at` | | |

Les montants vivent **dans la donnée, pas dans le code** : chaque séance porte
son prix, fixé à la création depuis la console. Aucun tarif n'est écrit en dur.

### `formation_inscriptions`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | clé primaire |
| `session_id` | uuid | → `formation_sessions` |
| `user_id` | uuid | → `auth.users`, suppression en cascade |
| `statut` | text | `reservee` \| `payee` \| `annulee` \| `presente` \| `absente` |
| `transaction_id` | uuid | → `billing_transactions`, nullable |
| `created_at`, `updated_at` | | |

Unicité sur `(session_id, user_id)` : on ne réserve pas deux fois la même séance.

### Ce que la base garantit elle-même

- **Pas de surréservation.** `places_prises` est incrémenté par un déclencheur à
  l'insertion d'une inscription non annulée, et la contrainte
  `places_prises <= places` fait échouer la transaction de trop. Un comptage
  applicatif laisserait passer deux inscriptions simultanées sur la dernière
  place ; la contrainte, non.
- **Pas d'auto-proclamation de paiement.** Le statut d'une inscription n'est
  modifiable que par la clé de service. Sans cela, un inscrit pourrait se
  déclarer « payée » et accéder au lien de visio.

## 3. RLS et exposition

`formation_sessions` **n'est pas lisible publiquement**. Une vue
`formation_sessions_publiques` (`security_invoker = true`) expose les séances
`ouverte` et `complete` **sans `lien_visio`**. C'est le procédé déjà éprouvé
pour `academy_certificates_public` : une colonne de lien de visioconférence dans
une table à lecture publique, c'est une salle ouverte à tous.

Le `lien_visio` n'est servi que par une route serveur, après vérification que
l'appelant a une inscription `payee` sur cette séance.

`formation_inscriptions` : lecture par son propriétaire ; écriture réservée à la
clé de service (console et routes serveur).

Contrôles obligatoires après migration, conformément à la discipline du projet :
scan `get_advisors` (type security) **et** essai à la clé anon sur les deux
tables et la vue avant toute fusion.

## 4. Circuit de l'argent

1. **Réservation** — l'utilisateur connecté réserve. Création d'une ligne
   `billing_transactions` : `provider = 'manual'`, `status = 'pending'`,
   `subscription_id = NULL` (le schéma l'autorise déjà), `objet = 'formation'`
   (nouvelle colonne, valeur par défaut `abonnement`), montant = `prix_abonne`
   si l'utilisateur est abonné et que la remise existe, sinon `prix`.
   L'inscription est créée en `reservee` et pointe la transaction.
2. **Paiement** — hors produit (Wave, Orange Money, virement), comme aujourd'hui
   pour les abonnements.
3. **Confirmation** — dans `/admin/payments`, un bouton **distinct** de celui des
   abonnements : la transaction passe à `paid`, l'inscription à `payee`, et le
   lien de visio devient accessible à cette personne. Confirmer une formation ne
   doit jamais activer un abonnement Premium par effet de bord ; c'est la raison
   d'être de la colonne `objet`.
4. **Annulation d'une séance** — statut `annulee`, inscriptions `annulee`,
   `places_prises` remis à zéro. Le remboursement est un geste hors produit ; la
   console affiche la liste des transactions à rembourser plutôt que de prétendre
   le faire.

## 5. Pages

| Route | Accès | Contenu |
|---|---|---|
| `/formations/sessions` | public | Séances à venir : date, niveau, modalité, places restantes, prix. Lecture de la vue publique. |
| `/formations/sessions/[id]` | public | Détail et bouton Réserver. Non connecté → invitation à créer un compte, avec retour sur la séance. |
| `/compte/formations` | connecté | Mes inscriptions, statut, lien de visio quand la place est payée. |
| `/admin/formations` | `content.write` | Créer et modifier une séance, voir les inscrits, marquer les présents. |

Entrées : un bloc sur `/formations` à côté de l'Academy et des modules ; une
diapositive dans le carrousel du hero (le mécanisme `landing_slides` existe déjà,
emplacement `hero` ou `billboard`).

**La réservation exige un compte.** C'est le choix qui sert l'objectif
d'acquisition : une formation qui ne laisse qu'une adresse dans une boîte de
réception ne construit rien. Le compte gratuit est sans carte bancaire, donc le
frein est faible.

## 6. RGPD

- **Données collectées** : aucune nouvelle. On s'appuie sur le compte existant
  (`user_id`) ; ni nom ni téléphone ne sont re-saisis.
- **Finalité** : exécution de la prestation de formation.
- **Base légale** : exécution du contrat.
- **Conservation** : inscriptions purgées **3 ans** après la date de la séance,
  dans `purge_rgpd_retention()`. Les pièces de paiement suivent le régime propre
  aux `billing_transactions`.
- **Droits** : `formation_inscriptions` ajoutée à `/api/account/export` ; la
  suppression est couverte par la cascade sur `auth.users`.
- **Sécurité** : clé de service côté serveur uniquement ; aucun lien de visio ni
  identifiant dans les journaux.

## 7. Tests

Modules purs, testés sans base :
- calcul du prix applicable (abonné / non abonné, remise absente) ;
- place disponible : `places_prises` contre `places`, y compris à la dernière
  place ;
- transitions de statut autorisées (`reservee → payee`, `→ annulee`) et refus des
  transitions interdites (`annulee → payee`).

Vérifications d'intégration, à faire à la main avant fusion : lecture anonyme de
la vue publique (le `lien_visio` **ne doit pas** apparaître), écriture anonyme
refusée sur les deux tables, et confirmation d'une transaction `formation` qui
n'active aucun abonnement.

## 8. Hors périmètre de la première livraison

Rappels J-2 et J-0 (email et Telegram — les canaux existent), liste d'attente,
attestation de participation en PDF, paiement en ligne (CinetPay), sessions
intra-entreprise, replay vidéo.

L'attestation de participation, quand elle viendra, restera **distincte du
certificat Academy** : assister n'est pas réussir, et un certificat qui
s'obtiendrait par la seule présence ne vaudrait plus rien.
