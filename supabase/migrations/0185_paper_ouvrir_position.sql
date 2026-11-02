-- Audit sécurité : course sur le plafond d'exposition du paper trading (0182).
-- N requêtes POST /api/paper-trading/positions parallèles lisaient toutes le même
-- « disponible » avant d'insérer : chacune passait le plafond et l'exposition
-- cumulée le dépassait (levier artificiel, donc P&L % falsifiable au classement).
--
-- Correctif : contrôle du plafond + insertion/renfort dans UNE fonction qui verrouille
-- la ligne du compte (select … for update) : les appels concurrents d'un même
-- compte sont sérialisés et recalculent l'exposition à jour.
--
-- Sécurité : SECURITY DEFINER, exécutable par service_role SEUL (revoke des TROIS
-- rôles public/anon/authenticated). La route lui passe l'identifiant de la session.
-- Idempotent.

create or replace function public.paper_ouvrir_position(
  p_user   uuid,
  p_code   text,
  p_amount numeric default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account  public.paper_trading_accounts%rowtype;
  v_prix     numeric;
  v_date     date;
  v_engage   numeric;
  v_dispo    numeric;
  v_montant  numeric;
  v_nb       numeric;
  v_exist    public.paper_trading_positions%rowtype;
  v_total    numeric;
  v_pru      numeric;
  v_pos      public.paper_trading_positions%rowtype;
begin
  -- Verrou du compte : sérialise les ouvertures concurrentes de cet utilisateur.
  select * into v_account from public.paper_trading_accounts
   where user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NO_ACCOUNT');
  end if;

  select cours_jour, date_marche into v_prix, v_date
    from public.brvm_actions_daily
   where code = p_code
   order by date_marche desc limit 1;
  if v_prix is null or v_prix <= 0 then
    return jsonb_build_object('ok', false, 'error', 'NO_QUOTE');
  end if;

  select coalesce(sum(num_shares * entry_price), 0) into v_engage
    from public.paper_trading_positions
   where account_id = v_account.id and status = 'open';

  v_dispo   := greatest(0, v_account.capital_current - v_engage);
  v_montant := least(coalesce(p_amount, v_account.capital_current * 0.1), v_dispo);
  v_nb      := floor(v_montant / v_prix);
  if v_nb < 1 then
    return jsonb_build_object('ok', false, 'error', 'AMOUNT_TOO_LOW', 'prix', v_prix);
  end if;

  select * into v_exist from public.paper_trading_positions
   where account_id = v_account.id and code = p_code and status = 'open'
   limit 1;

  if found then
    v_total := v_exist.num_shares + v_nb;
    v_pru   := (v_exist.num_shares * v_exist.entry_price + v_nb * v_prix) / v_total;
    update public.paper_trading_positions
       set num_shares = v_total, entry_price = v_pru
     where id = v_exist.id
     returning * into v_pos;
    return jsonb_build_object('ok', true, 'reinforced', true, 'position', to_jsonb(v_pos));
  end if;

  insert into public.paper_trading_positions
    (user_id, account_id, code, entry_price, entry_date, num_shares, status)
  values (p_user, v_account.id, p_code, v_prix, v_date, v_nb, 'open')
  returning * into v_pos;
  return jsonb_build_object('ok', true, 'reinforced', false, 'position', to_jsonb(v_pos));
end;
$function$;

revoke execute on function public.paper_ouvrir_position(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.paper_ouvrir_position(uuid, text, numeric) to service_role;
