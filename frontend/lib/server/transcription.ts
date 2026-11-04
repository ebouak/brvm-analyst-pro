import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { MODELE_LLM } from '@/lib/server/llmModels';

/**
 * Transcription d'une note vocale WhatsApp par Gemini (API native, audio en
 * ligne). L'audio n'est jamais stocké : il ne vit que le temps de cet appel.
 * null : sans clé, audio vide ou trop lourd, parole inaudible. Lève sur une
 * erreur HTTP — l'appelant répond alors « pas compris ».
 */
const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Une note vocale WhatsApp (Opus) d'environ une minute pèse moins d'un Mo. */
export const AUDIO_MAX_OCTETS = 1024 * 1024;
const INAUDIBLE = '[INAUDIBLE]';
const CONSIGNE = `Transcris mot à mot ce message vocal, en français, tel qu'il est prononcé. N'ajoute rien, ne réponds pas à la question, ne commente pas. Si la parole est inaudible ou absente, écris exactement : ${INAUDIBLE}`;

interface ReponseGemini {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

export async function transcrireAudio(octets: Buffer, mimetype: string): Promise<string | null> {
  if (octets.length === 0 || octets.length > AUDIO_MAX_OCTETS) return null;
  const cle = await resolveApiKey('gemini');
  if (!cle) return null;
  const r = await fetch(`${API}/models/${encodeURIComponent(MODELE_LLM.gemini)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': cle, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: mimetype.split(';')[0]!.trim(), data: octets.toString('base64') } }, { text: CONSIGNE }],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`transcription HTTP ${r.status}`);
  const j = (await r.json()) as ReponseGemini;
  const texte = (j.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
  if (!texte || texte.includes(INAUDIBLE)) return null;
  return texte.slice(0, 1000);
}
