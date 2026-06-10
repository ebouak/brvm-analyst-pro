'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveInvestorProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const profil = formData.get('profil') as string | null;
  const horizon = formData.get('horizon') as string | null;
  const mode_debutant = formData.get('mode_debutant') === 'true';

  const { error } = await supabase
    .from('profiles')
    .update({ profil, horizon, mode_debutant, onboarding_done: true })
    .eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}
