'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { isLeadStatut } from '@/lib/leads';

/**
 * Met à jour le statut d'un lead (gated par `leads.write`). Mutation via
 * service-role, tracée dans admin_audit_logs.
 */
export async function setLeadStatus(
  leadId: string,
  statut: string,
): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('leads.write');
  if (!isLeadStatut(statut)) {
    return { ok: false, message: 'Statut invalide.' };
  }

  const { error } = await getServiceClient()
    .from('leads_brvm')
    .update({ statut })
    .eq('id', leadId);

  await recordAudit(ctx, {
    action: 'lead.status_update',
    resourceType: 'lead',
    resourceId: leadId,
    severity: error ? 'warning' : 'info',
    metadata: { statut, ok: !error },
  });

  if (error) return { ok: false, message: 'Erreur serveur.' };
  revalidatePath('/admin/leads');
  return { ok: true };
}
