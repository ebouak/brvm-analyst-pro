'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { activateSubscription, cancelSubscription } from '@/lib/billing/activate';
import { getServiceClient } from '@/lib/billing/serviceClient';

/** user_id de l'abonnement (pour tracer la cible dans l'audit). */
async function subscriptionUserId(subscriptionId: string): Promise<string | null> {
  try {
    const { data } = await getServiceClient()
      .from('subscriptions')
      .select('user_id')
      .eq('id', subscriptionId)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function confirmPayment(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('subscriptions.write');
  const targetUserId = await subscriptionUserId(subscriptionId);
  const r = await activateSubscription(subscriptionId);
  await recordAudit(ctx, {
    action: 'payment.confirm',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    targetUserId,
    severity: r.ok ? 'info' : 'warning',
    metadata: { ok: r.ok, message: r.message ?? null },
  });
  revalidatePath('/admin/payments');
  return r;
}

export async function rejectPayment(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('subscriptions.write');
  const targetUserId = await subscriptionUserId(subscriptionId);
  const r = await cancelSubscription(subscriptionId);
  await recordAudit(ctx, {
    action: 'payment.reject',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    targetUserId,
    severity: 'warning',
    metadata: { ok: r.ok, message: r.message ?? null },
  });
  revalidatePath('/admin/payments');
  return r;
}
