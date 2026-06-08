import 'server-only';

/**
 * OCR d'un PDF scanné via l'endpoint Mistral OCR (`mistral-ocr-latest`).
 * Prend l'URL du document, renvoie le texte markdown concaténé de toutes les pages.
 * Utilisé en repli quand l'extraction texte pdfjs renvoie trop peu de caractères
 * (PDF image / scanné).
 */
export async function ocrPdf(url: string, mistralKey: string): Promise<string> {
  const r = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mistralKey}` },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: { type: 'document_url', document_url: url },
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`OCR HTTP ${r.status}`);
  const j = (await r.json()) as { pages?: Array<{ markdown?: string }> };
  return (j.pages ?? []).map((p) => p.markdown ?? '').join('\n');
}
