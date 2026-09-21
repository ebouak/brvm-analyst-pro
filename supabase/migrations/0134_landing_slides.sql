-- 0134 — Landing : diapositives du hero (« À la une »), dont emplacements annonceurs.
--
-- Le hero de la landing est un carrousel : des vues PERMANENTES (produit,
-- définies dans le code, jamais en base) et des vues ajoutées depuis la console
-- admin — publicités d'annonceurs, annonces maison. Cette table ne porte que
-- les secondes.
--
-- Règles :
--  · lecture anonyme des SEULES vues actives dans leur fenêtre (policy
--    explicite, security_invoker) ; le reste est invisible à la clé anon ;
--  · écriture service_role uniquement (console admin, permission
--    content.publish, journal admin_audit_logs) ;
--  · une vue `ad` est toujours affichée avec la mention « Publicité » et
--    `sponsor_name` : la mention n'est pas une option, elle est dérivée du kind.
--
-- RGPD : aucune donnée personnelle (annonceur = raison sociale ; created_by =
-- id d'un administrateur, déjà tracé par admin_audit_logs). Aucune mesure
-- d'audience : pas d'impression ni de clic comptés — la landing promet
-- « aucun traceur ».

create table if not exists public.landing_slides (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'ad' check (kind in ('ad', 'house')),
  title        text not null check (char_length(title) between 3 and 80),
  subtitle     text check (char_length(subtitle) <= 200),
  cta_label    text check (char_length(cta_label) <= 40),
  link_url     text check (link_url is null or link_url ~* '^https?://'),
  image_path   text not null,                 -- objet du bucket landing-slides
  sponsor_name text check (char_length(sponsor_name) <= 80),
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  is_active    boolean not null default true,
  position     smallint not null default 100,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint landing_slides_window check (ends_at is null or ends_at > starts_at),
  constraint landing_slides_ad_sponsor check (kind <> 'ad' or sponsor_name is not null)
);

create index if not exists landing_slides_actives_idx
  on public.landing_slides (position, starts_at)
  where is_active;

alter table public.landing_slides enable row level security;

drop policy if exists "landing_slides_public_read" on public.landing_slides;
create policy "landing_slides_public_read"
  on public.landing_slides for select
  to anon, authenticated
  using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));

-- Aucune policy insert/update/delete : seule la service_role écrit.

-- updated_at
create or replace function public.landing_slides_touch()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;
revoke execute on function public.landing_slides_touch() from public, anon, authenticated;
drop trigger if exists landing_slides_touch on public.landing_slides;
create trigger landing_slides_touch before update on public.landing_slides
  for each row execute function public.landing_slides_touch();

-- Bucket public : la landing charge les <img> sans session. Écriture
-- service_role uniquement (bypass RLS de storage.objects ; aucune policy
-- d'écriture pour anon/authenticated).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing-slides', 'landing-slides', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

comment on table public.landing_slides is
  'Diapositives admin du hero de la landing (publicités, annonces maison). Les vues permanentes vivent dans le code. Lecture anon des seules vues actives ; écriture service_role.';
