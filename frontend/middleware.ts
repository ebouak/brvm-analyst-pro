import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Ancien domaine de prod → domaine officiel. Redirection 308 limitée à cet
// hôte EXACT (jamais *.vercel.app : les déploiements preview doivent rester
// accessibles sur leurs URLs Vercel).
const LEGACY_HOST = 'frontend-zeta-ten-22.vercel.app';
const CANONICAL_ORIGIN = 'https://www.westbourse.com';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  if (host === LEGACY_HOST) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
    return NextResponse.redirect(url, 308);
  }
  return await updateSession(request);
}

export const config = {
  // `mp4|webm` ajoutés le 2026-09-10. Sans eux, /landing-video.mp4 traversait
  // le middleware et repartait en 307 vers le mur d'authentification : le
  // <video> de ScreensShowcase recevait du HTML, et la section « La plateforme
  // en action » n'affichait qu'un cadre vide sur la landing PUBLIQUE.
  // L'affiche PNG passait, elle — d'où un défaut invisible au typecheck et
  // visible seulement à l'écran.
  // Aucun élargissement de surface exposée : tout `public/` est déjà servi
  // statiquement par Next, le middleware n'est pas ce qui le protège —
  // `_next/static` et les images en sont exclus pour la même raison.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)'],
};
