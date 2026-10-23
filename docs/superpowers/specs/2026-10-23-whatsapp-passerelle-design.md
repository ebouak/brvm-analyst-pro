# WhatsApp sans Meta — passerelle WAHA — conception

Date : 2026-10-23 · Décisions de l'exploitant : « non officiel pour tester, puis
officiel » ; hébergement VPS Hetzner ; les 4 usages. Fable (conseiller
d'architecture) indisponible ce jour faute de crédits : conception tranchée sans
consultation, à faire relire si possible avant P3.

## 1. Contexte et risque assumé

- WAHA (devlikeapro) se connecte comme « WhatsApp Web » : **contraire aux
  conditions de WhatsApp**, le numéro peut être banni sans préavis. Le risque est
  confiné à un **numéro dédié** (+33 7 43 65 72 71), jamais au numéro personnel.
- Une passerelle non officielle peut **tomber en silence** (déconnexion, bannissement,
  conteneur arrêté). Quatre pannes silencieuses ont déjà coûté cher au projet : la
  surveillance de session fait partie du **socle**, pas d'une option.

## 2. Infrastructure (en place le 2026-10-23)

Hetzner projet `WESTBOURSE`, serveur `westbourse-wa` (CX23 x86, Falkenstein,
2.31.31.43), pare-feu 22/ICMP/80/443. `/opt/waha` : WAHA `gows-2026.9.2` (non
publié) derrière Caddy `2.11.7` (HTTPS `wa.westbourse.com`, DNS Cloudflare en
« DNS only »). Clé d'API exigée (empreinte `sha512:` côté serveur), webhooks signés
HMAC-SHA512. Session `default` WORKING sur 33743657271.

## 3. Architecture

- **Interface d'envoi unique** `lib/whatsapp/passerelle.ts` :
  `envoyerTexte(destinataire, texte)`, `etatSession()`. Implémentation `waha`
  (aujourd'hui) ; `meta` (code Cloud API existant) choisie par
  `WHATSAPP_PASSERELLE`. Les fonctions propres au non officiel (publication sur une
  Chaîne) restent hors de l'interface commune : l'API officielle ne les offre pas.
- **Entrée** : WAHA → `POST /api/whatsapp/waha` → vérification HMAC-SHA512 du corps
  BRUT (en-tête `X-Webhook-Hmac`, comparaison à temps constant) → déduplication par
  identifiant de message → aiguillage (P1 : contact ; P2 : abonné appairé → agent).
- **Le passage à l'officiel** coûtera : messages types pré-validés hors fenêtre de
  24 h (les alertes sont donc conçues dès P3 comme modèle + variables) et perte de la
  Chaîne (P4 assumée « non officielle seulement »).

## 4. Découpage

| PR | Contenu |
|----|---------|
| **P0** | interface d'envoi, route entrante sécurisée, surveillance de session |
| P1 | visiteurs WhatsApp → `/admin/contact` (brouillon IA, validation, réponse WhatsApp) |
| P2 | appairage du numéro par code (précondition de CLAUDE.md), puis agent à outils |
| P3 | alertes et dossiers aux abonnés appairés et consentants, débit limité |
| P4 | diffusion sur une Chaîne WhatsApp |

## 5. P0 en détail

- `lib/whatsapp/waha.ts` (pur, testé) : `verifierSignatureWaha(corpsBrut, entete,
  secret)` ; `lireEvenementWaha(json)` → `message` (id, expéditeur, texte, deMoi,
  média) | `session.status` (statut) | `null` ; `estConversationPrivee(chatId)` —
  groupes (`@g.us`), statuts (`status@broadcast`) et Chaînes (`@newsletter`)
  ignorés ; `chatIdDepuisTelephone`.
- `lib/whatsapp/passerelle.ts` : implémentation WAHA (`POST /api/sendText`,
  `GET /api/sessions/default`, en-tête `X-Api-Key`, délai 10 s) et Meta (code
  existant). Aucun contenu de message journalisé.
- `app/api/whatsapp/waha/route.ts` : 401 si signature invalide ; 200 sinon ;
  `session.status` ≠ WORKING → **alerte Telegram immédiate** ; `message` →
  déduplication (rate_limit, identifiant haché) puis, en P0, simple accusé (pas de
  traitement, aucune donnée stockée) — P1 branchera le traitement.
- `lib/server/alerteExploitant.ts` : alerte Telegram générique extraite de
  `billing/chariow/alerte.ts` (qui la réutilise).
- **Surveillance planifiée** : CLI scraper `whatsapp:sante` (pur
  `evaluerSessionWhatsapp` testé) appelée par `whatsapp-sante.yml` toutes les heures
  de 06 h à 22 h UTC : statut ≠ WORKING ou passerelle injoignable → Telegram
  exploitant + run en échec. Couvre le cas que le webhook ne peut pas signaler :
  WAHA lui-même arrêté.
- **Activation** (après déploiement) : `WHATSAPP_HOOK_URL` et
  `WHATSAPP_HOOK_EVENTS=message,session.status` dans `/opt/waha/.env`, redémarrage.
- **Secrets GitHub** à créer pour la surveillance : `WAHA_URL`, `WAHA_API_KEY`
  (transférés du serveur à GitHub sans affichage, sur accord de l'exploitant).

## 6. Critères d'acceptation P0

1. Un webhook non signé ou mal signé → 401 ; signé → 200 (testé en production).
2. Un message envoyé au numéro produit un appel signé reçu, dédupliqué au rejeu.
3. Couper la session (ou WAHA) déclenche une alerte Telegram (webhook ou passage
   horaire) et un run rouge.
4. `envoyerTexte` envoie un message réel au numéro de l'exploitant (essai unique).
5. Aucun contenu de message ni secret dans les journaux.

## 7. P1 — contact par WhatsApp

- Message privé entrant → `contact_messages` (`canal = 'whatsapp'`, `whatsapp_chat_id`,
  migration 0160). Conversation **en attente** du même correspondant : le message s'ajoute au fil
  (horodaté UTC) au lieu d'une nouvelle fiche.
- Nouvelle fiche → email à l'exploitant (lien console) + **accusé FIXE** sur WhatsApp, en réponse
  seulement, au plus une fois par conversation et par 24 h.
- Réponse depuis la console → repart par le canal d'arrivée (`renduReponseWhatsapp` : texte simple,
  offre courte, avertissement, signature ; pas de citation). L'identifiant WhatsApp du message est
  gardé dans `resend_id` ; les accusés `message.ack` (SERVER/DEVICE/READ/ERROR) alimentent la même
  colonne `livraison` (monotone) que l'email.
- Échec d'enregistrement : l'identifiant est déjà dédupliqué → alerte Telegram ; le message reste
  lisible dans WhatsApp sur le téléphone.
- Serveur : `WHATSAPP_HOOK_EVENTS=message,message.ack,session.status`.
