'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';

type R = { ok: boolean; error?: string };

/**
 * Modifie l'accès et les quotas d'une fonctionnalité, sans redéploiement.
 *
 * `disabled` = KILL SWITCH : coupe la feature en production (utile si une
 * fonction coûte trop cher ou dysfonctionne). Tracé en critique — c'est une
 * action à impact utilisateur immédiat.
 */
export async function updateFlag(
  code: string,
  patch: {
    acces?: 'free' | 'premium' | 'pro' | 'disabled';
    quota_free?: number | null;
    quota_premium?: number | null;
  },
): Promise<R> {
  const ctx = await requirePermission('settings.write');
  const db = getServiceClient();

  const { data: before } = await db
    .from('feature_flags')
    .select('label, acces, quota_free, quota_premium')
    .eq('code', code)
    .maybeSingle();
  if (!before) return { ok: false, error: 'Fonctionnalité inconnue.' };

  const { error } = await db
    .from('feature_flags')
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq('code', code);
  if (error) return { ok: false, error: error.message };

  const disabling = patch.acces === 'disabled' && before.acces !== 'disabled';

  await recordAudit(ctx, {
    action: disabling ? 'feature.disable' : 'feature.update',
    resourceType: 'feature_flag',
    resourceId: code,
    // Couper une feature en prod a un impact immédiat sur tous les utilisateurs.
    severity: disabling ? 'critical' : 'warning',
    metadata: { avant: before, apres: patch },
  });

  revalidatePath('/admin/features');
  return { ok: true };
}
