'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function login(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  });
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

const NEUTRAL_SIGNUP_MSG = 'Si cette adresse est éligible, un email de confirmation vient de vous être envoyé. Vérifiez votre boîte de réception.';

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email')).toLowerCase().trim();
  const { error } = await supabase.auth.signUp({
    email,
    password: String(formData.get('password')),
  });

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
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
