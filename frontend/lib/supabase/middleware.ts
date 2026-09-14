import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const SUPER_ADMIN_EMAIL = 'ebouak@gmail.com';

/**
 * Vitrine SEO ouverte / app fermée.
 *
 * Un visiteur NON connecté ne voit que les pages « vitrine » (contenu indexable
 * par Google et les IA + acquisition). Tout le reste — l'application interactive
 * — exige un compte. La liste publique = exactement la surface du sitemap, plus
 * les nécessités techniques (auth, api, sitemap, robots, widgets embarqués).
 *
 * Pour ouvrir/fermer une page : éditer PUBLIC_EXACT / PUBLIC_PREFIXES ci-dessous.
 */
const PUBLIC_EXACT = new Set<string>([
  '/', '/login', '/signup', '/pricing',
  '/mentions-legales', '/cgu', '/confidentialite',
  '/methodologie', '/debutant', '/developers',
  '/rendement-vrai', '/fiscalite', '/simulateur-budget',
  '/comparateur-sgi', '/actualites', '/formations',
  '/robots.txt', '/sitemap.xml', '/manifest.webmanifest',
]);
const PUBLIC_PREFIXES = [
  '/societes',   // fiches sociétés (SEO)
  '/analyses',   // pages citables (GEO)
  '/brief',      // briefs de séance datés (SEO)
  '/simulateur', // simulateur d'investissement public (/simulateur/[code])
  '/embed',      // widgets embarqués sur des sites tiers
  '/certificat', // vérification publique d'un certificat Academy
  '/auth',       // callback Supabase
  '/api',        // routes API (gèrent leur propre auth)
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Rendu serveur-à-serveur du dossier valeur : video/dossiers.mjs imprime la
 * page en PDF avec Chromium, sans session. Il présente DOSSIER_RENDER_SECRET
 * dans un en-tête — jamais dans l'URL, qui finirait dans les journaux d'accès.
 *
 * Ouvert pour CE SEUL préfixe. La page ne contient que des données de marché,
 * aucune donnée utilisateur : si le secret fuyait, l'exposition serait un
 * rapport lisible par tout abonné, pas un portefeuille. Comparaison à temps
 * constant écrite à la main : node:crypto n'existe pas en Edge. Un secret de
 * moins de 32 caractères est refusé — mieux vaut un cron en échec qu'un mur
 * gardé par « test ».
 */
function isRenderAuthorized(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith('/rapports/dossier/')) return false;
  const attendu = process.env.DOSSIER_RENDER_SECRET;
  const fourni = request.headers.get('x-dossier-render');
  if (!attendu || !fourni || attendu.length < 32) return false;
  let diff = attendu.length ^ fourni.length;
  for (let i = 0; i < attendu.length; i++) {
    diff |= attendu.charCodeAt(i) ^ (fourni.charCodeAt(i % fourni.length) || 0);
  }
  return diff === 0;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Mur d'authentification : hors vitrine SEO, un anonyme est renvoyé vers /login
  // (avec ?next pour revenir après connexion). Les pages publiques restent
  // indexables ; l'app interactive exige un compte.
  if (!user && !isPublicPath(request.nextUrl.pathname) && !isRenderAuthorized(request)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Gating /premium/* : vérifie is_premium sauf super admin
  if (request.nextUrl.pathname.startsWith('/premium') &&
      !request.nextUrl.pathname.startsWith('/premium/upgrade')) {

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Super admin bypass
    if (user.email !== SUPER_ADMIN_EMAIL) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      if (!profile?.is_premium) {
        const url = request.nextUrl.clone();
        url.pathname = '/premium/upgrade';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
