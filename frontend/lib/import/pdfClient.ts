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
const VISION_PAGES = 6;
const RENDER_SCALE = 2.0;

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
  for (let i = 1; i <= nImg; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
  }
  return { mode: 'vision', images };
}
