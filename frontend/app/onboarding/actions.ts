'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ensureFreeSubscription } from '@/lib/billing/ensureFreeSubscription';

export async function saveInvestorProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const profil = formData.get('profil') as string | null;
  const horizon = formData.get('horizon') as string | null;
  const mode_debutant = formData.get('mode_debutant') === 'true';
  const formule = formData.get('formule') as string | null;

  const { error } = await supabase
    .from('profiles')
    .update({ profil, horizon, mode_debutant, onboarding_done: true })
    .eq('id', user.id);

  if (error) return { error: error.message };

  // Trace explicite du choix « Gratuit » : abonnement free (idempotent). Pour
  // « Premium », le client redirige vers /account/plan (souscription dédiée).
  if (formule === 'gratuit') {
    await ensureFreeSubscription(user.id);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
