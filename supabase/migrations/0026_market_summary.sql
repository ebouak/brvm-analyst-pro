-- Totaux de séance publiés par brvm.org (table « Activités du marché »).
-- Données réelles : valeur des transactions + capitalisations actions/obligations.
create table if not exists public.brvm_market_summary (
  date_marche                date primary key,
  valeur_transactions        numeric,   -- FCFA échangés sur la séance (total marché)
  capitalisation_actions     numeric,   -- FCFA
  capitalisation_obligations numeric,   -- FCFA
  updated_at                 timestamptz not null default now()
);

comment on table public.brvm_market_summary is
  'Totaux de séance (source brvm.org « Activités du marché ») : valeur échangée et capitalisations.';

alter table public.brvm_market_summary enable row level security;

drop policy if exists "lecture publique market summary" on public.brvm_market_summary;
create policy "lecture publique market summary"
  on public.brvm_market_summary for select using (true);
