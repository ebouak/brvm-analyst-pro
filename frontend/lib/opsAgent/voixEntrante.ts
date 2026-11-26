import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';

export type ResultatTranscription =
  | { ok: true; texte: string; fournisseur: 'groq' | 'openai' | 'gemini' }
  | { ok: false; raison: string };

async function transcrireViaWhisperCompat(
  url: string,
  apiKey: string,
  model: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string | null> {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  form.set('model', model);
  form.set('language', 'fr');
  form.set('response_format', 'json');

  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => ({}))) as { text?: string };
  return j.text?.trim() || null;
}

export async function transcrireAudioOps(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ResultatTranscription> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try {
      const t = await transcrireViaWhisperCompat(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        groqKey,
        'whisper-large-v3-turbo',
        buffer,
        mimeType,
        fileName,
      );
      if (t) return { ok: true, texte: t, fournisseur: 'groq' };
    } catch {
      /* bascule vers le fournisseur suivant */
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      const t = await transcrireViaWhisperCompat(
        'https://api.openai.com/v1/audio/transcriptions',
        openaiKey,
        'whisper-1',
        buffer,
        mimeType,
        fileName,
      );
      if (t) return { ok: true, texte: t, fournisseur: 'openai' };
    } catch {
      /* bascule vers Gemini */
    }
  }

  const geminiKey = await resolveApiKey('gemini').catch(() => null);
  if (geminiKey) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Transcris exactement en français cet enregistrement vocal adressé à un agent d’administration technique (sans commentaire, uniquement la transcription).',
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: buffer.toString('base64'),
                    },
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (resp.ok) {
        const j = (await resp.json().catch(() => ({}))) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
        if (t) return { ok: true, texte: t, fournisseur: 'gemini' };
      }
    } catch {
      /* échec Gemini */
    }
  }

  return {
    ok: false,
    raison:
      'Aucune clé de transcription audio configurée (GROQ_API_KEY, OPENAI_API_KEY ou clé Gemini).',
  };
}
