# Point de clôture Telegram — conception

**Statut** : validé le 2026-09-08.
**Objectif** : définir ce que chaque utilisateur reçoit sur Telegram à la clôture.

## 1. Ce qui existe déjà

| Pièce | État |
|---|---|
| Appairage Telegram (code à usage unique, `chat_id` fourni par Telegram) | en production |
| Alertes personnelles vers la bonne conversation | en production depuis le 2026-09-08 |
| Agent conversationnel à 8 outils, lecture seule | en production |
| Vidéo de séance sur le canal public `@westbourse7` | en production |
| `runBriefWhatsapp` — brief aux consentants, idempotent par `notifications_log` | en production |

Ce document ajoute **un seul** élément : le **point de clôture privé**, et
déplace la vidéo dans une séquence cohérente.

## 2. Décisions

Trois choix arbitrés, qui commandent tout le reste :

1. **Messages séparés, mais cohérents.** Les alertes partent quand elles se
   déclenchent ; le point de clôture et la vidéo suivent. Pas de message unique
   fourre-tout, pas non plus cinq notifications éparpillées.
2. **Le marché pour tous.** Un utilisateur sans alerte, sans portefeuille ni
   watchlist reçoit tout de même le point de marché et la vidéo. Les blocs
   personnels n'apparaissent que s'ils ont du contenu.
3. **Le personnel est premium.** Point de marché et vidéo pour tous ; alertes,
   portefeuille et watchlist réservés aux abonnés.
   « Abonné » = `profiles.is_premium`, la même lecture que partout ailleurs
   (agent conversationnel, pages premium). **Pas de `checkFeature` ici** : ce
   n'est pas un quota consommable mais un droit d'accès binaire, et introduire
   un code de fonctionnalité non semé refuserait l'accès à tout le monde en
   silence — le piège rencontré le 2026-09-08 sur l'agent.

## 3. Séquence du soir

```text
15:00  Clôture BRVM
16:00  daily.yml + score.yml     consolidation cours et signaux        [existant]
16:30  alerts.yml                alertes personnelles → Telegram       [existant]
16:45  video-seance.yml          vidéo publiée sur @westbourse7
                                 -> file_id conservé
16:50  cloture.yml               point de clôture privé + vidéo
```

**16:50 et non 16:35** : le point annonce « 2 alertes se sont déclenchées ». Il
doit donc passer **après** `alerts.yml`, sinon il annonce un compte faux.

**Corrigé au passage** : la vidéo tournait à 18:00, deux heures après la
consolidation et **en concurrence avec `scrape-daily`**, lui aussi à 18:00.

## 4. Anatomie du point de clôture

```text
WESTBOURSE · Clôture du 8 septembre

BRVM Composite  +0,45 %  ·  537,67 pts
17 hausses · 21 baisses · 9 stables
3,01 Md FCFA échangés

▸ VOS ALERTES (2)                    <- premium, si déclenchées
  SNTS a franchi 15 000 FCFA
  BOAC : RSI en surachat (72)

▸ VOTRE PORTEFEUILLE                 <- premium, si positions
  +127 400 FCFA  ·  +3,2 %

▸ VOTRE WATCHLIST                    <- premium, si non vide
  SGBC +2,1 %   ORAC −0,8 %   NTLC =

▸ LE BRIEF
  « Séance portée par les banques… »
  westbourse.com/brief

Information de marché, pas un conseil en investissement.
```

Puis la vidéo, en pièce jointe.

**Trois règles de composition** :

- **Un bloc vide n'apparaît pas.** L'absence se traite par le silence, jamais
  par « Portefeuille : néant ».
- **Un gratuit voit ce qu'il rate UNE fois**, en pied de message : « 2 alertes
  se sont déclenchées aujourd'hui · voir ». Pas un bloc masqué par section —
  frustrer trois fois dans un même message ferait fuir.
- **Aucun chiffre n'est recomposé.** Le point lit les mêmes tables que la vidéo
  et la landing. Si un chiffre change, il change partout ou nulle part.

## 5. Consentement

**Aucune nouvelle colonne.** Les quatre existantes suffisent :

| Colonne | Commande |
|---|---|
| `telegram_optin` | consentement racine — sans lui, rien ne part |
| `alerts_telegram` | les alertes de 16:30 |
| `brief_telegram` | le point de clôture **et** la vidéo |
| `agent_optin` | l'agent conversationnel |

Le point et la vidéo partagent un interrupteur : deux formes du même rendez-vous.

**Le poids de la vidéo (1 Mo par soir) se règle côté Telegram**, qui expose déjà
le téléchargement automatique par type de réseau. Ajouter notre propre réglage
dupliquerait un contrôle que l'utilisateur maîtrise mieux que nous.

**Défauts à l'appairage** : `alerts_telegram` et `brief_telegram` vrais,
`agent_optin` faux. Lier son Telegram exprime l'intention de recevoir ;
converser avec une IA est un acte distinct.

## 6. Le coût de la vidéo, et comment il est annulé

Envoyer 1 Mo à N utilisateurs, ce serait N téléversements.

**Telegram permet de réutiliser un `file_id`** : la vidéo est téléversée **une
fois** vers `@westbourse7`, et l'identifiant renvoyé est ensuite adressé à
chaque conversation **sans re-téléversement**. Le coût devient indépendant du
nombre d'abonnés.

`video/publie.mjs` écrit donc le `file_id` dans `seance.json`, que le worker de
clôture relit. Sans cette technique, l'envoi privé de la vidéo serait
déconseillé.

## 7. Quand une donnée manque

| Situation | Comportement |
|---|---|
| Séance non publiable (5 contrôles de `seance.json`) | **rien n'est envoyé** |
| Brief absent | le point part **sans le bloc brief** |
| Vidéo en échec | le point part quand même |
| L'utilisateur a bloqué le bot (`403`) | **effacer son `telegram_chat_id`**, cesser d'essayer |
| Un envoi échoue | journaliser, **continuer avec les autres** |
| Workflow relancé | `notifications_log` fait foi, rien n'est renvoyé |

Le premier point est le plus important : un cron publie sans relecture humaine.
**Mieux vaut un soir de silence qu'un message faux.**

Le cas `403` n'est pas cosmétique : sans effacement, on relance chaque soir un
utilisateur qui a explicitement coupé le contact — son consentement n'existe
plus de fait.

## 8. Architecture

**Un worker dédié `scraper/src/cloture/`**, et non une extension de
`runBriefWhatsapp`.

**Pourquoi** : le domaine est celui du scraper (service_role, idempotence par
`notifications_log` déjà éprouvée), et cela **ne touche pas au chemin WhatsApp**,
en production et non éprouvable ici. Le coût est un worker de plus ; le bénéfice
est qu'aucune régression ne peut l'atteindre.

```text
scraper/src/cloture/
  composer.ts       PUR — assemble le texte depuis des données déjà lues.
                    Testable sans réseau ni base : c'est là que vivent les
                    règles de composition du §4.
  destinataires.ts  lecture des consentants + niveau de plan
  runCloture.ts     orchestration, envoi, journalisation
```

`composer.ts` est pur parce que **les règles de composition sont ce qui peut
silencieusement mal tourner** — un bloc vide affiché, un chiffre recomposé, une
mention premium montrée à un abonné. Un test doit pouvoir les éprouver toutes
sans dépendre d'une séance réelle.

## 9. Ce que ce document ne couvre pas

- **Le brief WhatsApp reste inchangé.** Le rendre multicanal viendra peut-être,
  mais pas dans le même passage.
- **Aucune migration.** Si une colonne s'avérait nécessaire, ce serait le signe
  d'une décision non arbitrée ici.
- **Pas de digest hebdomadaire ni de résumé du week-end.** Un rendez-vous à la
  fois.
