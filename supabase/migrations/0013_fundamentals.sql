-- ============================================================================
-- BRVM Analyst Pro — Fondamentaux extraits des états financiers (IFRS/SYSCOHADA).
-- Alimentée par le pipeline d'extraction PDF (brvm_scanner/utils), poussée par
-- le service_role. Lecture publique (RLS) pour le frontend et l'app Scanner.
-- ============================================================================

create table if not exists public.fundamentals (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null references public.brvm_instruments(code) on update cascade,
  year        int,
  revenue     bigint,     -- chiffre d'affaires (FCFA)
  net_income  bigint,     -- résultat net (FCFA)
  equity      bigint,     -- capitaux propres (FCFA)
  cash        bigint,     -- trésorerie (FCFA)
  debt        bigint,     -- dette financière (FCFA)
  bfr         bigint,     -- besoin en fonds de roulement (FCFA)
  source      text        not null default 'bdfin-pdf',
  source_file text,
  updated_at  timestamptz not null default now(),
  unique (code, year)
);

create index if not exists idx_fundamentals_code on public.fundamentals (code, year desc);

alter table public.fundamentals enable row level security;

drop policy if exists "lecture publique fundamentals" on public.fundamentals;
create policy "lecture publique fundamentals"
  on public.fundamentals for select using (true);
-- écriture réservée au service_role (pipeline d'extraction).
