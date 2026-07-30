# Alerte thèse invalidée — design

**Date** : 2026-07-30
**Statut** : approuvé, prêt pour plan d'implémentation
**Fonctionnalité** : #15 du catalogue produit — préparée par
[Journal de décision](2026-07-26-journal-decision-design.md) §10 (hors périmètre à l'époque)

## 1. Pourquoi, et ce qui existe déjà

Aujourd'hui, savoir qu'une thèse est « à revoir » exige de retourner soi-même sur
la fiche de l'action (`checkThesis`, `lib/theses/status.ts`, déjà en prod). Rien
ne prévient l'utilisateur de manière proactive quand :

- le signal quantitatif se retourne contre sa conviction ;
- le cours décroche de ≥ 20 % contre une thèse d'achat (ou rebondit de ≥ 20 %
  contre une thèse de vente).

**Réutilisé tel quel, rien reconstruit :**

- `checkThesis()` (pure, testée) — calcule `status: 'intacte' | 'a-revoir' |
  'objectif-atteint'` à partir de `stance`, `coursReference`, `objectif`,
  `coursActuel`, `signalActuel`.
- `investment_theses` (migration `0051` + `0123`) — une thèse active par
  (user, code).
- Le pattern de livraison personnelle déjà en prod dans
  `scraper/src/alerts/runAlerts.ts` (canal WhatsApp opt-in via
  `notification_prefs`).
- `notifications_log` (`alert_id` nullable — on laissera `null` pour les
  alertes de thèse, il n'y a pas de ligne `alerts` correspondante).

## 2. Correction d'hypothèse : `dispatch()` ne convient pas ici

La première intuition — « réutiliser `dispatch()` existant » — s'est révélée
fausse à la lecture de `channels.ts` :

- `dispatch({ ..., to })` envoie **toujours** aussi au Telegram et au WhatsApp
  **globaux de l'exploitant** (`TELEGRAM_CHAT_ID`, `WHATSAPP_TO`), quel que
  soit `to`. C'est voulu pour les alertes de prix (visibilité opérationnelle
  sur tout ce qui se déclenche), mais une alerte de thèse est strictement
  **personnelle** — l'appeler une fois par thèse invalidée spammerait les
  canaux internes de l'exploitant à chaque événement individuel d'un
  utilisateur.
- Le seul canal réellement personnalisable dans `dispatch()` est l'email via
  `n.to`, et cette fonction (`sendEmail`) n'est aujourd'hui **pas exportée**.

**Décision** : ce flux n'appelle jamais `dispatch()`. Il exporte `sendEmail()`
de `channels.ts` et l'appelle **directement** avec `to: <email utilisateur>`,
exactement comme le canal WhatsApp personnel appelle déjà `sendWhatsAppTemplate`
/`sendWhatsAppRaw` directement en contournant `dispatch()`. Aucun message ne
part vers les canaux globaux de l'exploitant pour cette fonctionnalité.

## 3. Email personnel — aucune nouvelle donnée stockée

L'email de l'utilisateur existe déjà dans `auth.users` (créé à l'inscription).
Le worker (`service_role`) le récupère via l'API admin GoTrue :
`sb.auth.admin.getUserById(user_id)` → `.data.user.email`. Aucune duplication
de l'adresse dans une table applicative.

Seule donnée nouvelle : un **booléen de préférence** — cohérent avec la
discipline déjà appliquée à `alerts_whatsapp`.

```sql
alter table public.notification_prefs
  add column if not exists alerts_email boolean not null default false;
```

Décoché par défaut. Retrait libre (toggle). Couvert par `/api/account/export`
et `/api/account/delete` sans modification : les deux routes font
`select('*')` / suivent la ligne `notification_prefs` déjà en cascade sur le
compte.

## 4. Décisions de cadrage

| Question | Décision |
|---|---|
| États déclencheurs | Uniquement `'a-revoir'` — jamais `'objectif-atteint'` (positif, pas une alerte d'alerte) |
| Canal personnel | WhatsApp (existant, `notification_prefs.alerts_whatsapp`) **et** email (nouveau, `notification_prefs.alerts_email`) |
| Canal global (`dispatch`) | **Aucun** — voir §2, c'est strictement personnel |
| Répétition | **Front montant uniquement** : une notification à la *transition* vers `'a-revoir'`, pas à chaque exécution tant que ça reste `'a-revoir'` |
| Ré-armement | Si le statut repasse à `'intacte'` puis retombe à `'a-revoir'`, nouvelle notification (nouvelle transition) |

Le choix « front montant » évite le spam pour un titre qui reste durablement
« à revoir » pendant des semaines — cohérent avec l'esprit « honnêteté, pas de
bruit » du projet.

## 5. Migration `0124_these_alerte.sql`

```sql
alter table public.investment_theses
  add column if not exists dernier_statut_evalue text
       check (dernier_statut_evalue in ('intacte','a-revoir','objectif-atteint')),
  add column if not exists derniere_alerte_le timestamptz;

alter table public.notification_prefs
  add column if not exists alerts_email boolean not null default false;
```

`dernier_statut_evalue` est mis à jour à **chaque** exécution du worker (que
l'alerte parte ou non) — c'est la mémoire qui permet de détecter la
transition. `derniere_alerte_le` n'est posé que lorsqu'une notification part
réellement (utile pour l'affichage et le débogage, pas pour la dédup — la
dédup repose sur le changement de statut, pas sur une fenêtre de temps).

RLS : aucune nouvelle policy — les deux tables ont déjà une RLS owner-strict
qui couvre la ligne entière, colonnes incluses.

## 6. Module pur dupliqué côté scraper

`checkThesis` vit dans `frontend/lib/theses/status.ts`. Le scraper est un
paquet TS/ESM séparé qui ne résout pas les imports du frontend (même
contrainte déjà rencontrée pour `hebdo` — voir
`scraper/src/hebdo/pure/`). Même traitement :

**Créer** `scraper/src/theses/pure/status.ts` — copie fidèle de
`checkThesis`, `Stance`, `ThesisStatus`, `ThesisCheckInput`,
`ThesisCheckResult`, avec un commentaire d'en-tête :

```ts
// Copie de frontend/lib/theses/status.ts — toute correction doit être
// reportée des deux côtés (pas de module partagé entre les deux paquets TS).
```

**Test** : `scraper/tests/theses-pure-status.test.ts` — copie des cas déjà
couverts par `frontend/lib/theses/status.test.ts` (objectif atteint, signal
contraire, décrochage ≥ 20 %, thèse intacte).

## 7. Worker `scraper/src/theses/runThesisAlerts.ts`

Pattern calqué sur `runAlerts.ts` (batching des lectures, pas de N+1) :

1. Charger toutes les thèses actives : `investment_theses` où `statut='active'`.
2. Codes distincts → un seul `select` batché sur `brvm_actions_daily` (dernier
   cours par code, comme `runAlerts.ts` §L51-63) et un seul sur `signals_daily`
   (dernier signal par code).
3. Pour chaque thèse : `check = checkThesis({ stance, coursReference,
   objectif, coursActuel, signalActuel })`.
4. Si `check.status === 'a-revoir'` **et** `these.dernier_statut_evalue !==
   'a-revoir'` → c'est une transition, on notifie :
   - Charger les prefs de l'utilisateur (`notification_prefs` — un seul
     `select` batché par lot d'`user_id`, comme `waByUser` dans
     `runAlerts.ts`) : `alerts_whatsapp`+`whatsapp_phone`,
     `alerts_email`.
   - Si `alerts_whatsapp` : `sendWhatsAppTemplate` puis repli
     `sendWhatsAppRaw` (identique à l'existant).
   - Si `alerts_email` : email récupéré via
     `sb.auth.admin.getUserById(these.user_id)`, puis
     `sendEmail({ to: email, subject, body })` (nouvellement exportée,
     §2).
   - Insérer une ligne `notifications_log` par canal effectivement tenté
     (`alert_id: null`, `code: these.code`, `user_id: these.user_id`).
   - `derniere_alerte_le = now()`.
5. Toujours (déclenché ou non) : `dernier_statut_evalue = check.status`.

**Contenu du message** — construit uniquement à partir de
`check.raisons` (jamais de texte inventé) :

```
Objet : Thèse à revoir — {code}
Corps :
Votre thèse « {stance} » sur {code} (rédigée le {date}) semble à revoir :
{raisons.join('\n')}
Voir : https://www.westbourse.com/journal
```

**CLI** : nouvelle commande `these-alertes` dans `scraper/src/index.ts`,
instrumentée avec `withMonitoring` (même pattern que les 6 commandes déjà
câblées — Lot 3 monitoring, voir `scraper/src/monitoring/`), `--mock` neutralise
tout envoi réel. Planifiée en cron juste après `score` (a besoin de
`signals_daily` et `brvm_actions_daily` à jour).

**Écart assumé au moment du plan** : plutôt qu'un nouvel appel dans
`score.yml`, l'implémentation a créé un workflow GitHub dédié
`.github/workflows/thesis-alerts.yml` (16:40 UTC, lun-ven), calqué sur
`.github/workflows/alerts.yml` (retry ×3, notification Slack en cas d'échec) —
ce gabarit existait déjà pour un besoin identique (alertes personnelles) et
manquait à `score.yml`. Fonctionnellement équivalent, échoue plus proprement
de façon isolée. Voir `docs/superpowers/plans/2026-07-30-alerte-these-invalidee-implementation.md`
Task 7.

## 8. UI — `notification_prefs`

Le composant existant `frontend/components/settings/WhatsAppPrefs.tsx` gère
déjà `alerts_whatsapp`. Pas de route API à modifier : le composant écrit
**directement** en base via la clé anon (`sb.from('notification_prefs').upsert(...)`,
`onConflict: 'user_id'`) — la RLS owner (`notification_prefs_update_own`,
migration `0087`) fait autorité, pas de couche serveur intermédiaire.

Ajouter une case « Recevoir un email si une de mes thèses est à revoir » :
étendre l'interface `Prefs` locale avec `alerts_email: boolean`, l'inclure dans
`DEFAULTS` et dans l'objet passé à `save()`. Même style de checkbox que
`alerts_whatsapp` (§ligne 184-192 du composant), mais visible indépendamment de
l'opt-in WhatsApp — l'email ne dépend pas de `whatsapp_optin`.

Aucune nouvelle page : la case vit dans les préférences déjà existantes.

## 9. Tests

**Purs** (`scraper/tests/theses-pure-status.test.ts`) : copie des 4-5 cas de
`status.test.ts` frontend (voir §6).

**Détection de transition** (nouveau test, logique du worker isolée dans une
fonction pure `shouldNotify(statutActuel, statutPrecedent): boolean`) :

- `'a-revoir'` après `'intacte'` → `true`
- `'a-revoir'` après `'a-revoir'` → `false` (pas de répétition)
- `'a-revoir'` après `null` (jamais évalué) → `true`
- `'intacte'` après `'a-revoir'` → `false` (pas d'alerte sur un retour au vert)
- `'a-revoir'` après `'objectif-atteint'` → `true`

**RGPD** : confirmer que `alerts_email` apparaît dans l'export (`select('*')`
sur `notification_prefs`, déjà vérifié §3).

**Bout-en-bout manuel** (comme le formulaire de leads plus tôt dans la
session) : créer une thèse de test, forcer `dernier_statut_evalue = 'intacte'`,
faire tourner `these-alertes --mock` d'abord, puis en réel sur un compte de
test avec `alerts_email` coché, vérifier réception + ligne
`notifications_log` + nettoyage.

## 10. Hors périmètre

- Alerte sur `'objectif-atteint'` (célébration, pas une invalidation — pourrait
  être une feature séparée du catalogue).
- Fréquence configurable par l'utilisateur (quotidien/hebdo) — le front montant
  suffit pour la V1.
- Canal Telegram personnel (l'app n'a pas de lien compte↔chat_id Telegram par
  utilisateur ; hors scope).

## 11. Risques

| Risque | Traitement |
|---|---|
| `dispatch()` réutilisé par erreur → spam des canaux globaux de l'exploitant | §2 : le worker n'appelle jamais `dispatch()`, code review au plan |
| `sendEmail` reste privée dans `channels.ts` | Export explicite requis (tâche du plan) |
| Notification répétée en boucle si le statut oscille chaque jour entre les deux états | Accepté : c'est un signal réel (situation volatile), pas un bug — le front montant reste correct par définition |
| Duplication `checkThesis` scraper/frontend diverge dans le temps | Commentaire d'en-tête + tests miroir (§6), même discipline que `hebdo/pure` |
| Email admin API (`auth.admin.getUserById`) échoue silencieusement | Résultat `null` → email ignoré pour ce run, WhatsApp reste tenté indépendamment, pas de crash worker |
