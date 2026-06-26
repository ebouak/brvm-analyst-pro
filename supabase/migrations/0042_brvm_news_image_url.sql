-- Add image_url column to brvm_news (scraped from og:image meta tag)
alter table if exists public.brvm_news
add column if not exists image_url text;

-- Add hidden and created_by columns if missing (for UI control)
alter table if exists public.brvm_news
add column if not exists hidden boolean not null default false,
add column if not exists created_by text default 'scraper';

-- Index for date-based queries
create index if not exists idx_brvm_news_hidden on public.brvm_news (hidden, date_publication desc);
