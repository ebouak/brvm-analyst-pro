-- 0249 — Dessins du graphique avancé, par compte et par valeur.
--
-- Finalité : conserver les tracés qu'une personne pose sur le graphique d'une
-- valeur (lignes, Fibonacci, annotations) pour les retrouver à sa prochaine
-- visite. Aucune donnée de marché ici, seulement les tracés de l'utilisateur.
-- Base légale : exécution du service demandé (fonction du compte).
-- Conservation : tant que le compte existe ; supprimés avec lui (cascade
-- auth.users + purge explicite de /api/account/delete). Export : inclus dans
-- /api/account/export.
-- Accès : le seul propriétaire lit et écrit ses lignes (RLS owner). Aucun
-- accès anonyme. Aucune fonction n'est créée.
--
-- Test à la clé publique après application (sans session) :
--   curl "$SUPABASE_URL/rest/v1/graphique_dessins?select=*" -H "apikey: $ANON"
--   → 401 / permission denied (le rôle anon n'a aucun privilège).
-- Avec une session A : lecture limitée à ses lignes ; un upsert portant le
-- user_id d'un compte B est refusé (42501, with check).

create table if not exists public.graphique_dessins (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  code       text        not null check (code ~ '^[A-Z0-9]{2,12}$'),
  dessins    jsonb       not null default '[]'::jsonb
             check (jsonb_typeof(dessins) = 'array'
                    and jsonb_array_length(dessins) <= 200
                    and pg_column_size(dessins) <= 131072),
  updated_at timestamptz not null default now(),
  primary key (user_id, code)
);

comment on table public.graphique_dessins is
  'Tracés du graphique avancé (lignes, Fibonacci, annotations) par compte et par valeur. RLS owner.';

alter table public.graphique_dessins enable row level security;

revoke all on public.graphique_dessins from public, anon, authenticated;
grant select, insert, update, delete on public.graphique_dessins to authenticated;

drop policy if exists graphique_dessins_select_owner on public.graphique_dessins;
create policy graphique_dessins_select_owner on public.graphique_dessins
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists graphique_dessins_insert_owner on public.graphique_dessins;
create policy graphique_dessins_insert_owner on public.graphique_dessins
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists graphique_dessins_update_owner on public.graphique_dessins;
create policy graphique_dessins_update_owner on public.graphique_dessins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists graphique_dessins_delete_owner on public.graphique_dessins;
create policy graphique_dessins_delete_owner on public.graphique_dessins
  for delete to authenticated
  using ((select auth.uid()) = user_id);
