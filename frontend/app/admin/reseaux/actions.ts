'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { estReseau } from '@/lib/social/oauth';

/** Interrupteur par réseau : à false, aucun worker ne publie (jetons conservés). */
export async function basculerReseau(reseau: string, actif: boolean): Promise<void> {
  const ctx = await requirePermission('content.publish');
  if (!estReseau(reseau)) return;
  await getServiceClient().from('social_tokens').update({ actif, maj_le: new Date().toISOString() }).eq('reseau', reseau);
  await recordAudit(ctx, { action: actif ? 'reseaux.activer' : 'reseaux.couper', resourceType: 'social_tokens', resourceId: reseau, severity: 'warning' });
  revalidatePath('/admin/reseaux');
}

/** Efface les jetons : il faudra reconnecter le compte pour publier à nouveau. */
export async function deconnecterReseau(reseau: string): Promise<void> {
  const ctx = await requirePermission('content.publish');
  if (!estReseau(reseau)) return;
  await getServiceClient().from('social_tokens').delete().eq('reseau', reseau);
  await recordAudit(ctx, { action: 'reseaux.deconnexion', resourceType: 'social_tokens', resourceId: reseau, severity: 'warning' });
  revalidatePath('/admin/reseaux');
}
