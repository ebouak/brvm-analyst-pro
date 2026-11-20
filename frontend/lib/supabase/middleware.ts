import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/server/admin-emails';
import { destinationInscritConnecte, urlConnexion, urlPortePremium } from '@/lib/auth/urlsAcces';
import { isPublicPath } from '@/lib/auth/cheminsPublics';
import { estCheminPremium } from '@/lib/auth/cheminsPremium';
import { secretRenduValide, EN_TETE_RENDU, PREFIXE_RENDU } from '@/lib/dossier/renduAutorise';
import { EN_TETE_RELEVE, PREFIXE_RELEVE, jetonRenduPlausible } from '@/lib/releve/renduAutorise';

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

/**
 * Rendu du RELEVÉ mensuel (portefeuille privé) : le worker d'impression présente
 * un jeton à usage unique dans `x-releve-render`. Ici on ne valide QUE la forme
 * (32 octets en hexadécimal) pour ne pas rediriger le robot vers /login : la
 * page /rapports/releve/[id] est la seule autorité (empreinte, expiration,
 * relevé visé, consommation). Une requête sans session ni jeton de bonne forme
 * est redirigée comme n'importe quelle page fermée. Ne concerne pas le préfixe
 * du dossier valeur, qui garde son propre secret.
 */
function porteUnJetonDeReleve(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith(PREFIXE_RELEVE)) return false;
  return jetonRenduPlausible(request.headers.get(EN_TETE_RELEVE));
}

/**
 * Le visiteur porte-t-il un cookie de session Supabase (`sb-<ref>-auth-token`,
 * éventuellement découpé en `.0`, `.1`…) ? PUR, testé.
 */
export function porteCookieSession(noms: string[]): boolean {
  return noms.some((n) => n.startsWith('sb-') && n.includes('-auth-token'));
}

export async function updateSession(request: NextRequest) {
  // Chemin court (2026-11-18, quota CPU Vercel) : un visiteur SANS cookie de
  // session sur une page publique n'a rien à rafraîchir ni à vérifier. Le
  // middleware s'exécute à CHAQUE requête, y compris celles servies ensuite
  // depuis le cache : on n'y construit plus de client Supabase pour rien.
  // Sans cookie, `getClaims()` rendait de toute façon `null` : le résultat
  // est identique (aucune redirection sur un chemin public).
  const sansSession = !porteCookieSession(request.cookies.getAll().map((c) => c.name));
  if (sansSession && isPublicPath(request.nextUrl.pathname) && !estCheminPremium(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

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

  // `getClaims()` et non `getUser()` (règle 3 de l'audit de performance).
  // `getUser()` interroge Supabase Auth à CHAQUE navigation ; `getClaims()`
  // rafraîchit la session si besoin (comme avant), puis vérifie la SIGNATURE du
  // jeton sur place avec la clé publique ECC du projet, mise en cache dans le
  // module. Si le jeton est signé en symétrique (HS*) ou si WebCrypto manque,
  // la bibliothèque retombe d'elle-même sur `getUser()`.
  // Limite connue et acceptée : un compte supprimé garde l'accès au mur jusqu'à
  // l'expiration de son jeton (1 h au plus). Les pages et les API revérifient
  // l'utilisateur côté serveur (`utilisateurCourant`, `getUser`).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;
  const user = claims?.sub
    ? { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined }
    : null;

  // Déjà connecté sur /signup?next=… (bouton « Recevoir mes alertes » d'une page
  // ISR, qui ne lit pas la session) : directement vers `next`. Les cookies
  // éventuellement rafraîchis voyagent avec la redirection.
  const versNext = user ? destinationInscritConnecte(request.nextUrl.pathname, request.nextUrl.searchParams.get('next')) : null;
  if (versNext) {
    const r = NextResponse.redirect(new URL(versNext, request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  }

  // Mur d'authentification : hors vitrine SEO, un anonyme est renvoyé vers /login
  // (avec ?next pour revenir après connexion). Les pages publiques restent
  // indexables ; l'app interactive exige un compte.
  if (!user && !isPublicPath(request.nextUrl.pathname) && !isRenderAuthorized(request) && !porteUnJetonDeReleve(request)) {
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

  // Un relevé contient un portefeuille : jamais de mise en cache, ni navigateur ni CDN.
  if (request.nextUrl.pathname.startsWith(PREFIXE_RELEVE)) {
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}
