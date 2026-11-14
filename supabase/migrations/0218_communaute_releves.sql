-- 0218 — Relevés datés de la communauté sur les réseaux (TikTok, Facebook,
-- LinkedIn, Telegram, WhatsApp).
--
-- Un relevé = un nombre d'abonnés, une date, une source. 'auto' quand une API
-- le fournit (Telegram : getChatMemberCount), 'manuel' quand l'exploitant le
-- saisit depuis /admin/reseaux (LinkedIn n'a pas d'API pour un profil ; TikTok
-- et Facebook en attendant leurs autorisations). L'accueil affiche le dernier
-- relevé de chaque réseau AVEC SA DATE : un chiffre sans date ferait croire
-- qu'il est d'aujourd'hui.
--
-- RGPD : aucune donnée personnelle (des totaux publics). `saisi_par` désigne
-- l'administrateur qui a saisi, pour l'audit ; il n'est pas exposé (grant de
-- colonnes). Lecture publique des colonnes affichées, écriture service_role.

create table if not exists public.communaute_releves (
  reseau     text not null check (reseau in ('tiktok', 'facebook', 'linkedin', 'telegram', 'whatsapp')),
  releve_le  date not null,
  abonnes    integer not null check (abonnes >= 0),
  source     text not null check (source in ('auto', 'manuel')),
  saisi_par  uuid null references auth.users(id) on delete set null,
  cree_le    timestamptz not null default now(),
  primary key (reseau, releve_le)
);

comment on table public.communaute_releves is
  'Abonnés par réseau, relevé daté. Public en lecture (reseau, releve_le, abonnes, source), écriture service_role. Aucune donnée personnelle hors saisi_par (non exposé).';

alter table public.communaute_releves enable row level security;

drop policy if exists communaute_releves_lecture on public.communaute_releves;
create policy communaute_releves_lecture on public.communaute_releves
  for select to anon, authenticated using (true);

revoke all on public.communaute_releves from public, anon, authenticated;
grant select (reseau, releve_le, abonnes, source) on public.communaute_releves to anon, authenticated;
