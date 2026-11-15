-- 0244 — Ordres simulés BRVM : aucune instruction n'est transmise à la BRVM.
-- Les valeurs du BOC sont un instantané daté des limites résiduelles publiées,
-- pas une file complète ni la garantie d'exécution d'un ordre hypothétique.

create table public.paper_trading_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.paper_trading_accounts(id) on delete cascade,
  code text not null references public.brvm_instruments(code) on delete restrict,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('at_best', 'limit')),
  execution_mode text not null check (execution_mode in ('fixing', 'boc_prudent')),
  status text not null check (
    status in ('pending', 'partial', 'filled', 'expired', 'cancelled', 'waiting_data')
  ),
  limit_price numeric check (limit_price is null or limit_price > 0),
  quantity bigint not null check (quantity > 0),
  filled_quantity bigint not null default 0 check (filled_quantity >= 0),
  remaining_quantity bigint generated always as (quantity - filled_quantity) stored,
  submitted_after date not null,
  expires_after_sessions integer not null check (expires_after_sessions between 1 and 20),
  evaluated_sessions integer not null default 0 check (evaluated_sessions >= 0),
  last_evaluated_date date,
  reserved_cash_remaining numeric not null default 0 check (reserved_cash_remaining >= 0),
  reserved_shares_remaining bigint not null default 0 check (reserved_shares_remaining >= 0),
  waiting_reason text,
  boc_date date,
  boc_collected_at timestamptz,
  boc_buy_quantity bigint check (boc_buy_quantity is null or boc_buy_quantity >= 0),
  boc_buy_price numeric check (boc_buy_price is null or boc_buy_price > 0),
  boc_sell_quantity bigint check (boc_sell_quantity is null or boc_sell_quantity >= 0),
  boc_sell_price numeric check (boc_sell_price is null or boc_sell_price > 0),
  boc_buy_at_market boolean not null default false,
  boc_sell_at_market boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_trading_orders_quantity_bounds check (filled_quantity <= quantity),
  constraint paper_trading_orders_limit_shape check (
    (order_type = 'at_best' and limit_price is null)
    or (order_type = 'limit' and limit_price is not null)
  ),
  constraint paper_trading_orders_boc_shape check (
    (execution_mode = 'fixing' and boc_date is null and boc_collected_at is null)
    or (execution_mode = 'boc_prudent' and boc_date is not null and boc_collected_at is not null)
  )
);

create index paper_trading_orders_user_created_idx
  on public.paper_trading_orders (user_id, created_at desc, id);
create index paper_trading_orders_account_status_idx
  on public.paper_trading_orders (account_id, status, submitted_after);

comment on table public.paper_trading_orders is
  'Ordres de paper trading uniquement : aucune instruction réelle n''est transmise à la BRVM.';
comment on column public.paper_trading_orders.boc_date is
  'Date du BOC figé lors de la saisie ; indique les limites résiduelles publiées, pas une file complète.';

create table public.paper_trading_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.paper_trading_accounts(id) on delete cascade,
  order_id uuid not null references public.paper_trading_orders(id) on delete cascade,
  code text not null references public.brvm_instruments(code) on delete restrict,
  date_marche date not null,
  quantity bigint not null check (quantity > 0),
  price numeric not null check (price > 0),
  execution_mode text not null check (execution_mode in ('fixing', 'boc_prudent')),
  boc_date date,
  created_at timestamptz not null default now(),
  constraint paper_trading_fills_order_date_key unique (order_id, date_marche)
);

create index paper_trading_fills_user_created_idx
  on public.paper_trading_fills (user_id, created_at desc, id);

comment on table public.paper_trading_fills is
  'Exécutions estimées du paper trading au fixing publié ; elles ne sont pas des exécutions BRVM.';

alter table public.paper_trading_orders enable row level security;
alter table public.paper_trading_fills enable row level security;

create policy paper_trading_orders_owner_read
  on public.paper_trading_orders for select to authenticated
  using (auth.uid() = user_id);
create policy paper_trading_fills_owner_read
  on public.paper_trading_fills for select to authenticated
  using (auth.uid() = user_id);

revoke all on public.paper_trading_orders from public, anon, authenticated;
revoke all on public.paper_trading_fills from public, anon, authenticated;
grant select on public.paper_trading_orders to authenticated;
grant select on public.paper_trading_fills to authenticated;
grant all on public.paper_trading_orders to service_role;
grant all on public.paper_trading_fills to service_role;

create trigger paper_trading_orders_updated_at
  before update on public.paper_trading_orders
  for each row execute function public.update_paper_trading_accounts_updated_at();

create or replace function public.paper_placer_ordre(
  p_user uuid,
  p_code text,
  p_side text,
  p_type text,
  p_mode text,
  p_quantity bigint,
  p_limit_price numeric,
  p_expires_after_sessions integer
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account public.paper_trading_accounts%rowtype;
  v_order public.paper_trading_orders%rowtype;
  v_reference_price numeric;
  v_submitted_after date;
  v_reservation_price numeric;
  v_available_cash numeric;
  v_open_cost numeric;
  v_reserved_cash numeric;
  v_held_shares bigint;
  v_reserved_shares bigint;
  v_book public.brvm_carnet_daily%rowtype;
  v_opposing_quantity bigint;
begin
  if p_user is null or p_code is null or p_code !~ '^[A-Z]{3,5}$'
     or p_side is null or p_side not in ('buy', 'sell')
     or p_type is null or p_type not in ('at_best', 'limit')
     or p_mode is null or p_mode not in ('fixing', 'boc_prudent')
     or p_quantity is null or p_quantity <= 0
     or p_expires_after_sessions is null
     or p_expires_after_sessions not between 1 and 20
     or (p_type = 'limit' and (p_limit_price is null or p_limit_price <= 0))
     or (p_type = 'at_best' and p_limit_price is not null) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ORDER');
  end if;

  select * into v_account
    from public.paper_trading_accounts
   where user_id = p_user
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NO_ACCOUNT');
  end if;

  if not exists (
    select 1 from public.brvm_instruments
     where code = p_code and type = 'action' and actif
  ) then
    return jsonb_build_object('ok', false, 'error', 'UNKNOWN_INSTRUMENT');
  end if;

  select max(date_marche) into v_submitted_after
    from public.brvm_actions_daily;
  if v_submitted_after is null then
    return jsonb_build_object('ok', false, 'error', 'NO_MARKET_SESSION');
  end if;

  select cours_jour into v_reference_price
    from public.brvm_actions_daily
   where code = p_code and date_marche <= v_submitted_after
     and cours_jour > 0
   order by date_marche desc
   limit 1;
  if v_reference_price is null then
    return jsonb_build_object('ok', false, 'error', 'NO_QUOTE');
  end if;

  if p_mode = 'boc_prudent' then
    select * into v_book
      from public.brvm_carnet_daily
     where code = p_code
       and date_marche <= v_submitted_after
       and collecte_at <= now()
     order by date_marche desc
     limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NO_BOC_DATA');
    end if;
    v_opposing_quantity := case when p_side = 'buy' then v_book.qte_vente else v_book.qte_achat end;
    if v_opposing_quantity is null then
      return jsonb_build_object('ok', false, 'error', 'NO_BOC_QUANTITY');
    end if;
    if v_opposing_quantity = 0 then
      return jsonb_build_object('ok', false, 'error', 'NO_OPPOSING_QUANTITY');
    end if;
  end if;

  if p_side = 'buy' then
    v_reservation_price := case when p_type = 'limit' then p_limit_price else v_reference_price end;
    select coalesce(sum(num_shares * entry_price), 0)
      into v_open_cost
      from public.paper_trading_positions
     where account_id = v_account.id and status = 'open';
    select coalesce(sum(reserved_cash_remaining), 0)
      into v_reserved_cash
      from public.paper_trading_orders
     where account_id = v_account.id and side = 'buy'
       and status in ('pending', 'partial', 'waiting_data');
    v_available_cash := v_account.capital_current - v_open_cost - v_reserved_cash;
    if v_available_cash < p_quantity * v_reservation_price then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CASH');
    end if;
  else
    select coalesce(sum(num_shares), 0)
      into v_held_shares
      from public.paper_trading_positions
     where account_id = v_account.id and code = p_code and status = 'open';
    select coalesce(sum(reserved_shares_remaining), 0)
      into v_reserved_shares
      from public.paper_trading_orders
     where account_id = v_account.id and code = p_code and side = 'sell'
       and status in ('pending', 'partial', 'waiting_data');
    if v_held_shares - v_reserved_shares < p_quantity then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_SHARES');
    end if;
    v_reservation_price := 0;
  end if;

  insert into public.paper_trading_orders (
    user_id, account_id, code, side, order_type, execution_mode, status,
    limit_price, quantity, submitted_after, expires_after_sessions,
    reserved_cash_remaining, reserved_shares_remaining,
    boc_date, boc_collected_at, boc_buy_quantity, boc_buy_price,
    boc_sell_quantity, boc_sell_price, boc_buy_at_market, boc_sell_at_market
  ) values (
    p_user, v_account.id, p_code, p_side, p_type, p_mode, 'pending',
    p_limit_price, p_quantity, v_submitted_after, p_expires_after_sessions,
    case when p_side = 'buy' then p_quantity * v_reservation_price else 0 end,
    case when p_side = 'sell' then p_quantity else 0 end,
    case when p_mode = 'boc_prudent' then v_book.date_marche end,
    case when p_mode = 'boc_prudent' then v_book.collecte_at end,
    case when p_mode = 'boc_prudent' then v_book.qte_achat end,
    case when p_mode = 'boc_prudent' then v_book.cours_achat end,
    case when p_mode = 'boc_prudent' then v_book.qte_vente end,
    case when p_mode = 'boc_prudent' then v_book.cours_vente end,
    case when p_mode = 'boc_prudent' then v_book.achat_au_marche else false end,
    case when p_mode = 'boc_prudent' then v_book.vente_au_marche else false end
  ) returning * into v_order;

  return jsonb_build_object('ok', true, 'order', to_jsonb(v_order));
end;
$function$;

create or replace function public.paper_annuler_ordre(
  p_user uuid,
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account public.paper_trading_accounts%rowtype;
  v_order public.paper_trading_orders%rowtype;
  v_account_id uuid;
begin
  select account_id into v_account_id
    from public.paper_trading_orders
   where id = p_order_id and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_account from public.paper_trading_accounts
   where id = v_account_id and user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select * into v_order from public.paper_trading_orders
   where id = p_order_id and account_id = v_account.id and user_id = p_user
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_order.status not in ('pending', 'partial', 'waiting_data') then
    return jsonb_build_object('ok', false, 'error', 'TERMINAL_ORDER');
  end if;

  update public.paper_trading_orders
     set status = 'cancelled',
         reserved_cash_remaining = 0,
         reserved_shares_remaining = 0,
         waiting_reason = 'cancelled_by_user'
   where id = v_order.id
   returning * into v_order;

  return jsonb_build_object('ok', true, 'order', to_jsonb(v_order));
end;
$function$;

create or replace function public.paper_marquer_attente_donnees(
  p_user uuid,
  p_order_id uuid,
  p_date_marche date,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account_id uuid;
  v_account public.paper_trading_accounts%rowtype;
  v_order public.paper_trading_orders%rowtype;
begin
  select account_id into v_account_id
    from public.paper_trading_orders
   where id = p_order_id and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_account from public.paper_trading_accounts
   where id = v_account_id and user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_order from public.paper_trading_orders
   where id = p_order_id and account_id = v_account.id and user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_order.status not in ('pending', 'partial', 'waiting_data') then
    return jsonb_build_object('ok', false, 'error', 'TERMINAL_ORDER');
  end if;
  if p_date_marche <= v_order.submitted_after
     or (v_order.last_evaluated_date is not null and p_date_marche <= v_order.last_evaluated_date) then
    return jsonb_build_object('ok', false, 'error', 'SESSION_ALREADY_EVALUATED');
  end if;

  update public.paper_trading_orders
     set status = 'waiting_data',
         waiting_reason = left(coalesce(nullif(p_reason, ''), 'missing_market_data'), 160)
   where id = v_order.id
   returning * into v_order;
  return jsonb_build_object('ok', true, 'order', to_jsonb(v_order));
end;
$function$;

create or replace function public.paper_appliquer_remplissage(
  p_user uuid,
  p_order_id uuid,
  p_date_marche date,
  p_quantity bigint,
  p_price numeric,
  p_mode text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account_id uuid;
  v_account public.paper_trading_accounts%rowtype;
  v_order public.paper_trading_orders%rowtype;
  v_close numeric;
  v_volume bigint;
  v_opposing_quantity bigint;
  v_remaining bigint;
  v_quantity bigint;
  v_affordable bigint;
  v_reserved_cash numeric;
  v_reserved_shares bigint;
  v_evaluated_sessions integer;
  v_next_status text;
  v_reason text;
  v_new_reserved_cash numeric;
  v_new_reserved_shares bigint;
  v_open_position public.paper_trading_positions%rowtype;
  v_position public.paper_trading_positions%rowtype;
  v_sale_remaining bigint;
  v_sale_quantity bigint;
  v_pnl numeric;
  v_pnl_total numeric;
  v_pnl_pct numeric;
  v_days_held integer;
  v_fill public.paper_trading_fills%rowtype;
begin
  select account_id into v_account_id
    from public.paper_trading_orders
   where id = p_order_id and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_account from public.paper_trading_accounts
   where id = v_account_id and user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  select * into v_order from public.paper_trading_orders
   where id = p_order_id and account_id = v_account.id and user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_order.status not in ('pending', 'partial', 'waiting_data') then
    return jsonb_build_object('ok', false, 'error', 'TERMINAL_ORDER');
  end if;
  if p_mode is distinct from v_order.execution_mode then
    return jsonb_build_object('ok', false, 'error', 'MODE_MISMATCH');
  end if;
  if p_date_marche <= v_order.submitted_after then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_AFTER_SUBMISSION');
  end if;
  if v_order.last_evaluated_date is not null and p_date_marche <= v_order.last_evaluated_date then
    select * into v_fill from public.paper_trading_fills
     where order_id = v_order.id and date_marche = p_date_marche;
    return jsonb_build_object(
      'ok', true, 'already_evaluated', true,
      'fill', case when found then to_jsonb(v_fill) else null end
    );
  end if;

  select cours_jour, volume into v_close, v_volume
    from public.brvm_actions_daily
   where code = v_order.code and date_marche = p_date_marche;
  if not found or v_close is null or v_close <= 0 or v_volume is null or v_volume < 0 then
    return jsonb_build_object('ok', false, 'error', 'MISSING_MARKET_DATA');
  end if;

  v_remaining := v_order.quantity - v_order.filled_quantity;
  v_quantity := v_remaining;
  if v_order.execution_mode = 'boc_prudent' then
    if v_order.boc_date is null or v_order.boc_date > v_order.submitted_after
       or v_order.boc_date >= p_date_marche or v_order.boc_collected_at > v_order.created_at then
      return jsonb_build_object('ok', false, 'error', 'INVALID_BOC_SNAPSHOT');
    end if;
    v_opposing_quantity := case
      when v_order.side = 'buy' then v_order.boc_sell_quantity
      else v_order.boc_buy_quantity
    end;
    if v_opposing_quantity is null then
      return jsonb_build_object('ok', false, 'error', 'MISSING_BOC_QUANTITY');
    end if;
    v_quantity := least(v_quantity, v_opposing_quantity, v_volume);
  elsif v_volume = 0 then
    v_quantity := 0;
  end if;

  if v_order.side = 'buy' then
    v_reserved_cash := v_order.reserved_cash_remaining;
    v_affordable := floor(v_reserved_cash / v_close)::bigint;
    v_quantity := least(v_quantity, v_affordable);
    v_reserved_shares := 0;
  else
    v_reserved_shares := v_order.reserved_shares_remaining;
    v_quantity := least(v_quantity, v_reserved_shares);
    v_reserved_cash := 0;
  end if;

  if v_order.order_type = 'limit' and (
    (v_order.side = 'buy' and v_close > v_order.limit_price)
    or (v_order.side = 'sell' and v_close < v_order.limit_price)
  ) then
    v_quantity := 0;
    v_reason := 'price_limit_not_met';
  elsif v_quantity = 0 then
    v_reason := case
      when v_order.side = 'buy' and v_affordable < 1 then 'insufficient_reserved_cash'
      when v_order.side = 'sell' and v_reserved_shares < 1 then 'reserved_shares_exhausted'
      else 'no_available_simulated_liquidity'
    end;
  else
    v_reason := 'filled';
  end if;

  if coalesce(p_quantity, -1) <> v_quantity
     or (v_quantity > 0 and p_price is distinct from v_close)
     or (v_quantity = 0 and p_price is not null) then
    return jsonb_build_object('ok', false, 'error', 'STALE_EVALUATION');
  end if;

  v_evaluated_sessions := v_order.evaluated_sessions + 1;
  v_new_reserved_cash := v_order.reserved_cash_remaining;
  v_new_reserved_shares := v_order.reserved_shares_remaining;

  if v_quantity > 0 and v_order.side = 'buy' then
    v_new_reserved_cash := greatest(0, v_new_reserved_cash - v_quantity * v_close);

    select * into v_open_position from public.paper_trading_positions
     where account_id = v_account.id and code = v_order.code and status = 'open'
     order by entry_date, id limit 1 for update;
    if found then
      update public.paper_trading_positions
         set num_shares = num_shares + v_quantity,
             entry_price = (num_shares * entry_price + v_quantity * v_close)
                           / (num_shares + v_quantity)
       where id = v_open_position.id;
    else
      insert into public.paper_trading_positions (
        user_id, account_id, code, entry_price, entry_date, num_shares, status
      ) values (
        p_user, v_account.id, v_order.code, v_close, p_date_marche, v_quantity, 'open'
      );
    end if;
  elsif v_quantity > 0 then
    v_new_reserved_shares := greatest(0, v_new_reserved_shares - v_quantity);
    v_sale_remaining := v_quantity;
    v_pnl := 0;

    for v_position in
      select * from public.paper_trading_positions
       where account_id = v_account.id and code = v_order.code and status = 'open'
       order by entry_date, id for update
    loop
      exit when v_sale_remaining = 0;
      v_sale_quantity := least(v_position.num_shares::bigint, v_sale_remaining);
      v_days_held := greatest(0, p_date_marche - v_position.entry_date);
      if v_sale_quantity = v_position.num_shares then
        update public.paper_trading_positions
           set status = 'closed',
               exit_price = v_close,
               exit_date = p_date_marche,
               pnl = (v_close - v_position.entry_price) * v_sale_quantity,
               pnl_pct = ((v_close - v_position.entry_price) / v_position.entry_price) * 100,
               days_held = v_days_held
         where id = v_position.id;
      else
        update public.paper_trading_positions
           set num_shares = num_shares - v_sale_quantity
         where id = v_position.id;
        insert into public.paper_trading_positions (
          user_id, account_id, code, entry_price, entry_date, entry_signal_id,
          num_shares, exit_price, exit_date, status, pnl, pnl_pct, days_held
        ) values (
          p_user, v_account.id, v_position.code, v_position.entry_price,
          v_position.entry_date, v_position.entry_signal_id, v_sale_quantity,
          v_close, p_date_marche, 'closed',
          (v_close - v_position.entry_price) * v_sale_quantity,
          ((v_close - v_position.entry_price) / v_position.entry_price) * 100,
          v_days_held
        );
      end if;
      v_pnl := v_pnl + (v_close - v_position.entry_price) * v_sale_quantity;
      v_sale_remaining := v_sale_remaining - v_sale_quantity;
    end loop;

    if v_sale_remaining > 0 then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_SHARES');
    end if;

    select coalesce(sum(pnl), 0) into v_pnl_total
      from public.paper_trading_positions
     where account_id = v_account.id and status = 'closed';
    v_pnl_pct := case when v_account.capital_initial > 0
      then v_pnl_total / v_account.capital_initial * 100 else 0 end;
    update public.paper_trading_accounts
       set pnl_total = v_pnl_total,
           pnl_pct = v_pnl_pct,
           capital_current = v_account.capital_initial + v_pnl_total
     where id = v_account.id;
  end if;

  if v_quantity > 0 then
    insert into public.paper_trading_fills (
      user_id, account_id, order_id, code, date_marche, quantity,
      price, execution_mode, boc_date
    ) values (
      p_user, v_account.id, v_order.id, v_order.code, p_date_marche, v_quantity,
      v_close, v_order.execution_mode, v_order.boc_date
    ) returning * into v_fill;
  end if;

  if v_quantity = 0 then
    v_next_status := case
      when v_reason in ('insufficient_reserved_cash', 'reserved_shares_exhausted') then 'cancelled'
      when v_evaluated_sessions >= v_order.expires_after_sessions then 'expired'
      else 'pending'
    end;
  elsif v_order.filled_quantity + v_quantity >= v_order.quantity then
    v_next_status := 'filled';
  elsif (v_order.side = 'buy' and v_new_reserved_cash < v_close)
     or (v_order.side = 'sell' and v_new_reserved_shares = 0) then
    v_next_status := 'cancelled';
  elsif v_evaluated_sessions >= v_order.expires_after_sessions then
    v_next_status := 'expired';
  else
    v_next_status := 'partial';
  end if;

  if v_next_status in ('filled', 'expired', 'cancelled') then
    v_new_reserved_cash := 0;
    v_new_reserved_shares := 0;
  end if;
  if v_quantity > 0 then
    v_reason := case v_next_status
      when 'filled' then 'filled'
      when 'expired' then 'validity_expired'
      when 'cancelled' then 'reservation_exhausted'
      else 'partial_fill'
    end;
  elsif v_next_status = 'expired' then
    v_reason := 'validity_expired';
  elsif v_next_status = 'cancelled' and v_reason not in ('insufficient_reserved_cash', 'reserved_shares_exhausted') then
    v_reason := 'reservation_exhausted';
  end if;

  update public.paper_trading_orders
     set status = v_next_status,
         filled_quantity = filled_quantity + v_quantity,
         evaluated_sessions = v_evaluated_sessions,
         last_evaluated_date = p_date_marche,
         reserved_cash_remaining = v_new_reserved_cash,
         reserved_shares_remaining = v_new_reserved_shares,
         waiting_reason = v_reason
   where id = v_order.id
   returning * into v_order;

  return jsonb_build_object(
    'ok', true, 'order', to_jsonb(v_order),
    'fill', case when v_quantity > 0 then to_jsonb(v_fill) else null end
  );
end;
$function$;

revoke execute on function public.paper_placer_ordre(uuid, text, text, text, text, bigint, numeric, integer)
  from public, anon, authenticated;
revoke execute on function public.paper_annuler_ordre(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.paper_marquer_attente_donnees(uuid, uuid, date, text)
  from public, anon, authenticated;
revoke execute on function public.paper_appliquer_remplissage(uuid, uuid, date, bigint, numeric, text)
  from public, anon, authenticated;

grant execute on function public.paper_placer_ordre(uuid, text, text, text, text, bigint, numeric, integer)
  to service_role;
grant execute on function public.paper_annuler_ordre(uuid, uuid)
  to service_role;
grant execute on function public.paper_marquer_attente_donnees(uuid, uuid, date, text)
  to service_role;
grant execute on function public.paper_appliquer_remplissage(uuid, uuid, date, bigint, numeric, text)
  to service_role;
