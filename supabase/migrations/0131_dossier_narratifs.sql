-- 0131 — Dossier valeur : prose polie précalculée, et rangement des PDF.
--
-- POURQUOI UNE TABLE. La page /rapports/dossier/[code] construit un squelette
-- déterministe (lib/dossier/prose.ts). Le polissage par modèle de langage est
-- coûteux (5 à 15 s) et n'a de sens qu'une fois par semaine : il tourne en
-- cron et se range ici. La page LIT la dernière ligne, puis la REVALIDE contre
-- les chiffres vivants du dossier (garde-fou pur) : une prose dont un chiffre ne
-- correspond plus est écartée au profit du squelette. La table ne fait donc
-- jamais autorité sur un chiffre — seulement sur la tournure.
--
-- DONNÉES DE MARCHÉ, PAS DE DONNÉES UTILISATEUR : un dossier ne dépend que du
-- code. Lecture publique comme liquidity_daily ; écriture réservée au
-- service_role (aucune policy d'insertion → anon/authenticated ne peuvent rien
-- écrire, RLS activée).

create table if not exists public.dossier_narratifs (
  code        text        not null,
  genere_le   date        not null,
  -- [{ "titre": "...", "texte": "..." }] — sections polies, mêmes titres que le squelette
  sections    jsonb       not null,
  -- empreinte (sha-256) du squelette déterministe dont la prose est issue.
  -- À la lecture, si le squelette vivant n'a plus la même empreinte — une force
  -- apparue, un risque disparu — la prose est écartée : elle décrirait un
  -- dossier qui n'existe plus.
  empreinte   text        not null,
  -- liste blanche utilisée à la génération, conservée pour audit
  chiffres    numeric[]   not null default '{}',
  provider    text,
  created_at  timestamptz not null default now(),
  primary key (code, genere_le)
);

comment on table public.dossier_narratifs is
  'Prose polie (LLM) du dossier valeur, par code et par date. Revalidée à la lecture contre les chiffres vivants ; jamais source d''un chiffre.';

alter table public.dossier_narratifs enable row level security;

drop policy if exists "dossier_narratifs lecture publique" on public.dossier_narratifs;
create policy "dossier_narratifs lecture publique"
  on public.dossier_narratifs for select
  to anon, authenticated
  using (true);

-- Pas de policy insert/update/delete : seul service_role (qui contourne la RLS) écrit.

-- ── Bucket PRIVÉ pour les PDF ─────────────────────────────────────────────
-- Chemin : <CODE>/<date>.pdf et <CODE>/dernier.pdf. Aucune policy sur
-- storage.objects : seul service_role lit et écrit ; les utilisateurs reçoivent
-- une URL signée à durée courte via /api/dossier/[code]/pdf après contrôle de
-- session. Le contenu est de la donnée de marché, mais le bucket reste fermé :
-- c'est le produit, pas la vitrine.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dossiers', 'dossiers', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
