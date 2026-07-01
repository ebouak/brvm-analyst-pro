-- 0061_signals_backtest.sql
-- Résultats du backtest rétroactif des signaux BUY (méthode de scoring actuelle
-- appliquée à l'historique des cours). Sert la page publique de « track record »
-- (/signaux). La table ne contient QUE le dernier calcul (TRUNCATE + réinsertion
-- à chaque exécution de `npm run backtest-signals`, côté scraper).
--
-- RGPD : aucune donnée personnelle (résultats agrégés sur données de marché
-- publiques). Lecture publique nécessaire (page marketing /signaux).

create table if not exists public.signals_backtest (
  id              uuid primary key default gen_random_uuid(),
  code            text not null references public.brvm_instruments(code) on update cascade,
  date_signal     date not null,
  cours_signal    numeric(18,4) not null,
  cours_horizon   numeric(18,4),
  perf_pct        numeric(10,4),
  horizon_seances int not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_signals_backtest_code on public.signals_backtest (code);
create index if not exists idx_signals_backtest_date on public.signals_backtest (date_signal desc);

alter table public.signals_backtest enable row level security;

drop policy if exists signals_backtest_public_read on public.signals_backtest;
create policy signals_backtest_public_read on public.signals_backtest
  for select using (true);

comment on table public.signals_backtest is
  'Backtest rétroactif des signaux BUY (méthode de scoring actuelle appliquée à l''historique). Écriture réservée au service_role (scraper).';
