# WhatsApp — lot D : appairage par code et agent (essai gratuit / Premium)

Date : 2026-10-24. Feuille de route : `2026-10-23-whatsapp-lot-a-design.md` §0.

## Appairage (identifiant PROUVÉ)

- L'abonné génère un code dans `/parametres/alertes` (route existante
  `POST /api/whatsapp/pairing`, table `whatsapp_pairing_codes`) et l'envoie
  depuis son WhatsApp au +33 (bouton « Ouvrir WhatsApp avec le code », déjà là).
- Le webhook WAHA reconnaît le code (`isPairingCode`), le consomme
  ATOMIQUEMENT, puis pose `whatsapp_chat_id` (…@c.us ou …@lid), le numéro
  quand l'identifiant le porte, `whatsapp_verifie_at`, `whatsapp_optin` et son
  horodatage (`lib/whatsapp/appairage.ts`). 5 tentatives / 10 min par
  conversation, silence au-delà.
- Pourquoi l'identifiant et pas le numéro : WAHA transmet souvent un
  identifiant masqué `@lid`, sans numéro. On répond à l'identifiant reçu.

## Verrou des liaisons (défaut corrigé)

La policy « owner update » de `notification_prefs` laissait le propriétaire
écrire `telegram_chat_id` / `whatsapp_phone` avec la clé publique. Migration
`0162` : déclencheur qui, pour `anon`/`authenticated`, refuse de POSER ces
colonnes (et `whatsapp_chat_id`, `whatsapp_verifie_at`) et permet seulement de
les VIDER. Conséquence : `WhatsAppPrefs` n'envoie plus `whatsapp_phone` dans
son upsert (la branche INSERT du déclencheur l'aurait vidé à chaque
enregistrement) ; le retrait efface numéro et identifiant, comme Telegram.

## Aiguillage (route `/api/whatsapp/waha`)

1. code d'appairage → liaison ;
2. commande rapide (lot A) → réponse sans IA ;
3. abonné lié + `agent_optin` + message ≠ `HUMAIN`/`CONSEILLER`/`EQUIPE`/`SUPPORT`
   → agent ;
4. tout le reste → console de contact (humain).
Erreur de lecture de l'abonné → console : un message n'est jamais perdu.

## Agent (`lib/whatsapp/agent.ts`)

Mêmes modules que Telegram (prompt, watchlist, LLM, outils). Règle Premium
appliquée CÔTÉ SERVEUR :

| | Gratuit | Premium / admin |
|---|---|---|
| Quota (`feature_flags.whatsapp_agent`) | 3 / jour (0162) | 100 / jour |
| Outils | marché seulement | + `mon_portefeuille`, `mes_alertes` |
| Watchlist dans le contexte | non | oui |

Un compte gratuit ne reçoit pas les définitions des outils Premium ; si le
modèle en inventait l'appel, l'exécuteur renvoie « Réservé Premium ». Le prompt
(`premium: false`) lui fait dire que c'est réservé, avec le lien `/pricing`.
Quota atteint (gratuit) → message + lien Premium + rappel des commandes
illimitées. Le flag est partagé avec Telegram (même agent) : son quota gratuit
passe aussi à 3 ; les outils Telegram restent inchangés dans ce lot.

## Vérifications

tsc vert, vitest 947 verts (dont `estDemandeHumain`). `pairing.test.mjs`
échoue sous `node --test` AVANT ce lot (alias `@/lib` non résolu) : préexistant.
