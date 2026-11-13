import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/server/admin-emails';
import { urlConnexion, urlPortePremium } from '@/lib/auth/urlsAcces';
import { isPublicPath } from '@/lib/auth/cheminsPublics';
import { estCheminPremium } from '@/lib/auth/cheminsPremium';
import { secretRenduValide, EN_TETE_RENDU, PREFIXE_RENDU } from '@/lib/dossier/renduAutorise';

type CookieToSet = { name: string; value: string; options: CookieOptions };


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
  if (!request.nextUrl.pathname.startsWith(PREFIXE_RENDU)) return false;
  return secretRenduValide(process.env.DOSSIER_RENDER_SECRET, request.headers.get(EN_TETE_RENDU));
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
    // `next` = chemin + query d'origine ; la query n'est pas recopiée sur /login
    // (elle y serait lue comme paramètres de connexion et perdue après).
    return NextResponse.redirect(
      new URL(urlConnexion(request.nextUrl.pathname, request.nextUrl.search), request.url),
    );
  }

  // Gating /premium/* : vérifie is_premium sauf super admin
  if (estCheminPremium(request.nextUrl.pathname)) {

    if (!user) {
      return NextResponse.redirect(
        new URL(urlConnexion(request.nextUrl.pathname, request.nextUrl.search), request.url),
      );
    }

    // Super admin bypass
    if (!isAdminEmail(user.email)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      if (!profile?.is_premium) {
        // `from` = page demandée (chemin + query), pour que la porte sache d'où
        // l'on vient et puisse y ramener après l'abonnement.
        return NextResponse.redirect(
          new URL(urlPortePremium(request.nextUrl.pathname, request.nextUrl.search), request.url),
        );
      }
    }
  }

  return response;
}
