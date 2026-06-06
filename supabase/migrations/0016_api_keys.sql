-- ============================================================================
-- Clés API LLM gérées via la page admin. Accès UNIQUEMENT via service_role
-- (routes serveur) : aucune policy publique -> la clé anon ne lit/écrit rien.
-- ============================================================================
create table if not exists public.api_keys (
  provider   text primary key,          -- 'deepseek' | 'mistral' | 'xai'
  api_key    text not null,
  updated_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
-- Pas de policy : RLS activé sans policy => seul service_role contourne RLS.
