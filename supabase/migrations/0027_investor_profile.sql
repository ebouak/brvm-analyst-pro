-- supabase/migrations/0027_investor_profile.sql
alter table public.profiles
  add column if not exists profil text check (profil in ('prudent','modere','agressif')),
  add column if not exists horizon text check (horizon in ('court','moyen','long')),
  add column if not exists mode_debutant boolean not null default false,
  add column if not exists onboarding_done boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
    and policyname = 'profil modifiable par le propriétaire'
  ) then
    execute $policy$
      create policy "profil modifiable par le propriétaire"
        on public.profiles for update
        using (auth.uid() = id)
        with check (auth.uid() = id)
    $policy$;
  end if;
end $$;
