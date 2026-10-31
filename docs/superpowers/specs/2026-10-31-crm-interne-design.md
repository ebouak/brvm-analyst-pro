# CRM interne — lot 1 : repérer qui est proche de passer Premium

**Date :** 2026-10-31 · **Statut :** conception validée (carte blanche de
l'utilisateur), revue par Fable (4 amendements intégrés, §9).

## 1. Objectif

Donner à l'exploitant une vue **par personne** de ses prospects et
utilisateurs, classée par proximité de l'abonnement Premium, avec la raison
de chaque classement et un moyen de relancer à la main.

- **Lot 1 (ce document)** : liste classée, fiche personne, relance manuelle
  par e-mail, notes, opposition au profilage.
- **Lot 2 (plus tard)** : scénarios de relance automatiques et mesure de ce
  qui convertit. Le lot 1 enregistre dès maintenant ce dont le lot 2 aura
  besoin (§4.2).

Hors périmètre : relance WhatsApp/Telegram, B2B/organisations, CRM externe.

## 2. Ce qui existe et ce qui est réellement mesuré (vérifié le 2026-10-31)

| Donnée | Source | Volume |
|---|---|---|
| Comptes / Premium | `profiles`, `auth.users` | 188 / 7 |
| Dernière connexion | `auth.users.last_sign_in_at` (natif) | 49 en 30 j, 18 en 7 j |
| Paiement commencé non abouti | `billing_transactions.status = 'pending'` | 9 personnes |
| Prospects | `leads_brvm` | 8 |
| Newsletter | `newsletter_subscribers` | 32 |
| Messages de contact | `contact_messages` | 22 |
| Portefeuille saisi | `portfolios_positions` | 8 personnes |

**Non utilisables** : `auth_events` (aucune connexion jamais enregistrée) et
`feature_usage` (1 ligne depuis août). Les réparer est un sujet à part ;
le lot 1 ne s'appuie pas dessus. **Aucun signal « a regardé l'offre »
n'existe** : le lot 1 le crée (§4.1).

## 3. Identité et calcul

### 3.1 Qui apparaît

Chaque compte `auth.users`, plus les prospects et abonnés newsletter **sans
compte**. Rapprochement par **e-mail normalisé** (`lower(trim(email))`),
appelé `email_norm`.

Exclus de la liste : Premium actifs, administrateurs (`admin_user_roles`),
personnes présentes dans `crm_oppositions`.

### 3.2 Score — calculé à la lecture

Fonction **pure** `frontend/lib/crm/score.ts`, testée, sans accès réseau.
Entrée : un dossier par personne (faits datés) + la date de référence.
Sortie : `{ score, niveau, raisons[] }`, chaque raison portant son fait daté.

| Signal | Points | Fenêtre | Raison affichée (exemple) |
|---|---:|---|---|
| Paiement commencé non abouti | +40 | 30 j | « paiement de 5 000 FCFA commencé le 12/10, non terminé » |
| A consulté l'offre connecté | +20 | 14 j | « a consulté l'offre 3 fois, dernière le 29/10 » |
| Dernière connexion | +15 / +5 | ≤ 7 j / 8–30 j | « connecté il y a 2 jours » |
| Portefeuille saisi | +10 | — | « portefeuille de 4 lignes » |
| Message ou formulaire prospect | +10 | 30 j | « message du 25/10 » |
| Abonné newsletter | +5 | — | « abonné à la newsletter » |
| Academy commencée | +5 | — | « 3 leçons de l'Academy suivies » |

Score plafonné à 100. Niveaux : **chaud** ≥ 50, **tiède** 25–49, **froid**
< 25. Pondérations et fenêtres dans une seule constante exportée.

**Honnêteté** : une raison n'existe que si son fait existe ; les montants
et dates affichés sont ceux de la base, jamais recalculés ni arrondis
au-delà du format FCFA du site.

### 3.3 Volume

188 comptes : l'assemblage à la lecture (≈ 6 requêtes en parallèle,
service_role) suffit. Au-delà de quelques milliers de comptes, passer à une
table recalculée la nuit — pas avant.

## 4. Données nouvelles — migration `0172_crm_interne.sql`

Toutes : RLS activée, **aucune policy**, `revoke all … from public, anon,
authenticated` (les trois — voir CLAUDE.md §11). Écriture et lecture
**service_role uniquement**, côté serveur.

### 4.1 `crm_signaux` — l'intention « a regardé l'offre »

```
id bigserial pk
user_id uuid not null references auth.users on delete cascade
type text not null check (type in ('offre_vue'))
page text not null check (page in ('/pricing','/account/plan','/premium/upgrade'))
jour date not null default current_date
created_at timestamptz not null default now()
unique (user_id, page, jour)
```

**Écrit depuis le navigateur, pas au rendu serveur** (amendement Fable) :
Next.js précharge `/pricing` et `/premium/upgrade` (composants serveur) sans
que la personne voie la page ; un relevé au rendu compterait des visites
inventées. Un composant client `SignalOffre` envoie, **au montage**, un
`POST /api/crm/signal { page }`. La route : session obligatoire (anonyme →
204 sans écrire), page dans la liste blanche, `insert … on conflict do
nothing` (une ligne par jour et par page). Aucun traceur tiers, aucun cookie
nouveau. Rétention **90 jours**.

### 4.2 `crm_actions` — relances et notes

```
id uuid pk default gen_random_uuid()
email_norm text not null            -- clé d'identité, toujours remplie
user_id uuid null references auth.users on delete set null
type text not null check (type in ('relance','note'))
canal text null check (canal in ('email'))
template_id text null               -- gabarit de départ (relance)
sujet text null, contenu text not null
score_at_envoi int null             -- instantané (amendement Fable)
signaux_json jsonb null             -- raisons au moment de l'envoi
statut text not null check (statut in ('note','envoi','envoye','echec'))
erreur text null
resend_id text null
jeton_opposition text null unique   -- lien d'opposition en un clic
auteur uuid not null references auth.users
created_at timestamptz not null default now()
index (email_norm, created_at desc)
```

- **`email_norm` toujours rempli** : un prospect qui crée ensuite un compte
  garde un historique unique. Un changement d'e-mail orpheline les anciennes
  lignes — limite acceptée, documentée.
- **Conversion non stockée** : le lot 2 la déduira à la lecture (premier
  `billing_transactions.status = 'paid'` avec `paid_at` dans les 30 jours
  suivant la relance ; si plusieurs relances précèdent un paiement, **la
  plus récente l'emporte**). Une colonne « converti » serait une seconde
  vérité à tenir juste.
- Rétention **24 mois** après `created_at`.

### 4.3 `crm_oppositions` — droit d'opposition (art. 21 RGPD)

```
email_norm text pk
source text not null check (source in ('parametres','lien','admin'))
created_at timestamptz not null default now()
```

Table plutôt que colonne de `profiles` : couvre aussi les prospects sans
compte, et aucune mise à jour de profil envoyant la ligne entière ne peut
effacer le refus. Conservée tant que la personne existe (c'est la preuve du
refus) ; supprimée avec le compte.

### 4.4 Permissions

`crm.read` (liste, fiche) et `crm.write` (relance, note, opposition admin)
dans `admin_permissions`, rattachées aux rôles `super_admin` et `admin` —
même modèle que `support.reply` / `leads.write`.

### 4.5 Purge

`purge_rgpd_retention()` (dernière définition : migration 0158) est
recréée à l'identique **plus** deux suppressions : `crm_signaux` > 90 j,
`crm_actions` > 24 mois. Toujours `revoke execute … from public, anon,
authenticated`.

## 5. Écrans

### 5.1 `/admin/crm` — la liste (`crm.read`)

Classée par score décroissant, filtre chaud / tiède / froid / tous. Une
ligne : nom ou e-mail, niveau + score, **deux premières raisons**, dernière
connexion, dernière relance (date, canal) ou « jamais relancé », mention
« prospect sans compte » le cas échéant. État vide : « Aucune personne à
relancer pour l'instant » + rappel des signaux suivis.

### 5.2 `/admin/crm/[cle]` — la fiche (`crm.read`)

`cle` = `user_id` pour un compte, `email_norm` encodé pour un prospect.

- **En-tête** : statut du compte, formule, inscription, score et **toutes**
  les raisons datées.
- **Chronologie** fusionnée et triée : inscription, paiements (commencé,
  payé, échoué), messages, formulaire prospect, newsletter, consultations
  de l'offre, relances, notes.
- **Relance** (`crm.write`) : brouillon issu d'un **gabarit fixe** choisi
  par la raison principale (`frontend/lib/crm/gabarits.ts`, pur, testé) —
  paiement inachevé, offre consultée, actif sans payer, prospect sans
  compte. Le gabarit n'insère **que** des faits du dossier (prénom, date,
  montant) ; aucun chiffre étranger (test dédié). L'exploitant corrige
  puis envoie.
- **Garde-fou** : bandeau si la personne a été relancée il y a moins de
  14 jours ; l'envoi reste possible.
- **Notes internes** (`crm.write`), jamais visibles par la personne.
- **Opposition** : si la personne s'est opposée, la fiche reste lisible
  mais la relance est désactivée et le bandeau l'indique.

## 6. Envoi d'une relance

Action serveur `envoyerRelance(cle, sujet, contenu, templateId)` :

1. `requirePermission('crm.write')`.
2. **Revérifie** l'opposition **au moment de l'envoi** (amendement Fable),
   pas seulement dans le filtre de la liste.
3. Insère la ligne `crm_actions` en `statut = 'envoi'` avec l'instantané
   (`score_at_envoi`, `signaux_json`) et un `jeton_opposition` aléatoire —
   verrou contre le double envoi, comme `contact_messages`.
4. Ajoute au corps le **lien d'opposition en un clic**
   `https://www.westbourse.com/crm/opposition?t=<jeton>` (art. 21 : absolu
   en prospection, donc dès le lot 1).
5. `sendEmail` (chemin des réponses de contact, Resend).
6. Met à jour `envoye` + `resend_id`, ou `echec` + `erreur`. **L'échec est
   journalisé et affiché**, jamais avalé (leçon de la panne e-mail de
   juillet–septembre 2026).

Route publique `GET /crm/opposition?t=` : retrouve le jeton, insère
`crm_oppositions(email_norm, source='lien')`, page de confirmation sans
autre donnée. Jeton inconnu → même page neutre (pas d'oracle).

Paramètre utilisateur : case « Ne pas utiliser mon activité pour me proposer
l'offre Premium » dans `/parametres/compte`, écrite par action serveur
(service_role) — jamais par le client directement.

## 7. RGPD — mini-checklist

- **Données** : faits déjà présents (compte, connexions, paiements,
  messages, prospects, newsletter, portefeuille, Academy) + consultations de
  l'offre + relances et notes.
- **Finalité** : proposer l'abonnement Premium aux personnes déjà en
  relation avec WESTBOURSE, et suivre ces échanges.
- **Base légale** : **intérêt légitime** (prospection de ses propres
  utilisateurs, analyse interne). Pas de décision automatisée au sens de
  l'art. 22 : le score classe, un humain décide et écrit. Prospects du
  formulaire : consentement déjà recueilli (`leads_brvm.consent`).
- **Information** : paragraphe ajouté à `/confidentialite`, section
  « Finalités et base légale » + « Données collectées ».
- **Conservation** : signaux 90 j, actions 24 mois, opposition tant que la
  personne existe.
- **Droits** : export (`/api/account/export` couvre `crm_signaux`,
  `crm_actions` par `user_id` **et** `email_norm`, `crm_oppositions`),
  suppression (`/api/account/delete` efface par `email_norm` en plus de la
  cascade), opposition (paramètre + lien en un clic), rectification (notes
  modifiables par l'admin).
- **Sécurité** : RLS sans policy + revoke ×3, service_role côté serveur,
  permissions `crm.*`, aucun contenu de relance ni e-mail dans les logs.
- **Vigilance notée** : le signal « offre consultée » est une mesure
  d'audience première partie, côté serveur, sans dépôt sur le terminal
  (seul le cookie de session, strictement nécessaire, est lu). Si la CNIL
  ou un conseil le requalifie, le désactiver revient à retirer
  `SignalOffre` — le reste du CRM n'en dépend pas.

## 8. Tests et vérifications

- `lib/crm/score.test.mjs` : chaque signal isolé, bornes de fenêtres
  (7/8, 14/15, 30/31 jours), plafond 100, seuils de niveau, exclusions
  (Premium, admin, opposition), raisons sans fait inventé.
- `lib/crm/gabarits.test.mjs` : un gabarit par raison principale, aucun
  nombre absent du dossier (vérification de type `assertNoForeignNumber`),
  lien d'opposition toujours présent.
- `lib/crm/identite.test.mjs` : normalisation d'e-mail, fusion compte +
  prospect + newsletter, prospect sans compte.
- Après migration : `supabase db advisors` (sécurité) **et** test des trois
  tables à la **clé anon** (lecture et écriture refusées).
- Bout en bout en local : liste, fiche, relance vers l'adresse de
  l'exploitant (`ebouak@gmail.com`), opposition par le lien, relance
  ensuite refusée.
- `tsc` frontend vert, build vert.

## 9. Revue Fable du 2026-10-31 — ce qui a été retenu

1. Instantané à l'envoi (`template_id`, `score_at_envoi`, `signaux_json`) ;
   conversion déduite, non stockée — **retenu**.
2. `email_norm` toujours rempli — **retenu**.
3. Signal d'offre au rendu serveur = faits inventés (préchargement) →
   balise client + unicité par jour — **retenu** (`/pricing` et
   `/premium/upgrade` sont bien des composants serveur).
4. Colonne `profiles` acceptable avec revérification à l'envoi — revérif
   **retenue** ; colonne **remplacée** par `crm_oppositions` pour couvrir
   les prospects sans compte et l'écrasement d'une ligne de profil.
   Lien d'opposition dans chaque relance **dès le lot 1** — **retenu**.

Variante A/B (`variant`) : non ajoutée, le lot 2 n'en prévoit pas.

## 10. Écarts tranchés à la rédaction du plan (2026-10-31)

Constatés dans le code et la base ; le plan
(`docs/superpowers/plans/2026-10-31-crm-interne.md`) les applique :

1. Le rôle `admin` n'existe pas : `crm.*` va à `super_admin` et `support_admin`.
2. `last_sign_in_at` se lit par `auth.admin.listUsers()` (`auth.users` n'est pas
   exposé par PostgREST).
3. Tests frontend en `*.test.ts` (vitest).
4. Le lien d'opposition ouvre une page à **bouton de confirmation** : un scanner
   de liens qui ouvre l'URL ne doit pas opposer la personne à sa place.
5. Garde-fou anti double envoi : refus si une relance `envoi` de la même personne
   date de moins de 2 minutes.
