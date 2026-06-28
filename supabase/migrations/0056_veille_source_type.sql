-- Ajoute source_type à brvm_news pour permettre les filtres G.News / Sites / Matières
alter table public.brvm_news
  add column if not exists source_type text default 'rss';

create index if not exists idx_brvm_news_source_type
  on public.brvm_news(source_type);
