import { requireAdmin, can } from '@/lib/server/rbac';
import { ADMIN_NAV_GROUPS } from '@/lib/admin-nav';
import { loadAdminBadges } from '@/lib/admin/badges';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const groups = ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => !it.permission || can(ctx, it.permission)),
  })).filter((g) => g.items.length > 0);

  const badges = await loadAdminBadges();

  return (
    <AdminShell groups={groups} badges={badges} email={ctx.email} roles={ctx.roles}>
      {children}
    </AdminShell>
  );
}
