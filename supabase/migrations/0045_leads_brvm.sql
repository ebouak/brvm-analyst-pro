-- ============================================================================
-- 0045 — Leads BRVM (tunnel débutant /debutant → inbox partenaire /admin/leads)
--
-- DONNÉES PERSONNELLES (RGPD by design) :
--   • Collecte : nom, email, téléphone, pays, message d'un prospect débutant.
--   • Finalité : mise en relation avec un partenaire habilité (ouverture compte BRVM).
--   • Base légale : CONSENTEMENT explicite (case à cocher + consent_at horodaté serveur).
--   • Rétention : nouveau/contacte 24 mois · perdu 6 mois · converti longue durée
--     (relation contractuelle, suppression manuelle). Purge mensuelle pg_cron.
--   • Droits : accès/rectif/suppression via le partenaire (données non liées à un
--     compte auth — pas couvert par /api/account/export, c'est voulu).
--
-- SÉCURITÉ (RLS) :
--   • INSERT autorisé à anon + authenticated (soumission du formulaire public).
--   • AUCUNE policy SELECT/UPDATE/DELETE → lecture/écriture admin via service_role
--     uniquement (lib/admin/leads.ts). La clé anon ne peut JAMAIS lire un lead.
-- ============================================================================

create table if not exists public.leads_brvm (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null,
  email text not null,
  telephone text,
  pays text,
  message text,
  niveau text check (niveau in ('debutant','intermediaire','confirme')),
  source text not null default 'landing_debutant',
  statut text not null default 'nouveau'
    check (statut in ('nouveau','contacte','converti','perdu')),
  consent boolean not null default false,
  consent_at timestamptz
);

-- Index pour les purges RGPD et le filtre/ordre de l'inbox admin.
create index if not exists leads_brvm_statut_created_idx
  on public.leads_brvm (statut, created_at desc);

-- ── RLS : insert public, lecture service_role uniquement ────────────────────
alter table public.leads_brvm enable row level security;

do $$ begin
  create policy "Soumission d'un lead (anon + authenticated)"
    on public.leads_brvm for insert
    to anon, authenticated
    with check (true);
exception when duplicate_object then null; end $$;
-- Pas de policy select/update/delete : service_role seulement.

-- ── RBAC : permissions + rôle partenaire ───────────────────────────────────
insert into public.admin_permissions (code, label) values
  ('leads.read','Voir les leads BRVM'),
  ('leads.write','Modifier le statut des leads BRVM')
on conflict (code) do nothing;

insert into public.admin_roles (code, label) values
  ('partenaire','Partenaire SGI')
on conflict (code) do nothing;

-- super_admin : toutes les permissions (inclut les nouvelles).
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('leads.read','leads.write')
where r.code = 'super_admin'
on conflict do nothing;

-- partenaire : accès complet aux leads, rien d'autre.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('leads.read','leads.write')
where r.code = 'partenaire'
on conflict do nothing;

-- support_admin : lecture des leads (consultation).
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('leads.read')
where r.code = 'support_admin'
on conflict do nothing;

-- ── Rétention RGPD : purge mensuelle par statut ─────────────────────────────
create or replace function public.purge_leads_brvm()
returns void language plpgsql as $$
begin
  delete from public.leads_brvm
  where statut in ('nouveau','contacte')
    and created_at < now() - interval '24 months';

  delete from public.leads_brvm
  where statut = 'perdu'
    and created_at < now() - interval '6 months';

  -- 'converti' : conservation longue durée (relation contractuelle), purge manuelle.
end;
$$;

-- Planification pg_cron (tolérante si l'extension n'est pas disponible).
do $$
begin
  perform cron.unschedule('purge-leads-brvm');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('purge-leads-brvm', '0 3 1 * *', 'select public.purge_leads_brvm()');
exception when others then null;
end $$;
