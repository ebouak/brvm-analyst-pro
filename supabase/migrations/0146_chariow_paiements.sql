-- 0146 — Paiements Chariow : niveaux de l'Academy à l'unité et pass premium.
-- Doc : docs/CHARIOW_PAYMENTS.md
--
-- ADDITIVE : aucune table ni colonne supprimée, aucune donnée réécrite. La
-- seule contrainte retouchée (billing_transactions_objet_check) est ÉLARGIE.
--
-- RGPD
--   Données : droits d'accès achetés (user_entitlements), journal des
--   notifications de paiement (payment_webhook_events, SANS email, nom ni
--   téléphone du client : seulement type d'événement et références de vente).
--   Finalité : exécution du contrat (accès au contenu acheté).
--   Base légale : contrat. Conservation : droits = durée du compte (cascade
--   auth.users) ; journal = 12 mois (purge_rgpd_retention).
--   Droits : export (/api/account/export) et suppression (cascade).

-- ── 1. Transactions : rattachement à la vente Chariow ─────────────────────────
alter table public.billing_transactions add column if not exists provider_sale_id text;
alter table public.billing_transactions add column if not exists product_code text;

-- Une vente Chariow ne peut appartenir qu'à UNE transaction : c'est ce qui rend
-- impossible un double accès né d'une double notification.
create unique index if not exists billing_transactions_provider_sale_uidx
  on public.billing_transactions (provider, provider_sale_id)
  where provider_sale_id is not null;

-- Élargie (jamais restreinte) : 'module' = niveau de l'Academy, 'pass' = pass premium.
alter table public.billing_transactions drop constraint if exists billing_transactions_objet_check;
alter table public.billing_transactions
  add constraint billing_transactions_objet_check
  check (objet in ('abonnement', 'formation', 'module', 'pass'));

-- ── 2. Catalogue : la SEULE source des prix et des identifiants Chariow ──────
-- Le navigateur n'envoie qu'un product_code. Prix, devise et identifiant
-- Chariow sont lus ici, côté serveur. Éditable par SQL sans déploiement.
create table if not exists public.chariow_products (
  product_code       text primary key check (product_code ~ '^[a-z0-9:_-]{3,60}$'),
  kind               text not null check (kind in ('module', 'upgrade', 'pass')),
  libelle            text not null check (char_length(libelle) between 3 and 120),
  -- prd_… ou slug Chariow. Null = produit pas encore créé chez Chariow.
  chariow_product_id text check (chariow_product_id is null or char_length(chariow_product_id) between 3 and 120),
  niveau             text check (niveau in ('debutant', 'intermediaire', 'avance', 'expert')),
  plan_code          text,
  cycle              text check (cycle in ('monthly', 'quarterly', 'yearly')),
  amount             numeric(12,2) not null check (amount > 0),
  currency           text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  active             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chariow_products_forme check (
    (kind in ('module', 'upgrade') and niveau is not null and plan_code is null and cycle is null)
    or (kind = 'pass' and niveau is null and plan_code is not null and cycle is not null)
  ),
  -- Un produit ne se vend pas tant qu'il n'existe pas chez Chariow.
  constraint chariow_products_vendable check (not active or chariow_product_id is not null)
);

alter table public.chariow_products enable row level security;
-- Aucune policy : lu par le serveur (service_role) uniquement.

-- Pass : amorcés depuis les VRAIS prix de subscription_plans, INACTIFS et sans
-- identifiant Chariow. Les niveaux de l'Academy ne sont pas amorcés : aucun
-- prix n'a encore été décidé, et on n'en invente pas.
insert into public.chariow_products (product_code, kind, libelle, plan_code, cycle, amount, currency, active)
select 'pass:' || p.code || ':' || c.cycle,
       'pass',
       p.name || ' — ' || case c.cycle when 'monthly' then '1 mois' when 'quarterly' then '3 mois' else '12 mois' end,
       p.code,
       c.cycle,
       c.prix,
       coalesce(p.currency, 'XOF'),
       false
  from public.subscription_plans p
 cross join lateral (values
         ('monthly',   p.price_monthly),
         ('quarterly', p.price_quarterly),
         ('yearly',    p.price_yearly)) as c(cycle, prix)
 where p.code in ('premium', 'platinium')
   and c.prix is not null and c.prix > 0
on conflict (product_code) do nothing;

-- ── 3. Droits d'accès achetés ─────────────────────────────────────────────────
create table if not exists public.user_entitlements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  product_code   text not null,
  niveau         text check (niveau in ('debutant', 'intermediaire', 'avance', 'expert')),
  source         text not null check (source in ('chariow', 'admin')),
  source_ref     text,                    -- sal_… pour une vente Chariow
  transaction_id uuid references public.billing_transactions(id) on delete set null,
  granted_at     timestamptz not null default now(),
  expires_at     timestamptz,             -- null = à vie
  revoked_at     timestamptz,
  revoke_reason  text check (revoke_reason is null or char_length(revoke_reason) <= 300),
  created_at     timestamptz not null default now()
);

-- Une vente = un droit, quel que soit le nombre de notifications reçues.
create unique index if not exists user_entitlements_source_uidx
  on public.user_entitlements (source, source_ref)
  where source_ref is not null;
create index if not exists user_entitlements_user_idx on public.user_entitlements (user_id);

alter table public.user_entitlements enable row level security;
drop policy if exists "user_entitlements_owner_read" on public.user_entitlements;
create policy "user_entitlements_owner_read" on public.user_entitlements
  for select to authenticated
  using (user_id = auth.uid());
-- Aucune policy d'écriture : un utilisateur ne peut pas s'accorder un droit.

-- ── 4. Journal des notifications (Pulses Chariow) ─────────────────────────────
create table if not exists public.payment_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null default 'chariow',
  delivery_id    text not null,           -- x-pulse-delivery-id : clé d'idempotence
  event_type     text not null check (char_length(event_type) <= 60),
  sale_id        text check (sale_id is null or char_length(sale_id) <= 120),
  transaction_id uuid references public.billing_transactions(id) on delete set null,
  status         text not null default 'recu'
                 check (status in ('recu', 'traite', 'ignore', 'orphelin', 'rejete', 'a_verifier', 'erreur')),
  detail         text check (detail is null or char_length(detail) <= 500),
  attempts       int not null default 1,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  constraint payment_webhook_events_delivery_uniq unique (provider, delivery_id)
);
create index if not exists payment_webhook_events_status_idx
  on public.payment_webhook_events (status, received_at desc);

alter table public.payment_webhook_events enable row level security;
-- Aucune policy : service_role uniquement.

-- ── 5. Academy : date de refonte majeure, et fermeture du contenu ─────────────
-- Règle produit (2026-09-29) : un niveau acheté l'est à vie, SAUF une refonte
-- majeure publiée plus de 12 mois après l'achat (rachat à prix réduit).
alter table public.academy_courses add column if not exists refonte_majeure_le timestamptz;

-- FUITE CORRIGÉE : la policy academy_courses_public_read (0059) laissait lire
-- `content` et `html` — le cours entier — à la clé anon, sans compte ni
-- abonnement. Tous les lecteurs applicatifs passent par service_role (vérifié) :
-- on ne laisse à anon/authenticated que les colonnes de vitrine.
revoke select on public.academy_courses from anon, authenticated;
grant select (id, slug, titre, niveau, resume, published, created_at, updated_at, refonte_majeure_le)
  on public.academy_courses to anon, authenticated;

-- ── 6. Abonnements : origine et suivi des pass ────────────────────────────────
alter table public.subscriptions add column if not exists source text;               -- 'chariow' pour un pass
alter table public.subscriptions add column if not exists rappel_expiration_at timestamptz;
alter table public.subscriptions add column if not exists expired_at timestamptz;
create index if not exists subscriptions_pass_actifs_idx
  on public.subscriptions (renews_at)
  where source = 'chariow' and status = 'active';

-- ── 7. Accorder un achat : UNE transaction SQL, idempotente ───────────────────
-- Appelée par le webhook APRÈS vérification de la vente auprès de Chariow, et
-- par la console admin (confirmation manuelle). Le verrou FOR UPDATE sérialise
-- deux notifications simultanées de la même vente : la seconde voit 'paid' et
-- sort sans rien écrire.
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

  if prod.kind in ('module', 'upgrade') then
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

-- ── 7 bis. Révoquer un achat (remboursement) ─────────────────────────────────
-- Chariow n'émet AUCUN événement de remboursement : la révocation est une
-- action d'administration (/admin/payments). Atomique, idempotente.
-- Pass : on retire la période PAYÉE par cette transaction (un pass prolongé
-- par plusieurs achats ne perd que la part remboursée).
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
    return 'module_revoque';
  end if;

  select * into prod from public.chariow_products where product_code = t.product_code;
  v_pas := case prod.cycle when 'yearly' then interval '1 year'
                           when 'quarterly' then interval '3 months'
                           else interval '1 month' end;
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
  return 'pass_revoque';
end $$;
revoke execute on function public.revoquer_achat(uuid, text) from public, anon, authenticated;

-- ── 8. Expiration des pass Chariow (et d'eux seuls) ───────────────────────────
-- Les abonnements manuels/CinetPay ne sont PAS touchés : leur `renews_at` n'a
-- jamais été appliqué, l'appliquer rétroactivement couperait des clients
-- actuels. Décision à prendre à part (voir docs/CHARIOW_PAYMENTS.md §8).
create or replace function public.expirer_pass_chariow()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
  r record;
begin
  for r in
    update public.subscriptions
       set status = 'expired', expired_at = now()
     where source = 'chariow' and status = 'active' and renews_at < now()
    returning user_id
  loop
    n := n + 1;
    -- Premium retiré seulement si plus AUCUN abonnement payant actif ne le justifie.
    update public.profiles p
       set is_premium = false, updated_at = now()
     where p.id = r.user_id
       and not exists (
         select 1 from public.subscriptions s
           join public.subscription_plans pl on pl.id = s.plan_id
          where s.user_id = r.user_id and s.status = 'active' and pl.code <> 'free');
  end loop;
  return n;
end $$;
revoke execute on function public.expirer_pass_chariow() from public, anon, authenticated;

-- ── 9. Rétention : journal des notifications 12 mois ─────────────────────────
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
