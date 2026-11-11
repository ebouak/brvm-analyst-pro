/**
 * Construction PURE des adresses de redirection d'accès (connexion, porte Premium).
 *
 * Règle : la page d'origine voyage en entier (chemin ET query) dans `next` / `from`,
 * et la query d'origine n'est JAMAIS recopiée sur la page de destination — sinon
 * elle y serait lue comme des paramètres de /login et perdue après connexion.
 * Toute valeur relue passe par `nextSur` : chemin interne seulement.
 */
import { nextSur } from '@/lib/bienvenue/redirection';

/** `pathname` + `search` (avec ou sans « ? » initial), tels que vus par le middleware. */
export function cheminComplet(pathname: string, search: string | null | undefined): string {
  const s = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  return `${pathname}${s === '?' ? '' : s}`;
}

/** Adresse de connexion qui ramène à la page demandée, query comprise. */
export function urlConnexion(pathname: string, search: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(cheminComplet(pathname, search))}`;
}

/** Porte Premium : `from` = page d'origine (chemin + query), assaini. */
export function urlPortePremium(pathname: string, search: string | null | undefined): string {
  const from = nextSur(cheminComplet(pathname, search), '');
  return from ? `/premium/upgrade?from=${encodeURIComponent(from)}` : '/premium/upgrade';
}

/** Lien vers les formules, avec retour vers la page d'origine si elle est sûre. */
export function urlFormules(from: string | null | undefined, base = '/account/plan'): string {
  const sur = nextSur(from, '');
  return sur ? `${base}?from=${encodeURIComponent(sur)}` : base;
}

/** `from` relu d'une URL : assaini, ou null. */
export function fromSur(from: string | null | undefined): string | null {
  const sur = nextSur(from, '');
  return sur || null;
}

/** `from` porté par un `retour` du type « /account/plan?from=%2Fpremium%2Fdcf », assaini, ou null. */
export function fromDeRetour(retour: string | null | undefined): string | null {
  if (!retour || !retour.includes('?')) return null;
  return fromSur(new URLSearchParams(retour.slice(retour.indexOf('?') + 1)).get('from'));
}
