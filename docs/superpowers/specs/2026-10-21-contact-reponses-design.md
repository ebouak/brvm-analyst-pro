# Répondre aux messages du formulaire de contact — conception

Date : 2026-10-21 · Statut : validée oralement (« Brouillon IA, je valide » ;
adresse `support@westbourse.com`), en relecture écrite.

## 1. Le problème, mesuré

L'encart « Salut, on se parle ? » (`/api/contact`) relaie chaque message par
email vers `ebouak@gmail.com` et envoie au visiteur un accusé promettant une
réponse « sous 2 jours ouvrés » (`lib/contact/accuse.ts`). Le message n'est pas
conservé. Relevé de la boîte le 2026-10-21, tests exclus :

| Reçu  | Question (résumée)                         | Réponse |
|-------|--------------------------------------------|---------|
| 17/09 | se former, ouvrir un compte de zéro        | aucune (33 j) |
| 22/09 | investir depuis le Cameroun, quelle monnaie | rédigée mais envoyée à `noreply@westbourse.com` → rejetée |
| 28/09 | utilité de l'application                   | 7 min |
| 28/09 | « Comment investir »                       | aucune (22 j) |
| 04/10 | Dangote cotée à la BRVM ?                  | 5 h |
| 14/10 | « pas mal » (retour)                       | — |
| 14/10 | sociétés agréées par le CREPMF             | aucune (6 j) |

Quatre personnes sur sept sans réponse alors qu'un accusé la leur promettait.
Les réponses parties ont aussi trahi l'outillage : préambule d'assistant collé
(« Voici une version mise à jour de votre réponse… »), Markdown brut (`**`, `>`),
signature personnelle (deux téléphones, deux adresses postales) envoyée à des
inconnus. Le renvoi vers `noreply` est corrigé depuis le 14/10 (`replyTo`), le
reste non : **rien ne garde trace d'un message, rien ne relance.**

Rattrapage fait hors code le 2026-10-21 : quatre brouillons Gmail, à envoyer
par l'exploitant.

## 2. Décisions

- **L'humain a le dernier mot.** L'IA rédige un brouillon, l'exploitant le
  corrige et clique « Envoyer ». Aucune réponse ne part sans lui : une réponse
  fausse ou assimilable à un conseil en investissement, au nom de WESTBOURSE,
  coûte plus qu'un délai.
- **Adresse de marque** : réponses depuis `WESTBOURSE <support@westbourse.com>`,
  « Répondre » vers `support@westbourse.com`. Le domaine n'a aujourd'hui **aucun
  MX** — c'est pourquoi la réponse du 22/09 a été rejetée. Routage email
  Cloudflare (gratuit, DNS déjà chez Cloudflare) : `support@` → Gmail de
  l'exploitant. Resend utilise le sous-domaine `send.` (MX
  `feedback.forge.rmta.net`) : un MX à la racine ne le perturbe pas. Étape DNS
  **faite par l'exploitant**, guidée.
- **Les relances d'un visiteur arrivent dans Gmail** (via le routage), pas dans
  la console : V1 ne lit pas d'emails entrants. Réglage Gmail facultatif
  « Envoyer en tant que support@ » pour poursuivre la conversation sous la
  marque.

## 3. Conception

### 3.1 Conserver chaque message — migration `0158_contact_messages.sql`

Table `contact_messages` : `id uuid`, `created_at`, `prenom`, `email`, `page`,
`message`, `statut` (`nouveau` | `envoi` | `repondu` | `clos` | `spam`),
`brouillon`, `brouillon_at`, `reponse`, `repondu_at`, `repondu_par uuid`,
`resend_id text`, `derniere_activite_at`.

- RLS activée **sans aucune policy** : seul le service_role lit et écrit. La
  console lit côté serveur après `requirePermission`. Testé à la clé anon
  (lecture `[]`, écriture `42501`).
- Permission `support.reply` ajoutée et accordée à `support_admin`
  (super_admin passe déjà par le contournement).
- **Rétention** : 12 mois après `derniere_activite_at`, ligne ajoutée à
  `purge_rgpd_retention()` (recréée à l'identique de 0146 + cette ligne).
- **Ordre dans `/api/contact`** : 1) insertion ; 2) email à l'exploitant, avec
  lien direct `/admin/contact/<id>` ; 3) accusé. Si l'insertion échoue,
  l'email part quand même (et le dit) : un message ne se perd jamais à cause
  de la base.

**RGPD (mini-checklist).** Données : prénom, email, page, message. Finalité :
répondre à la demande. Base légale : mesures précontractuelles / intérêt
légitime à répondre à une sollicitation volontaire. Conservation : 12 mois
après la dernière activité. Droits : accès et export (messages dont l'email
égale celui du compte, ajoutés à `/api/account/export`), suppression sur
demande à `support@`, et par la purge. Sécurité : RLS sans policy, service_role
serveur uniquement, aucun contenu de message dans les journaux. Le message
n'étant **plus** éphémère, `/confidentialite` et `docs/RGPD.md` sont mis à jour
(et le `<Placeholder>email de contact</Placeholder>` de `/confidentialite`
devient `support@westbourse.com`).

### 3.2 Console `/admin/contact`

- **Liste** : en attente d'abord, puis par date. Ancienneté affichée ; au-delà
  d'**un jour ouvré**, la ligne passe en alerte (l'engagement public est de deux).
- **Fiche** `/admin/contact/[id]` : message, page d'origine, brouillon éditable,
  boutons *Régénérer*, *Envoyer*, *Clore sans réponse*, *Spam*.
- Entrée dans le menu admin (`AdminShell`).

### 3.3 Brouillon IA — module pur + appel

- `lib/contact/brouillon.ts` : construit les messages LLM. Sources :
  1. une **fiche produit fixe**, versionnée dans le code (fonctions, pages,
     liens publics vérifiés) ;
  2. les offres lues dans `subscription_plans` ;
  3. les outils de marché **en lecture seule** de `lib/agent/outils.ts`
     (`cours_valeur`, `dividendes_valeur`, `actualites_valeur`,
     `liquidite_valeur`, `palmares_seance`). **Jamais** les outils liés à un
     compte (`mon_portefeuille`, `mes_alertes`) : l'auteur du message n'est pas
     authentifié.
- Garde-fou : `buildSystemPrompt` existant (une seule source, paramétrée par
  canal `email`) — pas de conseil en investissement, renvoi vers une SGI agréée
  AMF-UMOA. Cascade `callAgentLlm` existante.
- `lib/contact/validerBrouillon.ts` (pur, testé) **refuse** un brouillon qui
  contient : Markdown (`**`, `#`, lignes commençant par `>`), préambule
  d'assistant (« voici », « version », « réponse proposée » en tête), numéro de
  téléphone, adresse email autre que `support@westbourse.com`, lien hors
  `westbourse.com` / `amf-umoa.org` / `brvm.org`. Refus → une régénération, puis
  champ vide avec la raison affichée. Chaque règle vient d'un défaut constaté
  (§1).
- Généré **à l'ouverture** de la fiche si absent (coût LLM seulement pour les
  messages lus), puis enregistré.

### 3.4 Envoi — `POST /api/admin/contact/[id]/repondre`

- `requirePermission('support.reply')`. Le texte envoyé est celui reçu du
  formulaire admin, **revalidé côté serveur** par `validerBrouillon` (mêmes
  règles), longueur bornée.
- **Anti double envoi** : `update … set statut='envoi' where id=… and
  statut='nouveau' returning` — un seul appel gagne ; puis Resend ; succès →
  `repondu` + `resend_id` ; échec → retour à `nouveau`, erreur affichée.
- Email : expéditeur `WESTBOURSE <support@westbourse.com>`, `replyTo` idem,
  sujet « Re : votre message à WESTBOURSE », corps texte → HTML échappé
  (paragraphes), signature **fixe** « L'équipe WESTBOURSE — westbourse.com »,
  message d'origine cité en dessous. Version texte jointe.
- Trace dans `admin_audit_logs` (action, id du message — jamais le contenu).

### 3.5 Relance — CLI `contact:rappel` (scraper)

Chaque jour ouvré à 07:00 UTC (workflow dédié `contact-rappel.yml` :
`alerts.yml` ne tourne qu'à 16:30) : messages `nouveau`
plus vieux qu'un jour ouvré → un message Telegram **exploitant**
(`operateur: true`) avec le nombre, l'ancienneté maximale et le lien de la
console — sans prénom, adresse ni contenu. Aucun message en attente → rien.
Fonction pure `enRetard(messages, maintenant)` testée (jours ouvrés, week-end).

## 4. Hors périmètre (V1)

Lecture des réponses entrantes dans la console, modèles de réponse
réutilisables, envoi automatique, WhatsApp.

## 5. Critères d'acceptation

1. Un message posté est en base **et** arrive par email avec le lien console ;
   base indisponible → l'email part quand même.
2. Anon : lecture `[]`, écriture `42501` ; `get_advisors` sans nouvel avis.
3. La fiche affiche un brouillon qui passe `validerBrouillon` ; les défauts du
   §1 rejoués en tests sont refusés.
4. Deux clics simultanés sur « Envoyer » → un seul email (test de la
   transition conditionnelle).
5. L'email reçu vient de `support@westbourse.com` ; « Répondre » arrive dans
   Gmail via le routage Cloudflare (vérifié par un vrai aller-retour).
6. La relance Telegram part pour un message de plus d'un jour ouvré, pas le
   week-end, et ne contient aucune donnée personnelle.
7. `/confidentialite`, `docs/RGPD.md`, export de compte et purge à jour.
