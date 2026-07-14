import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Résolveur d'accès central — la source unique de vérité pour « qui a droit à quoi ».
 *
 * Trois niveaux : free < premium < platinium (« pro »).
 *   - isPremium = premium OU platinium (la plupart des fonctionnalités payantes)
 *   - isPro     = platinium seulement (formations, etc.)
 *
 * `profiles.is_premium` (booléen) couvre premium ET platinium. Pour distinguer
 * le pro, on résout le plan de l'abonnement ACTIF. Lecture via service_role :
 * la table subscriptions est en RLS et cette résolution doit marcher côté serveur
 * quel que soit l'appelant.
 *
 * Centraliser ici évite que chaque page réinvente sa propre règle d'accès — et
 * qu'une d'elles se trompe. Une seule fonction à auditer.
 */

export type Tier = 'free' | 'premium' | 'platinium';

export interface Entitlements {
  userId: string | null;
  tier: Tier;
  isPremium: boolean;
  isPro: boolean;
}

const ANON: Entitlements = { userId: null, tier: 'free', isPremium: false, isPro: false };

export async function getEntitlements(): Promise<Entitlements> {
  const supa = createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return ANON;

  const { data: prof } = await supa
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .maybeSingle();

  const isPremium = Boolean(prof?.is_premium);
  if (!isPremium) return { userId: user.id, tier: 'free', isPremium: false, isPro: false };

  // Premium confirmé. On distingue le platinium via l'abonnement actif.
  // En cas de doute (lecture impossible), on retombe sur « premium » — jamais
  // sur « pro » : on n'accorde pas un droit supérieur qu'on n'a pas pu vérifier.
  let isPro = false;
  try {
    const db = getServiceClient();
    const { data: subs } = await db
      .from('subscriptions')
      .select('status, subscription_plans!inner(code)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    isPro = (subs ?? []).some((s) => {
      const plan = (s as { subscription_plans?: { code?: string } | { code?: string }[] }).subscription_plans;
      const code = Array.isArray(plan) ? plan[0]?.code : plan?.code;
      return code === 'platinium';
    });
  } catch {
    isPro = false;
  }

  return {
    userId: user.id,
    tier: isPro ? 'platinium' : 'premium',
    isPremium: true,
    isPro,
  };
}
