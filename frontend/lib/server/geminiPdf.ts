import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { MODELE_LLM } from '@/lib/server/llmModels';

/**
 * Lecture d'un PDF ENTIER par Gemini (API native) : texte ET images des pages
 * en un appel, scans compris. Remplace l'OCR Mistral, que le palier gratuit
 * rend inutilisable (429) et qui ne lisait pas les tableaux en image.
 *
 * ⚠️ COPIE de `scraper/src/interim/gemini.ts` (`jsonDepuisPdf`) : deux paquets
 * TypeScript distincts, sans module partagé — même règle que
 * `scraper/src/hebdo/pure/`. Une correction se reporte des deux côtés.
 * Différence assumée : ici le modèle est celui de `llmModels.ts`, pas une
 * découverte par /models — une route serverless n'a pas de cache durable où
 * garder le résultat de cette découverte.
 */
const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Limite des données en ligne de l'API (20 Mo par requête), marge comprise. */
const PDF_MAX_OCTETS = 18 * 1024 * 1024;

interface ReponseGemini {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  modelVersion?: string;
}

function jsonTolerant(texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch {
    const a = texte.indexOf('{');
    const b = texte.lastIndexOf('}');
    try {
      return a >= 0 && b > a ? JSON.parse(texte.slice(a, b + 1)) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Envoie le PDF à Gemini et renvoie l'objet JSON de la réponse (non validé)
 * avec le nom du modèle servi. null sans clé, PDF trop lourd ou réponse vide ;
 * lève sur une erreur HTTP — l'appelant décide de son repli.
 */
export async function jsonDepuisPdf(
  urlPdf: string,
  systeme: string,
  consigne: string,
): Promise<{ brut: unknown; modele: string } | null> {
  const cle = await resolveApiKey('gemini');
  if (!cle) return null;

  const pdf = await fetch(urlPdf, { signal: AbortSignal.timeout(60_000) });
  if (!pdf.ok) throw new Error(`PDF HTTP ${pdf.status}`);
  const octets = Buffer.from(await pdf.arrayBuffer());
  if (octets.length > PDF_MAX_OCTETS) return null;

  const modele = MODELE_LLM.gemini;
  const r = await fetch(`${API}/models/${encodeURIComponent(modele)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': cle, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systeme }] },
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: 'application/pdf', data: octets.toString('base64') } }, { text: consigne }],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
  const j = (await r.json()) as ReponseGemini;
  const texte = (j.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  if (!texte.trim()) return null;
  return { brut: jsonTolerant(texte), modele: j.modelVersion ?? modele };
}
