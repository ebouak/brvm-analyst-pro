-- Publication automatique sur LinkedIn (profil de l'exploitant) et TikTok
-- (brouillons) : articles publiés et vidéo de séance.
--
-- 1. `social_tokens` — UNE source de jetons pour les deux workers (scraper des
--    articles, worker vidéo). Pas des secrets GitHub : la page admin qui
--    reçoit le retour OAuth (Vercel) ne peut pas écrire un secret GitHub, et
--    TikTok fait TOURNER son jeton de rafraîchissement à chaque échange — deux
--    copies divergeraient et la seconde casserait la première.
--    `actif` est l'interrupteur par réseau : à false, aucun worker ne publie.
--
-- 2. `publications_sociales` — une ligne par (cible, réseau) au plus : la clé
--    primaire est le VERROU. Elle est insérée (`en_cours`) AVANT l'appel à
--    l'API ; une relance du cron, un second worker ou une relance manuelle
--    tombent sur la contrainte et ne publient rien deux fois. Seul `echec`
--    se relance ; un `en_cours` resté en plan se vérifie à la main (l'API a
--    pu publier avant que le statut ne soit écrit).
--
-- RGPD : les jetons et le nom du compte sont ceux de l'EXPLOITANT, aucun
-- utilisateur n'est concerné. Service_role uniquement, aucune policy.

create table if not exists public.social_tokens (
  reseau             text primary key check (reseau in ('linkedin', 'tiktok')),
  access_token       text not null,
  refresh_token      text,
  expire_le          timestamptz,
  refresh_expire_le  timestamptz,
  compte_id          text,
  compte_nom         text,
  scopes             text,
  actif              boolean not null default true,
  maj_le             timestamptz not null default now()
);

create table if not exists public.publications_sociales (
  cible       text not null check (cible in ('article', 'video')),
  cible_id    text not null,          -- id de l'article, ou date de séance AAAA-MM-JJ
  reseau      text not null check (reseau in ('linkedin', 'tiktok')),
  statut      text not null default 'en_cours'
                check (statut in ('en_cours', 'publie', 'echec', 'ignore')),
  post_id     text,                   -- URN LinkedIn ou publish_id TikTok
  erreur      text,
  lance_le    timestamptz not null default now(),
  termine_le  timestamptz,
  primary key (cible, cible_id, reseau)
);
create index if not exists publications_sociales_lance_idx on public.publications_sociales (lance_le desc);

alter table public.social_tokens enable row level security;
alter table public.publications_sociales enable row level security;
revoke all on public.social_tokens from anon, authenticated;
revoke all on public.publications_sociales from anon, authenticated;
