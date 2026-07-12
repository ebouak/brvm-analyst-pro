-- ============================================================================
-- 0092_auth_events.sql
-- Journal des connexions : IP, appareil, succès/échec.
--
-- POURQUOI : aujourd'hui on ne sait ni d'où ni quand un utilisateur se connecte.
-- `auth.users.last_sign_in_at` donne la date, jamais l'IP ni l'appareil — et
-- l'historique est écrasé à chaque connexion. Impossible de répondre à « ce
-- compte a-t-il été piraté ? » ou « depuis quels pays se connecte-t-il ? ».
--
-- RGPD : l'IP est une donnée personnelle. Base légale = intérêt légitime
-- (sécurité des comptes). Conservation limitée à 12 MOIS — la purge est prévue
-- ci-dessous et doit être branchée sur un cron. À déclarer au registre
-- (docs/RGPD.md) et à couvrir par l'export/suppression de compte.
-- ============================================================================

create table if not exists public.auth_events (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  -- Email conservé même si le compte est supprimé plus tard : une tentative de
  -- connexion échouée sur un compte inexistant est justement un signal.
  email      text,
  event      text not null check (event in ('sign_in', 'sign_in_failed', 'sign_out', 'password_reset')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_events_user on public.auth_events(user_id, created_at desc);
create index if not exists idx_auth_events_created on public.auth_events(created_at desc);
create index if not exists idx_auth_events_ip on public.auth_events(ip_address);

comment on table public.auth_events is
  'Journal des connexions (IP, appareil). Donnée perso : intérêt légitime (sécurité), conservation 12 mois.';

alter table public.auth_events enable row level security;

-- L'utilisateur peut consulter SON historique de connexions (transparence RGPD,
-- et cela lui permet de repérer un accès qu'il ne reconnaît pas).
drop policy if exists "auth_events_read_own" on public.auth_events;
create policy "auth_events_read_own" on public.auth_events
  for select using (auth.uid() = user_id);

-- Écriture : service_role uniquement (aucune policy insert).

-- Purge de rétention (12 mois) — à appeler par un cron.
create or replace function public.purge_auth_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.auth_events
  where created_at < now() - interval '12 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_auth_events() from public;
