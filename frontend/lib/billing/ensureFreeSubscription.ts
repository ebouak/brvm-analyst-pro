import { getServiceClient } from './serviceClient';

/**
 * Enregistre explicitement un abonnement « free » pour l'utilisateur (trace du
 * choix « Gratuit » à l'onboarding). Idempotent : ne fait rien si l'utilisateur
 * a déjà un abonnement (quel que soit le statut), pour ne pas écraser un
 * pending/active Premium. Utilise le service-role (insert hors RLS).
 */
export async function ensureFreeSubscription(userId: string): Promise<{ ok: boolean }> {
  const db = getServiceClient();

  const { data: existing } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (existing && existing.length > 0) return { ok: true };

  const { data: plan } = await db
    .from('subscription_plans')
    .select('id')
    .eq('code', 'free')
    .maybeSingle();
  if (!plan) return { ok: false };

  const { error } = await db.from('subscriptions').insert({
    user_id: userId,
    plan_id: plan.id,
    status: 'active',
    billing_cycle: 'monthly',
    started_at: new Date().toISOString(),
  });
  return { ok: !error };
}
