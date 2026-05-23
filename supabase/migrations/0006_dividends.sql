-- ============================================================================
-- BRVM Analyst Pro — Dividendes (brique §6.8) + log de notifications.
-- ============================================================================

create table if not exists public.dividends (
  id            uuid primary key default gen_random_uuid(),
  code          text not null references public.brvm_instruments(code) on update cascade,
  exercice      int,                 -- année de l'exercice concerné
  ex_date       date,                -- date de détachement
  payment_date  date,                -- date de mise en paiement
  montant       numeric(18,4) not null check (montant >= 0), -- dividende par action (FCFA)
  devise        text not null default 'XOF',
  source        text,
  source_url    text,
  dedupe_hash   text unique,
  created_at    timestamptz not null default now()
);
create index if not exists idx_dividends_code on public.dividends (code, exercice desc);

-- Journal des notifications d'alertes envoyées (audit / anti-spam).
create table if not exists public.notifications_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  alert_id     uuid references public.alerts(id) on delete set null,
  code         text,
  channel      text not null,        -- email | telegram | console
  message      text not null,
  status       text not null default 'sent', -- sent | failed
  created_at   timestamptz not null default now()
);
create index if not exists idx_notiflog_user on public.notifications_log (user_id, created_at desc);

-- RLS : dividendes en lecture publique ; notifications privées par utilisateur.
alter table public.dividends         enable row level security;
alter table public.notifications_log enable row level security;

create policy "lecture publique dividends"
  on public.dividends for select using (true);
-- écriture dividends réservée au service_role (ingestor).

create policy "notifications_log: proprietaire seul - select"
  on public.notifications_log for select to authenticated
  using (user_id = auth.uid());
-- écriture notifications_log réservée au service_role (worker d'alertes).
