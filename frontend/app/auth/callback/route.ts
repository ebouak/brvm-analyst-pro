// Échange le code OAuth (Google) contre une session Supabase, puis redirige.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

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

  return NextResponse.redirect(`${origin}${next}`);
}
