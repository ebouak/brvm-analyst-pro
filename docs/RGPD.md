# RGPD — Registre des traitements & audit

Conformité **by design** (cf. CLAUDE.md §12). Document vivant : à mettre à jour
à chaque feature touchant des données personnelles.

Audit initial : 2026-06-16.

## 1. Inventaire des données personnelles

| Table | Données perso | Finalité | Base légale | Conservation | Export | Suppression |
|---|---|---|---|---|---|---|
| `auth.users` (Supabase) | email, hash mdp | Authentification | Contrat | Vie du compte | ✅ (account) | Support/worker service-role |
| `profiles` | email, profil/horizon investisseur, mode_debutant | Compte + personnalisation (profiling léger) | Contrat | Vie du compte | ✅ | Liée au compte auth (support) |
| `newsletter_subscribers` | email, confirm_token | Marketing (newsletter) | **Consentement** (double opt-in) | Jusqu'au désabonnement | ⬜ (à ajouter) | ✅ par email |
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
| 2 | P2 | Pas de purge planifiée de `admin_audit_logs` (IP/UA) ni `notifications_log` | À faire (cron de rétention 12 mois) |
| 3 | P2 | `subscriptions`/`billing_transactions` non supprimés à l'effacement | **Voulu** — base légale obligation comptable (documenté) |
| 4 | P2 | Suppression définitive du compte `auth.users` non automatisée | À faire (worker service-role déclenché par demande) |
| 5 | Info | Bannière cookies présente, zéro traceur tiers | Conforme |

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
- Conservation : jusqu'au désabonnement.
- Droits : désabonnement = suppression de la ligne ; couvert par l'effacement compte (par email).
- Sécurité : pas d'autre donnée perso ; pas de partage tiers.

**Monitoring scraping (Lot 3)**
- Données : **aucune donnée personnelle** (sources de marché, métriques techniques).
- N/A RGPD. `scraper_errors` ne doit pas contenir de donnée perso (messages techniques).
