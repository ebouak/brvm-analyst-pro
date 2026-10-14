/** PostgREST plafonne une réponse à 1000 lignes, en silence. */
export const TAILLE_PAGE = 1000;

type Page<T> = (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Lit toutes les pages. Une erreur est levée (jamais un résultat partiel), et
 * dépasser `maxPages` lève aussi : mieux vaut un bloc indisponible qu'une
 * valorisation fausse et plausible.
 */
export async function toutesLesPages<T>(page: Page<T>, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  for (let n = 0; n < maxPages; n++) {
    const de = n * TAILLE_PAGE;
    const { data, error } = await page(de, de + TAILLE_PAGE - 1);
    if (error) throw new Error(error.message);
    const lignes = data ?? [];
    out.push(...lignes);
    if (lignes.length < TAILLE_PAGE) return out;
  }
  throw new Error(`plafond de ${maxPages} pages atteint`);
}
