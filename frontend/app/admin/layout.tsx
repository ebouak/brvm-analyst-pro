import { requireAdmin, can } from '@/lib/server/rbac';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const items = ADMIN_NAV.filter((it) => !it.permission || can(ctx, it.permission));

  return (
    <AdminShell items={items} email={ctx.email} roles={ctx.roles}>
      {children}
    </AdminShell>
  );
}
