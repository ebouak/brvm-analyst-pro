import 'server-only';
import { NextResponse } from 'next/server';
import { getAdminContext, can, type AdminContext, type PermissionCode } from './rbac';
import { getMfaStatus } from './mfa';

/**
 * Garde unique des routes API admin : renvoie un vrai JSON 401/403 (jamais une
 * redirection, qui n'a pas de sens pour un fetch) et EXIGE la 2FA (aal2).
 *
 * Pourquoi : plusieurs routes (import-batch, import-sgi-tarifs, quant/run…)
 * autorisaient sur l'e-mail ou `profiles.is_admin` sans regarder le niveau
 * d'assurance : un mot de passe volé suffisait à lancer des imports facturés au
 * LLM ou à écrire en base avec la clé service_role. `rbac.requireAdmin` impose la
 * 2FA aux PAGES ; ceci l'impose aux routes API.
 *
 * Usage : const g = await requireAdminApi('content.write');
 *         if ('error' in g) return g.error;
 */
export async function requireAdminApi(
  permission: PermissionCode,
): Promise<{ ctx: AdminContext } | { error: NextResponse }> {
  const ctx = await getAdminContext();
  if (!ctx) {
    // 401 si pas connecté, 403 si connecté sans droits : on ne distingue pas ici
    // pour ne rien révéler sur l'existence de rôles. getAdminContext renvoie null
    // dans les deux cas.
    return { error: NextResponse.json({ error: 'Accès réservé à l’administration' }, { status: 403 }) };
  }
  if (!can(ctx, permission)) {
    return { error: NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 }) };
  }
  const mfa = await getMfaStatus();
  if (!mfa.isElevated) {
    return {
      error: NextResponse.json(
        {
          error: mfa.hasFactor
            ? 'Double authentification requise : reconnectez-vous avec votre code.'
            : 'Double authentification obligatoire. Activez-la sur /account/security.',
        },
        { status: 403 },
      ),
    };
  }
  return { ctx };
}
