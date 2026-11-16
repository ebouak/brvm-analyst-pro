// Graphique avancé : modèle des dessins et validation (pur).
//
// Les dessins enregistrés par un compte reviennent de la base sous forme de
// JSON : ils sont REVALIDÉS à la lecture (type connu, dates et prix valides,
// texte borné) avant d'être affichés. Une entrée invalide est écartée.

import type { Ancre } from './geometrie';

export type TypeDessin =
  | 'horizontale'
  | 'tendance'
  | 'segment'
  | 'rectangle'
  | 'fibonacci'
  | 'texte'
  | 'mesure';

export interface Dessin {
  id: string;
  type: TypeDessin;
  a: Ancre;
  b?: Ancre;
  texte?: string;
  couleur: string;
  epaisseur: 1 | 2 | 3;
}

export const OUTILS_DEUX_POINTS: readonly TypeDessin[] = ['tendance', 'segment', 'rectangle', 'fibonacci', 'mesure'];

export const COULEURS_DESSIN = [
  { valeur: 'accent', libelle: 'Cyan' },
  { valeur: 'warn', libelle: 'Ambre' },
  { valeur: 'up', libelle: 'Vert' },
  { valeur: 'down', libelle: 'Rouge' },
  { valeur: 'ivory', libelle: 'Clair' },
] as const;

export const MAX_DESSINS = 200;
export const MAX_TEXTE = 120;

const TYPES = new Set<TypeDessin>(['horizontale', 'tendance', 'segment', 'rectangle', 'fibonacci', 'texte', 'mesure']);
const COULEURS = new Set<string>(COULEURS_DESSIN.map((c) => c.valeur));

function ancre(v: unknown): Ancre | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const t = typeof o.t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.t) ? o.t : null;
  const p = typeof o.p === 'number' && Number.isFinite(o.p) && o.p > 0 && o.p < 1e9 ? o.p : null;
  return t && p != null ? { t, p } : null;
}

export function validerDessins(brut: unknown): Dessin[] {
  if (!Array.isArray(brut)) return [];
  const out: Dessin[] = [];
  for (const v of brut.slice(0, MAX_DESSINS)) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const type = o.type as TypeDessin;
    if (!TYPES.has(type)) continue;
    const a = ancre(o.a);
    if (!a) continue;
    const deuxPoints = OUTILS_DEUX_POINTS.includes(type);
    const b = deuxPoints ? ancre(o.b) : null;
    if (deuxPoints && !b) continue;
    const texte = type === 'texte' && typeof o.texte === 'string' ? o.texte.trim().slice(0, MAX_TEXTE) : undefined;
    if (type === 'texte' && !texte) continue;
    const id = typeof o.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(o.id) ? o.id : null;
    if (!id) continue;
    const couleur = typeof o.couleur === 'string' && COULEURS.has(o.couleur) ? o.couleur : 'accent';
    const epaisseur = o.epaisseur === 2 || o.epaisseur === 3 ? o.epaisseur : 1;
    out.push({ id, type, a, ...(b ? { b } : {}), ...(texte ? { texte } : {}), couleur, epaisseur });
  }
  return out;
}

/** Déplace un dessin d'un nombre de pas de temps (via `decaler`) et d'un écart de prix relatif. */
export function deplacerDessin(d: Dessin, decalerDate: (t: string) => string, facteurPrix: number): Dessin {
  const bouger = (x: Ancre): Ancre => ({ t: decalerDate(x.t), p: x.p * facteurPrix });
  return { ...d, a: bouger(d.a), ...(d.b ? { b: bouger(d.b) } : {}) };
}

export const LIBELLES_OUTILS: Record<TypeDessin, string> = {
  horizontale: 'Ligne horizontale',
  tendance: 'Ligne de tendance',
  segment: 'Segment',
  rectangle: 'Rectangle',
  fibonacci: 'Retracement de Fibonacci',
  texte: 'Annotation',
  mesure: 'Mesure',
};
