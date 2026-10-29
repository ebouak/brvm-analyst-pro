/**
 * Choix de l'article « à la une » de la landing.
 *
 * Un décryptage récent passe devant : c'est notre analyse la plus construite,
 * alors qu'un rappel de paiement de dividende vieillit en une journée. Au-delà
 * de `FRAICHEUR_UNE_JOURS`, il redevient un article comme les autres et la une
 * revient au plus récent — une landing qui afficherait en tête une analyse de
 * trois mois laisserait croire qu'elle est d'aujourd'hui.
 */
export interface ArticleLanding {
  slug: string;
  type: string;
  code: string | null;
  titre: string;
  chapo: string;
  date_fait: string;
  publie_le: string | null;
}

export const FRAICHEUR_UNE_JOURS = 30;
export const NB_AUTRES = 3;

/** `articles` arrive trié du plus récent au plus ancien (publie_le desc). */
export function choisirUne(
  articles: ArticleLanding[],
  maintenant: Date,
): { une: ArticleLanding | null; autres: ArticleLanding[] } {
  if (articles.length === 0) return { une: null, autres: [] };
  const limite = maintenant.getTime() - FRAICHEUR_UNE_JOURS * 86_400_000;
  const decryptage = articles.find(
    (a) => a.type === 'decryptage' && a.publie_le != null && new Date(a.publie_le).getTime() >= limite,
  );
  const une = decryptage ?? articles[0];
  return { une, autres: articles.filter((a) => a !== une).slice(0, NB_AUTRES) };
}
