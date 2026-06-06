# Assistant IA du brief + Page admin clés API — design

Date : 2026-06-06
Statut : validé (en attente revue spec)

## 1. Objectifs

Deux fonctionnalités liées (toutes deux s'appuient sur la cascade LLM existante) :

1. **Assistant IA dans le brief de séance** : un bouton « 🤖 Demander à l'IA »
   ouvre un chat où l'utilisateur pose des questions sur le marché. L'IA répond
   à partir du **contexte du jour** et peut appeler des **outils ciblés**
   (historique d'une action, fondamentaux d'un émetteur) pour des analyses
   autonomes.
2. **Page admin `/admin/cles-api`** : gérer les clés API LLM (DeepSeek, Mistral,
   xAI) sans redéployer. Réservée à l'administrateur.

## 2. Contexte existant réutilisé

- Cascade LLM : `frontend/lib/import/llmProviders.ts` (`TEXT_PROVIDERS`,
  `parseLlmJson`) et endpoints OpenAI-compatibles (DeepSeek/Mistral/Grok).
- Route relais : `frontend/app/api/extract-llm/route.ts` (pattern d'appel LLM
  serveur + auth).
- Auth : `createClient` (server) + `supabase.auth.getUser()`.
- Email utilisateur connu : `Ebouak@gmail.com` (admin unique).

## 3. Donnée : clés API en base

### Migration `0016_api_keys.sql`
```sql
create table if not exists public.api_keys (
  provider text primary key,          -- 'deepseek' | 'mistral' | 'xai'
  api_key  text not null,
  updated_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
-- Aucune policy SELECT/INSERT publique : accès UNIQUEMENT via service_role
-- (les routes serveur). La clé anon ne peut rien lire/écrire.
```

### Résolution d'une clé (ordre de priorité)
`lib/server/apiKeys.ts` (serveur uniquement) : pour un provider donné,
1. variable d'env (`DEEPSEEK_API_KEY`…) si présente ;
2. sinon, valeur en table `api_keys` (lue via service_role).
Cette fonction remplace la lecture directe `process.env.*` dans
`/api/extract-llm` et la nouvelle route IA.

## 4. Sécurité (admin unique)

- Constante serveur `ADMIN_EMAILS = ['ebouak@gmail.com']` (comparaison en
  minuscules) dans `lib/server/admin.ts`.
- Garde `requireAdmin(supabase)` : 401 si non connecté, 403 si email ≠ admin.
- Page `/admin/cles-api` : vérifie l'admin côté serveur (composant serveur qui
  redirige si non-admin) ; les mutations passent par `/api/admin/cles` (garde
  `requireAdmin` + service_role).
- Les clés ne sont **jamais renvoyées en clair** au client : la page affiche
  seulement un statut (« configurée » / « absente ») + un champ pour saisir une
  nouvelle valeur. L'API de lecture renvoie `{ provider, configured: boolean }`.

## 5. Assistant IA du brief

### Composant `BriefAssistant.tsx` (client)
- Bouton dans le bloc brief du dashboard → ouvre une modale de chat.
- Historique de messages (question/réponse) en state local.
- Envoie chaque question à `POST /api/brief-assistant`.

### Route `POST /api/brief-assistant` (serveur)
- Auth : utilisateur connecté requis.
- Entrée : `{ question: string, history: {role,content}[] }`.
- Construit le **contexte du jour** côté serveur (requêtes Supabase) :
  indices BRVM30/BRVMC (dernière date), nb hausse/baisse/stable, top volumes,
  signaux non-HOLD du jour. Injecté en message système.
- **Outils ciblés** (function calling OpenAI-compatible) que l'IA peut appeler :
  - `get_action_history(code, days)` → cours récents d'une action ;
  - `get_fundamentals(code)` → derniers fondamentaux d'un émetteur.
  La route exécute l'outil demandé (requête Supabase), renvoie le résultat au
  LLM, puis renvoie la réponse finale. Max 3 tours d'outils (borne anti-boucle).
- Cascade providers : DeepSeek → Mistral → Grok (clé résolue via `apiKeys.ts`).
- Sortie : `{ answer: string, provider }` ou `{ error }`.

### Garde-fous IA
- Le prompt système impose : répondre en français, se baser sur les données
  fournies/outils, **ne pas inventer de chiffres**, dire « donnée non
  disponible » si l'info manque. Pas de conseil d'investissement personnalisé
  (ton analytique factuel).

## 6. Composants / fichiers

```
supabase/migrations/0016_api_keys.sql
frontend/
├── lib/server/apiKeys.ts          # résolution clé (env -> table), service_role
├── lib/server/admin.ts            # ADMIN_EMAILS + requireAdmin()
├── app/api/admin/cles/route.ts    # GET statut clés / POST maj (requireAdmin)
├── app/admin/cles-api/page.tsx    # UI gestion clés (serveur: garde admin)
├── components/admin/ApiKeysForm.tsx  # formulaire (client)
├── app/api/brief-assistant/route.ts  # chat IA + outils ciblés
├── components/dashboard/BriefAssistant.tsx  # bouton + modale chat
├── app/page.tsx                   # insérer <BriefAssistant /> dans le bloc brief
└── components/Sidebar.tsx         # lien « 🔑 Clés API » (admin)
```

### Refactor ciblé
`/api/extract-llm` : remplacer les lectures `process.env.DEEPSEEK_API_KEY`…
par `resolveApiKey('deepseek')` (de `apiKeys.ts`) pour que les clés saisies en
admin profitent aussi à l'Import IA. Comportement inchangé si l'env est défini.

## 7. Gestion d'erreurs

- Aucune clé (ni env ni table) → 503 « Configurer une clé API (page admin) ».
- Tous providers échouent → message d'erreur agrégé.
- Outil IA renvoyant rien → l'IA répond « donnée non disponible ».
- Non-admin sur page/route admin → 403, redirection.

## 8. Tests

- `lib/server/admin.ts` : test `requireAdmin` (admin ok, autre email 403,
  non connecté 401) — testable en isolant la logique de comparaison email.
- `lib/import/llmProviders.ts` (parseLlmJson) déjà testé, réutilisé.
- Test manuel : page admin (admin voit le formulaire, autre compte refusé) ;
  bouton IA répond à « Quelles actions ont le plus monté aujourd'hui ? ».

## 9. Hors périmètre (YAGNI)

- Pas de chiffrement applicatif des clés en base (RLS service_role-only suffit ;
  Supabase chiffre au repos). Documenté comme limite acceptée.
- Pas de streaming de la réponse IA (réponse en une fois).
- Pas d'historique de conversation persistant (state local, par session UI).
- Pas de gestion multi-admins dynamique (liste en dur, modifiable en code).
