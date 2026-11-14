# RGPD — Registre des traitements & audit

Conformité **by design** (cf. CLAUDE.md §12). Document vivant : à mettre à jour
à chaque feature touchant des données personnelles.

Audit initial : 2026-06-16.

## 1. Inventaire des données personnelles

| Table | Données perso | Finalité | Base légale | Conservation | Export | Suppression |
|---|---|---|---|---|---|---|
| `auth.users` (Supabase) | email, hash mdp | Authentification | Contrat | Vie du compte | ✅ (account) | ✅ `DELETE /api/account/delete` (service-role) |
| `profiles` | email, profil/horizon investisseur, mode_debutant | Compte + personnalisation (profiling léger) | Contrat | Vie du compte | ✅ | ✅ cascade à la suppression du compte |
| `newsletter_subscribers` | email, confirm_token | Marketing (newsletter) | **Consentement** (double opt-in) | Confirmés : jusqu'au désabonnement · **non confirmés : 30 j après le dernier email de confirmation** (0133, cron mensuel) | ⬜ (à ajouter) | ✅ par email |
| `watchlists` / `watchlist_items` | user_id, libellés | Suivi de valeurs | Contrat | Vie du compte | ✅ | ✅ |
| `portfolios_positions` | user_id, lignes | Portefeuille | Contrat | Vie du compte | ✅ | ✅ |
| `alerts` | user_id, seuils | Alertes | Contrat | Vie du compte | ✅ | ✅ |
| `notifications_log` | user_id, canal | Traçabilité envois | Intérêt légitime | 12 mois (recommandé) | ✅ | ✅ |
| `report_snapshots` / `backtest_runs` | user_id | Sauvegardes utilisateur | Contrat | Vie du compte | ✅ | ✅ |
| `push_subscriptions` | user_id, endpoint navigateur | Notifications push | Consentement | Jusqu'au retrait | ✅ | ✅ |
| `paper_trading_accounts` / `_positions` | user_id, positions fictives | Entraînement | Contrat | Vie du compte | ✅ | ✅ |
| `subscriptions` | user_id, plan, statut | Abonnement | Contrat | Vie du compte | ✅ | ✅ cascade (le justificatif de paiement reste dans `billing_transactions`, anonymisé) |
| `billing_transactions` | user_id, montant, provider | Facturation | **Obligation légale** (compta) | ~10 ans (selon juridiction) | ✅ | ❌ (obligation légale) |
| `admin_audit_logs` | actor/target user_id, **ip_address**, **user_agent** | Sécurité / traçabilité admin | Intérêt légitime | 12 mois (recommandé) | n/a (admin) | Purge planifiée (à mettre en place) |
| `forum_topics` / `forum_posts` | pseudonyme (`display_name`), contenu des messages, horodatage | Discussion communautaire | Intérêt légitime + action volontaire de l'utilisateur | Jusqu'à suppression par l'auteur ou masquage admin | ✅ (`/api/account/export`) | Anonymisation automatique à la suppression du compte (`author_id` → NULL, affichage « Utilisateur supprimé ») |

| `recherche_societes_cache`, `rate_limit_hits` (route `recherche-societes`) | Aucun texte de recherche (empreinte SHA-256 seule) ; identifiant de compte **haché** pour le quota | Recherche des sociétés en langage naturel (Jev) | Contrat (exécution du service) | Cache 24 h ; quota : fenêtre d'une heure | N/A (rien de rattaché au compte) | Purge `purge_rgpd_retention()` || `whatsapp_aiguillages`, `jev_budget` | Aucune (intention retenue, décision, probabilité ; compteur journalier) | Aiguillage des messages WhatsApp libres (Jev) | Intérêt légitime (répondre au message reçu) | 90 jours ; budget 30 jours | N/A (rien de rattaché à une personne) | Purge `purge_rgpd_retention()` |

> IP et user-agent (`admin_audit_logs`) sont des données personnelles : limiter la
> rétention et ne pas les exposer hors admin.

## 2. Droits des personnes

- **Accès / portabilité** : `GET /api/account/export` → JSON de toutes les tables
  user-scopées (profil, watchlists, portefeuille, alertes, notifications, paper
  trading, push, abonnements, transactions). ✅ étendu le 2026-06-16.
- **Suppression** : `DELETE /api/account/delete` (lu dans le code le 2026-11-11) :
  1. purge explicite des tables user-scopées (watchlists, portefeuille, alertes,
     notifications, rapports, backtests, push, paper trading, thèses, Academy :
     progression, notes, examens, certificats) ;
  2. en `service_role` : newsletter (par e-mail), `notification_prefs`, conversations et
     codes d'appairage WhatsApp/Telegram, CRM (`crm_actions`, `leads_brvm` — par adresse
     seulement si elle est confirmée), photo de profil du bucket `newsletter-assets` ;
  3. **suppression du compte `auth.users`** (`auth.admin.deleteUser`) → cascade FK sur
     `profiles`, `subscriptions` et les tables rattachées. `billing_transactions.user_id`
     passe à NULL : justificatif conservé, anonymisé (obligation comptable).
  **Conservés volontairement** : justificatifs de paiement anonymisés ; `crm_oppositions`
  (liste d'opposition, art. 21). Les lignes `subscriptions` partent avec la cascade du
  compte (elles ne sont plus rattachées à une personne) — la mention « Durée légale
  comptable » du tableau ne s'applique qu'à `billing_transactions`.
  ⚠️ Cette section décrivait auparavant `profiles` et `auth.users` comme EXCLUS de la
  suppression : c'était périmé, la suppression est automatique (constat 4 ci-dessous).
- **Rectification** : profil éditable (`/account`, onboarding). Email via Supabase Auth.
- **Information** : `/mentions-legales`, `/cgu`, `/confidentialite` + bannière cookies.

## 3. Cookies & traceurs

- Mécanisme de consentement présent : `components/consent/` (`ConsentProvider`,
  `CookieBanner`, `CookiePreferences`) + lien pied de page (`FooterCookieLink`).
- **Un seul SDK d'audience : PostHog** (`components/analytics/PostHogInit.tsx`), chargé
  UNIQUEMENT après consentement « Mesure d'audience » (rien n'est chargé ni émis avant ;
  retrait du consentement = opt-out + purge locale). Hôte européen
  (`eu.i.posthog.com`), saisies masquées dans les enregistrements de session. Pour une
  personne connectée ayant consenti, la session est identifiée par son identifiant de compte
  et son e-mail (`identify`). Pas de Google Analytics/GTM, Facebook Pixel, Hotjar, Mixpanel,
  Segment ni Clarity. Autres scripts : internes (rendu, PDF worker local
  `public/pdf.worker.min.mjs`). ✅
- Sans consentement : cookies essentiels uniquement (session Supabase). Les traceurs non
  essentiels sont bloqués par la bannière.
- **Rapports d'audience (`/admin/audience`, `/api/cron/audience`)** : statistiques
  AGRÉGÉES lues dans PostHog côté serveur (clé personnelle en lecture seule, jamais exposée au
  client ni journalisée). Elles ne couvrent que les visiteurs ayant consenti à la mesure
  d'audience : l'audience réelle est supérieure, et les pages l'indiquent. Les messages
  (Telegram, e-mail hebdomadaire/mensuel à `ALERTS_EMAIL_TO`) ne contiennent que des
  totaux : ni identifiant, ni e-mail, ni IP. Pas de pixel de suivi dans l'e-mail. Le bloc
  « intérêt formation » vient de notre base (comptes distincts comptés, pays du compte), sans
  noms. Rien n'est stocké : chaque rapport est recalculé à la demande.

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
  Premium (paiement abandonné : J+1 et J+8 ; offre consultée : J+2).
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

**CRM — formation consultée et pays du compte (2026-11-01, migration 0179)**
- Données : pages de la formation (Academy) consultées en étant connecté
  (`crm_signaux.type = 'formation_vue'`, une ligne par jour et par page) ; **code pays ISO**
  du compte (`profiles.pays_code`, `pays_maj_le`), déduit de l'en-tête réseau de l'hébergeur à
  la connexion. **Jamais** l'adresse IP, ni la ville, ni aucune coordonnée : le code pays est
  seul conservé, l'IP n'est pas lue ni journalisée par ce traitement.
- Finalité : segmentation commerciale (proposer la formation complète à qui a consulté la
  formation gratuite ; cibler par zone géographique) et affichage dans le CRM interne.
- Base légale : **intérêt légitime** (offre de son propre service à ses titulaires de compte),
  avec droit d'**opposition** à tout moment (lien en pied de message, ou Paramètres → Compte) ;
  l'opposition exclut aussi la personne de ces relances. Aucun enregistrement pour un visiteur
  non connecté.
- Conservation : `crm_signaux` 90 j (`purge_rgpd_retention`) ; le pays est conservé avec le
  compte et supprimé avec lui.
- Droits : export (`/api/account/export` : `profiles` complet dont `pays_code`, et
  `crm_signaux` avec son `type`), rectification du pays par une nouvelle connexion,
  suppression avec le compte.
- Sécurité : écriture par le seul serveur (service_role), identifiant tiré de la session et
  jamais du corps de la requête ; le pays provient de l'en-tête serveur, pas du navigateur.
- Mesure d'audience : l'identification PostHog d'un compte reste soumise au consentement
  « Mesure d'audience » (rien n'est chargé sans accord).

**Monitoring scraping (Lot 3)**
- Données : **aucune donnée personnelle** (sources de marché, métriques techniques).
- N/A RGPD. `scraper_errors` ne doit pas contenir de donnée perso (messages techniques).

### Sessions d'examen Academy (`academy_exam_sessions`, migration 0184)

- Donnée : identifiant utilisateur, niveau, liste des questions émises, horodatages.
- Finalité : intégrité de l'examen (correction sur l'examen émis, usage unique).
- Base légale : intérêt légitime (sécurité du service). Aucune donnée sensible.
- Conservation : 7 jours (`purge_rgpd_retention`) ; suppression du compte par cascade.
- Accès : service_role seul (RLS sans policy). Pas d'export : donnée technique éphémère.

### Recherche des sociétés en langage naturel (Jev, migration 0191)

- Données : texte saisi, **jamais conservé** (seule son empreinte SHA-256, 24 h) ; identifiant de compte haché dans `rate_limit_hits`, purgé hors fenêtre (1 h). Une requête contenant une adresse e-mail ou un numéro de téléphone est refusée et n'est jamais envoyée.
- Finalité : classer les sociétés cotées selon la recherche ; base légale : exécution du service (comptes connectés).
- Sous-traitant : **TypeSafe** (texte de la recherche, sans identité).
- Conservation : cache 24 h, compteur de budget 30 jours (`purge_rgpd_retention`).
- Accès : service_role seul (RLS sans policy, fonctions révoquées pour anon/authenticated — vérifié à la clé publique : 401).
- Journaux : codes d'événement seulement, jamais le texte de la recherche (test « Confidentialité »).

### Aiguillage des messages WhatsApp libres par Jev (migration 0192)

- Données envoyées à TypeSafe : **le texte du message seulement**, jamais le numéro ni le nom ; un message contenant une adresse e-mail ou un numéro de téléphone n'est jamais envoyé (filtre testé).
- Conservé chez nous : `whatsapp_aiguillages` (intention, décision, probabilité — ni texte ni numéro), 90 jours ; `jev_budget` (compteur par usage et par jour), 30 jours. Quota : numéro **haché** dans `rate_limit_hits`, fenêtre d'une heure.
- Finalité : répondre au message par la donnée exacte ; base légale : intérêt légitime.
- Sous-traitant : TypeSafe. Interrupteur `whatsapp_jev` (livré coupé, activé seulement après évaluation favorable).
- Accès : service_role seul (RLS sans policy ; fonction révoquée — clé publique : 401).

### Assistant WhatsApp ouvert à tous (migration 0193)

- Données : texte des messages adressés au numéro WESTBOURSE et transcription des notes vocales (l'audio n'est **jamais stocké** : il ne vit que le temps de la transcription) ; réponses de l'assistant.
- Conservé chez nous : `whatsapp_conversations`, désormais aussi pour les conversations **non liées** à un compte, indexées par `chat_hash` (HMAC du chatId, pseudonyme — jamais le numéro en clair). Rétention **30 jours** sans compte, **90 jours** avec (`purge_rgpd_retention`). Adresses e-mail et numéros de téléphone **masqués** avant stockage et avant envoi à l'IA (testé).
- Finalité : répondre à la question que la personne nous adresse ; base légale : mesures précontractuelles / intérêt légitime. Les outils **personnels** (portefeuille, alertes) restent soumis au consentement `agent_optin` et à l'appairage prouvé.
- Droits : commande **EFFACER** (supprime toute la conversation) ; pour une conversation liée, export (`/api/account/export`, par `user_id`) et suppression (cascade) inchangés.
- Sous-traitants : DeepSeek, Google Gemini, xAI (rédaction des réponses) ; Google Gemini (transcription des notes vocales). Information : pied fixe au premier échange + `/confidentialite`.
- Quotas : inconnus 1 question IA/jour (numéro **haché** dans `rate_limit_hits`), comptes liés selon `whatsapp_agent` ; plafonds `jev_budget` (`whatsapp_ia`, `whatsapp_ia_inconnu`).
- Interrupteur `whatsapp_chatbot` (livré coupé). Accès : service_role seul (RLS sans policy ; clé publique → `[]`, vérifié le 2026-11-04).

### Profil des sociétés cotées : dirigeants (`societes_profils`, migration 0201)

- **Données** : nom et fonction des dirigeants de sociétés cotées (présidence, direction générale), date de prise de fonction quand elle est publiée, lien vers la source.
- **Finalité** : informer l'investisseur sur la gouvernance de la société.
- **Base légale** : intérêt légitime ; ce sont des mandataires sociaux, dont la fonction est rendue publique par la société ou la BRVM.
- **Sources** : officielles seulement (brvm.org, l'émetteur, BCEAO, État). Aucun téléphone ni aucune adresse personnelle.
- **Conservation** : tant que la fonction est exercée ; une ligne périmée est remplacée, pas archivée.
- **Droits** : une personne concernée peut demander la rectification ou le retrait par le formulaire de contact. La table n'est pas rattachée à un compte utilisateur : elle n'entre pas dans l'export ni dans la suppression de compte.
- **Sécurité** : lecture publique, écriture service_role seule. Écriture testée à la clé publique : 42501.

## 7. Destinataires, transferts et durées (mise à jour 2026-11-11, audit F-10)

La politique publique `/confidentialite` énumère désormais, d'après le code : Supabase, Vercel,
Resend, Cloudflare (e-mail et Turnstile), Hetzner, DeepSeek / Google Gemini / xAI (cascade de
rédaction), Mistral AI (import de relevés, OCR de publications), PostHog (UE, après consentement),
Sentry (collecte `ingest.de`), CinetPay, Chariow, Telegram, WhatsApp (Meta), TypeSafe (Jev),
synthèse vocale (Microsoft Edge TTS, ElevenLabs — textes de marché uniquement, sans donnée personnelle).

Transferts de données personnelles vers des fournisseurs d'IA :
- `app/api/ai/chat/route.ts` : si la question évoque le portefeuille, positions (code, quantité, PRU),
  valorisation et plus-value latente sont ajoutées à la requête LLM (`buildPortfolioContext`).
- `app/api/import-releve/route.ts` : texte ou images du relevé de SGI envoyés à DeepSeek, Mistral ou xAI
  (cascade `lib/import/llmProviders.ts`). Rate-limit par IP, fail-closed depuis le lot D.

Pays : UE (Mistral, PostHog, Sentry DE, Hetzner DE) ; États-Unis (Vercel, Resend, Cloudflare, Google,
xAI, Meta) ; Chine (DeepSeek) ; **à préciser** : Supabase (région), TypeSafe, Telegram, CinetPay,
Chariow. Les conditions de réutilisation/entraînement de chaque fournisseur d'IA restent **à vérifier**.

Durées (source : `purge_rgpd_retention()`, migration 0193, et les migrations citées plus haut) :
`admin_audit_logs`, `notifications_log`, `auth_events`, `payment_webhook_events`, `contact_messages` :
12 mois ; `crm_actions` : 24 mois ; `crm_signaux`, `dossier_envois`, `*_conversations` (liées),
`whatsapp_aiguillages` : 90 jours ; conversations WhatsApp sans compte : 30 jours ;
`academy_exam_sessions` : 7 jours ; cache de recherche : 24 h ; quotas : 30 jours ;
`formation_inscriptions` : 3 ans après la session. **Non trouvées dans le code** (déclarées
« à préciser » sur la page publique) : durée de conservation chez PostHog et Sentry, durée
comptable précise des justificatifs.

Autorité de réclamation : celle du pays de résidence (ARTCI, CDP, APDP, CNIL…) ; l'autorité chef
de file dépend de la raison sociale du responsable de traitement, encore à renseigner.
