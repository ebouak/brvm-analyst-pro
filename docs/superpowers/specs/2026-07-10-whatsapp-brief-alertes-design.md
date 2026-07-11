# Brief & alertes WhatsApp — Design

**Date** : 2026-07-10 · **Statut** : validé (user) · **Priorité** : après le fiscal
(le code peut être écrit et testé en mock avant que l'app Meta soit prête).

## 1. Objectif

Livrer le brief quotidien et les alertes de titres sur **WhatsApp**, canal
dominant en zone UEMOA → rétention + différenciation. L'envoi est déjà codé
(`scraper/src/alerts/channels.ts` : `sendWhatsApp` via Meta Cloud API, tronqué à
4096 caractères) ; il manque l'opt-in utilisateur, le worker brief et la config.

## 2. Contrainte Meta structurante

Les messages **à l'initiative de l'entreprise** (hors fenêtre de 24 h après un
message du client) exigent des **templates pré-approuvés** par Meta.
→ 2 templates à soumettre (catégorie *Utility*) :
- `daily_brief` : « Brief BRVM du {{1}} : {{2}} » (corps = résumé du brief)
- `alerte_titre` : « Alerte {{1}} : {{2}} » (code + message d'alerte)

Le message de bienvenue à l'opt-in peut être un template `optin_bienvenue` ou
être envoyé en session si l'utilisateur écrit d'abord au numéro (V1 : template).

## 3. Actions préalables côté admin (bloquantes, hors code)

1. Créer l'app **Meta Business** + activer WhatsApp + numéro dédié.
2. Soumettre les 3 templates (bienvenue, brief, alerte) et attendre l'approbation.
3. Fournir les secrets : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
   (GitHub Actions pour le scraper). Coût indicatif : conversations *utility*
   ≈ 2-8 FCFA/message selon pays.

## 4. Architecture

### 4.1 Migration `notification_prefs` (nouvelle table user-scopée)

```sql
create table notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_phone text,            -- E.164 (+225…), null si non renseigné
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,  -- horodatage du consentement (preuve RGPD)
  brief_whatsapp boolean not null default false,   -- brief quotidien
  alerts_whatsapp boolean not null default false,  -- alertes titres
  updated_at timestamptz default now()
);
```

- RLS : owner-only (select/insert/update `auth.uid() = user_id`), service_role
  pour le worker. Vue aucune. `revoke execute` sur toute fonction associée.
- Post-migration : scan `get_advisors` + test clé anon (discipline pentest).

### 4.2 UI opt-in — `/parametres/alertes` (section « WhatsApp »)

- Saisie du numéro (validation E.164, préfixes UEMOA suggérés), case de
  consentement explicite avec texte : finalité (brief/alertes), coût nul pour
  l'utilisateur, retrait à tout moment (toggle), lien politique de
  confidentialité.
- À l'activation : envoi du template de bienvenue (via route serveur qui appelle
  la Cloud API avec la clé serveur — jamais côté client).
- Deux toggles indépendants : « Brief quotidien » / « Alertes de mes titres ».

### 4.3 Scraper

- `alerts/channels.ts` : déjà prêt (aucun changement attendu, hors passage des
  destinataires par utilisateur).
- `runAlerts` : aujourd'hui les canaux sont globaux ; ajout — pour chaque alerte
  déclenchée, lire `notification_prefs` du propriétaire (`alerts_whatsapp` +
  numéro) et envoyer aussi sur WhatsApp. Journalisation `notifications_log`
  (channel `whatsapp`).
- **Nouveau worker** `brief:whatsapp` (commande CLI + monitoring `scraper_runs`) :
  lit le brief du jour (table existante du module brief), formate ≤ 1024 car.
  utiles (limites template), lit les opt-ins `brief_whatsapp`, envoie, journalise.
  Cron GitHub Actions après la génération du brief. Idempotence : pas de renvoi
  si `notifications_log` contient déjà (user, brief du jour, whatsapp).
- Mode `--mock` : aucune requête Meta, log console (pattern du repo).

### 4.4 Gestion d'erreurs

- Numéro invalide/refusé par Meta → statut `failed` dans `notifications_log`,
  pas de retry agressif (max 1 retry), jamais de crash du run global.
- Token expiré → run `failed` visible dans `/admin/scraping`.

## 5. RGPD (mini-checklist obligatoire)

- **Données** : numéro de téléphone (donnée perso) + horodatage consentement.
- **Finalité** : notifications demandées (brief, alertes). **Base légale** :
  consentement explicite (case décochée par défaut).
- **Conservation** : jusqu'au retrait du consentement ou suppression du compte
  (cascade `on delete`).
- **Droits** : couvert par `GET /api/account/export` et `DELETE
  /api/account/delete` → **ajouter `notification_prefs` aux deux routes**.
- **Sécurité** : RLS owner, clé Meta server-only, numéro jamais loggé en clair
  (masquage `+225…XX` dans les logs).

## 6. Tests

- Scraper : formatage brief ≤ limite, sélection des opt-ins, idempotence renvoi
  (vitest, Supabase mocké).
- UI : validation E.164 (fonction pure + test).
- Bout-en-bout réel : après config Meta, envoi test sur le numéro de l'admin.

## 7. Hors périmètre V1

Réponses entrantes (webhook), commandes conversationnelles (« cours SNTS »),
double opt-in par réponse « OUI », autres canaux (SMS). V2 si traction.
