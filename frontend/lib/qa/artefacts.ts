/**
 * Accès admin à une pièce jointe de test (capture, trace, vidéo, rapport).
 *
 * Le bucket qa-artefacts est privé et sans policy : rien n'y est lisible sans
 * passer par ici. La route vérifie d'abord qa.read + 2FA (requireAdminApi),
 * puis redirige vers une URL signée de courte durée. Un fichier non reçu ou
 * purgé est déclaré indisponible, jamais servi à moitié.
 */

export const DUREE_URL_LECTURE_S = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ArtefactLu {
  chemin: string;
  type: 'capture' | 'trace' | 'video' | 'rapport_html';
  statut: 'attendu' | 'televerse' | 'purge';
}

export interface DepsLecture {
  lire(id: string): Promise<ArtefactLu | null>;
  /** URL signée ; `telechargement` force un nom de fichier (sinon affichage dans le navigateur). */
  signerLecture(chemin: string, dureeS: number, telechargement: string | null): Promise<string>;
}

export type IssueLecture =
  | { status: 302; url: string }
  | { status: 404 | 410; error: string };

export async function traiterLectureArtefact(id: string, deps: DepsLecture): Promise<IssueLecture> {
  if (!UUID.test(id)) return { status: 404, error: 'Pièce jointe introuvable' };
  const a = await deps.lire(id);
  if (!a) return { status: 404, error: 'Pièce jointe introuvable' };
  if (a.statut === 'purge') return { status: 410, error: 'Pièce jointe purgée (conservation de 30 jours)' };
  if (a.statut !== 'televerse') return { status: 404, error: "Pièce jointe non reçue : la CI ne l'a pas téléversée" };
  // Une capture s'affiche ; une trace, une vidéo ou un rapport zippé se télécharge.
  const nom = a.type === 'capture' ? null : a.chemin.split('/').pop() ?? 'piece-jointe';
  return { status: 302, url: await deps.signerLecture(a.chemin, DUREE_URL_LECTURE_S, nom) };
}
