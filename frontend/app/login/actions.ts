'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuthEvent } from '@/lib/server/authEvents';

/**
 * Seule la déconnexion vit ici. La connexion et l'inscription passent par la
 * page /login (code e-mail, cf. Turnstile) ; les anciennes actions par mot de
 * passe, jamais importées, ont été supprimées (audit F-21) — l'une d'elles
 * inscrivait à la newsletter avec `confirmed: true`, sans consentement.
 */
export async function logout() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.auth.signOut();
  await recordAuthEvent({ event: 'sign_out', userId: user?.id ?? null, email: user?.email ?? null });

  revalidatePath('/', 'layout');
  redirect('/login');
}
