# Envoi hebdomadaire des dossiers valeur — design

Date : 2026-09-15. Statut : validé en dialogue, à implémenter.

## Objet

Chaque samedi, après la production des PDF (`dossier.yml`, 11:00 UTC), envoyer à
chaque porteur qui l'a demandé le dossier valeur (PDF A4, 7 pages) de chaque
action de son portefeuille. Deux canaux au choix de l'utilisateur : email et
Telegram. Rien n'est envoyé à qui n'a pas coché.

Ce qui existe déjà et n'est pas refait : les PDF (`dossiers/<CODE>/dernier.pdf`,
bucket privé), l'email Resend (`scraper/src/alerts/channels.ts`), l'appairage
Telegram prouvé (`notification_prefs.telegram_chat_id`), le monitoring des jobs
(`scraper/src/monitoring/`), les routes RGPD d'export et de suppression.

## Décisions prises

| Question | Décision | Pourquoi |
|---|---|---|
| Canal | Email **et** Telegram, une case par canal | Tout compte a un email ; Telegram est prouvé par appairage. WhatsApp exclu : numéro déclaratif, non prouvé. |
| Contenu | PDF en **pièces jointes** | Lisible sans connexion, hors ligne. Un lien signé serait un secret dans une URL. |
| Compte sans ligne | **Aucun message** | Un envoi vide est du bruit. Journalisé `vide`. |
| Où tourne l'envoi | Job **scraper**, 3ᵉ étape de `dossier.yml` | Resend, Telegram, service_role et monitoring y sont déjà. Ordre garanti : PDF puis envoi. |

## 1. Consentement — migration `0132`

Sur `public.notification_prefs` :

```sql
add column dossiers_email     boolean not null default false,
add column dossiers_telegram  boolean not null default false,
add column dossiers_optin_at  timestamptz;  -- première activation ; null quand les deux sont décochées
```

- Finalité : recevoir chaque samedi le dossier PDF de chaque valeur détenue.
- Base légale : consentement explicite, cases décochées par défaut.
- Conservation : jusqu'au retrait (cases décochées) ou suppression du compte
  (cascade existante). Export et suppression déjà couverts (même table).
- Aucune donnée nouvelle collectée : l'email vient de `profiles`, le
  `chat_id` de l'appairage existant.

UI : bloc « Dossiers valeur du samedi » dans `/parametres/alertes`, deux cases.
La case Telegram est désactivée tant que `telegram_chat_id` est nul, avec le
texte « Appairez Telegram ci-dessus ». Le composant écrit les deux booléens et
`dossiers_optin_at` ; il n'écrit **jamais** `telegram_chat_id`.

## 2. Journal des envois — migration `0132` (suite)

```sql
create table public.dossier_envois (
  user_id    uuid not null references auth.users(id) on delete cascade,
  semaine    date not null,              -- lundi ISO de la semaine d'envoi
  canal      text not null check (canal in ('email','telegram')),
  codes      text[] not null default '{}',
  statut     text not null check (statut in ('en_cours','envoye','echec','vide')),
  erreur     text,
  created_at timestamptz not null default now(),
  primary key (user_id, semaine, canal)
);
```

- RLS activée ; policy `select` owner (`auth.uid() = user_id`) ; aucune policy
  d'écriture (service_role seulement).
- Rôle : **idempotence**. Un `(compte, semaine, canal)` en `envoye` n'est
  jamais renvoyé, même si le workflow est relancé.
- Rétention 90 jours : ajout à `purge_rgpd_retention()`. Couverte par
  `/api/account/export` (lecture owner) et la cascade de suppression.

## 3. Job `dossiers:envoi` — `scraper/src/dossiers/runEnvoi.ts`

Étapes, par compte éligible :

1. **Sélection.** `notification_prefs` où `dossiers_email` ou
   `dossiers_telegram` ; codes distincts de `portfolios_positions` avec
   `quantite > 0` ; `profiles.email` ; `telegram_chat_id`.
2. **Fraîcheur (verrou).** `storage.objects` pour `dossiers/<CODE>/dernier.pdf` :
   retenu seulement si `updated_at` ≥ maintenant − 3 jours. Sinon **écarté et
   nommé** dans le message : « CODE : dossier de cette semaine non disponible ».
   Jamais un document périmé sans le dire.
3. **Téléchargement** des PDF retenus via service_role, en mémoire.
4. **Plafond email : 12 pièces jointes** (~2 Mo). Tri par valorisation
   (`quantite × dernier cours`) décroissante ; les suivantes sont listées
   « disponibles sur votre portefeuille » (lien `/portefeuille`, session
   requise, rien de secret). Telegram : un `sendDocument` par PDF, sans plafond.
5. **Envoi.** Email : `sendEmail` étendu d'un champ facultatif
   `attachments: {filename, content(base64)}[]` (API Resend). Telegram : nouveau
   `sendTelegramDocument(chatId, buffer, filename, caption)` en multipart
   (modèle : `sendVideo` dans `video/publie.mjs`). `telegramChatId` explicite,
   **aucun repli** vers `TELEGRAM_CHAT_ID` de l'exploitant.
6. **Journal.** Ligne `dossier_envois` écrite **avant** l'envoi en `en_cours`,
   puis `envoye` ou `echec` + `erreur`. Un compte déjà `envoye` cette semaine
   est sauté.
7. **Compte vide** (aucune ligne, ou aucune fraîche) : pas de message, ligne
   `vide`.

Un compte en échec n'arrête pas le lot. Résumé final : envoyés / vides /
échecs. Sortie **code 1** si au moins un échec, pour que le workflow le
signale. Instrumenté par `withMonitoring` (→ `scraper_runs`).

## 4. Le message

- Sujet email : `Vos dossiers valeur — semaine du <lundi JJ/MM/AAAA>`.
- Corps **texte**, pas de HTML. Une ligne par valeur : `CODE — Désignation —
  dossier de 7 pages`. Les exclus, nommés avec leur raison. Une phrase de cadre :
  « Document d'information établi à partir des données Westbourse ; ne
  constitue pas un conseil en investissement. »
- **Aucun chiffre dans le corps** (hors dates) : les chiffres sont dans les PDF,
  déjà vérifiés. En remettre créerait une seconde source à tenir juste.
- Telegram : même message d'ouverture, puis un document par valeur, légende
  `CODE — Désignation`.
- Pied : « Vous recevez ceci parce que vous l'avez activé dans Paramètres ›
  Alertes. Pour arrêter : décochez la case. » Retrait à un clic, sans lien de
  désinscription porteur de secret.

## 5. Workflow

`dossier.yml` gagne une étape « Envoyer aux porteurs » après « Imprimer et
ranger », `working-directory: scraper`, `npm run dossiers:envoi`. Secrets déjà
présents : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`ALERTS_EMAIL_FROM`, `TELEGRAM_BOT_TOKEN`. Une étape d'envoi en échec ne fait
pas échouer l'impression, déjà faite ; elle est signalée.

## 6. Tests

Fonctions pures, vitest (scraper) :

- `cleSemaine(date)` → lundi ISO.
- `selectionnerLignes(positions, objets, maintenant)` : exclusion des PDF de
  plus de 3 jours, tri par valorisation, plafond 12 avec reste nommé.
- `composerMessage(...)` : sujet, une ligne par valeur, exclus nommés, pied ;
  **test qui échoue si un chiffre apparaît hors dates**.
- `sendEmail` avec `attachments` : corps JSON attendu (mock fetch).

Mode `--mock` : n'envoie rien, imprime ce qui aurait été envoyé et n'écrit pas
le journal.

Vérification en production : premier passage en `workflow_dispatch` avec **un
seul compte** coché (celui de l'exploitant), contrôle de `dossier_envois` et
du message reçu, puis activation générale par le simple fait que la case
existe.

## Hors périmètre

- WhatsApp (numéro non prouvé — précondition d'appairage, voir CLAUDE.md).
- Choix des valeurs à recevoir (tout le portefeuille, ou rien).
- Fréquence autre qu'hebdomadaire.
- HTML, mise en forme, résumé chiffré dans le message.
