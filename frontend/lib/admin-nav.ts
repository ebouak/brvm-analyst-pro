import type { PermissionCode } from '@/lib/server/rbac';

export interface AdminNavItem {
  href: string;
  label: string;
  /** Permission requise pour voir l'entrée (super_admin voit tout). */
  permission?: PermissionCode;
}

/** Console d'administration — source unique du menu. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: "Vue d'ensemble" },
  { href: '/admin/users', label: 'Utilisateurs', permission: 'users.read' },
  { href: '/admin/organizations', label: 'Organisations', permission: 'users.read' },
  { href: '/admin/subscriptions', label: 'Abonnements', permission: 'subscriptions.read' },
  { href: '/admin/payments', label: 'Paiements', permission: 'billing.read' },
  { href: '/admin/scraping', label: 'Scraping', permission: 'scraping.read' },
  { href: '/admin/content', label: 'Contenu', permission: 'content.read' },
  { href: '/admin/formations', label: 'Formations', permission: 'content.read' },
  { href: '/admin/academy', label: 'Academy (IA)', permission: 'content.read' },
  { href: '/admin/weekly', label: 'Rapports hebdo', permission: 'content.read' },
  { href: '/admin/newsletter', label: 'Newsletter', permission: 'content.read' },
  { href: '/admin/leads', label: 'Leads débutants', permission: 'leads.read' },
  { href: '/admin/reports', label: 'Rapports IA', permission: 'content.read' },
  { href: '/admin/audit-logs', label: 'Audit logs', permission: 'audit.read' },
  { href: '/admin/settings', label: 'Paramètres', permission: 'settings.read' },
];

/** Libellé lisible pour le breadcrumb à partir du pathname. */
export function adminBreadcrumb(pathname: string): string {
  const exact = ADMIN_NAV.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const match = [...ADMIN_NAV]
    .filter((i) => i.href !== '/admin' && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? 'Administration';
}
