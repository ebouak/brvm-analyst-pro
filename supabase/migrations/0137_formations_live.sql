-- 0137 — Formations live payantes.
-- Spec : docs/superpowers/specs/2026-09-23-formations-live-design.md
--
-- RGPD : aucune donnée personnelle nouvelle — l'inscription pointe le compte
-- existant. Conservation : 3 ans après la séance (purge_rgpd_retention).

create table if not exists public.formation_sessions (
  id           uuid primary key default gen_random_uuid(),
  niveau       text not null check (niveau in ('debutant', 'intermediaire', 'avance')),
  titre        text not null check (char_length(titre) between 3 and 120),
  description  text check (char_length(description) <= 2000),
  debut_at     timestamptz not null,
  duree_min    int not null check (duree_min between 30 and 600),
  modalite     text not null check (modalite in ('presentiel', 'visio')),
  lieu         text,
  -- Jamais exposé publiquement : voir la vue ci-dessous.
  lien_visio   text,
  places       int not null check (places > 0),
  places_prises int not null default 0 check (places_prises >= 0),
  prix         numeric not null check (prix >= 0),
  prix_abonne  numeric check (prix_abonne is null or prix_abonne >= 0),
  statut       text not null default 'brouillon'
               check (statut in ('brouillon', 'ouverte', 'complete', 'annulee', 'terminee')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- La surréservation devient impossible au niveau de la BASE : un comptage
  -- applicatif laisserait passer deux inscriptions simultanées sur la dernière place.
  constraint formation_sessions_places check (places_prises <= places)
);

create index if not exists formation_sessions_a_venir_idx
  on public.formation_sessions (debut_at)
  where statut in ('ouverte', 'complete');

create table if not exists public.formation_inscriptions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.formation_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  statut        text not null default 'reservee'
                check (statut in ('reservee', 'payee', 'annulee', 'presente', 'absente')),
  transaction_id uuid references public.billing_transactions(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint formation_inscriptions_unicite unique (session_id, user_id)
);

create index if not exists formation_inscriptions_session_idx on public.formation_inscriptions (session_id);
create index if not exists formation_inscriptions_user_idx on public.formation_inscriptions (user_id);

-- Distinguer une vente de formation d'un abonnement : sans cela, le bouton de
-- confirmation de /admin/payments activerait un Premium par effet de bord.
alter table public.billing_transactions
  add column if not exists objet text not null default 'abonnement';
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.billing_transactions'::regclass
                   and conname = 'billing_transactions_objet_check') then
    alter table public.billing_transactions
      add constraint billing_transactions_objet_check check (objet in ('abonnement', 'formation'));
  end if;
end $$;

-- Compteur de places tenu par la base, dans la même transaction que l'insertion.
create or replace function public.formation_places_maj()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.statut <> 'annulee' then
      update public.formation_sessions set places_prises = places_prises + 1, updated_at = now() where id = new.session_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.statut <> 'annulee' and new.statut = 'annulee' then
      update public.formation_sessions set places_prises = greatest(places_prises - 1, 0), updated_at = now() where id = new.session_id;
    elsif old.statut = 'annulee' and new.statut <> 'annulee' then
      update public.formation_sessions set places_prises = places_prises + 1, updated_at = now() where id = new.session_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.statut <> 'annulee' then
      update public.formation_sessions set places_prises = greatest(places_prises - 1, 0), updated_at = now() where id = old.session_id;
    end if;
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.formation_places_maj() from public, anon, authenticated;

drop trigger if exists formation_inscriptions_places on public.formation_inscriptions;
create trigger formation_inscriptions_places
  after insert or update or delete on public.formation_inscriptions
  for each row execute function public.formation_places_maj();

create or replace function public.formations_touch()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;
revoke execute on function public.formations_touch() from public, anon, authenticated;

drop trigger if exists formation_sessions_touch on public.formation_sessions;
create trigger formation_sessions_touch before update on public.formation_sessions
  for each row execute function public.formations_touch();
drop trigger if exists formation_inscriptions_touch on public.formation_inscriptions;
create trigger formation_inscriptions_touch before update on public.formation_inscriptions
  for each row execute function public.formations_touch();

-- RLS : les tables ne sont PAS lisibles publiquement.
alter table public.formation_sessions enable row level security;
alter table public.formation_inscriptions enable row level security;

drop policy if exists "formation_inscriptions_owner_read" on public.formation_inscriptions;
create policy "formation_inscriptions_owner_read"
  on public.formation_inscriptions for select
  to authenticated
  using (user_id = auth.uid());
-- Aucune policy insert/update/delete : seule la clé de service écrit. Sans
-- cela, un inscrit pourrait se déclarer « payee » et ouvrir le lien de visio.

-- Vue publique SANS lien_visio : une colonne de lien dans une table à lecture
-- publique, c'est une salle ouverte à tous.
drop view if exists public.formation_sessions_publiques;
create view public.formation_sessions_publiques
with (security_invoker = true) as
  select id, niveau, titre, description, debut_at, duree_min, modalite, lieu,
         places, places_prises, prix, prix_abonne, statut
    from public.formation_sessions
   where statut in ('ouverte', 'complete');

drop policy if exists "formation_sessions_public_read" on public.formation_sessions;
create policy "formation_sessions_public_read"
  on public.formation_sessions for select
  to anon, authenticated
  using (statut in ('ouverte', 'complete'));

revoke all on public.formation_sessions from anon, authenticated;
grant select (id, niveau, titre, description, debut_at, duree_min, modalite, lieu,
              places, places_prises, prix, prix_abonne, statut)
  on public.formation_sessions to anon, authenticated;
grant select on public.formation_sessions_publiques to anon, authenticated;

-- Rétention : 3 ans après la séance.
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
