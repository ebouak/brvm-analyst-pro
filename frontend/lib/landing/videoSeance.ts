/**
 * Fiche de la dernière vidéo de séance, publiée par le worker `video/`.
 *
 * La source est un objet du bucket public `seance-video`, pas une table : la
 * vidéo n'existe qu'en tant que fichier, et lui adjoindre une table n'aurait
 * rien apporté de plus que ce JSON.
 *
 * Aucune donnée personnelle, lecture publique : pas de clé de service ici.
 */

export type VideoSeance = {
  /** Date de la séance couverte par la vidéo, ISO. Peut être antérieure à la
   *  dernière séance du site si le worker n'a pas encore tourné. */
  seance: string;
  date_fr: string;
  valeurs: number;
  hausses: number;
  baisses: number;
  stables: number;
  capitaux_fcfa: number;
  capitaux_estimes: boolean;
  composite: { valeur: number; variation_pct: number } | null;
  duree_s: number;
  /** Texte lu par la voix — sert de transcription accessible. */
  texte: string;
  url: string;
  affiche: string | null;
};

const CHEMIN = 'storage/v1/object/public/seance-video/derniere.json';

/**
 * Renvoie `null` si aucune vidéo n'est publiée, ou si la fiche est incomplète.
 * Une section absente vaut mieux qu'un lecteur vide : la landing gère déjà ce
 * cas partout ailleurs.
 */
export async function getVideoSeance(): Promise<VideoSeance | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  try {
    const r = await fetch(`${base}/${CHEMIN}`, {
      // Le fichier change une fois par séance ; cinq minutes suffisent.
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Partial<VideoSeance>;
    // Sans URL ni date il n'y a rien à montrer d'honnête.
    if (!d.url || !d.seance || !d.date_fr) return null;
    return d as VideoSeance;
  } catch {
    return null;
  }
}
