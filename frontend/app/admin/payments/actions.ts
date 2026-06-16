'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { activateSubscription, cancelSubscription } from '@/lib/billing/activate';

export async function confirmPayment(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  await requirePermission('subscriptions.write');
  const r = await activateSubscription(subscriptionId);
  revalidatePath('/admin/payments');
  return r;
}

export async function rejectPayment(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  await requirePermission('subscriptions.write');
  const r = await cancelSubscription(subscriptionId);
  revalidatePath('/admin/payments');
  return r;
}
