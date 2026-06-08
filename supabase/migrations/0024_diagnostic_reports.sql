-- diagnostic_reports : cache des rapports LLM sell-side par action
-- Un seul rapport par code (le plus récent). TTL géré applicativement (7 jours).
create table if not exists public.diagnostic_reports (
  id               uuid primary key default gen_random_uuid(),
  code             text not null references public.brvm_instruments(code) on update cascade,
  generated_at     timestamptz not null default now(),
  model_used       text not null default 'deepseek',
  markdown_content text not null,
  metrics_snapshot jsonb,
  unique (code)
);

alter table public.diagnostic_reports enable row level security;

create policy "lecture publique diagnostic_reports"
  on public.diagnostic_reports for select using (true);

create policy "ecriture service_role diagnostic_reports"
  on public.diagnostic_reports for all using (auth.role() = 'service_role');

create index if not exists idx_diagnostic_code on public.diagnostic_reports(code);
