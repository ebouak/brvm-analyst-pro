# CRM — relance WhatsApp, numéro après inscription, e-mail habillé, dossier offert

Date : 2026-11-01. Suite de `2026-10-31-crm-interne-design.md` (PR #136/#137).
Demande : « dans le message inclure le WhatsApp histoire d'avoir un autre
contact pour relancer ; dans l'inscription ajouter le numéro de téléphone, un
moyen de le retrouver ; rendre le mail attrayant avec les logos et pied de
page ; proposer une petite offre ». Puis : « montrer les avantages à se
connecter avec », « utiliser les meilleurs styles premium de présentation ».

## Décisions de l'exploitant

| Sujet | Décision |
|---|---|
| Offre | Bonus sans prix : **un dossier PDF de valeur**, pas de remise ni d'essai |
| Choix du dossier | **La personne choisit** via un lien dans le message |
| WhatsApp | **Les deux** : bouton entrant dans l'e-mail + bouton sortant manuel dans la fiche CRM |
| Numéro | **Écran unique après la première connexion**, avec les avantages |
| Mode de collecte | **Appairage d'abord** (prouvé), numéro saisi en repli (déclaré) |
| Style | Premium, aligné sur le design system du site |

Écarté : l'envoi automatique par la passerelle WAHA (non officielle ; des
messages commerciaux non sollicités en série font bannir le numéro), les
coupons (aucun système de remise n'existe), les relances programmées.

## 1. Données — migration `0174_crm_whatsapp_offre.sql`

À appliquer par l'exploitant dans l'éditeur SQL Supabase.

`notification_prefs` :
- `telephone_declare text null` — E.164 (`+22507…`), saisi par la personne ;
- `recontact_optin_at timestamptz null` — consentement au recontact
  commercial sur WhatsApp ; null = pas de consentement ;
- `ecran_whatsapp_vu_at timestamptz null` — l'écran d'après inscription a été
  montré (vu, lié ou « Plus tard »).

Le déclencheur de `0162` reste inchangé : `whatsapp_phone`/`whatsapp_chat_id`
ne sont posés que par l'appairage. `telephone_declare` est une colonne
distincte, que le propriétaire peut écrire (policy owner existante) et qui ne
sert JAMAIS à identifier quelqu'un auprès de l'agent.

`crm_actions` :
- `canal` accepte `'whatsapp'` ; `statut` accepte `'prepare'` (WhatsApp ouvert
  par l'exploitant — on ne sait pas si le message est parti, le journal ne le
  prétend pas) ;
- `jeton_bonus text null unique`, `bonus_code text null`, `bonus_at
  timestamptz null`.

RGPD : `notification_prefs` est déjà exportée en entier (`select('*')`) et
supprimée en cascade ; `crm_actions` est déjà couverte par l'export et la
suppression CRM (PR #136). Finalité : recontact commercial ; base légale :
consentement (case décochée par défaut) ; conservation : jusqu'au retrait ou à
la suppression du compte.

## 2. Écran `/bienvenue/whatsapp`

- Affiché une fois, après la toute première connexion (Google et code e-mail) :
  compte créé depuis moins de 24 h (`auth.users.created_at`),
  `ecran_whatsapp_vu_at` nul et aucun WhatsApp lié. Les comptes existants ne le
  voient PAS (la demande porte sur l'inscription) ; ils gardent
  `/parametres/alertes`. Puis redirection vers la page demandée (`next`, validé
  comme ailleurs).
- Titre « Recevez WESTBOURSE sur WhatsApp ». Avantages limités à ce qui
  fonctionne : alertes de cours, point du soir, dossiers PDF du samedi, « cours
  SNTS » / dividendes / palmarès à la demande, l'équipe en écrivant « HUMAIN ».
  L'assistant n'est cité qu'avec la mention Premium.
- Bouton principal « Lier mon WhatsApp » : `POST /api/whatsapp/pairing`
  (existant) puis `wa.me` avec le code pré-rempli.
- Lien secondaire « ou laissez simplement votre numéro » : champ téléphone,
  normalisé, refusé s'il est illisible.
- Case « J'accepte d'être recontacté par WESTBOURSE sur WhatsApp au sujet de
  son offre », décochée, distincte des deux options.
- « Plus tard » pose `ecran_whatsapp_vu_at` : l'écran ne revient pas.
- `/parametres/alertes` gagne le champ numéro et la case (modifier, retirer).

## 3. E-mail de relance habillé

Module pur `lib/crm/emailRelance.ts` : `(corps, options) → { html, texte }`.
- En-tête : logo PNG absolu (`https://www.westbourse.com/…`, jamais de SVG —
  Gmail ne l'affiche pas) sur bandeau sombre aux jetons du site.
- Corps relu par l'exploitant, échappé, 600 px max, lisible sur mobile.
- Bloc « Votre dossier offert » + bouton « Choisir mon dossier » (si l'offre
  est incluse — case dans `RelanceForm`, cochée par défaut).
- Bouton « Une question ? Écrivez-nous sur WhatsApp » vers
  `NEXT_PUBLIC_WHATSAPP_NUMBER`, message pré-rempli.
- Pied : site, canal Telegram, chaîne WhatsApp, « Données de marché, pas un
  conseil en investissement », puis le lien d'opposition, toujours dernier.
- La version texte reste envoyée à côté.
- Mise en page en tableaux et styles en ligne (clients e-mail), aucun script,
  aucune police distante obligatoire (repli système).

## 4. Dossier offert `/offre/dossier?t=<jeton>`

- Un jeton par relance incluant l'offre, 24 octets aléatoires, **14 jours**,
  **un dossier**.
- Page publique (ajoutée aux exceptions du middleware), liste des valeurs dont
  un dossier existe ; lignes du portefeuille de la personne en premier.
- Au choix : vérification (existe, non expiré, non utilisé), puis
  **consommation atomique** (`update … where bonus_at is null` renvoyant la
  ligne ; zéro ligne = déjà utilisé), puis URL signée 10 min vers
  `dossiers/<CODE>/dernier.pdf`.
- Fraîcheur : dossier de plus de 3 jours → non servi, jeton NON consommé,
  message « en cours de mise à jour, choisissez-en un autre ». La vérification
  de fraîcheur précède la consommation.
- Jeton expiré / utilisé / inconnu : page explicative avec lien d'inscription
  et bouton WhatsApp, jamais d'erreur sèche.
- CRM : chronologie « Dossier SNTS téléchargé le 03/11 » ; nouveau signal de
  score `offre_utilisee`.

## 5. Relance WhatsApp depuis la fiche CRM

- Bouton visible si `recontact_optin_at` non nul ET un numéro connu : prouvé
  (`whatsapp_phone`) d'abord, sinon déclaré ; la fiche affiche la source.
  Appairé sans numéro (`@lid`) : « joignable en répondant dans la console
  WhatsApp ».
- Gabarit pur, court, sans HTML, avec le lien du dossier offert et la ligne
  « Répondez STOP pour ne plus être recontacté ».
- Server action : mêmes verrous que l'e-mail (opposition revérifiée, échec
  fermé ; pas de Premium ni d'admin ; anti-doublon 2 min ; `crm.write`), puis
  ligne `canal='whatsapp'`, `statut='prepare'`, jeton bonus, audit sans numéro.
  Elle renvoie l'URL `wa.me` ; le client l'ouvre. L'exploitant envoie lui-même.
- Opposition : un seul droit pour les deux canaux. `STOP` reçu sur la
  passerelle (`/api/whatsapp/waha`) enregistre l'opposition de l'e-mail du
  compte rattaché — par `whatsapp_chat_id` (couvre `@lid`), sinon par numéro
  (prouvé ou déclaré). Expéditeur non rattaché : message transmis à la console
  de contact, comme aujourd'hui, et accusé « STOP bien reçu ».

## 6. Erreurs

Rien d'avalé : échec d'e-mail journalisé et affiché (comportement actuel),
jeton invalide → page explicative, dossier périmé non servi, numéro illisible
refusé à la saisie, vérification d'opposition impossible → rien n'est envoyé
ni préparé.

## 7. Tests

- Purs : normalisation du numéro ; HTML (logo et opposition présents,
  échappement, aucun chiffre hors faits du dossier) ; validité du jeton
  (expiré, utilisé, frais) ; gabarit WhatsApp ; reconnaissance de `STOP`.
- tsc + build frontend.
- Réel après fusion : une relance envoyée à `ebouak@gmail.com`, rendu validé
  sur Gmail bureau et mobile ; parcours du dossier offert de bout en bout ;
  écran WhatsApp vérifié en local avec un compte de test.
