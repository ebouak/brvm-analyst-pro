-- 0138 — Carnet d'ordres de la BRVM, issu du Bulletin Officiel de la Cote.
--
-- Pourquoi : `CLAUDE.md` notait que « le carnet d'ordres n'étant pas publié par
-- la BRVM, profondeur et coût d'exécution sont estimés, jamais inventés ».
-- C'était inexact : la BRVM publie chaque séance un bulletin PDF dont une page
-- donne, par valeur, les quantités résiduelles et les cours des deux côtés.
-- La profondeur devient MESURÉE, et le spread RÉEL — là où liquidity/compute.ts
-- l'estime aujourd'hui par Roll.
--
-- Décalage assumé : le bulletin d'une séance paraît après la clôture, parfois
-- le lendemain. Cette table porte donc TOUJOURS sa propre date de séance, et
-- l'interface doit l'afficher avec cette date — jamais comme « en ce moment ».
--
-- RGPD : aucune donnée personnelle. Donnée de marché publique, lecture ouverte
-- comme brvm_actions_daily.

create table if not exists public.brvm_carnet_daily (
  code            text not null,
  date_marche     date not null,
  designation     text,
  -- NULL = aucun ordre résiduel de ce côté. Jamais 0, qui se lirait comme
  -- « des titres à zéro franc » dans une agrégation.
  qte_achat       bigint check (qte_achat is null or qte_achat >= 0),
  cours_achat     numeric check (cours_achat is null or cours_achat > 0),
  qte_vente       bigint check (qte_vente is null or qte_vente >= 0),
  cours_vente     numeric check (cours_vente is null or cours_vente > 0),
  -- Ordre « au marché » : sans limite de cours. Ce n'est pas un cours absent,
  -- c'est une intention différente — et elle interdit de calculer un spread.
  achat_au_marche boolean not null default false,
  vente_au_marche boolean not null default false,
  cours_reference numeric check (cours_reference is null or cours_reference > 0),
  collecte_at     timestamptz not null default now(),
  primary key (code, date_marche)
);

comment on table public.brvm_carnet_daily is
  'Quantités résiduelles et meilleurs cours des deux côtés, par valeur et par séance. Source : Bulletin Officiel de la Cote (BRVM), page « MARCHE DES ACTIONS ».';
comment on column public.brvm_carnet_daily.achat_au_marche is
  'Ordre sans limite de cours. Interdit le calcul d''un spread : il n''y a pas de prix à comparer.';

create index if not exists brvm_carnet_daily_date_idx on public.brvm_carnet_daily (date_marche desc);

alter table public.brvm_carnet_daily enable row level security;

drop policy if exists "brvm_carnet_daily_public_read" on public.brvm_carnet_daily;
create policy "brvm_carnet_daily_public_read"
  on public.brvm_carnet_daily for select
  to anon, authenticated
  using (true);

-- Aucune policy d'écriture : seul le collecteur, porteur de la clé de service,
-- alimente cette table.
