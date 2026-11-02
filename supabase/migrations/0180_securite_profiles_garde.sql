-- 0180 — SÉCURITÉ (audit 2026-11-02) : un compte connecté pouvait se rendre
-- Premium lui-même. La policy owner UPDATE de 0027 (« profil modifiable par le
-- propriétaire ») couvre toutes les colonnes, et authenticated a le droit UPDATE
-- sur is_premium (vérifié en production : has_column_privilege = true). Un simple
-- PATCH PostgREST avec la clé publique et son JWT suffisait.
--
-- Correctif : un déclencheur BEFORE UPDATE refuse, pour les rôles anon et
-- authenticated, toute modification des colonnes de DROITS (is_premium,
-- premium_since) et des colonnes POSÉES PAR LE SERVEUR (email, pays_code,
-- pays_maj_le). Le service_role (activation d'abonnement, admin, géolocalisation)
-- n'est pas concerné. Les colonnes éditables par l'utilisateur (display_name,
-- bio, préférences…) restent modifiables : la policy owner est conservée.
-- Idempotente.

create or replace function public.profiles_garde_colonnes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.is_premium is distinct from old.is_premium
       or new.premium_since is distinct from old.premium_since
       or new.email is distinct from old.email
       or new.pays_code is distinct from old.pays_code
       or new.pays_maj_le is distinct from old.pays_maj_le
       or new.id is distinct from old.id then
      raise exception 'Colonne protégée : modification réservée au serveur.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_garde_colonnes() from public, anon, authenticated;

drop trigger if exists profiles_garde_colonnes on public.profiles;
create trigger profiles_garde_colonnes
  before update on public.profiles
  for each row execute function public.profiles_garde_colonnes();
