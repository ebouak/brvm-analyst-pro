# Canal WhatsApp — brief quotidien & alertes

Le scraper sait envoyer le **brief de séance** (et les alertes/bascules du
Conseiller côté frontend) sur **WhatsApp** via l'API officielle Meta Cloud.
Le code est en place et **inactif tant que les secrets ne sont pas fournis**
(aucun impact si non configuré).

## Ce qui est branché

| Émetteur | Fichier | Déclencheur |
|---|---|---|
| Brief quotidien | `scraper/src/brief/runBrief.ts` | workflow `daily.yml` (16h) |
| Alertes prix | `scraper/src/alerts/channels.ts` (`dispatch`) | commande `alerts` |
| Bascules Conseiller | `frontend/lib/advisor/notify.ts` | worker advisor |

Variables (identiques partout) : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TO`.

## Activation (≈ 30 min, gratuit pour ce volume)

1. **Créer l'app Meta** : [developers.facebook.com](https://developers.facebook.com)
   → *Créer une app* → type **Business** → ajouter le produit **WhatsApp**.
2. **Récupérer les identifiants** (WhatsApp → *API Setup*) :
   - `WHATSAPP_PHONE_ID` = « Phone number ID » du numéro d'expédition
     (Meta fournit un numéro de test ; en prod, ajouter un vrai numéro dédié —
     il ne doit **pas** être déjà lié à une app WhatsApp classique).
   - `WHATSAPP_TOKEN` = token **permanent** : Business Settings → Utilisateurs
     système → créer un utilisateur système admin → générer un token avec la
     permission `whatsapp_business_messaging` (le token temporaire de l'écran
     API Setup expire en 24 h — ne pas l'utiliser en prod).
3. **Choisir le destinataire** : `WHATSAPP_TO` = numéro au format international
   sans `+` (ex. `2250707115115`). En phase test, Meta impose de l'ajouter à la
   liste des destinataires autorisés (*API Setup → To*).
4. **Poser les secrets** :
   - GitHub (brief) : repo → Settings → Secrets and variables → Actions →
     `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TO`.
   - Vercel (advisor, facultatif) : mêmes variables sur le projet `frontend`.
5. **Tester** : `cd scraper && npx tsx src/index.ts brief --force` (avec les
   3 variables dans `.env.local`) → le brief arrive sur le numéro `WHATSAPP_TO`.

## Limites à connaître (honnêteté opérationnelle)

- **Fenêtre de 24 h** : l'API n'autorise le **texte libre** que si le
  destinataire a écrit au numéro dans les dernières 24 h. Hors fenêtre, l'envoi
  échoue (HTTP 470/131047) → il faut un **modèle (template) approuvé** par Meta.
  Contournement simple pour un canal opérateur : envoyer un message au numéro
  du bot une fois par jour, ou approuver un template `daily_brief` (champ texte
  unique) — demande 1-2 jours de validation Meta.
- **Les chaînes WhatsApp (Channels) n'ont PAS d'API publique** : on ne peut pas
  poster automatiquement dans une chaîne type « RichBourse ». Le flux prévu ici
  envoie le brief sur **ton** WhatsApp (`WHATSAPP_TO`) → tu le **transfères en
  2 taps** dans ta chaîne WESTBOURSE. C'est exactement ce que font les médias.
- **Diffusion individuelle aux abonnés** (chaque utilisateur reçoit le brief) :
  possible mais chantier séparé — opt-in RGPD par utilisateur, template
  approuvé, coût Meta par conversation (~0,005-0,08 € selon pays), gestion des
  désabonnements. À ne lancer que si la demande existe.

## Coût

Gratuit jusqu'à 1 000 conversations/mois initiées par l'entreprise — un brief
quotidien vers 1 numéro opérateur ≈ 22 conversations/mois : très en dessous.

---

# Agent conversationnel (entrant) — ajout 2026-08

Le canal ci-dessus est **sortant** (nous écrivons à l'utilisateur). L'agent
conversationnel est **entrant** : l'utilisateur écrit au numéro WESTBOURSE et
reçoit une réponse générée à partir de ses propres données (watchlist, cours,
signaux). Les deux cohabitent sur le même numéro Meta.

## Ce qui est branché

| Élément | Fichier |
|---|---|
| Webhook Meta (GET handshake + POST réception) | `frontend/app/api/whatsapp/webhook/route.ts` |
| Vérification de signature HMAC | `frontend/lib/whatsappAgent/verifySignature.ts` |
| Orchestration (identité → consentement → quota → contexte → LLM) | `frontend/lib/whatsappAgent/handleMessage.ts` |
| Prompt système (discipline anti-conseil) | `frontend/lib/whatsappAgent/systemPrompt.ts` |
| Contexte watchlist enrichi (cours, variation, signal réels) | `frontend/lib/whatsappAgent/watchlistContext.ts` |
| Cascade LLM DeepSeek → Mistral | `frontend/lib/whatsappAgent/callAgentLlm.ts` |
| Appairage du numéro par code | `frontend/lib/whatsappAgent/pairing.ts` + `redeemPairing.ts` |
| Génération du code (route authentifiée) | `frontend/app/api/whatsapp/pairing/route.ts` |
| Interface consentement + appairage | `frontend/components/settings/WhatsAppPrefs.tsx` |

Migrations : `0125` (conversations, consentement `agent_optin`, quota),
`0126` (purge 90 j), `0127` (unicité du numéro), `0128` (codes d'appairage).

## Variables d'environnement — projet **frontend** (Vercel)

| Variable | Où la trouver |
|---|---|
| `WHATSAPP_TOKEN` | Meta → WhatsApp → API Setup (token **permanent**, cf. §Activation ci-dessus) |
| `WHATSAPP_PHONE_ID` | Même écran — *Phone number ID*, pas le numéro |
| `WHATSAPP_APP_SECRET` | Meta → app → Settings → Basic → *App Secret* |
| `WHATSAPP_VERIFY_TOKEN` | **Chaîne que vous inventez**, à reporter à l'identique côté Meta |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Le numéro **public** de l'agent, format `2250700000000` — affiché dans les paramètres pour indiquer où envoyer le code d'appairage |

Sans `WHATSAPP_APP_SECRET`, le webhook rejette **toutes** les requêtes en 401
(fail-closed volontaire). Sans `NEXT_PUBLIC_WHATSAPP_NUMBER`, l'interface
affiche le code mais ne peut pas nommer le numéro destinataire.

## Configuration du webhook côté Meta

1. Déployer le frontend **d'abord** (sinon la route n'existe pas encore).
2. Meta → votre app → WhatsApp → Configuration → Webhook :
   - **Callback URL** : `https://www.westbourse.com/api/whatsapp/webhook`
   - **Verify token** : exactement la valeur de `WHATSAPP_VERIFY_TOKEN`
   - *Verify and save* → Meta appelle le `GET`, la route renvoie le challenge.
3. **Manage** → cocher le champ **`messages`**. Sans cet abonnement, aucun
   message entrant n'est transmis — c'est l'oubli le plus courant.

## Parcours utilisateur

1. Paramètres → « Lier mon numéro WhatsApp » → un code `WB-XXXXXX` s'affiche.
2. L'utilisateur envoie ce code depuis **son** WhatsApp au numéro WESTBOURSE.
3. Le webhook reconnaît le code, lie le numéro **tel que Meta le fournit** au
   compte, et répond une confirmation.
4. L'utilisateur coche le consentement « agent conversationnel » (distinct de
   l'opt-in brief/alertes), puis peut poser ses questions.

Ce sens (code **envoyé par** l'utilisateur, non reçu) est délibéré : il évite
de faire approuver un template Meta pour l'envoi hors fenêtre de 24 h, et
prouve la possession du numéro plus solidement qu'un code reçu.

## Garde-fous en place

- **Signature** vérifiée sur le corps brut avant tout parsing et tout effet de
  bord ; `WHATSAPP_APP_SECRET` absent → 401.
- **Rejeux Meta dédupliqués** par `message.id` (Meta rejoue tout webhook non
  acquitté ; sans ça, double appel LLM facturé et double réponse).
- **Tentatives d'appairage limitées** par numéro (5 / 10 min), numéro HMAC-é —
  jamais en clair dans `rate_limit_hits`. Au-delà du seuil, l'agent **cesse de
  répondre** plutôt que d'amplifier le volume sortant, qui dégraderait la
  *quality rating* du numéro chez Meta.
- **Quota par plan** via `feature_flags.whatsapp_agent` (10/jour gratuit,
  100/jour premium), ajustable depuis `/admin/features` sans redéploiement.
- **Consentement RGPD distinct**, horodaté, retirable ; conversations purgées
  à 90 jours par `purge_rgpd_retention()` ; les deux tables sont couvertes par
  `GET /api/account/export` et `DELETE /api/account/delete`.
- **Le prompt interdit tout conseil en investissement**, y compris reformulé,
  et interdit d'inventer un chiffre absent du contexte fourni.

## Limite connue

L'agent ne connaît que la **watchlist** de l'utilisateur (cours, variation,
signal du jour), plafonnée à 20 titres. Il n'a accès ni aux fondamentaux, ni
à l'historique, ni aux obligations — à toute question hors de ce périmètre, il
répond qu'il n'a pas la donnée plutôt que de l'estimer.
