-- supabase/migrations/0029_paper_trading.sql
-- Paper trading accounts and positions for premium users

-- 1. Create paper_trading_accounts table
create table if not exists public.paper_trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capital_initial numeric not null check (capital_initial > 0),
  capital_current numeric not null check (capital_current >= 0),
  pnl_total numeric default 0,
  pnl_pct numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

create index if not exists idx_paper_trading_accounts_user_id on public.paper_trading_accounts(user_id);

-- 2. Create paper_trading_positions table
create table if not exists public.paper_trading_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.paper_trading_accounts(id) on delete cascade,
  code text not null references public.brvm_instruments(code) on delete restrict,
  entry_price numeric not null check (entry_price > 0),
  entry_date date not null,
  entry_signal_id bigint references public.signals_daily(id) on delete set null,
  num_shares numeric not null check (num_shares > 0),
  exit_price numeric check (exit_price is null or exit_price > 0),
  exit_date date,
  exit_signal_id bigint references public.signals_daily(id) on delete set null,
  status text not null check (status in ('open', 'closed')) default 'open',
  pnl numeric default 0,
  pnl_pct numeric default 0,
  days_held integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_paper_trading_positions_user_id on public.paper_trading_positions(user_id);
create index if not exists idx_paper_trading_positions_account_id on public.paper_trading_positions(account_id);
create index if not exists idx_paper_trading_positions_code on public.paper_trading_positions(code);
create index if not exists idx_paper_trading_positions_status on public.paper_trading_positions(status);
create index if not exists idx_paper_trading_positions_entry_date on public.paper_trading_positions(entry_date);

-- 3. RLS Policies

alter table public.paper_trading_accounts enable row level security;
alter table public.paper_trading_positions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'paper_trading_accounts'
    and policyname = 'Users can view own paper_trading_accounts'
  ) then
    execute $policy$
      create policy "Users can view own paper_trading_accounts"
        on public.paper_trading_accounts for select
        using (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'paper_trading_accounts'
    and policyname = 'Users can insert paper_trading_accounts (own)'
  ) then
    execute $policy$
      create policy "Users can insert paper_trading_accounts (own)"
        on public.paper_trading_accounts for insert
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'paper_trading_accounts'
    and policyname = 'Users can update paper_trading_accounts (own)'
  ) then
    execute $policy$
      create policy "Users can update paper_trading_accounts (own)"
        on public.paper_trading_accounts for update
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'paper_trading_positions'
    and policyname = 'Users can view own paper_trading_positions'
  ) then
    execute $policy$
      create policy "Users can view own paper_trading_positions"
        on public.paper_trading_positions for select
        using (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'paper_trading_positions'
    and policyname = 'Users can insert paper_trading_positions (own)'
  ) then
    execute $policy$
      create policy "Users can insert paper_trading_positions (own)"
        on public.paper_trading_positions for insert
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'paper_trading_positions'
    and policyname = 'Users can update paper_trading_positions (own)'
  ) then
    execute $policy$
      create policy "Users can update paper_trading_positions (own)"
        on public.paper_trading_positions for update
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

-- 4. Triggers for updated_at

create or replace function public.update_paper_trading_accounts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_paper_trading_accounts_updated_at'
  ) then
    execute $trigger$
      create trigger trigger_paper_trading_accounts_updated_at
      before update on public.paper_trading_accounts
      for each row
      execute function public.update_paper_trading_accounts_updated_at()
    $trigger$;
  end if;
end $$;

create or replace function public.update_paper_trading_positions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_paper_trading_positions_updated_at'
  ) then
    execute $trigger$
      create trigger trigger_paper_trading_positions_updated_at
      before update on public.paper_trading_positions
      for each row
      execute function public.update_paper_trading_positions_updated_at()
    $trigger$;
  end if;
end $$;

-- 5. View: current open positions with latest prices
create or replace view public.vw_paper_trading_positions_open as
select
  p.id,
  p.user_id,
  p.account_id,
  p.code,
  p.entry_price,
  p.entry_date,
  p.num_shares,
  a.cours_jour as current_price,
  (a.cours_jour - p.entry_price) * p.num_shares as unrealized_pnl,
  case when p.entry_price > 0
    then ((a.cours_jour - p.entry_price) / p.entry_price) * 100
    else 0
  end as unrealized_pnl_pct,
  (now()::date - p.entry_date)::integer as days_open,
  p.created_at
from public.paper_trading_positions p
join public.brvm_actions_daily a on p.code = a.code
where p.status = 'open'
  and a.date_marche = (
    select max(date_marche)
    from public.brvm_actions_daily
    where code = p.code
  );

comment on view public.vw_paper_trading_positions_open is
  'Open positions with unrealized P&L and current market price';
