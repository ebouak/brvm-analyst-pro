// Échange le code OAuth (Google) contre une session Supabase, puis redirige.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enregistrerPays } from '@/lib/crm/geoServeur';
import { estNouveauCompte, nextSur, versEcranWhatsapp } from '@/lib/bienvenue/redirection';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = nextSur(searchParams.get('next'));

  if (!code) {
    console.error('auth/callback: aucun code dans l\'URL de retour OAuth', {
      url: request.url,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Authentification échouée, réessayez.')}`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('auth/callback: exchangeCodeForSession a échoué', {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Authentification échouée, réessayez.')}`,
    );
  }

  // Premier passage d'un nouveau compte : écran WhatsApp facultatif (une seule fois).
  const { data: { user } } = await supabase.auth.getUser();
  // Pays du compte (en-tête Vercel, côté serveur) : best-effort, jamais bloquant.
  // Sans attendre : la redirection ne doit pas dépendre de cette écriture (enregistrerPays ne lève jamais).
  if (user) void enregistrerPays(user.id, request.headers).catch(() => {});
  const destination = user && estNouveauCompte(user.created_at, new Date()) ? versEcranWhatsapp(next) : next;
  return NextResponse.redirect(`${origin}${destination}`);
}
