/**
 * Notes les plus proches d'un signal, pour la séance où le moteur s'abstient.
 *
 * POURQUOI (2026-10-31). 97,8 % des notes sont « conserver » : le bloc
 * « Signaux d'opportunité » était presque toujours vide. Abaisser le seuil
 * aurait fabriqué des recommandations, et le banc d'évaluation
 * (scraper/src/signaux/evaluation.ts) n'a prouvé aucun pouvoir prédictif des
 * notes. On montre donc les notes extrêmes de la séance, avec leur distance au
 * seuil — SANS les appeler « achat » ni « vente » : être proche du seuil n'est
 * pas un signal.
 */

/** Seuils du moteur (scraper/src/scoring/score.ts) : achat si > 0,6, vente si < −0,6. */
export const SEUIL_SIGNAL = 0.6;

export interface NoteSeance { code: string; score_total: number | null }
export interface NoteProche { code: string; score: number; ecart: number }

export function notesProches(notes: readonly NoteSeance[], n = 3): { hautes: NoteProche[]; basses: NoteProche[] } {
  const valides = notes
    .filter((x): x is { code: string; score_total: number } => typeof x.score_total === 'number' && Number.isFinite(x.score_total))
    .map((x) => ({ code: x.code, score: x.score_total }));
  const hautes = valides
    .filter((x) => x.score > 0 && x.score <= SEUIL_SIGNAL)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => ({ ...x, ecart: SEUIL_SIGNAL - x.score }));
  const basses = valides
    .filter((x) => x.score < 0 && x.score >= -SEUIL_SIGNAL)
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => ({ ...x, ecart: x.score + SEUIL_SIGNAL }));
  return { hautes, basses };
}
