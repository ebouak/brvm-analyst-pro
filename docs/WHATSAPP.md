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
