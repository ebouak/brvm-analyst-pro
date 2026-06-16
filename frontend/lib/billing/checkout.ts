'use server';

import { createClient } from '@/lib/supabase/server';
import { getProvider } from './provider';
import type { BillingCycle, CheckoutResult } from './types';

/** Démarre le checkout pour l'utilisateur authentifié via le provider configuré. */
export async function startCheckout(planCode: string, cycle: BillingCycle): Promise<CheckoutResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 'error', message: 'Connectez-vous pour souscrire.' };

  return getProvider().createCheckout({
    userId: user.id,
    email: user.email ?? '',
    planCode,
    cycle,
  });
}
