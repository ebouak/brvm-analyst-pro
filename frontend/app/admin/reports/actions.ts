'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';

/** Invalide (supprime) le diagnostic d'une action — il sera régénéré à la prochaine consultation. */
export async function invalidateDiagnostic(code: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('content.write');
  const { error } = await getServiceClient().from('diagnostic_reports').delete().eq('code', code);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, {
    action: 'diagnostic.invalidate',
    resourceType: 'diagnostic',
    resourceId: code,
    severity: 'warning',
  });
  revalidatePath('/admin/reports');
  return { ok: true };
}
