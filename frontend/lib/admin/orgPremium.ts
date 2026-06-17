import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/** Une org a-t-elle un abonnement actif rattaché ? */
export async function orgHasActiveSubscription(orgId: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from('subscriptions')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** L'utilisateur a-t-il son propre abonnement actif (hors organisation) ? */
export async function userHasOwnActiveSub(userId: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .is('organization_id', null)
    .eq('status', 'active')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** L'utilisateur est-il membre d'une organisation ayant un abonnement actif ? */
export async function userInActiveOrg(userId: string): Promise<boolean> {
  const db = getServiceClient();
  const { data: memberships } = await db
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId);
  const orgIds = (memberships ?? []).map((m) => (m as { organization_id: string }).organization_id);
  if (orgIds.length === 0) return false;
  const { data } = await db
    .from('subscriptions')
    .select('id')
    .in('organization_id', orgIds)
    .eq('status', 'active')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Recalcule et applique le statut premium d'un utilisateur à partir de ses
 * sources actives (abonnement propre OU appartenance à une org abonnée).
 * Idempotent : n'écrit que si le flag change. Limite assumée : un premium
 * accordé manuellement (sans abonnement) est révoqué ici s'il perd toute source.
 */
export async function recomputeMemberPremium(userId: string): Promise<void> {
  const db = getServiceClient();
  const should = (await userHasOwnActiveSub(userId)) || (await userInActiveOrg(userId));

  const { data: prof } = await db.from('profiles').select('is_premium').eq('id', userId).maybeSingle();
  if (!prof) return; // pas de profil → rien à faire
  const current = Boolean((prof as { is_premium: boolean }).is_premium);
  if (current === should) return;

  const nowIso = new Date().toISOString();
  await db
    .from('profiles')
    .update({ is_premium: should, premium_since: should ? nowIso : null, updated_at: nowIso })
    .eq('id', userId);
}
