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
  /** Compte suspendu (banni) — l'utilisateur ne peut plus se connecter. */
  suspended: boolean;
  /** Métadonnées d'authentification (source : auth.users, via l'API Admin). */
  last_sign_in_at: string | null;
  created_at: string | null;
  email_confirmed: boolean;
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

  // État d'authentification : suspension et dernière connexion vivent dans
  // auth.users (non lisible en SQL) — seule l'API Admin les expose.
  let suspended = false;
  let last_sign_in_at: string | null = null;
  let created_at: string | null = null;
  let email_confirmed = false;
  try {
    const { data: authUser } = await db.auth.admin.getUserById(userId);
    const u = authUser?.user as
      | { banned_until?: string | null; last_sign_in_at?: string | null; created_at?: string; email_confirmed_at?: string | null }
      | undefined;
    if (u) {
      // `banned_until` dans le futur = compte suspendu.
      suspended = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
      last_sign_in_at = u.last_sign_in_at ?? null;
      created_at = u.created_at ?? null;
      email_confirmed = Boolean(u.email_confirmed_at);
    }
  } catch {
    // Indisponibilité de l'API Admin : on n'invente pas d'état — les champs
    // restent à leur valeur neutre et la fiche reste affichable.
  }

  return {
    id: profile.id as string,
    email: (profile.email as string) ?? null,
    is_premium: Boolean(profile.is_premium),
    premium_since: (profile.premium_since as string) ?? null,
    roleCodes,
    suspended,
    last_sign_in_at,
    created_at,
    email_confirmed,
  };
}
