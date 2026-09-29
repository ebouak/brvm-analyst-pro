-- Westbourse Quant models — runs & scores
create table if not exists public.quant_model_runs (
  id uuid primary key default gen_random_uuid(),
  model_code text not null check (model_code in ('WB_PRICE_MOMENTUM','WB_COMBINED_ALPHA')),
  model_version text not null,
  calculation_date date not null,
  universe_name text not null default 'BRVM actions',
  parameters_json jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('running','completed','failed')),
  total_securities int not null default 0,
  eligible_securities int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.quant_model_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.quant_model_runs(id) on delete cascade,
  security_id text not null references public.brvm_instruments(code) on update cascade,
  score_date date not null,
  price_momentum_score int check (price_momentum_score between 0 and 100),
  value_score int check (value_score between 0 and 100),
  earnings_quality_score int check (earnings_quality_score between 0 and 100),
  financial_strength_score int check (financial_strength_score between 0 and 100),
  dividend_quality_score int check (dividend_quality_score between 0 and 100),
  combined_alpha_score int check (combined_alpha_score between 0 and 100),
  liquidity_score int check (liquidity_score between 0 and 100),
  raw_metrics_json jsonb not null default '{}'::jsonb,
  factor_scores_json jsonb not null default '{}'::jsonb,
  penalties_json jsonb not null default '[]'::jsonb,
  rank_global int,
  rank_sector int,
  eligibility_status text not null check (eligibility_status in ('eligible','eligible_with_warning','ineligible')),
  confidence_level text not null check (confidence_level in ('high','medium','low','insufficient')),
  classification text not null,
  calculation_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, security_id)
);
create index if not exists idx_quant_scores_run on public.quant_model_scores(run_id);
create index if not exists idx_quant_scores_sec_date on public.quant_model_scores(security_id, score_date desc);
create index if not exists idx_quant_scores_combined on public.quant_model_scores(combined_alpha_score desc);
create index if not exists idx_quant_scores_class on public.quant_model_scores(classification);
alter table public.quant_model_runs enable row level security;
alter table public.quant_model_scores enable row level security;
drop policy if exists "lecture publique quant runs" on public.quant_model_runs;
create policy "lecture publique quant runs" on public.quant_model_runs for select using (true);
drop policy if exists "lecture publique quant scores" on public.quant_model_scores;
create policy "lecture publique quant scores" on public.quant_model_scores for select using (true);
-- écriture réservée au service_role (pas de policy insert/update -> seul service_role y accède)
