-- ============================================================================
-- 0049_advisor_history.sql — Historique des recommandations du Conseiller.
-- Un snapshot par (date, action) permet de détecter les BASCULES de reco
-- (ex. Conserver → Acheter) → base des alertes proactives.
-- Écriture par le cron (service_role) ; lecture publique (données dérivées).
-- ============================================================================

create table if not exists public.advisor_history (
  date_marche date not null,
  code        text not null references public.brvm_instruments(code) on update cascade,
  action      text not null check (action in ('acheter','conserver','vendre')),
  conviction  int  not null,
  score       int  not null,
  created_at  timestamptz not null default now(),
  primary key (date_marche, code)
);

create index if not exists idx_advisor_history_date on public.advisor_history (date_marche desc);

alter table public.advisor_history enable row level security;
drop policy if exists "lecture publique advisor_history" on public.advisor_history;
create policy "lecture publique advisor_history" on public.advisor_history for select using (true);
-- Pas de policy d'écriture → réservé au service_role (cron).
