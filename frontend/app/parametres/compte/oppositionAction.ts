'use server';
import { createClient } from '@/lib/supabase/server';
import { enregistrerOpposition, estOppose, retirerOpposition } from '@/lib/crm/opposition';

/** `null` = état indisponible (lecture en erreur) : l'interface ne doit pas deviner. */
export async function lireOpposition(): Promise<boolean | null> {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    // Adresse non confirmée = peut-être celle d'un tiers : ni lire ni lever son refus.
    return user?.email && user.email_confirmed_at ? await estOppose(user.email) : null;
  } catch {
    return null;
  }
}

/** `null` = changement non enregistré (pas de session ou erreur) : l'état affiché ne doit pas bouger. */
export async function basculerOpposition(oppose: boolean): Promise<boolean | null> {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user?.email || !user.email_confirmed_at) return null;
    const ok = oppose ? await enregistrerOpposition(user.email, 'parametres') : await retirerOpposition(user.email);
    return ok ? oppose : null;
  } catch {
    return null;
  }
}
