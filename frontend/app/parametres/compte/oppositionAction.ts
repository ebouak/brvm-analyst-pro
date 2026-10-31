'use server';
import { createClient } from '@/lib/supabase/server';
import { enregistrerOpposition, estOppose, retirerOpposition } from '@/lib/crm/opposition';

/** `null` = état indisponible (lecture en erreur) : l'interface ne doit pas deviner. */
export async function lireOpposition(): Promise<boolean | null> {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    return user?.email ? await estOppose(user.email) : false;
  } catch {
    return null;
  }
}

export async function basculerOpposition(oppose: boolean): Promise<boolean> {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user?.email) return false;
  const ok = oppose ? await enregistrerOpposition(user.email, 'parametres') : await retirerOpposition(user.email);
  return ok ? oppose : !oppose;
}
