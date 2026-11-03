/**
 * Nettoyage d'un message d'erreur Playwright AVANT stockage.
 *
 * Une erreur de test recopie ce que la page ou le réseau lui a montré : un
 * en-tête, une URL, un cookie de session du compte de test. Rien de cela ne
 * doit atteindre la base ni l'écran d'administration. On masque large : un
 * diagnostic un peu moins lisible vaut mieux qu'un jeton recopié.
 */

export const LONGUEUR_MAX_ERREUR = 4000;
const MASQUE = '[masqué]';
const TRONQUE = '\n[tronqué]';

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const CLE_SUPABASE = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g;
const CLE_SK = /\bsk-[A-Za-z0-9_-]{16,}/g;
const BEARER = /(Bearer\s+)[^\s"']+/gi;
const COOKIE = /^(\s*(?:set-)?cookie:\s*).+$/gim;
const PARAMETRE = /(\b(?:access_token|refresh_token|token|apikey|api_key|key|secret|password|code)=)[^&\s#"']*/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function nettoyerErreur(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const propre = brut
    .replace(ANSI, '')
    .replace(JWT, MASQUE)
    .replace(CLE_SUPABASE, MASQUE)
    .replace(CLE_SK, MASQUE)
    .replace(BEARER, `$1${MASQUE}`)
    .replace(COOKIE, `$1${MASQUE}`)
    .replace(PARAMETRE, `$1${MASQUE}`)
    .replace(EMAIL, '[e-mail]')
    .trim();
  if (!propre) return null;
  return propre.length > LONGUEUR_MAX_ERREUR
    ? propre.slice(0, LONGUEUR_MAX_ERREUR - TRONQUE.length) + TRONQUE
    : propre;
}
