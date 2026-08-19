# Agent conversationnel WhatsApp — Design

## Contexte

L'utilisateur voulait initialement intégrer [whatsapp-agentkit](https://github.com/Hainrixz/whatsapp-agentkit) (MIT). Ce kit scaffold un service Python/FastAPI **séparé** (SQLite, déploiement Railway) piloté par une interview interactive — pensé pour un commerce générique (café, clinique, immobilier), pas branchable tel quel sur le stack Next.js/TypeScript/Supabase existant, et pas adapté à une plateforme financière (pas de discipline « jamais de conseil en investissement », pas de RLS/RGPD).

Décision retenue : construire l'équivalent **nativement dans le stack existant**, en réutilisant trois briques déjà en place :

1. **Envoi WhatsApp sortant** — `scraper/src/alerts/channels.ts` utilise déjà Meta Cloud API (`graph.facebook.com`). Identifiants Meta déjà configurés.
2. **Lien numéro ↔ compte** — `notification_prefs.whatsapp_phone` (E.164, vérifié, opt-in RGPD) existe déjà via `components/settings/WhatsAppPrefs.tsx`.
3. **Garde d'accès + quota par plan** — `frontend/lib/server/featureGate.ts` (`checkFeature`) gère déjà free/premium/pro + quota journalier + compteur atomique en base. Il suffit d'y déclarer un nouveau `FeatureCode`.

## Objectif

Un utilisateur avec un compte WESTBOURSE et un numéro WhatsApp vérifié peut écrire au numéro professionnel de WESTBOURSE et recevoir des réponses générées à partir des données réelles de la plateforme (cours, fondamentaux, signaux, sa propre watchlist/portefeuille) — jamais un conseil en investissement, jamais une action d'achat/vente.

## Architecture

```
WhatsApp (utilisateur) → Meta Cloud API → webhook Next.js
  app/api/whatsapp/webhook/route.ts (vérifie signature Meta)
        │
        ▼
  lib/whatsappAgent/handleMessage.ts
        │
        ├─ 1. Identification : notification_prefs.whatsapp_phone → user_id
        │     (pas de correspondance → réponse d'invite, fin du traitement)
        │
        ├─ 2. Consentement : notification_prefs.agent_optin = true ?
        │     (false → réponse d'invite à activer l'agent, fin du traitement)
        │
        ├─ 3. Quota : checkFeature('whatsapp_agent', user) — featureGate.ts existant
        │     (refusé → message quota atteint, fin du traitement)
        │
        ├─ 4. Contexte : derniers messages whatsapp_conversations (user_id)
        │     + watchlist/portefeuille de l'utilisateur (lecture seule)
        │
        ├─ 5. LLM : cascade DeepSeek→Mistral (lib/server/apiKeys.ts existant)
        │     system prompt : discipline "jamais de conseil en investissement"
        │     (même ton que lib/narrative.ts et les disclaimers déjà validés)
        │
        ├─ 6. Persistance : whatsapp_conversations (message user + réponse assistant)
        │
        └─ 7. Envoi de la réponse via le canal Meta déjà utilisé par
              scraper/src/alerts/channels.ts (fonction extraite/réutilisée,
              pas dupliquée)
```

Le webhook vit côté **frontend** (Route Handler serverless), pas dans le scraper : Meta attend une réponse HTTP rapide (quelques secondes), incompatible avec un process cron. Le scraper garde son rôle actuel (envois sortants planifiés) ; le frontend gère désormais aussi les envois réactifs (réponse à un message).

## Modèle de données

### Migration : `whatsapp_conversations`

```sql
create table if not exists public.whatsapp_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  contenu     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_whatsapp_conversations_user
  on public.whatsapp_conversations (user_id, created_at desc);

alter table public.whatsapp_conversations enable row level security;

create policy "whatsapp_conversations_owner_select"
  on public.whatsapp_conversations for select
  using (auth.uid() = user_id);

-- Pas de policy insert/update/delete pour les rôles anon/authenticated :
-- seul le service_role (webhook côté serveur) écrit. Lecture seule pour le
-- propriétaire (ex. futur historique visible dans les paramètres du compte).
```

### Migration : `notification_prefs` — nouvelles colonnes

```sql
alter table public.notification_prefs
  add column if not exists agent_optin boolean not null default false,
  add column if not exists agent_optin_at timestamptz;
```

### `feature_flags` — nouvelle ligne (seed, pas de migration de schéma)

```sql
insert into public.feature_flags (code, label, acces, quota_free, quota_premium, description)
values ('whatsapp_agent', 'Agent WhatsApp', 'free', 10, 100,
        'Nombre de messages traités par l''agent conversationnel WhatsApp, par jour.')
on conflict (code) do nothing;
```

Ajustable ensuite sans redéploiement via `/admin/features`, comme les autres features gatées.

## Consentement RGPD (distinct de l'opt-in brief/alertes existant)

`WhatsAppPrefs.tsx` gagne une seconde case à cocher, visible uniquement si `whatsapp_optin` est déjà actif (le numéro doit être vérifié avant de pouvoir activer l'agent) :

> « J'accepte que l'agent conversationnel WESTBOURSE garde l'historique de nos échanges (90 jours) pour personnaliser ses réponses. Retrait possible à tout moment ici même. »

Décoché par défaut (consentement actif, pas pré-coché). Le retrait désactive `agent_optin` — les conversations passées restent soumises à la purge normale de 90 jours, pas de suppression immédiate au retrait (cohérent avec le fait que le retrait coupe la collecte future, pas un droit à l'effacement immédiat, qui reste disponible séparément via `DELETE /api/account/delete`).

## Droits RGPD (mini-checklist)

- **Données collectées** : contenu des messages WhatsApp échangés avec l'agent (texte uniquement, pas de pièces jointes dans ce lot).
- **Finalité** : répondre aux questions de l'utilisateur sur les données BRVM déjà disponibles dans son compte, avec mémoire conversationnelle courte.
- **Base légale** : consentement explicite (case à cocher dédiée, distincte du consentement brief/alertes).
- **Conservation** : 90 jours, purge automatique (nouveau job cron scraper, même pattern que `purge_auth_events`).
- **Droits** : `whatsapp_conversations` ajoutée à `GET /api/account/export` et `DELETE /api/account/delete`. Retrait du consentement = case à décocher dans `WhatsAppPrefs.tsx`, effet immédiat sur les futurs messages.

## Sécurité

- Vérification de la signature Meta (`X-Hub-Signature-256`, HMAC-SHA256 avec l'app secret Meta déjà détenu) sur **toute** requête entrante avant tout traitement — sinon 401 immédiat.
- `service_role` utilisé uniquement côté webhook serveur, jamais exposé.
- Le LLM ne reçoit **jamais** d'instruction capable de déclencher une écriture (pas d'outil "acheter", "vendre", "modifier watchlist" dans ce lot — lecture seule stricte).

## Hors scope (ce lot)

- Pièces jointes (images, documents) dans les messages entrants.
- Actions d'écriture depuis l'agent (ajouter à la watchlist par message, etc.) — lecture seule uniquement.
- Support d'autres canaux (Telegram, SMS) — Meta WhatsApp uniquement, cohérent avec l'existant.
- Interface d'administration dédiée pour consulter les conversations (l'admin peut déjà interroger la table via Supabase SQL Editor si besoin de support).

## Tests

- Tests purs : parsing/validation du payload webhook Meta, vérification de signature (cas valide/invalide), construction du system prompt.
- Pas de test d'intégration réel contre l'API Meta (nécessite un vrai numéro WhatsApp Business) — vérification manuelle post-déploiement avec le numéro de test déjà utilisé pour les alertes sortantes.
