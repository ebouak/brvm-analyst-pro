import 'server-only';

/** Télécharge un PDF et en extrait le texte brut (toutes pages) via pdfjs-dist legacy. */
export async function fetchPdfText(url: string): Promise<string> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  if (!resp.ok) throw new Error(`PDF HTTP ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());

  // Import dynamique du build legacy (compatible Node). NE PAS toucher à
  // GlobalWorkerOptions.workerSrc en pdfjs-dist 4.x (lui assigner undefined lève
  // « Invalid workerSrc type ») ; le faux worker Node est utilisé automatiquement.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await pdfjs.getDocument({
    data: buf,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items
      .map((it) => ('str' in it ? (it.str ?? '') : ''))
      .join(' ') + '\n';
  }
  return out;
}
