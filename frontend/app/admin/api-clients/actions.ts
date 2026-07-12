'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { generateKey } from '@/lib/api/keys';

type R = { ok: true; key?: string } | { ok: false; error: string };

/**
 * Approuve une demande et génère la clé.
 *
 * La clé en clair est renvoyée UNE SEULE FOIS (à afficher à l'admin, qui la
 * transmet au demandeur) : seul son sha256 est stocké. Personne — pas même un
 * super-admin — ne pourra la relire ensuite. En cas de perte : révoquer et
 * réémettre.
 */
export async function approveClient(clientId: string): Promise<R> {
  const ctx = await requirePermission('settings.write');
  const db = getServiceClient();

  const { data: existing } = await db
    .from('api_clients')
    .select('statut, nom')
    .eq('id', clientId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Demande introuvable.' };

  const { key, hash, prefix } = generateKey();

  const { error } = await db
    .from('api_clients')
    .update({
      statut: 'active',
      key_hash: hash,
      key_prefix: prefix,
      motif_refus: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: ctx.userId,
    })
    .eq('id', clientId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, {
    action: 'api_client.approve',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'warning', // donne un accès aux données : action sensible
    metadata: { nom: (existing as { nom: string }).nom, key_prefix: prefix },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true, key };
}

/** Refuse une demande (motif obligatoire — il sera communiqué au demandeur). */
export async function rejectClient(clientId: string, motif: string): Promise<R> {
  const ctx = await requirePermission('settings.write');
  if (!motif.trim()) return { ok: false, error: 'Motif de refus obligatoire.' };

  const db = getServiceClient();
  const { error } = await db
    .from('api_clients')
    .update({
      statut: 'rejected',
      motif_refus: motif.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: ctx.userId,
    })
    .eq('id', clientId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, {
    action: 'api_client.reject',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'info',
    metadata: { motif: motif.trim() },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true };
}

/** Révoque une clé active : l'accès est coupé immédiatement (hash effacé). */
export async function revokeClient(clientId: string, motif: string): Promise<R> {
  const ctx = await requirePermission('settings.write');
  const db = getServiceClient();

  const { error } = await db
    .from('api_clients')
    .update({
      statut: 'revoked',
      // On efface le hash : la clé cesse d'être reconnaissable, même en cas de
      // réactivation accidentelle du statut.
      key_hash: null,
      motif_refus: motif.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: ctx.userId,
    })
    .eq('id', clientId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, {
    action: 'api_client.revoke',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'critical', // coupe un accès en production
    metadata: { motif: motif.trim() || null },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true };
}

/** Ajuste le quota journalier d'un client. */
export async function setQuota(clientId: string, quota: number): Promise<R> {
  const ctx = await requirePermission('settings.write');
  if (!Number.isFinite(quota) || quota < 1) {
    return { ok: false, error: 'Quota invalide (minimum 1).' };
  }

  const db = getServiceClient();
  const { error } = await db
    .from('api_clients')
    .update({ quota_daily: Math.floor(quota) })
    .eq('id', clientId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, {
    action: 'api_client.set_quota',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'info',
    metadata: { quota_daily: Math.floor(quota) },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true };
}
