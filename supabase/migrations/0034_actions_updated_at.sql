-- updated_at sur brvm_actions_daily : requis par le monitoring de fraîcheur
-- intraday (workflows intraday.yml / intraday-watchdog.yml). L'upsert intraday
-- met à jour les lignes toutes les 15 min en séance → le trigger horodate.
alter table public.brvm_actions_daily
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_actions_updated on public.brvm_actions_daily;
create trigger trg_actions_updated before update on public.brvm_actions_daily
  for each row execute function public.set_updated_at();

create index if not exists idx_actions_updated
  on public.brvm_actions_daily (updated_at desc);
