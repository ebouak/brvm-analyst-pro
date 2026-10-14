/** Registre des widgets du dashboard + résolution du layout utilisateur (pur). */

export type WidgetKey =
  | 'etat' | 'comprendre' | 'seance' | 'agenda' | 'publications' | 'portefeuille'
  | 'signaux' | 'secteurs' | 'indices' | 'liquidite' | 'actus';

export interface WidgetMeta { key: WidgetKey; label: string; desc: string }

/** Registre, dans l'ordre du profil débutant (spec §3). */
export const WIDGETS: WidgetMeta[] = [
  { key: 'etat', label: 'Récit de séance', desc: 'La séance racontée : titre, chapô, six mesures' },
  { key: 'comprendre', label: 'Comprendre la séance', desc: 'La séance en constats simples' },
  { key: 'seance', label: 'Séance du jour', desc: 'Trajectoire des indices, largeur du marché, moteur de signaux' },
  { key: 'agenda', label: 'Agenda', desc: 'Dividendes et jours fermés des 30 prochains jours' },
  { key: 'publications', label: 'Publications', desc: 'Documents des émetteurs, 7 derniers jours' },
  { key: 'portefeuille', label: 'Mon portefeuille', desc: 'Valeur, plus-value latente, positions' },
  { key: 'signaux', label: 'Lecture et signaux', desc: "Ce que dit la séance, signaux d'opportunité" },
  { key: 'secteurs', label: 'Vos secteurs', desc: 'Perf du jour de vos secteurs favoris' },
  { key: 'indices', label: 'Mouvements et secteurs', desc: 'Plus fortes hausses et baisses, indices sectoriels' },
  { key: 'liquidite', label: 'Liquidité', desc: 'Facilité à échanger les valeurs' },
  { key: 'actus', label: 'Actualités et régions', desc: 'Actualités, motifs en séance, Afrique' },
];

/** Profil déduit des positions (spec §2) : rien n'est stocké. */
export type Profil = 'actif' | 'debutant';

/** Au moins une position détenue → investisseur actif. */
export function deduireProfil(nbPositions: number): Profil {
  return nbPositions > 0 ? 'actif' : 'debutant';
}

/** Débutant : comprendre la séance avant d'en voir le détail (spec §3). */
export const ORDRE_DEBUTANT: WidgetKey[] = WIDGETS.map((w) => w.key);

/** Actif : ce qui le concerne d'abord (spec §3). `comprendre` y figure mais masqué par défaut. */
export const ORDRE_ACTIF: WidgetKey[] = [
  'portefeuille', 'agenda', 'publications', 'etat', 'comprendre', 'seance',
  'liquidite', 'signaux', 'secteurs', 'indices', 'actus',
];

/** @deprecated Utiliser ORDRE_DEBUTANT ou ordreParDefaut(profil). Conservé pour compatibilité. */
export const DEFAULT_ORDER: WidgetKey[] = ORDRE_DEBUTANT;

/** Widgets présents dans le registre mais masqués tant que l'utilisateur ne les active pas. */
export const MASQUES_PAR_DEFAUT: Record<Profil, WidgetKey[]> = {
  actif: ['comprendre'],
  debutant: [],
};

export function ordreParDefaut(profil: Profil): WidgetKey[] {
  return profil === 'actif' ? ORDRE_ACTIF : ORDRE_DEBUTANT;
}

const VALID = new Set<string>(ORDRE_DEBUTANT);

export interface DashboardLayout { order?: string[]; hidden?: string[] }

/**
 * Résout l'ordre + la visibilité des widgets.
 * - Layout sauvegardé : il l'emporte TOUJOURS sur le profil (spec §2).
 * - Sinon : l'ordre par défaut du profil, moins ses masqués par défaut.
 * Tolérant : ignore les clés inconnues ; un widget absent du layout sauvegardé
 * est ajouté en fin, SAUF s'il est masqué par défaut pour ce profil (un layout
 * enregistré avant son apparition ne doit pas le faire surgir).
 * Retourne la liste ORDONNÉE des widgets VISIBLES.
 */
export function resolveLayout(saved: DashboardLayout | null | undefined, profil: Profil = 'debutant'): WidgetKey[] {
  const defaut = ordreParDefaut(profil);
  const masquesProfil = new Set<WidgetKey>(MASQUES_PAR_DEFAUT[profil]);
  const savedOrder = [...new Set((saved?.order ?? []).filter((k) => VALID.has(k)))] as WidgetKey[];
  const seen = new Set<string>(savedOrder);
  const hidden = new Set<string>((saved?.hidden ?? []).filter((k) => VALID.has(k)));
  for (const k of defaut) if (!seen.has(k) && masquesProfil.has(k)) hidden.add(k);
  const merged = [...savedOrder, ...defaut.filter((k) => !seen.has(k))];
  return merged.filter((k) => !hidden.has(k));
}

/** Trois niveaux de lecture (spec §4.0). `seance`, `indices` : contenu déjà en grille → pleine largeur. */
export type Largeur = 'pleine' | 'demi' | 'tiers';

export const LARGEUR: Record<WidgetKey, Largeur> = {
  portefeuille: 'pleine', etat: 'pleine', comprendre: 'pleine', seance: 'pleine', indices: 'pleine',
  agenda: 'demi', publications: 'demi', liquidite: 'demi',
  signaux: 'pleine', secteurs: 'tiers', actus: 'pleine',
};

export interface Rangee { largeur: Largeur; cles: WidgetKey[] }

const PAR_RANGEE: Record<Largeur, number> = { pleine: 1, demi: 2, tiers: 3 };

/** Regroupe les widgets CONSÉCUTIFS de même largeur, dans l'ordre du layout. */
export function grouperEnRangees(cles: WidgetKey[]): Rangee[] {
  const out: Rangee[] = [];
  for (const k of cles) {
    const l = LARGEUR[k];
    const derniere = out[out.length - 1];
    if (derniere && derniere.largeur === l && derniere.cles.length < PAR_RANGEE[l]) derniere.cles.push(k);
    else out.push({ largeur: l, cles: [k] });
  }
  return out;
}

/** Rangée de la surface unique : grille 12 colonnes, filet sous la rangée (spec §12). */
export function classeRangee(_r: Rangee): string {
  return 'grid grid-cols-1 border-b border-border lg:grid-cols-12';
}

const SPAN: Record<Largeur, string> = { pleine: 'lg:col-span-12', demi: 'lg:col-span-6', tiers: 'lg:col-span-4' };

/** Cellule d'une rangée : filet vertical entre cellules (horizontal quand empilées). */
export function classeCellule(largeur: Largeur, seule: boolean): string {
  return `min-w-0 ${seule ? 'lg:col-span-12' : SPAN[largeur]} border-t border-border first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0`;
}
