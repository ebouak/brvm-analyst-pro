# Plusieurs WhatsApp par compte

Date : 2026-10-24. Demande : « prévoir le cas où une personne peut avoir deux
WhatsApp ». Décision : **chaque WhatsApp lié reçoit tout**, au plus **2** par
compte.

- **Table `whatsapp_liaisons`** (migration 0165) : une ligne par WhatsApp lié
  (`chat_id` unique, `telephone` quand WhatsApp le fournit, `lie_le`).
  Le propriétaire LIT et DÉLIE (policies owner) ; seul le webhook CRÉE, après
  un code d'appairage envoyé depuis ce WhatsApp. Les liaisons existantes
  (`notification_prefs.whatsapp_chat_id`, 0162) sont recopiées ; la colonne
  devient obsolète.
- **Consentements au niveau du compte** (inchangés) : `whatsapp_optin`,
  `brief_whatsapp`, `alerts_whatsapp`, `dossiers_whatsapp`, `agent_optin`,
  `recap_soir` valent pour chaque WhatsApp lié.
- **Appairage** (`lib/whatsapp/appairage.ts`) : refuse un WhatsApp déjà lié à
  un autre compte, refuse au-delà de 2, sinon ajoute la liaison.
- **Entrées** : RECAP, commandes et assistant fonctionnent depuis chaque
  WhatsApp lié (`lib/whatsapp/liaisons.ts`).
- **Envois** (scraper) : point du soir, alertes, dossiers et récap partent vers
  chaque WhatsApp lié (`scraper/src/whatsapp/liaisons.ts`).
- **Paramètres** : liste des WhatsApp liés, « Délier » pour chacun, « Lier un
  autre WhatsApp » tant qu'il y en a moins de 2 ; retirer le consentement
  délie tout.
- **Compatibilité** : tant que 0165 n'est pas appliquée, tout retombe sur
  l'ancienne colonne (un WhatsApp) — aucun abonné n'est coupé.
- **RGPD** : export (`whatsapp_liaisons`), suppression par cascade du compte,
  conservation jusqu'au déliement.
