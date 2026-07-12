-- ============================================================================
-- 0090_api_clients.sql
-- L'API publique passe de « ouverte à tous » à « sur autorisation ».
--
-- POURQUOI (audit sécurité 2026-07-13) :
--  - /api/public/v1/* répondait à quiconque, sans clé, avec CORS `*` :
--    n'importe qui pouvait aspirer l'intégralité des données BRVM — l'actif
--    principal du produit ;
--  - le rate-limit était une Map EN MÉMOIRE : sur Vercel serverless chaque
--    instance a la sienne, donc le quota ne tenait PAS (il suffisait de varier
--    les requêtes pour tomber sur d'autres instances).
--
-- Modèle retenu :
--  - `api_clients` : un demandeur = une clé. La clé N'EST JAMAIS stockée en
--    clair (sha256 uniquement) ; seul un préfixe lisible sert à l'identifier.
--  - `api_usage`   : compteur journalier PERSISTANT (le quota tient enfin).
--
-- RGPD : email + organisation d'un demandeur professionnel (base légale :
-- exécution de la demande / intérêt légitime). Purge à la révocation.
-- ============================================================================

create table if not exists public.api_clients (
  id           uuid primary key default gen_random_uuid(),
  -- Demandeur
  nom          text not null,
  email        text not null,
  organisation text,
  motif        text not null,                -- usage déclaré (modération humaine)
  site_url     text,
  -- Secret : jamais en clair. `key_prefix` sert uniquement à l'affichage.
  key_hash     text unique,                  -- sha256 hex de la clé
  key_prefix   text,                         -- ex. 'wb_live_a1b2c3d4'
  -- Cycle de vie
  statut       text not null default 'pending'
               check (statut in ('pending', 'active', 'rejected', 'revoked')),
  quota_daily  integer not null default 1000 check (quota_daily > 0),
  motif_refus  text,
  -- Traçabilité
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null,
  last_used_at timestamptz
);

create index if not exists idx_api_clients_statut on public.api_clients(statut);
create index if not exists idx_api_clients_key_hash on public.api_clients(key_hash);

comment on table public.api_clients is
  'Clients de l''API publique BRVM — accès sur autorisation. La clé est stockée HACHÉE (sha256) : elle n''est affichée qu''une seule fois, à l''approbation.';
comment on column public.api_clients.key_hash is
  'sha256 de la clé. Jamais la clé en clair : une fuite de la base ne doit pas donner accès à l''API.';

-- Compteur journalier — c'est LUI qui rend le quota réel (l'ancien rate-limit
-- en mémoire ne survivait pas au serverless).
create table if not exists public.api_usage (
  client_id uuid not null references public.api_clients(id) on delete cascade,
  jour      date not null default current_date,
  requetes  integer not null default 0,
  primary key (client_id, jour)
);

comment on table public.api_usage is
  'Consommation journalière par client d''API. Persistant (contrairement au rate-limit en mémoire, inopérant sur serverless).';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Aucune policy : ces tables sont EXCLUSIVEMENT service-role (routes API et
-- console admin, côté serveur). RLS activée = deny-all pour anon/authenticated.
alter table public.api_clients enable row level security;
alter table public.api_usage   enable row level security;

-- ── Incrément atomique du quota ──────────────────────────────────────────────
-- Fait en SQL (upsert atomique) : deux requêtes simultanées ne doivent pas
-- écraser mutuellement leur compteur.
create or replace function public.api_usage_increment(p_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.api_usage (client_id, jour, requetes)
  values (p_client_id, current_date, 1)
  on conflict (client_id, jour)
  do update set requetes = public.api_usage.requetes + 1
  returning requetes into v_count;
  return v_count;
end;
$$;

-- SECURITY DEFINER : révoquer EXECUTE à PUBLIC (accordé par défaut), sinon
-- n'importe qui pourrait gonfler le compteur d'un client via /rest/v1/rpc.
revoke execute on function public.api_usage_increment(uuid) from public;
