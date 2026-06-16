-- supabase/migrations/0044_content_moderation.sql
-- Modération du contenu scrapé : flag `hidden` (filtré côté public via RLS) +
-- `created_by` (auteur des entrées créées à la main). 3 tables : news, communiqués, bulletins.

alter table public.brvm_news        add column if not exists hidden boolean not null default false;
alter table public.brvm_news        add column if not exists created_by uuid references auth.users(id);
alter table public.brvm_communiques add column if not exists hidden boolean not null default false;
alter table public.brvm_communiques add column if not exists created_by uuid references auth.users(id);
alter table public.brvm_bulletins   add column if not exists hidden boolean not null default false;
alter table public.brvm_bulletins   add column if not exists created_by uuid references auth.users(id);

drop policy if exists "actualites publiques" on public.brvm_news;
create policy "actualites publiques" on public.brvm_news for select using (hidden = false);

drop policy if exists "Public read communiques" on public.brvm_communiques;
create policy "Public read communiques" on public.brvm_communiques for select using (hidden = false);

drop policy if exists "Public read bulletins" on public.brvm_bulletins;
create policy "Public read bulletins" on public.brvm_bulletins for select using (hidden = false);
