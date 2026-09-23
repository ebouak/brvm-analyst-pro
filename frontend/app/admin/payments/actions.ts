'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { activateSubscription, cancelSubscription } from '@/lib/billing/activate';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { confirmerPlaceFormation } from '@/lib/formations/confirmer';

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

  // Une transaction de formation ne passe PAS par l'activation d'abonnement.
  // NB : `subscriptionId` ici est en réalité `billing_transactions.subscription_id`
  // (voir PaymentRowActions) — colonne toujours NULL pour une transaction de
  // formation (reserverPlace l'insère explicitement à null), donc cette
  // branche n'est aujourd'hui jamais atteinte depuis /admin/payments : le
  // bouton « Confirmer » n'y est même pas rendu pour ces lignes. Conservée
  // pour tout appelant qui passerait un jour l'identifiant de transaction.
  const db = getServiceClient();
  const { data: t } = await db
    .from('billing_transactions')
    .select('id, objet')
    .eq('subscription_id', subscriptionId)
    .eq('status', 'pending')
    .maybeSingle();
  if (t?.objet === 'formation') {
    const r = await confirmerPlaceFormation(t.id as string);
    await recordAudit(ctx, {
      action: 'payment.confirm',
      resourceType: 'formation_inscription',
      resourceId: t.id as string,
      targetUserId: null,
      severity: r.ok ? 'info' : 'warning',
      metadata: { ok: r.ok, message: r.message },
    });
    revalidatePath('/admin/payments');
    return { ok: r.ok, message: r.message };
  }

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
