import {
  REGISTRE,
  RUBRIQUES,
  entreesPalette,
  trouverEntree,
  chaineParents,
  remplirChemin,
  libelleRubrique,
  type Rubrique,
} from '@/lib/navRegistre';

export { MENU_COMPTE } from '@/lib/navRegistre';

export interface NavItem {
  href: string;
  label: string;
  premium?: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Conservé pour les appelants ; plus aucun groupe admin dans ce menu (console /admin à part). */
  adminOnly?: boolean;
}

/**
 * Menu à six rubriques (variante ambitieuse, spec 2026-11-11 §5), DÉRIVÉ du
 * registre lib/navRegistre.ts : l'ordre des entrées y est celui du registre.
 * Pour ajouter, retirer ou renommer une entrée : éditer le registre, jamais ici.
 * Premium est une marque sur l'entrée (cadenas, ?from=), plus une rubrique.
 * Le compte vit dans le menu de l'avatar (MENU_COMPTE), l'admin aussi.
 */
export const NAV_GROUPS: NavGroup[] = RUBRIQUES.map((r) => ({
  label: r.libelle,
  items: REGISTRE.filter((e) => e.statut === 'menu' && e.rubrique === r.id).map((e) => ({
    href: e.chemin,
    label: e.libelleMenu ?? e.libelle,
    ...(e.premium ? { premium: true } : {}),
  })),
}));

/**
 * Pages hors menu indexées par la palette (et par la liste blanche du
 * Copilote) : statuts `secondaire` et `public` du registre, hors pages
 * dynamiques et hors accueil.
 */
export const PALETTE_EXTRA: NavItem[] = entreesPalette()
  .filter((e) => e.statut !== 'menu')
  .map((e) => ({ href: e.chemin, label: e.libelle, ...(e.premium ? { premium: true } : {}) }));

/**
 * Élément actif, cohérent sidebar / tiroir / barre du bas : une entrée est
 * active si elle est la page courante OU l'un de ses parents dans le registre
 * (lib/navRegistre.ts). Ainsi /veille allume « Actualités », /premium/dcf
 * allume « Valorisation », /comparateur-sgi/annuaire allume « Choisir sa SGI »
 * (défauts P1-2 et P1-3 de la spec). Une adresse absente du registre (console
 * /admin) garde l'ancienne règle par préfixe.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  const c = trouverEntree(pathname);
  if (c) return chaineParents(c.entree).some((e) => e.chemin === href);
  // Routes à correspondance exacte (sinon « /admin » resterait actif sur ses sous-pages).
  if (href === '/dashboard' || href === '/admin' || href === '/conseiller') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface MaillonFil {
  libelle: string;
  /** `null` : maillon non cliquable (page courante, ou adresse impossible à reconstituer). */
  href: string | null;
}

export interface Fil {
  /** Libellé de la rubrique (texte, ce n'est pas une page), ou `null`. */
  rubrique: string | null;
  /** De la racine à la page courante incluse. */
  maillons: MaillonFil[];
  /** La page refuse le fil (sortie d'impression). */
  sansFil: boolean;
}

function decoder(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/**
 * Fil d'Ariane d'une adresse, tiré du registre. Le dernier maillon prend
 * `libelleDernier` s'il est fourni par la page ; sinon, pour une page
 * dynamique déclarée `libelleParam`, la valeur réelle du dernier paramètre de
 * l'adresse ; sinon le libellé du modèle de route. Jamais une valeur inventée.
 * `null` si l'adresse n'est pas dans le registre.
 */
export function construireFil(pathname: string, libelleDernier?: string | null): Fil | null {
  const c = trouverEntree(pathname);
  if (!c) return null;
  const chaine = chaineParents(c.entree);
  const maillons = chaine.map((e, i) => {
    const dernier = i === chaine.length - 1;
    let libelle = e.libelle;
    if (e.libelleParam) {
      const noms = [...e.chemin.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      const v = c.params[noms[noms.length - 1]];
      if (v) libelle = decoder(v);
    }
    if (dernier && libelleDernier && libelleDernier.trim()) libelle = libelleDernier.trim();
    return { libelle, href: dernier ? null : remplirChemin(e.chemin, c.params) };
  });
  const racine = chaine[0];
  return { rubrique: libelleRubrique(racine.rubrique ?? c.entree.rubrique), maillons, sansFil: Boolean(c.entree.sansFil) };
}

/**
 * Libellé de la page demandée, tiré du registre de navigation (menu puis liste
 * secondaire). Correspondance exacte d'abord, puis préfixe le plus long ; `null`
 * si la page n'y figure pas (l'appelant écrit alors un texte générique).
 * La query est ignorée.
 */
export function libellePage(chemin: string | null | undefined): string | null {
  if (!chemin) return null;
  const path = chemin.split(/[?#]/)[0];
  const tous = [...NAV_GROUPS.filter((g) => !g.adminOnly).flatMap((g) => g.items), ...PALETTE_EXTRA];
  const exact = tous.find((i) => i.href === path);
  if (exact) return exact.label;
  const prefixes = tous
    .filter((i) => i.href !== '/' && path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return prefixes[0]?.label ?? null;
}

/** Rubrique de la page servie à `pathname` (registre), ou `null` (compte, légal, admin…). */
export function rubriqueDe(pathname: string): Rubrique | null {
  return trouverEntree(pathname)?.entree.rubrique ?? null;
}
