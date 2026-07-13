'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { generateKey } from '@/lib/api/keys';
import { notifyApproved, notifyRejected, notifyRevoked } from '@/lib/api/notify';

/**
 * `emailed` : l'envoi a-t-il réussi ? Sur une approbation, c'est décisif — si
 * l'email n'est pas parti, l'admin est le SEUL à détenir la clé en clair et doit
 * la transmettre à la main avant de fermer la fenêtre. La taire serait perdre la clé.
 */
type R = { ok: true; key?: string; emailed?: boolean } | { ok: false; error: string };

type ClientRow = { statut: string; nom: string; email: string; quota_daily: number };

/**
 * Approuve une demande et génère la clé.
 *
 * La clé en clair est renvoyée UNE SEULE FOIS (affichée à l'admin ET envoyée au
 * demandeur) : seul son sha256 est stocké. Personne — pas même un super-admin —
 * ne pourra la relire ensuite. En cas de perte : révoquer et réémettre.
 */
export async function approveClient(clientId: string): Promise<R> {
  const ctx = await requirePermission('settings.write');
  const db = getServiceClient();

  const { data: existing } = await db
    .from('api_clients')
    .select('statut, nom, email, quota_daily')
    .eq('id', clientId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Demande introuvable.' };
  const client = existing as ClientRow;

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

  // Envoi de la clé au demandeur. C'est l'unique occasion : nous ne stockons que
  // son empreinte, donc nous ne pourrons jamais la renvoyer.
  const emailed = await notifyApproved(client.email, client.nom, key, client.quota_daily);

  await recordAudit(ctx, {
    action: 'api_client.approve',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'warning', // donne un accès aux données : action sensible
    metadata: { nom: client.nom, key_prefix: prefix, emailed },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true, key, emailed };
}

/** Refuse une demande (motif obligatoire — il sera communiqué au demandeur). */
export async function rejectClient(clientId: string, motif: string): Promise<R> {
  const ctx = await requirePermission('settings.write');
  if (!motif.trim()) return { ok: false, error: 'Motif de refus obligatoire.' };

  const db = getServiceClient();
  const { data: existing } = await db
    .from('api_clients')
    .select('nom, email')
    .eq('id', clientId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Demande introuvable.' };
  const client = existing as Pick<ClientRow, 'nom' | 'email'>;

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

  const emailed = await notifyRejected(client.email, client.nom, motif.trim());

  await recordAudit(ctx, {
    action: 'api_client.reject',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'info',
    metadata: { motif: motif.trim(), emailed },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true, emailed };
}

/** Révoque une clé active : l'accès est coupé immédiatement (hash effacé). */
export async function revokeClient(clientId: string, motif: string): Promise<R> {
  const ctx = await requirePermission('settings.write');
  const db = getServiceClient();

  const { data: existing } = await db
    .from('api_clients')
    .select('nom, email')
    .eq('id', clientId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Client introuvable.' };
  const client = existing as Pick<ClientRow, 'nom' | 'email'>;

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

  // Couper un accès sans prévenir laisse un partenaire face à des 403 inexpliqués.
  const emailed = await notifyRevoked(client.email, client.nom);

  await recordAudit(ctx, {
    action: 'api_client.revoke',
    resourceType: 'api_client',
    resourceId: clientId,
    severity: 'critical', // coupe un accès en production
    metadata: { motif: motif.trim() || null, emailed },
  });

  revalidatePath('/admin/api-clients');
  return { ok: true, emailed };
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
