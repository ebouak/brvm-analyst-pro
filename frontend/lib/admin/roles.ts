import { getServiceClient } from '@/lib/billing/serviceClient';

export interface RoleDef {
  code: string;
  label: string;
}

export interface UserRights {
  id: string;
  email: string | null;
  is_premium: boolean;
  premium_since: string | null;
  roleCodes: string[];
}

/**
 * Tous les rôles admin (référentiel).
 */
export async function listRoles(): Promise<RoleDef[]> {
  const db = getServiceClient();
  const { data } = await db
    .from('admin_roles')
    .select('code, label')
    .order('label', { ascending: true });
  return (data ?? []) as RoleDef[];
}

/**
 * Profil + rôles d'un utilisateur. null si introuvable.
 */
export async function getUserRights(userId: string): Promise<UserRights | null> {
  const db = getServiceClient();

  // Récupérer le profil
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, is_premium, premium_since')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  // Récupérer les rôles
  const { data: roles } = await db
    .from('admin_user_roles')
    .select('admin_roles(code)')
    .eq('user_id', userId);

  const roleCodes = (roles ?? [])
    .map((r: Record<string, unknown>) => {
      const ar = r.admin_roles as { code?: string } | { code?: string }[] | null;
      const one = Array.isArray(ar) ? ar[0] : ar;
      return one?.code ?? null;
    })
    .filter((c): c is string => Boolean(c));

  return {
    id: profile.id as string,
    email: (profile.email as string) ?? null,
    is_premium: Boolean(profile.is_premium),
    premium_since: (profile.premium_since as string) ?? null,
    roleCodes,
  };
}
