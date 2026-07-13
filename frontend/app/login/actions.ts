'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { recordAuthEvent } from '@/lib/server/authEvents';
import { isPasswordPwned, pwnedMessage } from '@/lib/server/pwned';

/**
 * Longueur minimale. Le plancher Supabase par défaut (6) est trop bas : la
 * longueur est le seul facteur qui compte vraiment face à une attaque hors ligne.
 */
const MIN_PASSWORD_LENGTH = 10;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function login(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email'));

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get('password')),
  });

  if (error) {
    // On journalise l'ÉCHEC : une série de tentatives ratées sur un compte est
    // le signal d'attaque le plus exploitable — et c'est précisément ce qu'on
    // ne voyait pas jusqu'ici.
    await recordAuthEvent({ event: 'sign_in_failed', email });
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  await recordAuthEvent({ event: 'sign_in', userId: data.user?.id ?? null, email });

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

const NEUTRAL_SIGNUP_MSG = 'Si cette adresse est éligible, un email de confirmation vient de vous être envoyé. Vérifiez votre boîte de réception.';

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email')).toLowerCase().trim();
  const password = String(formData.get('password'));

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(
      '/signup?error=' +
        encodeURIComponent(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`),
    );
  }

  // Refus des mots de passe déjà présents dans des fuites publiques.
  // Contrôlé AVANT signUp : inutile de créer un compte pour le rejeter ensuite.
  const pwned = await isPasswordPwned(password);
  if (pwned.pwned) {
    redirect('/signup?error=' + encodeURIComponent(pwnedMessage(pwned.count)));
  }

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Anti-énumération : ne JAMAIS révéler si l'email existe déjà. On répond la
    // même chose qu'en cas de succès. Seules les erreurs de validation neutres
    // (mot de passe trop faible, email mal formé) sont remontées telles quelles.
    if (/already|registered|exists|déjà/i.test(error.message)) {
      redirect('/login?message=' + encodeURIComponent(NEUTRAL_SIGNUP_MSG));
    }
    redirect('/signup?error=' + encodeURIComponent(error.message));
  }

  // Auto-abonnement newsletter à la création du compte.
  // Insert simple : un doublon (déjà inscrit via la landing) est sans gravité.
  await getAdminClient()
    .from('newsletter_subscribers')
    .insert({ email, source: 'signup', confirmed: true, confirmed_at: new Date().toISOString() })
    .then(() => null, () => null);

  redirect('/login?message=' + encodeURIComponent(NEUTRAL_SIGNUP_MSG));
}

export async function logout() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.auth.signOut();
  await recordAuthEvent({ event: 'sign_out', userId: user?.id ?? null, email: user?.email ?? null });

  revalidatePath('/', 'layout');
  redirect('/login');
}
