/** Calculs purs des sections « thermomètre » et « Apprendre » de la landing (testés). */
import { NIVEAUX, type Niveau } from '@/lib/academy/types';

/** Points SVG d'une courbe 0-100 sur un axe vertical FIXE (la hauteur dit la tension, pas l'amplitude locale). */
export function pointsCourbe(valeurs: readonly number[], largeur: number, hauteur: number): string {
  const v = valeurs.filter((x) => Number.isFinite(x));
  if (v.length < 2) return '';
  const pas = largeur / (v.length - 1);
  return v
    .map((x, i) => `${(i * pas).toFixed(1)},${(hauteur - (Math.min(100, Math.max(0, x)) / 100) * hauteur).toFixed(1)}`)
    .join(' ');
}

/** Nom court de chaque niveau, tel qu'il figure dans les adresses des cours. */
export const NOMS_NIVEAUX: Record<Niveau, string> = {
  debutant: 'Initiation',
  intermediaire: 'Fondamental',
  avance: 'Technique',
  expert: 'Expert',
};

export interface NiveauParcours {
  niveau: Niveau;
  lecons: number;
}

/** Nombre de leçons par niveau, dans l'ordre du parcours ; null si un niveau manque (jamais de parcours partiel). */
export function parcoursDepuis(
  lignes: readonly { niveau: string | null; content: { lessons?: unknown } | null }[],
): NiveauParcours[] | null {
  const parNiveau = new Map<Niveau, number>();
  for (const l of lignes) {
    if (!l.niveau || !(NIVEAUX as readonly string[]).includes(l.niveau)) continue;
    const n = Array.isArray(l.content?.lessons) ? (l.content!.lessons as unknown[]).length : 0;
    if (n > 0) parNiveau.set(l.niveau as Niveau, (parNiveau.get(l.niveau as Niveau) ?? 0) + n);
  }
  if (!NIVEAUX.every((n) => parNiveau.has(n))) return null;
  return NIVEAUX.map((niveau) => ({ niveau, lecons: parNiveau.get(niveau)! }));
}
