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

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email')).toLowerCase().trim();
  const { error } = await supabase.auth.signUp({
    email,
    password: String(formData.get('password')),
  });
  if (error) redirect('/signup?error=' + encodeURIComponent(error.message));

  // Auto-abonnement newsletter à la création du compte.
  // Insert simple : un doublon (déjà inscrit via la landing) est sans gravité.
  await getAdminClient()
    .from('newsletter_subscribers')
    .insert({ email, source: 'signup', confirmed: true, confirmed_at: new Date().toISOString() })
    .then(() => null, () => null);

  redirect('/login?message=' + encodeURIComponent('Compte créé, vérifiez vos emails puis connectez-vous.'));
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
