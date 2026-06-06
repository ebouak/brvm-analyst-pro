'use client';

/**
 * Lecture de PDF côté navigateur (pdf.js). Renvoie soit le texte (PDF natif),
 * soit des images des 6 premières pages (PDF scanné, pour la voie vision LLM).
 */
import * as pdfjs from 'pdfjs-dist';

// Le worker pdf.js 4.x est un module ESM (.mjs) ; on le sert depuis /public
// pour éviter que webpack/Terser ne le re-minifie comme un script classique.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const TEXT_MIN = 200;
const MAX_TEXT = 45000;
const VISION_PAGES = 4;        // bilan + compte de résultat tiennent en 4 pages
const RENDER_SCALE = 1.4;      // ~100 dpi : lisible mais léger
const JPEG_QUALITY = 0.7;      // JPEG compressé (bien plus léger que PNG)
const MAX_PAYLOAD = 3_800_000; // borne sous la limite Vercel (~4,5 Mo body)

export interface PdfResult {
  mode: 'text' | 'vision';
  text?: string;
  images?: string[];
}

export async function readPdf(file: File): Promise<PdfResult> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  let text = '';
  const nText = Math.min(doc.numPages, 30);
  for (let i = 1; i <= nText; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
    if (text.length > MAX_TEXT) break;
  }
  if (text.trim().length >= TEXT_MIN) {
    return { mode: 'text', text: text.slice(0, MAX_TEXT) };
  }

  const images: string[] = [];
  const nImg = Math.min(doc.numPages, VISION_PAGES);
  let payload = 0;
  for (let i = 1; i <= nImg; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    // JPEG compressé : ~5-10× plus léger que PNG, suffisant pour l'OCR vision.
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    // On borne le payload total pour rester sous la limite serveur Vercel.
    if (payload + dataUrl.length > MAX_PAYLOAD) break;
    images.push(dataUrl);
    payload += dataUrl.length;
  }
  if (images.length === 0) {
    throw new Error('PDF scanné trop volumineux — réduisez le fichier ou utilisez un PDF natif.');
  }
  return { mode: 'vision', images };
}
