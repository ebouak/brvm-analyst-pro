/**
 * Classement des événements d'une valeur (saisonnalité v2, lot 3) — PUR, testé.
 * Plan : docs/superpowers/plans/2026-11-10-saisonnalite-v2-lot3.md.
 *
 * Les titres de publications sont classés par mots-clés : un titre ambigu est
 * laissé de côté (null), jamais deviné.
 */

export type TypeEvenement =
  | 'detachement'
  | 'comptes_annuels'
  | 'comptes_semestriels'
  | 'convocation_ag'
  | 'suspension'
  | 'avertissement';

export interface Evenement { type: TypeEvenement; date: string }

/** Types qui ont une fenêtre d'événement (assez nombreux pour une moyenne). */
export const TYPES_FENETRE: TypeEvenement[] = ['detachement', 'comptes_annuels', 'comptes_semestriels', 'convocation_ag'];

/** Minuscules, sans accents : les titres BRVM sont saisis de façons variées. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DOC_COMPTES = /(etats? financiers|comptes|rapport d.?activites?|rapport annuel|resultats|bilan)/;

export function classerPublication(libelle: string, type: string | null): TypeEvenement | null {
  const t = norm(libelle);
  if (/(avertissement sur (les )?resultats?|profit warning)/.test(t)) return 'avertissement';
  if ((type ?? '') === 'ag') {
    return /convocation/.test(t) && !/(annulation|report)/.test(t) ? 'convocation_ag' : null;
  }
  if (/trimestr/.test(t)) return null;
  if (/semestr/.test(t) && DOC_COMPTES.test(t)) return 'comptes_semestriels';
  if (/exercice\s+20\d\d/.test(t) && DOC_COMPTES.test(t)) return 'comptes_annuels';
  return null;
}

/** Un avis de reprise de cotation n'est pas une suspension. */
export const suspensionUtile = (titre: string) => !/reprise/.test(norm(titre));

/**
 * Un même événement est souvent publié plusieurs fois (états financiers puis
 * rapport annuel, rectificatif) : par type, on garde la première date et on
 * écarte celles qui la suivent de moins de `jours` jours.
 */
export function dedoublonner(evts: Evenement[], jours = 30): Evenement[] {
  const tries = [...evts].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  const dernier = new Map<TypeEvenement, string>();
  const out: Evenement[] = [];
  for (const e of tries) {
    const prec = dernier.get(e.type);
    if (prec && (Date.parse(e.date) - Date.parse(prec)) / 86_400_000 < jours) continue;
    dernier.set(e.type, e.date);
    out.push(e);
  }
  return out;
}
