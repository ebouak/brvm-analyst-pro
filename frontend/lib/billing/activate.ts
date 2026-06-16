import { getServiceClient } from './serviceClient';
import { computeRenewsAt } from './dates';
import type { BillingCycle } from './types';

/**
 * Active un abonnement : transactions pending → paid, abonnement → active
 * (started_at, renews_at), profil → premium. Idempotent. Réutilisable par un
 * futur webhook provider live.
 */
export async function activateSubscription(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  const db = getServiceClient();
  const { data: sub, error } = await db
    .from('subscriptions')
    .select('id, user_id, billing_cycle')
    .eq('id', subscriptionId)
    .maybeSingle();
  if (error || !sub) return { ok: false, message: 'Abonnement introuvable.' };

  const now = new Date();
  const nowIso = now.toISOString();
  const renewsAt = computeRenewsAt(now, (sub.billing_cycle as BillingCycle) ?? 'monthly');

  await db
    .from('billing_transactions')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('subscription_id', subscriptionId)
    .eq('status', 'pending');

  const { error: subErr } = await db
    .from('subscriptions')
    .update({ status: 'active', started_at: nowIso, renews_at: renewsAt, canceled_at: null })
    .eq('id', subscriptionId);
  if (subErr) return { ok: false, message: subErr.message };

  await db
    .from('profiles')
    .update({ is_premium: true, premium_since: nowIso, updated_at: nowIso })
    .eq('id', sub.user_id);

  return { ok: true };
}

/**
 * Rejette/annule un abonnement : transactions pending → failed, abonnement →
 * canceled. Ne révoque pas premium (une intention pending n'était pas premium).
 */
export async function cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; message?: string }> {
  const db = getServiceClient();
  const nowIso = new Date().toISOString();

  await db
    .from('billing_transactions')
    .update({ status: 'failed' })
    .eq('subscription_id', subscriptionId)
    .eq('status', 'pending');

  const { error } = await db
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: nowIso })
    .eq('id', subscriptionId);
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}
