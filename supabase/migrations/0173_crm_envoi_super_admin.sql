-- 0173 — CRM : l'envoi de relances commerciales (crm.write) est réservé au
-- super-admin (décision de l'exploitant, 2026-11-01). support_admin garde la
-- lecture (crm.read) : il voit les fiches, il ne relance pas.
-- Idempotent : relancer ne supprime rien de plus.

delete from public.admin_role_permissions rp
using public.admin_roles r, public.admin_permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'support_admin'
  and p.code = 'crm.write';
