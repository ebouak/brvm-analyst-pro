import type { PermissionCode } from '@/lib/server/rbac';

export type AdminNavGroupId =
  | 'pilotage'
  | 'donnees'
  | 'business'
  | 'editorial'
  | 'communaute'
  | 'systeme';

export interface AdminNavItem {
  href: string;
  label: string;
  /** Permission requise pour voir l'entrée (super_admin voit tout). */
  permission?: PermissionCode;
}

export interface AdminNavGroup {
  id: AdminNavGroupId;
  label: string;
  items: AdminNavItem[];
}

/** Console d'administration — source unique du menu, regroupée par pôle métier. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'pilotage',
    label: 'Pilotage & Santé',
    items: [
      { href: '/admin', label: "Vue d'ensemble" },
      { href: '/admin/controle', label: 'Tour de contrôle', permission: 'scraping.read' },
      { href: '/admin/controle/boc', label: 'Écarts BOC', permission: 'scraping.read' },
      { href: '/admin/coherence', label: 'Cohérence des fiches', permission: 'scraping.read' },
      { href: '/admin/scraping', label: 'Scraping', permission: 'scraping.read' },
      { href: '/admin/qualite', label: 'Qualité & Tests', permission: 'qa.read' },
    ],
  },
  {
    id: 'donnees',
    label: 'Données & Marché',
    items: [
      { href: '/admin/agregats', label: 'Agrégats bancaires à relire', permission: 'scraping.read' },
      { href: '/admin/calendrier', label: 'Calendrier fériés BRVM', permission: 'scraping.read' },
      { href: '/admin/import-fondamentaux', label: 'Import fondamentaux (IA)', permission: 'content.write' },
      { href: '/admin/import-sgi-tarifs', label: 'Import tarifs SGI', permission: 'content.write' },
      { href: '/admin/veille-brvm', label: 'Veille BRVM', permission: 'content.read' },
    ],
  },
  {
    id: 'business',
    label: 'Business & Revenus',
    items: [
      { href: '/admin/users', label: 'Utilisateurs', permission: 'users.read' },
      { href: '/admin/organizations', label: 'Organisations', permission: 'users.read' },
      { href: '/admin/subscriptions', label: 'Abonnements', permission: 'subscriptions.read' },
      { href: '/admin/payments', label: 'Paiements', permission: 'billing.read' },
      { href: '/admin/crm', label: 'CRM · proches du Premium', permission: 'crm.read' },
      { href: '/admin/leads', label: 'Leads débutants', permission: 'leads.read' },
      { href: '/admin/acquisition', label: 'Acquisition par source', permission: 'crm.read' },
      { href: '/admin/audience', label: 'Audience (PostHog)', permission: 'crm.read' },
    ],
  },
  {
    id: 'editorial',
    label: 'Éditorial & Formation',
    items: [
      { href: '/admin/content', label: 'Contenu', permission: 'content.read' },
      { href: '/admin/analyses', label: 'Analyses citables', permission: 'content.write' },
      { href: '/admin/articles', label: 'Articles de presse', permission: 'content.publish' },
      { href: '/admin/hebdo', label: 'Valeurs de la semaine', permission: 'content.publish' },
      { href: '/admin/weekly', label: 'Rapports hebdo', permission: 'content.read' },
      { href: '/admin/reports', label: 'Rapports IA', permission: 'content.read' },
      { href: '/admin/landing', label: 'Landing · À la une', permission: 'content.read' },
      { href: '/admin/newsletter', label: 'Newsletter', permission: 'content.read' },
      { href: '/admin/reseaux', label: 'Réseaux sociaux', permission: 'content.publish' },
      { href: '/admin/reseaux/tiktok', label: 'Réseaux · TikTok à valider', permission: 'content.publish' },
      { href: '/admin/formations', label: 'Formations', permission: 'content.read' },
      { href: '/admin/formations/sessions', label: 'Formations · Sessions live', permission: 'content.read' },
      { href: '/admin/formations/modules', label: 'Formations · Modules vidéo', permission: 'content.read' },
      { href: '/admin/academy', label: 'Academy (IA)', permission: 'content.read' },
    ],
  },
  {
    id: 'communaute',
    label: 'Communauté & Support',
    items: [
      { href: '/admin/contact', label: 'Messages de contact', permission: 'support.read' },
      { href: '/admin/forum', label: 'Modération forum', permission: 'content.read' },
    ],
  },
  {
    id: 'systeme',
    label: 'Système & Ops',
    items: [
      { href: '/admin/ops', label: 'Bot Ops & Canaux', permission: 'scraping.read' },
      { href: '/admin/securite', label: 'Sécurité des comptes', permission: 'users.suspend' },
      { href: '/admin/features', label: 'Fonctionnalités', permission: 'settings.write' },
      { href: '/admin/cles-api', label: 'Clés API (LLM)', permission: 'settings.write' },
      { href: '/admin/api-clients', label: 'Clients API', permission: 'settings.write' },
      { href: '/admin/audit-logs', label: 'Audit logs', permission: 'audit.read' },
      { href: '/admin/settings', label: 'Paramètres', permission: 'settings.read' },
    ],
  },
];

/** Liste plate conservée pour compatibilité ascendante et calcul du breadcrumb. */
export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

/** Libellé lisible pour le breadcrumb à partir du pathname. */
export function adminBreadcrumb(pathname: string): string {
  const exact = ADMIN_NAV.find((i) => i.href === pathname);
  if (exact) return exact.label;
  const match = [...ADMIN_NAV]
    .filter((i) => i.href !== '/admin' && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? 'Administration';
}
