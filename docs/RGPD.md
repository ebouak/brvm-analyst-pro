# RGPD — Registre des traitements & audit

Conformité **by design** (cf. CLAUDE.md §12). Document vivant : à mettre à jour
à chaque feature touchant des données personnelles.

Audit initial : 2026-06-16.

## 1. Inventaire des données personnelles

| Table | Données perso | Finalité | Base légale | Conservation | Export | Suppression |
|---|---|---|---|---|---|---|
| `auth.users` (Supabase) | email, hash mdp | Authentification | Contrat | Vie du compte | ✅ (account) | Support/worker service-role |
| `profiles` | email, profil/horizon investisseur, mode_debutant | Compte + personnalisation (profiling léger) | Contrat | Vie du compte | ✅ | Liée au compte auth (support) |
| `newsletter_subscribers` | email, confirm_token | Marketing (newsletter) | **Consentement** (double opt-in) | Confirmés : jusqu'au désabonnement · **non confirmés : 30 j après le dernier email de confirmation** (0133, cron mensuel) | ⬜ (à ajouter) | ✅ par email |
| `watchlists` / `watchlist_items` | user_id, libellés | Suivi de valeurs | Contrat | Vie du compte | ✅ | ✅ |
| `portfolios_positions` | user_id, lignes | Portefeuille | Contrat | Vie du compte | ✅ | ✅ |
| `alerts` | user_id, seuils | Alertes | Contrat | Vie du compte | ✅ | ✅ |
| `notifications_log` | user_id, canal | Traçabilité envois | Intérêt légitime | 12 mois (recommandé) | ✅ | ✅ |
| `report_snapshots` / `backtest_runs` | user_id | Sauvegardes utilisateur | Contrat | Vie du compte | ✅ | ✅ |
| `push_subscriptions` | user_id, endpoint navigateur | Notifications push | Consentement | Jusqu'au retrait | ✅ | ✅ |
| `paper_trading_accounts` / `_positions` | user_id, positions fictives | Entraînement | Contrat | Vie du compte | ✅ | ✅ |
| `subscriptions` | user_id, plan, statut | Abonnement | Contrat | Durée légale comptable | ✅ | ❌ (obligation légale) |
| `billing_transactions` | user_id, montant, provider | Facturation | **Obligation légale** (compta) | ~10 ans (selon juridiction) | ✅ | ❌ (obligation légale) |
| `admin_audit_logs` | actor/target user_id, **ip_address**, **user_agent** | Sécurité / traçabilité admin | Intérêt légitime | 12 mois (recommandé) | n/a (admin) | Purge planifiée (à mettre en place) |
| `forum_topics` / `forum_posts` | pseudonyme (`display_name`), contenu des messages, horodatage | Discussion communautaire | Intérêt légitime + action volontaire de l'utilisateur | Jusqu'à suppression par l'auteur ou masquage admin | ✅ (`/api/account/export`) | Anonymisation automatique à la suppression du compte (`author_id` → NULL, affichage « Utilisateur supprimé ») |

> IP et user-agent (`admin_audit_logs`) sont des données personnelles : limiter la
> rétention et ne pas les exposer hors admin.

## 2. Droits des personnes

- **Accès / portabilité** : `GET /api/account/export` → JSON de toutes les tables
  user-scopées (profil, watchlists, portefeuille, alertes, notifications, paper
  trading, push, abonnements, transactions). ✅ étendu le 2026-06-16.
- **Suppression** : `DELETE /api/account/delete` → purge les données révocables
  (watchlists, portefeuille, alertes, notifications, rapports, backtests, push,
  paper trading) + désabonnement newsletter (par email). **Exclus** : `subscriptions`
  / `billing_transactions` (conservation légale comptable) ; `profiles` + compte
  `auth.users` (nécessite la `service_role` → support/worker dédié).
- **Rectification** : profil éditable (`/account`, onboarding). Email via Supabase Auth.
- **Information** : `/mentions-legales`, `/cgu`, `/confidentialite` + bannière cookies.

## 3. Cookies & traceurs

- Mécanisme de consentement présent : `components/consent/` (`ConsentProvider`,
  `CookieBanner`, `CookiePreferences`) + lien pied de page (`FooterCookieLink`).
- **Aucun SDK de tracking tiers** détecté (pas de Google Analytics/GTM, Facebook
  Pixel, Hotjar, Mixpanel, Segment, PostHog, Clarity). Les seuls scripts sont
  internes (rendu, PDF worker local `public/pdf.worker.min.mjs`). ✅
- Cookies essentiels uniquement : session Supabase (auth). Pas de traceur non
  essentiel à bloquer aujourd'hui — la bannière reste le garde-fou si on en ajoute.

## 4. Sécurité

- **Secrets** : `service_role` server-only (jamais côté client). Logger scraper
  masque les secrets (`scraper/src/logger.ts`). Aucun mot de passe/token en clair
  dans les logs applicatifs.
- **RLS** : tables user-scopées protégées par policy owner ; tables admin/billing
  en `service_role` only. Vérifier la policy owner à chaque nouvelle table perso.
- **RH / candidats** : **aucun** traitement de recrutement dans le produit (N/A).

## 5. Constats de l'audit (2026-06-16)

| # | Sévérité | Constat | Statut |
|---|---|---|---|
| 1 | P1 | Export/suppression ne couvraient pas `push_subscriptions`, `paper_trading_*`, newsletter | **Corrigé** (export + delete étendus) |
| 2 | P2 | Pas de purge planifiée de `admin_audit_logs` (IP/UA) ni `notifications_log` | **Corrigé** — migration `0042_rgpd_retention.sql` (fonction + pg_cron mensuel, 12 mois)¹ |
| 3 | P2 | `subscriptions`/`billing_transactions` non supprimés à l'effacement | **Voulu** — base légale obligation comptable ; `billing_transactions.user_id` anonymisé (→ NULL) à la suppression du compte |
| 4 | P2 | Suppression définitive du compte `auth.users` non automatisée | **Corrigé** — `DELETE /api/account/delete` appelle `auth.admin.deleteUser` (service-role) → cascade FK |
| 5 | Info | Bannière cookies présente, zéro traceur tiers | Conforme |

¹ La migration `0042` planifie des suppressions récurrentes : à appliquer
explicitement (Supabase SQL editor / `supabase db push`). Sans pg_cron, appeler
`public.purge_rgpd_retention()` via un planificateur externe.

## 6. Mini-checklists par feature récente

**Lot 4 — Billing / abonnements**
- Données : user_id, plan, montant, provider, statut.
- Finalité : exécution de l'abonnement Premium.
- Base légale : **contrat** (abonnement) + **obligation légale** (justificatifs compta).
- Conservation : durée légale comptable (ne pas supprimer à l'effacement compte).
- Droits : export ✅ ; suppression ❌ (exception légale, documentée) ; rectif via support.
- Sécurité : écritures service-role server-only ; lecture `/account/billing` filtrée
  par `user_id` ; actions admin gardées par `subscriptions.write`.

**Newsletter**
- Données : email + token de confirmation.
- Finalité : envoi de la newsletter.
- Base légale : **consentement** (double opt-in via `confirm_token`).
- Conservation : confirmés, jusqu'au désabonnement ; non confirmés, 30 jours après le dernier email de confirmation envoyé (`confirmation_sent_at`, migration 0133) — jamais sollicités : conservés.
- Droits : désabonnement = suppression de la ligne ; couvert par l'effacement compte (par email).
- Sécurité : pas d'autre donnée perso ; pas de partage tiers.

**Formulaire de contact — messages conservés et réponses (2026-10-21, migration 0158)**
- ⚠️ **Remplace le « non persisté » ci-dessous** : 4 visiteurs sur 7 n'avaient jamais
  reçu la réponse promise, faute de trace. Les messages sont désormais conservés dans
  `contact_messages` (adresse enregistrée en minuscules).
- Données : prénom, email, page, message, brouillon, réponse envoyée, identifiant Resend.
- Finalité : répondre à la demande. Base légale : mesures précontractuelles / intérêt
  légitime à répondre à une sollicitation volontaire.
- Conservation : **12 mois après `derniere_activite_at`** (`purge_rgpd_retention`).
- Sous-traitants : brouillon rédigé par DeepSeek → Gemini → xAI à partir du **prénom et
  du message seulement** (jamais l'adresse) ; aucun envoi sans relecture humaine.
  Cloudflare achemine `support@westbourse.com` vers la boîte de l'exploitant.
- Droits : export (`/api/account/export`, si l'adresse du compte est **confirmée** — sinon
  un compte créé avec l'adresse d'un tiers exporterait ses messages) ; suppression sur
  demande à support@ (service_role) et par la purge.
- Sécurité : RLS sans aucune policy (service_role seul) ; console `/admin/contact` derrière
  `support.read` / `support.reply` ; l'audit ne trace que l'action et l'identifiant ;
  relance Telegram exploitant sans aucune donnée personnelle.
- Livraison (migration 0159, 2026-10-21) : statut Resend reçu par webhook signé ; seule
  donnée nouvelle, la raison d'un rejet (`livraison_detail`, 300 caractères au plus, peut
  citer l'adresse du destinataire) — même table, même RLS, même purge 12 mois. Ouvertures
  et clics ne sont PAS suivis.
- **WhatsApp (migration 0160, 2026-10-23)** : messages reçus sur le numéro WESTBOURSE via la
  passerelle WAHA (serveur Hetzner, Allemagne) → même table, `canal = 'whatsapp'`. Donnée nouvelle :
  `whatsapp_chat_id` (numéro ou identifiant `@lid`) et le nom affiché choisi par la personne. Même
  finalité, même base légale, même conservation (12 mois), même accès (service_role seul). Accusé
  automatique FIXE, en réponse seulement, une fois par 24 h. Hetzner ajouté aux sous-traitants.

**Formulaire de contact (`/api/contact`) — accusé de réception (2026-10-15)**
- Données : prénom, email, message, page — **non persistés** : relayés par email à la
  boîte support (`CONTACT_EMAIL_TO`), qui peut répondre directement (en-tête
  `reply_to` = adresse du visiteur).
- Accusé de réception : texte **fixe** envoyé à l'adresse saisie, sans aucune reprise
  de la saisie (empêche d'utiliser le formulaire comme relais vers un tiers).
- Finalité : répondre à la demande. Base légale : **consentement** (envoi volontaire).
- Conservation : l'email vit dans la boîte support (hors base). En base, seule une
  **empreinte SHA-256** de l'adresse (`rate_limit_hits`, route `contact-accuse`) limite
  les accusés à un par adresse et par 24 h ; purgée au premier passage suivant la fin
  de la fenêtre. `checkRateLimit` purge désormais toute la route, et non plus la seule
  IP appelante (les IP qui ne revenaient jamais restaient en base sans limite).
- Droits : rien à exporter ni supprimer en base ; la boîte support se traite à la main.
- Sécurité : limite 5 messages / 10 min par IP ; journal d'échec sans adresse.

**Publication LinkedIn / TikTok (2026-10-29, migration 0170)**
- Données : jetons OAuth, identifiant et nom affiché du compte **de l'exploitant**
  (`social_tokens`) ; journal des publications (`publications_sociales`, aucune
  donnée d'utilisateur, seulement des identifiants d'articles et de séances).
- Finalité : publier les contenus WESTBOURSE sur les comptes de l'exploitant.
- Base légale : **intérêt légitime** de l'éditeur, sur ses propres comptes.
- Conservation : jetons jusqu'à déconnexion (`/admin/reseaux` → Déconnecter les
  efface) ou expiration ; journal conservé comme trace d'exploitation.
- Droits : aucun utilisateur concerné ; l'exploitant gère ses comptes depuis l'admin.
- Sécurité : RLS sans policy (service_role seul), jetons jamais renvoyés au
  navigateur ni journalisés ; `state` OAuth en cookie httpOnly ; audit sans jeton.

**CRM interne — relation commerciale (2026-10-31, migration 0172)**
- Données : pages de l'offre Premium consultées en étant connecté (`crm_signaux`) ;
  messages de relance et notes internes (`crm_actions`) ; refus de recevoir des
  propositions (`crm_oppositions`, adresse normalisée).
- Finalité : proposer l'offre Premium aux personnes déjà en relation avec WESTBOURSE.
- Base légale : **intérêt légitime** (comptes, activité sur l'offre) ; **consentement**
  pour les prospects issus du formulaire de contact. Une personne décide de chaque
  message, aucun envoi automatique.
- Conservation : `crm_signaux` 90 j ; `crm_actions` 24 mois (`purge_rgpd_retention`) ;
  `crm_oppositions` conservée même après suppression du compte, réduite à l'adresse, la
  date et l'origine : c'est la liste d'opposition qui garantit qu'on ne vous recontacte
  pas (la purger permettrait de relancer).
- Droits : export (`/api/account/export` : signaux, actions, opposition — adresse
  **confirmée** requise pour les données indexées par e-mail ; jamais le jeton
  d'opposition, l'auteur, les erreurs techniques ni l'instantané de score) ;
  suppression (`/api/account/delete` : actions et prospect par adresse confirmée ; l'opposition est conservée) ; opposition par lien confirmé en pied de
  message ou Paramètres → Compte.
- `auteur` est mis à NULL si le compte de l'administrateur est supprimé.
- Sécurité : RLS activée sans aucune policy + `revoke` pour `public`, `anon` et
  `authenticated` ; lecture/écriture service_role côté serveur seulement ; console
  protégée par `crm.read` / `crm.write`.

**CRM — numéro WhatsApp déclaré et recontact (2026-11-01, migrations 0174+)**
- Données : `notification_prefs.telephone_declare` (numéro déclaré, non vérifié),
  `recontact_optin_at` (date du consentement), `ecran_whatsapp_vu_at` (écran
  post-inscription vu) ; `crm_actions.bonus_code` / `bonus_at` (dossier offert) ;
  `crm_oppositions.source = 'whatsapp'` (STOP reçu sur WhatsApp).
- Finalité : recontact commercial sur WhatsApp au sujet de l'offre WESTBOURSE ; dossier offert.
- Base légale : **consentement** pour le recontact WhatsApp (case décochée par défaut,
  facultative, aucun consentement enregistré sans moyen de contact). Le reste du CRM
  conserve la base documentée ci-dessus.
- Conservation : jusqu'au retrait du consentement ou à la suppression du compte ;
  `crm_actions` selon la rétention CRM (24 mois).
- Droits : export (`/api/account/export`) ; rectification et suppression du numéro, et
  retrait du consentement, dans `/parametres/alertes` ; STOP en réponse sur WhatsApp ;
  suppression du compte.
- Destinataires : aucun hors WESTBOURSE ; WhatsApp (Meta) comme simple transport quand
  la personne écrit ou est contactée.

**CRM — relances automatiques par séquences (2026-11-01, migration 0178)**
- Données : aucune nouvelle donnée personnelle ; `crm_actions.sequence_cle`
  (`<séquence>:<étape>`) identifie l'étape envoyée, le statut `simulation` marque
  un essai sans envoi.
- Finalité : relancer par e-mail une personne ayant abandonné un paiement ou consulté l'offre
  Premium (paiement abandonné : J+1 et J+4 ; offre consultée : J+2).
- Base légale : **intérêt légitime** pour les titulaires de compte (relation existante, offre
  de leur propre service) ; **consentement** pour les prospects sans compte (case de collecte).
- Opposition : à tout moment, par le lien présent dans chaque e-mail ; l'opposition est
  revérifiée à chaque envoi (échec fermé) et arrête toute séquence.
- Limites : e-mail uniquement ; arrêt dès un paiement, une réponse, une clôture ou une
  opposition ; une étape n'est jamais envoyée deux fois (index unique) ; plafond par
  exécution et nombre maximal de relances ; désactivées par défaut (mode `off`), la
  simulation précède toute activation.
- Conservation et droits : ceux de `crm_actions` (24 mois) ; la colonne est incluse dans
  l'export (`/api/account/export`) ; suppression avec le compte.
- Aucune donnée personnelle dans les journaux de la route cron ni dans l'alerte exploitant
  (des comptes seulement).

**Monitoring scraping (Lot 3)**
- Données : **aucune donnée personnelle** (sources de marché, métriques techniques).
- N/A RGPD. `scraper_errors` ne doit pas contenir de donnée perso (messages techniques).
