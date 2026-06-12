-- Note de conjoncture : données structurées du brief (jauges, top movers,
-- transactions) pour la page HTML interactive /brief/[date] et l'image OG.
alter table public.brief_daily
  add column if not exists data jsonb;

comment on column public.brief_daily.data is
  'Données structurées de la note de conjoncture (indices, breadth, movers, transactions, actualités).';
