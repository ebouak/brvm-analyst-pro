import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

/**
 * Brief audio (TTS OpenAI) — ~1 minute de vocal quotidien.
 * Inactif sans OPENAI_API_KEY (retour null, aucun impact sur le brief texte).
 * Coût : tts-1 ≈ 0,015 $/1k caractères → ~2-3 centimes par brief.
 */

/** Adapte le brief écrit à l'oral : émojis, liens et symboles retirés,
 *  intro/outro parlées. Fonction pure, testable. */
export function briefToSpeech(contenu: string, dateMarche: string): string {
  const cleaned = contenu
    // liens et URLs (inutiles à l'oral)
    .replace(/https?:\/\/\S+/g, '')
    // émojis et pictogrammes courants du brief
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    // puces et séparateurs → ponctuation parlée
    .replace(/[•·▲▼→]/g, ', ')
    .replace(/\s*\|\s*/g, ', ')
    // sigles finance lus correctement
    .replace(/\bFCFA\b/g, 'francs CFA')
    .replace(/\bMd\b/g, 'milliards de')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const [y, m, d] = dateMarche.split('-');
  const dateFr = new Date(`${dateMarche}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  void y; void m; void d;

  const texte =
    `Bonjour, voici le brief WestBourse de la séance du ${dateFr}. ` +
    cleaned +
    ' Retrouvez le détail complet sur westbourse point com. À demain.';
  // tts-1 accepte 4096 caractères max — coupe prudente à la dernière phrase.
  if (texte.length <= 3800) return texte;
  const cut = texte.slice(0, 3800);
  return cut.slice(0, cut.lastIndexOf('.') + 1) + ' Retrouvez la suite sur westbourse point com.';
}

/**
 * Génère le MP3 via OpenAI TTS et l'upload dans le bucket public brief-audio.
 * Retourne l'URL publique, ou null si non configuré / échec (jamais bloquant).
 */
export async function generateBriefAudio(
  sb: SupabaseClient,
  contenu: string,
  dateMarche: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL ?? 'tts-1',
        voice: process.env.OPENAI_TTS_VOICE ?? 'onyx',
        input: briefToSpeech(contenu, dateMarche),
        response_format: 'mp3',
        speed: 1.05,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'brief audio : TTS OpenAI en échec — brief texte inchangé');
      return null;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());

    const path = `${dateMarche}.mp3`;
    const { error } = await sb.storage
      .from('brief-audio')
      .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true });
    if (error) {
      logger.warn({ err: error.message }, 'brief audio : upload Storage en échec');
      return null;
    }
    const { data } = sb.storage.from('brief-audio').getPublicUrl(path);
    logger.info({ path, bytes: buffer.length }, 'brief audio généré et publié');
    return data.publicUrl;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'brief audio : erreur — ignorée (non bloquant)');
    return null;
  }
}
