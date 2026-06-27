-- Migration 0055: Enrichissement brvm_news pour la Veille BRVM
-- Colonnes pour sentiment, impact, source enrichie, multi-ticker

alter table public.brvm_news
  add column if not exists sentiment text
    check (sentiment in ('positif','négatif','neutre'))
    default 'neutre',
  add column if not exists score_impact integer default 0
    check (score_impact between 0 and 100),
  add column if not exists source_label text,
  add column if not exists ticker_codes text[] default '{}';

create index if not exists idx_brvm_news_sentiment
  on public.brvm_news(sentiment);
create index if not exists idx_brvm_news_impact
  on public.brvm_news(score_impact desc)
  where score_impact > 60;
create index if not exists idx_brvm_news_tickers
  on public.brvm_news using gin(ticker_codes);

comment on column public.brvm_news.sentiment is
  'positif / négatif / neutre — calculé par le pipeline veille';
comment on column public.brvm_news.score_impact is
  '0-100 : pertinence estimée pour les investisseurs BRVM';
comment on column public.brvm_news.source_label is
  'Libellé lisible de la source : "Sika Finance", "BRVM Officiel", "Google News PALM", etc.';
comment on column public.brvm_news.ticker_codes is
  'Liste des codes instruments mentionnés dans l''article (ex: {PALM,SGBC})';
