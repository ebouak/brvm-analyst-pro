# WhatsApp — lot E : alertes, point du soir et dossiers sur WhatsApp

Date : 2026-10-24. Feuille de route : `2026-10-23-whatsapp-lot-a-design.md` §0.
Demande : « envoyer les mêmes éléments que Telegram sur les WhatsApp des
personnes inscrites ».

## Destinataires

Uniquement `notification_prefs.whatsapp_chat_id`, identifiant PROUVÉ par code
d'appairage (lot D, 0162). Jamais un numéro saisi, aucun repli vers un autre
destinataire. Envoi par la passerelle (`scraper/src/whatsapp/passerelle.ts`),
2 à 4 s entre deux envois : une rafale ressemble à du spam et fait bannir un
numéro non officiel. Sans `WAHA_URL`/`WAHA_API_KEY`, rien ne part (l'ancien
chemin Meta reste tel quel, utilisé seulement sans passerelle — jamais les deux).

| Envoi | Worker | Condition | Accès |
|---|---|---|---|
| Point de clôture (même texte que Telegram, + lien de la Chaîne au lieu de la vidéo) | `cloture` (video-seance.yml) | `whatsapp_optin` + `brief_whatsapp` | Gratuit ; portefeuille/alertes dans le message si Premium (`composerCloture`) |
| Alertes de titres | `alerts` (alerts.yml) | `whatsapp_optin` + `alerts_whatsapp` | **Premium** |
| Dossiers PDF du samedi | `dossiers:envoi` (dossier.yml) | `dossiers_whatsapp` (0163) | **Premium** |

- Idempotence : `notifications_log` (marqueur `Cloture <date> (WhatsApp)`,
  clé utilisateur + canal) ; `dossier_envois` (canal `whatsapp`, 0163).
- La vidéo n'est PAS renvoyée à chaque abonné (≈ 19 Mo par envoi) : la Chaîne
  publique la porte, le message y renvoie (`WHATSAPP_CHAINE_URL`, variable GitHub).
- PDF en base64 (`sendFile`) : le bucket des dossiers est privé.

## Paramètres

- `/parametres/alertes` : les sections de CANAUX (WhatsApp, Telegram, brief)
  s'affichent pour tout compte connecté — lier WhatsApp ouvre l'essai gratuit de
  l'assistant ; seuls les alertes personnalisées et les dossiers restent
  derrière `canAccess('alertes')`. Avant, toute la page l'était.
- Section WhatsApp renommée « WhatsApp — alertes, point du soir et assistant »
  (« Notifications d'alertes » ne disait pas WhatsApp : signalé introuvable).
- Dossiers : case « Sur WhatsApp », inerte tant que WhatsApp n'est pas lié.

## Corrigé en passant

`brief:whatsapp` (Meta) envoyait réellement en `DRY_RUN` : garde ajouté.

## Signalé, non traité

`scrape-daily.yml` lance `npm run alerts` SANS aucun canal (ni Resend, ni
Telegram, ni passerelle). Une alerte déclenchée n'étant pas renotifiée le même
jour, si ce passage précède `alerts.yml`, l'alerte ne part qu'en console. À
vérifier sur `notifications_log` avant toute correction.

## Décisions prises sans le conseiller

Fable indisponible (crédits épuisés) : rythme 2-4 s, Premium pour alertes et
dossiers, vidéo par lien — tranchés ici et documentés.
