# Récap du portefeuille en image — à la demande et à la clôture

Date : 2026-10-24. Demande : « que l'utilisateur ait un screen récap de la
situation personnelle de son portefeuille à la demande ou à la fermeture du
marché ».

## Décisions (validées le 2026-10-24)

| Accès | Où |
|---|---|
| **Gratuit** | Bouton « Mon récap en image » sur `/portefeuille` (voir, télécharger, partager) |
| **Premium** | Commande `RECAP` / `PORTEFEUILLE` sur WhatsApp et Telegram (abonné lié) |
| **Premium + case `recap_soir`** | Image jointe au point du soir : WhatsApp, Telegram, e-mail |

## Une source de calcul, une mise en page

- `frontend/lib/recap/calcul.ts` (PUR, 7 tests) : valeur, investi, plus-value
  et secteurs repris TELS QUELS de `derivePortfolio` (mêmes chiffres que
  `/portefeuille`) ; ajoute l'effet de la séance (depuis la variation
  officielle de chaque titre), 3 meilleures / 3 moins bonnes lignes du jour,
  4 secteurs + « Autres », 3 détachements à venir, alertes du jour.
  Variation du jour inconnue → `null`, jamais 0.
- `lib/recap/donnees.ts` : lecture service_role, fenêtre de cours de 21 jours
  (sous le plafond silencieux de 1 000 lignes de PostgREST) ; filtre de
  fiabilité des dividendes identique à l'agent.
- `lib/recap/rendu.tsx` : image 1080×1350 (`next/og`), sans emoji ni espace
  fine (absents de la police par défaut).
- `app/api/recap/image` : identité par **session** OU **lien signé**
  (HMAC-SHA256 de `u.exp`, `RECAP_SECRET`, 10 min max) — un lien invalide est
  refusé sans retomber sur la session. `private, no-store`. Vide → 404.

## Envois

- **RECAP** (`lib/recap/demande.ts`) : identifiant de conversation PROUVÉ
  (`whatsapp_chat_id` 0162, `telegram_chat_id` 0129), Premium vérifié côté
  serveur, 10 demandes/h, image envoyée en mémoire (base64 / multipart) —
  aucune URL publique.
- **Clôture** (`scraper/src/cloture/runCloture.ts`) : après le texte, image
  récupérée par lien signé (`scraper/src/recap/telecharger.ts`), une seule par
  utilisateur. Consentement lu à part et de façon tolérante : si la lecture
  échoue, le point du soir part sans image.
- **E-mail** (`video/brief-envoi.mjs`) : pièce jointe PNG ; jamais en mode
  découverte ; échec → e-mail sans pièce jointe.

## Données personnelles

L'image porte des données financières personnelles. Elle n'est **jamais
stockée** ni mise en cache partagé ; aucun contenu dans les journaux. Seul
ajout en base : le booléen de consentement `recap_soir` (migration 0164,
décoché par défaut). Base légale : consentement ; retrait : décocher.

## Configuration

`RECAP_SECRET` (≥ 32 caractères) : Vercel (production + preview) et GitHub
(workflow `video-seance.yml`, étapes clôture et brief). Absent → la voie
signée est fermée et les envois du soir partent sans image ; le bouton du site
et la commande RECAP n'en dépendent pas.

Signature recopiée dans trois paquets (frontend, scraper, video) : toute
correction est à reporter des trois côtés.
