import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAILS } from './admin-emails';
import { getMfaStatus } from './mfa';

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

/**
 * Garde serveur : redirige si l'utilisateur n'est pas admin, OU si son second
 * facteur n'est pas présenté. Retourne le contexte.
 *
 * La 2FA est EXIGÉE pour tout accès admin. Ces comptes peuvent supprimer des
 * utilisateurs, révoquer des clés d'API et couper des fonctionnalités : un mot de
 * passe volé ne doit pas suffire à en disposer.
 *
 * Deux cas distincts, deux destinations :
 *   - il a la 2FA mais cette session est restée en aal1 → challenge (saisie du code)
 *   - il n'a aucun facteur → inscription obligatoire
 *
 * `/account/security*` n'est volontairement PAS protégé par cette garde : c'est
 * l'unique porte de sortie. L'y soumettre enfermerait l'admin dehors (ou créerait
 * une boucle de redirection).
 *
 * Note : `getAdminContext()` ne fait AUCUNE de ces vérifications — il ne fait que
 * lire les droits. C'est ce qui permet à /account/security de savoir « cet
 * utilisateur est admin, donc la 2FA lui est obligatoire » sans se rediriger
 * elle-même.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect('/dashboard');

  const mfa = await getMfaStatus();
  if (mfa.needsChallenge) redirect('/account/security/verify?next=/admin');
  if (!mfa.hasFactor) redirect('/account/security');

  return ctx;
}

/** Garde serveur : exige une permission précise. */
export async function requirePermission(permission: PermissionCode): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!can(ctx, permission)) redirect('/admin');
  return ctx;
}
