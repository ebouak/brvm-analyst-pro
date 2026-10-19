-- ============================================================================
-- 0155_chariow_formation_integrale.sql
-- Décision du 2026-10-19 : l'Academy ENTIÈRE (les quatre niveaux, leurs
-- examens et certificats) s'ouvre à tout abonné Premium OU à tout acheteur de
-- « la formation » — UN seul produit Chariow (prd_48iuli9l), pas de produit
-- par niveau.
--
-- 0146 ne connaissait que des produits À UN NIVEAU (kind module/upgrade, niveau
-- obligatoire). On ajoute le type `formation` : ni niveau, ni plan, ni cycle.
-- La vente d'une formation suit la branche « module » d'accorder_achat : UN
-- droit (product_code academy:integrale, niveau NULL), idempotent par vente
-- grâce à unique (source, source_ref) comme avant. Le code applicatif
-- (lib/billing/chariow/regles.ts, niveauxDesDroits) traduit ce droit en
-- quatre niveaux, chacun soumis à la règle de refonte (> 12 mois).
--
-- Remboursement : revoquer_achat révoque déjà les droits par transaction pour
-- tout objet « module » — rien à changer.
-- Aucune donnée existante n'est modifiée (aucune vente Chariow au 2026-10-19).
-- Idempotente : peut être rejouée.
-- ============================================================================

alter table public.chariow_products drop constraint if exists chariow_products_kind_check;
alter table public.chariow_products
  add constraint chariow_products_kind_check
  check (kind in ('module', 'upgrade', 'pass', 'formation'));

alter table public.chariow_products drop constraint if exists chariow_products_forme;
alter table public.chariow_products
  add constraint chariow_products_forme check (
    (kind in ('module', 'upgrade') and niveau is not null and plan_code is null and cycle is null)
    or (kind = 'formation' and niveau is null and plan_code is null and cycle is null)
    or (kind = 'pass' and niveau is null and plan_code is not null and cycle is not null)
  );

-- accorder_achat : identique à 0146, sauf la branche des droits, qui accepte
-- désormais le type `formation` (droit à niveau NULL).
create or replace function public.accorder_achat(p_transaction uuid, p_sale text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t      public.billing_transactions%rowtype;
  prod   public.chariow_products%rowtype;
  v_plan uuid;
  v_sub  uuid;
  v_fin  timestamptz;
  v_pas  interval;
begin
  select * into t from public.billing_transactions where id = p_transaction for update;
  if not found then return 'introuvable'; end if;
  if t.status = 'paid' then return 'deja'; end if;
  if t.status not in ('pending', 'failed') then return 'statut_' || t.status; end if;
  if t.objet not in ('module', 'pass') then return 'objet_' || t.objet; end if;

  select * into prod from public.chariow_products where product_code = t.product_code;
  if not found then return 'produit_inconnu'; end if;

  update public.billing_transactions
     set status = 'paid', paid_at = now(),
         provider_sale_id = coalesce(provider_sale_id, p_sale)
   where id = t.id;

  if prod.kind in ('module', 'upgrade', 'formation') then
    insert into public.user_entitlements (user_id, product_code, niveau, source, source_ref, transaction_id)
    values (t.user_id, prod.product_code, prod.niveau, 'chariow',
            coalesce(t.provider_sale_id, p_sale, t.id::text), t.id)
    on conflict (source, source_ref) where source_ref is not null do nothing;
    return 'module_accorde';
  end if;

  -- Pass premium
  select id into v_plan from public.subscription_plans where code = prod.plan_code;
  if v_plan is null then raise exception 'plan % introuvable', prod.plan_code; end if;
  v_pas := case prod.cycle when 'yearly' then interval '1 year'
                           when 'quarterly' then interval '3 months'
                           else interval '1 month' end;

  -- Racheter avant l'échéance PROLONGE le pass en cours : aucun jour perdu.
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
    values (t.user_id, v_plan, 'active', prod.cycle, now(), now() + v_pas, 'chariow')
    returning id into v_sub;
  end if;

  update public.billing_transactions set subscription_id = v_sub where id = t.id;
  update public.profiles
     set is_premium = true, premium_since = coalesce(premium_since, now()), updated_at = now()
   where id = t.user_id;
  return 'pass_accorde';
end $$;
revoke execute on function public.accorder_achat(uuid, text) from public, anon, authenticated;
