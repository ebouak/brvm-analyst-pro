-- ============================================================================
-- Lot 1 — Fondations : abonnements/billing, RBAC admin, audit, scraping
-- Base : schéma fourni + organizations/members + RLS + index + seed.
--
-- SÉCURITÉ (RLS) :
--   • subscription_plans / plan_features : lecture PUBLIQUE (page /pricing),
--     écriture service_role uniquement.
--   • Toutes les autres tables (billing, subscriptions, admin_*, organizations,
--     scraper_*) : RLS activée SANS policy anon/authenticated → seules les
--     requêtes service_role (backend / pages admin gardées) y accèdent.
--   Aucune donnée sensible n'est exposée au client (clé anon).
-- ============================================================================

-- ── Business : plans & abonnements ─────────────────────────────────────────
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- free, premium, platinium
  name text not null,
  price_monthly numeric(12,2) not null default 0,
  price_yearly numeric(12,2),
  currency text not null default 'XOF',
  is_active boolean not null default true,
  is_recommended boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  feature_key text not null,
  feature_label text not null,
  feature_value text,
  category text,
  sort_order int not null default 0
);
create index if not exists plan_features_plan_idx on public.plan_features(plan_id);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',       -- owner, admin, member
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null,                       -- trialing, active, past_due, canceled, expired
  billing_cycle text not null,                -- monthly, yearly
  started_at timestamptz,
  renews_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,                     -- stripe, cinetpay, paydunya, manual
  provider_txn_id text,
  amount numeric(12,2) not null,
  currency text not null default 'XOF',
  status text not null,                       -- pending, paid, failed, refunded
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists billing_txn_sub_idx on public.billing_transactions(subscription_id);

-- ── RBAC admin ─────────────────────────────────────────────────────────────
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id uuid not null references public.admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.admin_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  target_user_id uuid,
  severity text not null default 'info',      -- info, warning, critical
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists audit_logs_action_idx on public.admin_audit_logs(action);
create index if not exists audit_logs_actor_idx on public.admin_audit_logs(actor_user_id);

-- ── Scraping (audit/monitoring) ────────────────────────────────────────────
create table if not exists public.scraper_sources (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                  -- bdfin-instruments, bdfin-market, brvm-news, brvm-bulletins, intraday
  label text not null,
  is_active boolean not null default true,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.scraper_sources(id),
  trigger_type text not null,                 -- cron, manual, backfill
  status text not null,                       -- running, success, partial, failed
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int,
  rows_extracted int not null default 0,
  rows_upserted int not null default 0,
  error_count int not null default 0,
  metadata jsonb not null default '{}'
);
create index if not exists scraper_runs_source_idx on public.scraper_runs(source_id, started_at desc);
create index if not exists scraper_runs_status_idx on public.scraper_runs(status);

create table if not exists public.scraper_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.scraper_runs(id) on delete cascade,
  step_name text not null,
  status text not null,
  message text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists scraper_steps_run_idx on public.scraper_run_steps(run_id);

create table if not exists public.scraper_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.scraper_runs(id) on delete cascade,
  source_code text,
  error_type text,
  error_message text,
  stack_excerpt text,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scraper_errors_run_idx on public.scraper_errors(run_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Lecture publique : plans + features (pour /pricing).
alter table public.subscription_plans enable row level security;
alter table public.plan_features      enable row level security;
do $$ begin
  create policy "plans lisibles par tous" on public.subscription_plans for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "features lisibles par tous" on public.plan_features for select using (true);
exception when duplicate_object then null; end $$;

-- Tables sensibles : RLS activée, AUCUNE policy → service_role uniquement.
do $$
declare t text;
begin
  foreach t in array array[
    'subscriptions','billing_transactions','organizations','organization_members',
    'admin_roles','admin_permissions','admin_role_permissions','admin_user_roles',
    'admin_audit_logs','scraper_sources','scraper_runs','scraper_run_steps','scraper_errors'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ── Seed : rôles, permissions, mapping ─────────────────────────────────────
insert into public.admin_roles (code, label) values
  ('super_admin','Super administrateur'),
  ('support_admin','Support'),
  ('billing_admin','Facturation'),
  ('data_admin','Données / scraping'),
  ('audit_viewer','Lecture audit')
on conflict (code) do nothing;

insert into public.admin_permissions (code, label) values
  ('users.read','Voir utilisateurs'), ('users.write','Modifier utilisateurs'), ('users.suspend','Suspendre utilisateurs'),
  ('subscriptions.read','Voir abonnements'), ('subscriptions.write','Modifier abonnements'),
  ('billing.read','Voir facturation'), ('billing.refund','Rembourser'),
  ('scraping.read','Voir scraping'), ('scraping.retry','Relancer scraping'), ('scraping.configure','Configurer sources'),
  ('content.read','Voir contenu'), ('content.write','Modifier contenu'), ('content.publish','Publier contenu'),
  ('audit.read','Voir audit'),
  ('settings.read','Voir paramètres'), ('settings.write','Modifier paramètres')
on conflict (code) do nothing;

-- super_admin : toutes les permissions
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r cross join public.admin_permissions p
where r.code = 'super_admin'
on conflict do nothing;

-- support_admin : lectures + suspension utilisateur
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('users.read','users.suspend','subscriptions.read','billing.read','scraping.read','content.read','audit.read','settings.read')
where r.code = 'support_admin'
on conflict do nothing;

-- billing_admin : abonnements + facturation
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('subscriptions.read','subscriptions.write','billing.read','billing.refund','users.read','audit.read')
where r.code = 'billing_admin'
on conflict do nothing;

-- data_admin : scraping + contenu
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('scraping.read','scraping.retry','scraping.configure','content.read','content.write','content.publish','audit.read')
where r.code = 'data_admin'
on conflict do nothing;

-- audit_viewer : lecture audit (+ lectures globales)
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('audit.read','users.read','subscriptions.read','billing.read','scraping.read','content.read','settings.read')
where r.code = 'audit_viewer'
on conflict do nothing;

-- ── Seed : plans (Gratuit / Premium / Platinium) ───────────────────────────
insert into public.subscription_plans (code, name, price_monthly, price_yearly, currency, is_active, is_recommended, sort_order)
values
  ('free','Gratuit',0,0,'XOF',true,false,1),
  ('premium','Premium',15000,150000,'XOF',true,true,2),
  ('platinium','Platinium',50000,500000,'XOF',true,false,3)
on conflict (code) do update set
  name = excluded.name, price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly, is_recommended = excluded.is_recommended,
  sort_order = excluded.sort_order;

-- ── Seed : sources de scraping connues ─────────────────────────────────────
insert into public.scraper_sources (code, label) values
  ('intraday','Cours intraday (brvm.org)'),
  ('bdfin-instruments','BDFIN — instruments'),
  ('bdfin-market','BDFIN — activités marché'),
  ('brvm-news','BRVM — actualités'),
  ('brvm-bulletins','BRVM — bulletins officiels de la cote')
on conflict (code) do nothing;

-- ── Bootstrap : ebouak@gmail.com = super_admin ─────────────────────────────
insert into public.admin_user_roles (user_id, role_id)
select u.id, r.id
from auth.users u cross join public.admin_roles r
where u.email = 'ebouak@gmail.com' and r.code = 'super_admin'
on conflict do nothing;
