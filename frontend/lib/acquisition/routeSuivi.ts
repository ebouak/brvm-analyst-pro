import 'server-only';
import { NextResponse, after } from 'next/server';
import { destination, doitCompter, evenementVisite, normaliserSrc, type Cible } from './suivi';
import { incrementerAcquisition } from './compteur';

/**
 * /chaine et /telegram : compte la visite (agrégée, sans donnée personnelle) puis
 * redirige en 302 vers NOTRE canal — la destination ne vient jamais de l'URL.
 * L'incrément part APRÈS la réponse (`after`) : la redirection n'attend pas la base.
 * `no-store` : un 302 mis en cache par le CDN ne repasserait plus par ici.
 */
export function repondreSuivi(request: Request, cible: Cible): NextResponse {
  const src = normaliserSrc(new URL(request.url).searchParams.get('src'));
  const compter = doitCompter({
    methode: request.method,
    userAgent: request.headers.get('user-agent'),
    purpose: request.headers.get('sec-purpose') ?? request.headers.get('purpose'),
  });
  if (compter) after(() => incrementerAcquisition(src, evenementVisite(cible)).then(() => undefined));
  const r = NextResponse.redirect(destination(cible), 302);
  r.headers.set('Cache-Control', 'no-store, max-age=0');
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  r.headers.set('Referrer-Policy', 'no-referrer');
  return r;
}
