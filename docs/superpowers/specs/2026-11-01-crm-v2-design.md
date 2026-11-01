# CRM v2 — vues de travail, fiche latérale, relance pilotée, séquences

Date : 2026-11-01. Suite de `2026-11-01-crm-relance-whatsapp-offre-design.md`.
Demande de l'exploitant : organiser l'écran autour du travail à faire (6 vues),
fiche prospect en panneau latéral, relance assistée avec garde-fous, 4
indicateurs « sans surinterpréter », puis automatisation. Ordre imposé :
P0 fiabilité des paiements → P1 traitement → P2 relance pilotée et mesure →
P3 séquences. Instruction : « les trois via sous-agents jusqu'à atteinte de
l'objectif ».

**Conseil Fable** : consultation tentée le 2026-11-01, échouée (crédits
épuisés). Décisions tranchées sans consultation — à faire relire si possible
avant d'activer le mode `actif` des séquences (§SP3).

## Constat en production (2026-11-01)

- 12 paiements non aboutis : 9 intentions `manual` en `pending` (de 10 000 à
  500 000 XOF ; la personne a peut-être payé par Mobile Money et attend la
  confirmation, ou rien du tout), 1 `chariow` `pending` (paiement abandonné),
  1 `chariow` `failed`, 1 `pending` sans `user_id` (orphelin, 500 000 XOF).
- 2 comptes Premium (payés via Chariow) gardent une intention `manual`
  `pending` : doublons. Le CRM ne les relance que parce qu'il exclut les
  Premium ; si `is_premium` tarde, ils redeviendraient « paiement non terminé ».
- `subscriptions.status` ne dit rien : chaque compte a `active` (gratuit) ET
  `pending`. Il n'est PAS utilisé comme vérité.

## Principes

1. **Le CRM ne modifie jamais `billing_transactions`.** La vérité monétaire
   appartient à `/admin/payments` (confirmer / rejeter). Le CRM la lit et en
   DÉRIVE un état par personne.
2. **Tout se dérive.** L'état de paiement, le statut d'opportunité, la vue et
   l'action recommandée sont des fonctions PURES de la fiche (`Dossier`) et de
   l'horloge, testées.
3. **Les décisions humaines sont des événements.** Clôture, réouverture,
   échéance, responsable, « réponse reçue » : des lignes datées de
   `crm_actions` (`type = 'decision'`), la plus récente l'emporte. Historique
   complet, aucune table mutable de plus, export et suppression RGPD déjà
   câblés sur `crm_actions`.
4. **« Après » n'est pas « grâce à ».** Aucun indicateur ne présente une
   causalité ; la fenêtre et le dénominateur sont affichés.

---

## SP1 — Fiabilité des paiements et traitement (P0 + P1)

### 1.1 État de paiement par personne — `lib/crm/paiement.ts` (pur)

`Sources.paiements` gagne `id`, `provider`, et les lignes `failed`.
`Dossier` gagne `paiements: { id; montant; devise; statut: 'pending'|'paid'|'failed'; provider; date; payeLe }[]`
(les champs existants `paiementsEnAttente` / `paiementsReussis` restent,
dérivés, pour ne rien casser).

`etatPaiement(d, maintenant) → { etat, detail, doublons: string[] }` :

| État | Règle (dans l'ordre) |
|---|---|
| `paye` | `premium` (seulement : un `paid` récent SANS Premium est une contradiction — activation probablement manquée — et tombe en `a_verifier` ; le classer « converti » masquerait le problème. Décision de mise en œuvre, 2026-11-01) |
| doublons (marque) | tout `pending` antérieur à un `paid` est listé dans `doublons` et IGNORÉ ensuite |
| `a_verifier` | un `pending` `manual` non supplanté, de moins de 30 jours ; OU contradiction : `paid` de moins de 35 jours et pas Premium |
| `abandonne` | un `pending` en ligne (`chariow`…) non supplanté, OU un `pending` `manual` de plus de 30 jours, OU un `failed` récent sans `paid` |
| `expire` | ancien `paid` (plus de 35 jours), pas Premium, rien en cours |
| `aucun` | aucun paiement |

Les paiements **orphelins** (`user_id` nul) ne sont rattachés à aucune
personne : ils apparaissent en tête de la vue « Paiements à vérifier », avec
montant, date et lien vers `/admin/payments`.

**Critère P0** : un `paid` (ou Premium) retire la personne de toute relance —
garde-fou serveur, pas seulement l'affichage (voir 2.1 ; en SP1 déjà : les
deux server actions de relance refusent si `etatPaiement` vaut `paye`).

### 1.2 Statut d'opportunité et vue — `lib/crm/vues.ts` (pur)

Décisions (`crm_actions.type = 'decision'`, colonne `decision`) :
`cloture` (+ `motif` ∈ `pas_interesse | doublon | deja_abonne`),
`reouverture`, `echeance` (+ `echeance` date ; « À recontacter plus tard »
= une échéance), `responsable` (+ `responsable` uuid), `reponse` (réponse
reçue, déclarée à la main), `traite` (réponse traitée — migration `0176` : une
réponse antérieure à `traite` ne compte plus ; sans elle, une personne à qui
l'exploitant a répondu hors de l'outil restait indéfiniment « à traiter »).

`vueDe(d, maintenant, reglages) → { vue, echeance, raison }`, chaque personne
dans UNE seule vue, dans cet ordre de priorité :

1. `convertis` — état de paiement `paye`.
2. `clotures` — opposée (motif affiché « opposition »), ou dernière décision
   `cloture` non suivie d'une `reouverture`.
3. `paiements_a_verifier` — état `a_verifier`.
4. `a_traiter` — échéance manuelle atteinte ; OU réponse reçue après le
   dernier contact ; OU dernier contact plus vieux que
   `delai_suivi_jours` (défaut 7) sans réponse.
5. `en_attente` — contacté (relance `envoye` ou `prepare`), délai de suivi non
   écoulé ; OU échéance manuelle future.
6. `jamais_contactes` — aucune relance.

Les admins restent exclus de toutes les vues. « Réponse reçue » = décision
`reponse`, OU message de contact (`contact_messages`, formulaire ou console
WhatsApp) postérieur au dernier contact. Les réponses par e-mail arrivent
dans une boîte externe non ingérée : elles se déclarent à la main.

En SP1, `reglages` = constantes par défaut (`delai_suivi_jours = 7`) ; SP2 les
lit en base.

`actionRecommandee(d, vue, etat) → { libelle, justification }` (pur, une
phrase, dérivée des faits : ex. « Vérifier le paiement de 25 000 FCFA du 24/10
dans Paiements », « Relancer : contacté le 20/10, sans réponse depuis
12 jours »). Aucun chiffre qui ne vienne de la fiche.

### 1.3 Écran `/admin/crm`

- Onglets = les 6 vues avec leur effectif ; « À traiter » par défaut.
- Filtres secondaires : Chaud / Tiède / Froid, responsable, recherche
  (nom, e-mail).
- Colonnes : personne, état de paiement (badge), montant concerné, prochaine
  échéance, dernière action, responsable, score.
- Clic sur une ligne → **panneau latéral** (`?fiche=<cle>` rendu côté
  serveur) : identité et coordonnées (e-mail, téléphone prouvé/déclaré), offre
  et montant, chronologie des paiements, historique des messages et réponses,
  notes, responsable et échéance (formulaires), action recommandée et
  justification, clôture avec motif, réouverture, « réponse reçue », relances
  e-mail et WhatsApp (formulaires existants). La page `/admin/crm/[cle]` reste
  (lien « ouvrir en grand ») et partage les mêmes composants.

### 1.4 Données — migration `0175_crm_v2_decisions.sql`

`crm_actions` : `type` accepte `decision` ; `statut` accepte `decision` ;
colonnes `decision text check (…)`, `motif text check (…)`, `echeance date`,
`responsable uuid references auth.users on delete set null`. `contenu` reste
obligatoire (libellé lisible de la décision).

---

## SP2 — Relance pilotée et mesure (P2)

### 2.1 Éligibilité — `lib/crm/eligibilite.ts` (pur)

`eligibilite(d, reglages, maintenant) → { ok, raisons: string[] }`. Refus si :
état de paiement `paye` ou `a_verifier` (on vérifie avant de relancer) ;
opposition ; Premium/admin ; clôturé ; nombre de relances (`envoye` +
`prepare`) ≥ `max_relances` ; dernier contact commercial (tous canaux) plus
récent que `delai_min_jours`. L'interface affiche les raisons ; les server
actions (e-mail, WhatsApp) et le cron appellent LA MÊME fonction.

**Revérification juste avant l'envoi** : relecture directe, au moment de
l'envoi, de `billing_transactions` (`paid` du compte) et de
`profiles.is_premium` — un paiement confirmé entre l'affichage et le clic
annule l'envoi.

### 2.2 Réglages — table `crm_reglages` (une ligne)

`max_relances` (3), `delai_min_jours` (7), `delai_suivi_jours` (7),
`fenetre_conversion_jours` (30), `mode_sequences` (`off` | `simulation` |
`actif`, défaut `off`), `plafond_par_execution` (20). Lecture/écriture
service_role uniquement ; modifiable par `crm.write` dans `/admin/crm`
(onglet Réglages), chaque modification auditée. Valeur absente ou illisible →
valeurs par défaut (et `mode_sequences = off`).

### 2.3 Statuts de livraison

`crm_actions` gagne `livraison` (même vocabulaire que
`lib/contact/livraison.ts`) et `livraison_at`. Le webhook Resend existant met
aussi à jour `crm_actions` par `resend_id`, avec la même règle monotone.
Affichage : envoyé → livré → échec → réponse reçue, selon ce qu'on sait ;
« envoyé » ne prétend jamais « reçu ».

### 2.4 Score daté

Chaque raison porte déjà sa date ; la fiche affiche « score calculé le
<date heure> » et la date de chaque raison.

### 2.5 Quatre indicateurs — `lib/crm/indicateurs.ts` (pur)

| Indicateur | Règle |
|---|---|
| Prospects à traiter | personnes uniques dans la vue `a_traiter` |
| Opportunités ouvertes | personnes uniques hors `convertis` et `clotures` |
| Montant potentiel | somme, par opportunité ouverte, du montant du dernier paiement non abouti non supplanté ; « n opportunités sans montant » affiché à côté |
| Conversions après relance | sur les 90 derniers jours : personnes relancées (dénominateur) ; parmi elles, celles avec un `paid` dans les `fenetre_conversion_jours` suivant leur PREMIÈRE relance (numérateur). Libellé : « après relance — pas nécessairement grâce à elle », fenêtre et dénominateur affichés |

---

## SP3 — Séquences automatiques (P3)

### 3.1 Contrat

- **E-mail uniquement.** WhatsApp jamais automatisé (passerelle non
  officielle : bannissement).
- **Désactivé par défaut** (`mode_sequences = off`). `simulation` : la boucle
  tourne, journalise ce qu'elle AURAIT envoyé (`statut = 'simulation'`),
  n'envoie rien. `actif` : envoie. Passage à `actif` = décision de
  l'exploitant après au moins une semaine de simulation relue.
- Séquences (pures, `lib/crm/sequences.ts`) : `paiement_inacheve` étapes
  J+1 et J+8 après le paiement commencé (J+8 = J+1 + le délai minimal de 7 jours entre deux relances, qui reste appliqué) (état `abandonne` uniquement — un
  paiement `a_verifier` se vérifie, il ne se relance pas) ;
  `offre_consultee` étape J+2 après la dernière consultation. Gabarits
  existants (`gabarits.ts`), e-mail habillé, offre dossier incluse.
- Même éligibilité que la relance manuelle (2.1), même revérification avant
  envoi, + arrêt si réponse reçue ou clôture. **Toute réponse postérieure à
  l'ancre arrête la séquence, même marquée « traitée »** (un « non merci »
  traité ne reçoit pas l'étape suivante). L'étape 2 ne part que si l'étape 1
  est réellement partie (`envoye`) ; échec ou état indéterminé, la séquence
  s'arrête. Une ligne restée `envoi` compte comme un contact possible.
  Une étape dont l'e-mail a été rejeté ou signalé spam (`livraison`) n'est pas
  « réussie » : pas d'étape suivante. Un signalement spam interdit toute
  relance e-mail ultérieure (éligibilité, canal e-mail seulement ; WhatsApp
  inchangé). Réglages illisibles : le passage répond 500 avec alerte et ne
  s'exécute pas ; un `off` lu correctement reste silencieux.
- **Idempotence** : colonne `sequence_cle` (`<sequence>:<etape>`), index
  unique `(email_norm, sequence_cle)` : une étape n'est jamais envoyée (ni
  simulée) deux fois, même si le cron est relancé. Les lignes de simulation
  portent le préfixe `sim_` (`sim_paiement_inacheve:1`) : en mode `simulation`
  seules les clés `sim_` comptent (chaque étape est simulée une fois), en mode
  `actif` seules les clés réelles comptent — une étape simulée part donc pour
  de vrai, une fois, à l'activation.
- Plafond `plafond_par_execution` **par jour UTC** (le cron peut être relancé) :
  on retranche les lignes de séquence déjà écrites aujourd'hui (réelles ou
  `sim_` selon le mode) ; compte illisible => rien ne part, signalé.

### 3.2 Exécution

- Route `POST /api/cron/crm-sequences`, bearer `CRON_SECRET` (en-tête, jamais
  en query), `force-dynamic`.
- Workflow `.github/workflows/crm-sequences.yml`, chaque jour 09:00 UTC,
  échoue si la route ne répond pas 200 ; la route répond 500 si au moins un
  envoi a échoué.
- Rapport à l'exploitant (`alerterExploitant`) à chaque passage où quelque
  chose a été envoyé, simulé ou a échoué : compte par séquence et par issue,
  sans adresse.
- Garde de mode : le cœur relit le mode avant chaque étape ; `off` (ou un autre
  mode) prend effet immédiatement. Avant chaque étape, un contact récent
  (moins de `delai_min_jours`) est recherché directement en base.
- Issues : `envoye`, `simulation`, `refus` (règle métier), `echec`,
  `indisponible` (vérification ou journal impossibles), `reporte`. `echec` et
  `indisponible` donnent HTTP 500 et une alerte ; un e-mail parti dont le
  journal n'a pas pu être mis à jour est compté `echec`. Budget de 240 s :
  le reste est `reporte`. L'appel Resend a un délai de 15 s.
- Journal AVANT envoi (`envoi` → `envoye` | `echec`), comme la relance
  manuelle : une ligne ne reste jamais en `envoi`. Le cœur d'envoi est
  partagé avec la relance manuelle (une seule implémentation des garde-fous).

### 3.3 Données — migrations

`0177_crm_reglages_livraison.sql` (SP2) : table `crm_reglages` (RLS sans
policy, service_role), colonnes `livraison`, `livraison_at`.
`0178_crm_sequences.sql` (SP3) : `statut` accepte `simulation`, colonne
`sequence_cle`, index unique partiel.

## Tests

Purs et exhaustifs : `etatPaiement` (les 6 cas, doublons, bornes 30/35
jours), `vueDe` (exclusivité et ordre des 6 vues, chaque déclencheur
d'« à traiter »), `actionRecommandee`, `eligibilite` (chaque refus),
`indicateurs` (fenêtre, dénominateur, doublons de tentatives), `sequences`
(étapes dues, idempotence, arrêts). tsc + build. Réel : vues vérifiées sur la
production après chaque sous-projet ; séquences en `simulation` vérifiées sur
la base (lignes `simulation`, aucun e-mail).

## RGPD

Aucune nouvelle donnée personnelle hors `crm_actions` (déjà exportée et
supprimée) ; `responsable` désigne un administrateur. `crm_reglages` ne
contient aucune donnée personnelle. Export : ajouter `decision`, `motif`,
`echeance`, `livraison`, `sequence_cle` aux colonnes CRM exportées.
`docs/RGPD.md` : mention des relances automatiques (base : intérêt légitime
pour les comptes, consentement pour les prospects ; opposition à tout moment,
lien dans chaque e-mail).
