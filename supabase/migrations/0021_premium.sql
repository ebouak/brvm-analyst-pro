-- supabase/migrations/0021_premium.sql
-- Table profils utilisateurs avec flag premium.
-- Créée automatiquement à l'inscription via trigger.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  is_premium  boolean not null default false,
  premium_since timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- L'utilisateur peut lire son propre profil
create policy "profil lisible par le propriétaire"
  on public.profiles for select
  using (auth.uid() = id);

-- Trigger : crée le profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
