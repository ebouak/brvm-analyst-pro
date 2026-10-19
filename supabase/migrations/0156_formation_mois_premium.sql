-- ============================================================================
-- 0156_formation_mois_premium.sql
-- Décision du 2026-10-19 : l'achat de la formation complète (academy:integrale,
-- 0155) donne AUSSI un mois d'accès Premium.
--
-- accorder_achat : la vente d'une formation écrit le droit à vie (comme en
-- 0155) PUIS ouvre — ou prolonge, s'il en court déjà un — un abonnement
-- Premium Chariow d'un mois, exactement comme un pass mensuel. L'expiration
-- (expirer_pass_chariow, cron pass.yml) et le rappel J-7 s'appliquent sans
-- changement : ce mois est un abonnement de source « chariow ».
--
-- revoquer_achat (remboursement) : une formation remboursée perd son droit ET
-- le mois offert (retiré de l'échéance ; le Premium tombe s'il n'est plus
-- justifié par aucun autre abonnement actif).
--
-- Idempotence inchangée : statut « paid » sous verrou FOR UPDATE, un droit par
-- vente (unique source, source_ref). Valeurs de retour inchangées
-- (module_accorde / pass_accorde / deja…), donc aucun changement du webhook.
-- Rejouable.
-- ============================================================================

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

  update public.billing_transactions
     set status = 'paid', paid_at = now(),
         provider_sale_id = coalesce(provider_sale_id, p_sale)
   where id = t.id;

  if prod.kind in ('module', 'upgrade', 'formation') then
    insert into public.user_entitlements (user_id, product_code, niveau, source, source_ref, transaction_id)
    values (t.user_id, prod.product_code, prod.niveau, 'chariow',
            coalesce(t.provider_sale_id, p_sale, t.id::text), t.id)
    on conflict (source, source_ref) where source_ref is not null do nothing;
    if prod.kind <> 'formation' then return 'module_accorde'; end if;
    -- Formation : un mois Premium offert, traité comme un pass mensuel.
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

  -- Racheter avant l'échéance PROLONGE l'abonnement en cours : aucun jour perdu.
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

create or replace function public.revoquer_achat(p_transaction uuid, p_motif text default 'remboursement')
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t    public.billing_transactions%rowtype;
  prod public.chariow_products%rowtype;
  v_pas interval;
  v_fin timestamptz;
begin
  select * into t from public.billing_transactions where id = p_transaction for update;
  if not found then return 'introuvable'; end if;
  if t.status = 'refunded' then return 'deja'; end if;
  if t.status <> 'paid' then return 'statut_' || t.status; end if;
  if t.objet not in ('module', 'pass') then return 'objet_' || t.objet; end if;

  update public.billing_transactions set status = 'refunded' where id = t.id;

  if t.objet = 'module' then
    update public.user_entitlements
       set revoked_at = now(), revoke_reason = left(coalesce(p_motif, 'remboursement'), 300)
     where transaction_id = t.id and revoked_at is null;
    -- Un niveau seul n'a pas d'abonnement ; la formation a son mois offert.
    if t.subscription_id is null then return 'module_revoque'; end if;
    v_pas := interval '1 month';
  else
    select * into prod from public.chariow_products where product_code = t.product_code;
    v_pas := case prod.cycle when 'yearly' then interval '1 year'
                             when 'quarterly' then interval '3 months'
                             else interval '1 month' end;
  end if;

  update public.subscriptions
     set renews_at = renews_at - v_pas
   where id = t.subscription_id
  returning renews_at into v_fin;

  if v_fin is not null and v_fin <= now() then
    update public.subscriptions
       set status = 'canceled', canceled_at = now()
     where id = t.subscription_id;
    update public.profiles p
       set is_premium = false, updated_at = now()
     where p.id = t.user_id
       and not exists (
         select 1 from public.subscriptions s
           join public.subscription_plans pl on pl.id = s.plan_id
          where s.user_id = t.user_id and s.status = 'active' and pl.code <> 'free');
  end if;
  return case when t.objet = 'module' then 'module_revoque' else 'pass_revoque' end;
end $$;
revoke execute on function public.revoquer_achat(uuid, text) from public, anon, authenticated;

-- Libellé du produit : il annonce désormais le mois Premium.
update public.chariow_products
   set libelle = 'WestBourse Academy — formation complète (4 niveaux) + 1 mois Premium', updated_at = now()
 where product_code = 'academy:integrale';
