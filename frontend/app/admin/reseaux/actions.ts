'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { estReseau } from '@/lib/social/oauth';
import { estReseauCommunaute } from '@/lib/communaute';

/**
 * Relevé manuel du nombre d'abonnés d'un réseau, à la date du jour (UTC).
 * Une seconde saisie le même jour REMPLACE la première (clé reseau, releve_le).
 */
export async function enregistrerReleve(formData: FormData): Promise<void> {
  const ctx = await requirePermission('content.publish');
  const reseau = String(formData.get('reseau') ?? '');
  const abonnes = Number(String(formData.get('abonnes') ?? '').replace(/[\s\u202f\u00a0]/g, ''));
  if (!estReseauCommunaute(reseau) || !Number.isInteger(abonnes) || abonnes < 0 || abonnes > 100_000_000) return;
  const releve_le = new Date().toISOString().slice(0, 10);
  const { error } = await getServiceClient().from('communaute_releves').upsert(
    { reseau, releve_le, abonnes, source: 'manuel', saisi_par: ctx.userId ?? null },
    { onConflict: 'reseau,releve_le' },
  );
  if (error) throw new Error(`relevé non enregistré : ${error.message}`);
  await recordAudit(ctx, { action: 'communaute.releve', resourceType: 'communaute_releves', resourceId: `${reseau}:${releve_le}`, severity: 'info', metadata: { abonnes } });
  revalidatePath('/admin/reseaux');
  revalidatePath('/');
}

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
