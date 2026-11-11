/**
 * Fragments de TOUTES les pages d'un Bulletin Officiel de la Cote.
 *
 * Même extraction que le carnet (`carnet/fetch.ts`) : pdfjs, abscisse et
 * ordonnée de chaque fragment. La largeur est gardée pour recoller un mot que
 * le PDF aurait coupé en deux fragments.
 */
import type { FragmentPdf } from '../carnet/parse.js';

export async function fragmentsDesPages(pdf: Uint8Array): Promise<FragmentPdf[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdfjs détache le tampon qu'on lui passe : on lui en donne une copie.
  const doc = await pdfjs.getDocument({ data: pdf.slice(), useSystemFonts: true }).promise;
  const pages: FragmentPdf[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const contenu = await (await doc.getPage(n)).getTextContent();
    const items = contenu.items as { str?: string; transform?: number[]; width?: number }[];
    pages.push(
      items
        .filter((i) => typeof i.str === 'string' && i.str.trim() !== ''
          && typeof i.transform?.[4] === 'number' && typeof i.transform?.[5] === 'number')
        .map((i) => ({
          x: i.transform![4] as number,
          y: i.transform![5] as number,
          texte: i.str!,
          largeur: typeof i.width === 'number' ? i.width : undefined,
        })),
    );
  }
  await doc.destroy();
  return pages;
}
