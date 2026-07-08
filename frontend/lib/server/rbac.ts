import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAILS } from './admin-emails';

/**
 * RBAC admin — lecture serveur des rôles/permissions (tables admin_*).
 * Source de vérité : admin_user_roles → admin_roles → admin_role_permissions
 * → admin_permissions. Compat : un e-mail de ADMIN_EMAILS est traité comme
 * super_admin même sans ligne (bootstrap / filet de sécurité).
 *
 * Lecture via service_role (les tables admin_* sont en RLS service_role only) ;
 * jamais exposé au client — réservé aux composants/route handlers serveur.
 */

export type PermissionCode =
  | 'users.read' | 'users.write' | 'users.suspend'
  | 'subscriptions.read' | 'subscriptions.write'
  | 'billing.read' | 'billing.refund'
  | 'scraping.read' | 'scraping.retry' | 'scraping.configure'
  | 'content.read' | 'content.write' | 'content.publish'
  | 'leads.read' | 'leads.write'
  | 'audit.read'
  | 'settings.read' | 'settings.write'
  | 'forum.manage';

export interface AdminContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: Set<string>;
  isSuperAdmin: boolean;
}

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Contexte admin du user courant, ou null s'il n'est pas administrateur. */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const legacySuper = ADMIN_EMAILS.includes(user.email);

  const roles: string[] = [];
  const permissions = new Set<string>();

  try {
    const db = serviceDb();
    const { data } = await db
      .from('admin_user_roles')
      .select('admin_roles(code, admin_role_permissions(admin_permissions(code)))')
      .eq('user_id', user.id);

    for (const row of (data ?? []) as any[]) {
      const role = row.admin_roles;
      if (!role) continue;
      roles.push(role.code);
      for (const rp of role.admin_role_permissions ?? []) {
        const code = rp.admin_permissions?.code;
        if (code) permissions.add(code);
      }
    }
  } catch {
    // En cas d'indisponibilité, on retombe sur le legacy super-admin.
  }

  const isSuperAdmin = roles.includes('super_admin') || legacySuper;
  if (!isSuperAdmin && roles.length === 0) return null;

  return { userId: user.id, email: user.email, roles, permissions, isSuperAdmin };
}

/** true si le contexte possède la permission (super_admin = tout). */
export function can(ctx: AdminContext | null, permission: PermissionCode): boolean {
  if (!ctx) return false;
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions.has(permission);
}

/** Garde serveur : redirige si l'utilisateur n'est pas admin. Retourne le contexte. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect('/dashboard');
  return ctx;
}

/** Garde serveur : exige une permission précise. */
export async function requirePermission(permission: PermissionCode): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!can(ctx, permission)) redirect('/admin');
  return ctx;
}
