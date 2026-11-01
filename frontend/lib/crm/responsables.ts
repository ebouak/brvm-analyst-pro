/**
 * Responsables possibles d'un dossier CRM = comptes ayant au moins un rôle
 * admin (`admin_user_roles`). SERVEUR uniquement (service_role).
 */
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { lireTout } from './lecture';

export interface Responsable { id: string; email: string }

async function idsAdmins(): Promise<string[]> {
  const sb = getServiceClient();
  const lignes = await lireTout<{ user_id: string }>((a, b) => sb.from('admin_user_roles').select('user_id').order('user_id').order('role_id').range(a, b), 'rôles admin');
  return Array.from(new Set(lignes.map((l) => l.user_id)));
}

/** Vrai si le compte porte un rôle admin (vérification stricte avant d'assigner). */
export async function estAdministrateur(userId: string): Promise<boolean> {
  const { data, error } = await getServiceClient().from('admin_user_roles').select('user_id').eq('user_id', userId).limit(1);
  return !error && (data?.length ?? 0) > 0;
}

export async function listerResponsables(): Promise<Responsable[]> {
  const sb = getServiceClient();
  const ids = await idsAdmins();
  const reps = await Promise.all(ids.map(async (id) => {
    const { data } = await sb.auth.admin.getUserById(id);
    return data.user?.email ? { id, email: data.user.email } : null;
  }));
  return reps.filter((r): r is Responsable => r !== null).sort((a, b) => a.email.localeCompare(b.email));
}
