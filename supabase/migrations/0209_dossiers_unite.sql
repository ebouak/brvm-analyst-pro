-- Dossiers valeur vendus à l’unité via un SKU Chariow générique.
-- Aucun droit n'est accordé avant la relecture de la vente signée. Le code
-- société appartient à la transaction, jamais au produit Chariow partagé.

alter table public.billing_transactions add column if not exists subject_code text;
alter table public.billing_transactions
  drop constraint if exists billing_transactions_subject_code;
alter table public.billing_transactions
  add constraint billing_transactions_subject_code
  check (subject_code is null or subject_code ~ '^[A-Z0-9]{2,8}$');

alter table public.chariow_products drop constraint if exists chariow_products_kind_check;
alter table public.chariow_products
  add constraint chariow_products_kind_check
  check (kind in ('module', 'upgrade', 'pass', 'formation', 'dossier'));

alter table public.chariow_products drop constraint if exists chariow_products_forme;
alter table public.chariow_products
  add constraint chariow_products_forme check (
    (kind in ('module', 'upgrade') and niveau is not null and plan_code is null and cycle is null)
    or (kind in ('formation', 'dossier') and niveau is null and plan_code is null and cycle is null)
    or (kind = 'pass' and niveau is null and plan_code is not null and cycle is not null)
  );

insert into public.chariow_products (
  product_code, kind, libelle, chariow_product_id, amount, currency, active
) values (
  'dossier:a4', 'dossier',
  'Dossier valeur WESTBOURSE — 1 société', 'prd_j5jkzord', 1500, 'XOF', true
) on conflict (product_code) do update
set kind = excluded.kind,
    libelle = excluded.libelle,
    chariow_product_id = excluded.chariow_product_id,
    amount = excluded.amount,
    currency = excluded.currency,
    active = excluded.active,
    updated_at = now();

create or replace function public.accorder_achat(p_transaction uuid, p_sale text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t       public.billing_transactions%rowtype;
  prod    public.chariow_products%rowtype;
  v_plan  uuid;
  v_sub   uuid;
  v_fin   timestamptz;
  v_pas   interval;
  v_code  text;
  v_cycle text;
begin
  select * into t from public.billing_transactions where id = p_transaction for update;
  if not found then return 'introuvable'; end if;
  if t.status = 'paid' then return 'deja'; end if;
  if t.status not in ('pending', 'failed') then return 'statut_' || t.status; end if;
  if t.objet not in ('module', 'pass') then return 'objet_' || t.objet; end if;

  select * into prod from public.chariow_products where product_code = t.product_code;
  if not found then return 'produit_inconnu'; end if;
  if prod.kind = 'dossier' and t.subject_code is null then
    return 'code_sujet_absent';
  end if;

  update public.billing_transactions
     set status = 'paid', paid_at = now(),
         provider_sale_id = coalesce(provider_sale_id, p_sale)
   where id = t.id;

  if prod.kind = 'dossier' then
    insert into public.user_entitlements (
      user_id, product_code, niveau, source, source_ref, transaction_id
    ) values (
      t.user_id, 'dossier:' || t.subject_code, null, 'chariow',
      coalesce(t.provider_sale_id, p_sale, t.id::text), t.id
    )
    on conflict (source, source_ref) where source_ref is not null do nothing;
    return 'dossier_accorde';
  end if;

  if prod.kind in ('module', 'upgrade', 'formation') then
    insert into public.user_entitlements (user_id, product_code, niveau, source, source_ref, transaction_id)
    values (t.user_id, prod.product_code, prod.niveau, 'chariow',
            coalesce(t.provider_sale_id, p_sale, t.id::text), t.id)
    on conflict (source, source_ref) where source_ref is not null do nothing;
    if prod.kind <> 'formation' then return 'module_accorde'; end if;
    v_code := 'premium';
    v_cycle := 'monthly';
  else
    v_code := prod.plan_code;
    v_cycle := prod.cycle;
  end if;

  select id into v_plan from public.subscription_plans where code = v_code;
  if v_plan is null then raise exception 'plan % introuvable', v_code; end if;
  v_pas := case v_cycle when 'yearly' then interval '1 year'
                        when 'quarterly' then interval '3 months'
                        else interval '1 month' end;

  select id, renews_at into v_sub, v_fin
    from public.subscriptions
   where user_id = t.user_id and plan_id = v_plan and status = 'active' and source = 'chariow'
   order by renews_at desc nulls last
   limit 1
   for update;

  if v_sub is not null then
    update public.subscriptions
       set renews_at = greatest(now(), coalesce(v_fin, now())) + v_pas,
           rappel_expiration_at = null
     where id = v_sub;
  else
    insert into public.subscriptions (user_id, plan_id, status, billing_cycle, started_at, renews_at, source)
    values (t.user_id, v_plan, 'active', v_cycle, now(), now() + v_pas, 'chariow')
    returning id into v_sub;
  end if;

  update public.billing_transactions set subscription_id = v_sub where id = t.id;
  update public.profiles
     set is_premium = true, premium_since = coalesce(premium_since, now()), updated_at = now()
   where id = t.user_id;
  return case when prod.kind = 'formation' then 'module_accorde' else 'pass_accorde' end;
end $$;
revoke execute on function public.accorder_achat(uuid, text) from public, anon, authenticated;
