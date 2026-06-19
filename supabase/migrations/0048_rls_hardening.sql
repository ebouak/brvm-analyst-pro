-- ============================================================================
-- 0048_rls_hardening.sql — CORRECTIF SÉCURITÉ P0
-- La migration 0041 (admin/billing/rbac) a créé 13 tables sans activer la RLS,
-- + brvm_reference (0014) également sans RLS. Or Supabase accorde par défaut
-- l'accès `anon` au schéma public → ces tables étaient LISIBLES par n'importe qui
-- via la clé anon (présente dans le bundle client). Données concernées :
-- abonnements, transactions de facturation, journaux d'audit admin, rôles admin.
--
-- Correctif : activer la RLS partout + policies minimales conformes aux usages
-- réels (vérifiés) :
--   - admin_* et scraper_* : lus UNIQUEMENT via service_role (rbac/lib/admin) →
--     RLS activée SANS policy = anon/authenticated refusés, service_role outrepasse.
--   - subscriptions / billing_transactions : lecture propriétaire (la route
--     /api/account/export les lit via la session utilisateur) ; l'admin les lit
--     via service_role (outrepasse).
--   - organizations / organization_members : gérés via service_role (lib/admin) →
--     RLS sans policy.
--   - brvm_reference : données référentielles de marché → lecture publique.
-- Idempotent.
-- ============================================================================

alter table public.admin_roles            enable row level security;
alter table public.admin_permissions      enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles       enable row level security;
alter table public.admin_audit_logs       enable row level security;
alter table public.scraper_sources        enable row level security;
alter table public.scraper_runs           enable row level security;
alter table public.scraper_run_steps      enable row level security;
alter table public.scraper_errors         enable row level security;
alter table public.organizations          enable row level security;
alter table public.organization_members   enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.billing_transactions   enable row level security;
alter table public.brvm_reference         enable row level security;

-- Lecture propriétaire pour les tables exposées à la session utilisateur
-- (export RGPD). L'admin passe par service_role qui outrepasse la RLS.
drop policy if exists "subscriptions_owner_read" on public.subscriptions;
create policy "subscriptions_owner_read" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "billing_owner_read" on public.billing_transactions;
create policy "billing_owner_read" on public.billing_transactions
  for select using (auth.uid() = user_id);

-- Données référentielles de marché : lecture publique (comme les autres brvm_*).
drop policy if exists "brvm_reference_public_read" on public.brvm_reference;
create policy "brvm_reference_public_read" on public.brvm_reference
  for select using (true);

-- Les tables admin_*, scraper_*, organizations, organization_members n'ont
-- volontairement AUCUNE policy : seul le service_role (serveur) y accède.
