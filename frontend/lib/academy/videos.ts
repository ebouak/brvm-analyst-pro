import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Vidéos des leçons de l'Academy, rangées dans le bucket PRIVÉ `academy-videos`
 * sous <slug>/lecon-<n>.mp4 (n 1-indexé, comme ?lecon=n dans l'URL).
 *
 * Le fichier fait foi : une leçon a une vidéo si et seulement si le fichier
 * existe. Aucune table à tenir en double, donc rien qui puisse annoncer une
 * vidéo absente.
 */
export const BUCKET_VIDEOS = 'academy-videos';

export const SLUG_VALIDE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const FICHIER_VALIDE = /^lecon-([1-9]\d?)\.(mp4|jpg)$/;

/** Numéros de leçon (1-indexés) dont la vidéo .mp4 figure parmi `noms`. */
export function numerosVideo(noms: string[]): number[] {
  const n = new Set<number>();
  for (const nom of noms) {
    const m = FICHIER_VALIDE.exec(nom);
    if (m && m[2] === 'mp4') n.add(Number(m[1]));
  }
  return [...n].sort((a, b) => a - b);
}

/**
 * Leçons du cours qui ont une vidéo. Une erreur de stockage (bucket absent
 * avant la migration 0154, panne) rend une liste vide : la leçon s'affiche
 * alors sans lecteur, jamais avec un lecteur cassé.
 */
export async function videosDisponibles(slug: string): Promise<number[]> {
  if (!SLUG_VALIDE.test(slug)) return [];
  try {
    const { data, error } = await getServiceClient().storage.from(BUCKET_VIDEOS).list(slug, { limit: 100 });
    if (error || !data) return [];
    return numerosVideo(data.map((o) => o.name));
  } catch {
    return [];
  }
}
