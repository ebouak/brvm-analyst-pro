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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
