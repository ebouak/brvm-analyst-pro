'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { activateSubscription, cancelSubscription } from '@/lib/billing/activate';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { confirmerPlaceFormation, rejeterPlaceFormation } from '@/lib/formations/confirmer';

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

/**
 * Confirme un encaissement.
 *
 * L'identifiant reçu est celui de la TRANSACTION, pas celui de l'abonnement :
 * une vente de formation n'a pas d'abonnement (`subscription_id` nul), et
 * s'indexer sur lui rendait ces lignes inactionnables dans la console.
 *
 * L'objet de la transaction décide du chemin. Confirmer une formation ne doit
 * JAMAIS activer un abonnement Premium par effet de bord — quelqu'un qui paie
 * un atelier à 1 000 F deviendrait abonné.
 */
export async function confirmPayment(transactionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('subscriptions.write');
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, subscription_id')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };

  if (txn.objet === 'formation') {
    const r = await confirmerPlaceFormation(transactionId);
    await recordAudit(ctx, {
      action: 'payment.confirm',
      resourceType: 'formation_inscription',
      resourceId: transactionId,
      targetUserId: null,
      severity: r.ok ? 'info' : 'warning',
      metadata: { ok: r.ok, message: r.message },
    });
    revalidatePath('/admin/payments');
    return { ok: r.ok, message: r.message };
  }

  const subscriptionId = txn.subscription_id as string | null;
  if (!subscriptionId) return { ok: false, message: 'Cette transaction n’est rattachée à aucun abonnement.' };

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

/**
 * Rejette un encaissement. Même aiguillage : rejeter une formation libère la
 * place, là où annuler un abonnement inexistant n'aurait rien fait de bon.
 */
export async function rejectPayment(transactionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('subscriptions.write');
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, subscription_id')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };

  if (txn.objet === 'formation') {
    const r = await rejeterPlaceFormation(transactionId);
    await recordAudit(ctx, {
      action: 'payment.reject',
      resourceType: 'formation_inscription',
      resourceId: transactionId,
      targetUserId: null,
      severity: 'warning',
      metadata: { ok: r.ok, message: r.message },
    });
    revalidatePath('/admin/payments');
    return { ok: r.ok, message: r.message };
  }

  const subscriptionId = txn.subscription_id as string | null;
  if (!subscriptionId) return { ok: false, message: 'Cette transaction n’est rattachée à aucun abonnement.' };

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

