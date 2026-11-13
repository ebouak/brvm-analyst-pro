import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { getEntitlements } from './entitlements';
import { limiteAlertes } from '@/lib/alertes/limite';

/**
 * Limite d'alertes du compte courant. Le quota gratuit est LU EN BASE
 * (feature_flags.alertes.quota_free, réglable dans /admin/features).
 * Drapeau illisible : 0 en gratuit, jamais une ouverture par défaut.
 */
export async function limiteAlertesCourante(): Promise<{ premium: boolean; limite: number | null }> {
  const ent = await getEntitlements();
  let quota: number | null = 0;
  try {
    const { data } = await getServiceClient().from('feature_flags').select('acces, quota_free').eq('code', 'alertes').maybeSingle();
    const f = data as { acces: string; quota_free: number | null } | null;
    if (f?.acces === 'disabled') return { premium: false, limite: 0 };
    quota = f?.acces === 'free' ? null : (f?.quota_free ?? 0);
  } catch {
    quota = 0;
  }
  const premium = ent.isPremium || quota === null;
  return { premium, limite: limiteAlertes(premium, quota) };
}
