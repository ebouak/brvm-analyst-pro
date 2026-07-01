'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Actions de gestion des alertes (page /parametres/alertes).
 * Distinctes de updateAlert (portefeuille) qui impose seuil>0 : ici on veut un
 * simple toggle actif/inactif valable pour TOUS les types (y compris smart).
 * RLS + filtre explicite user_id → un utilisateur ne touche que ses alertes.
 */

export async function toggleAlert(id: string, actif: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await supabase.from('alerts').update({ actif }).eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath('/parametres/alertes');
  revalidatePath('/portefeuille');
  return { ok: true as const };
}

export async function removeAlert(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await supabase.from('alerts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath('/parametres/alertes');
  revalidatePath('/portefeuille');
  return { ok: true as const };
}
