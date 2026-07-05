import type { SupabaseClient } from '@supabase/supabase-js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { logger } from '../logger.js';

/**
 * Brief audio (~1 minute de vocal quotidien) — cascade de providers TTS,
 * du meilleur payant au gratuit sans clé, jamais bloquant pour le brief texte :
 *   1) OpenAI tts-1      — ≈ 0,015 $/1k car. (voix la plus naturelle)
 *   2) Google Cloud TTS  — gratuit jusqu'à 1M car./mois (voix Neural2)
 *   3) edge-tts          — gratuit, sans clé, aucun compte (voix Edge Read Aloud,
 *                          API non officielle : dernier recours, jamais premier
 *                          choix, mais garantit un brief audio même sans clé).
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

  const dateFr = new Date(`${dateMarche}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const texte =
    `Bonjour, voici le brief WestBourse de la séance du ${dateFr}. ` +
    cleaned +
    ' Retrouvez le détail complet sur westbourse point com. À demain.';
  // tts-1 accepte 4096 caractères max — coupe prudente à la dernière phrase.
  if (texte.length <= 3800) return texte;
  const cut = texte.slice(0, 3800);
  return cut.slice(0, cut.lastIndexOf('.') + 1) + ' Retrouvez la suite sur westbourse point com.';
}

/** 1) OpenAI tts-1 — retourne null si pas de clé ou échec (jamais throw). */
async function tryOpenAi(texte: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL ?? 'tts-1',
        voice: process.env.OPENAI_TTS_VOICE ?? 'onyx',
        input: texte,
        response_format: 'mp3',
        speed: 1.05,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'brief audio : OpenAI TTS en échec — repli Google/edge');
      return null;
    }
    return Buffer.from(await resp.arrayBuffer());
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'brief audio : OpenAI TTS erreur — repli Google/edge');
    return null;
  }
}

/** 2) Google Cloud TTS (clé API simple, gratuit ≤ 1M car./mois) — null si pas de clé ou échec. */
async function tryGoogleCloud(texte: string): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: texte },
          voice: { languageCode: 'fr-FR', name: process.env.GOOGLE_TTS_VOICE ?? 'fr-FR-Neural2-D' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.05 },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'brief audio : Google Cloud TTS en échec — repli edge-tts');
      return null;
    }
    const json = (await resp.json()) as { audioContent?: string };
    if (!json.audioContent) return null;
    return Buffer.from(json.audioContent, 'base64');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'brief audio : Google Cloud TTS erreur — repli edge-tts');
    return null;
  }
}

/** 3) edge-tts — gratuit, sans clé (dernier recours, API non officielle). */
async function tryEdgeTts(texte: string): Promise<Buffer | null> {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      process.env.EDGE_TTS_VOICE ?? 'fr-FR-HenriNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
    );
    const { audioStream } = await tts.toStream(texte);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'brief audio : edge-tts (gratuit) également en échec');
    return null;
  }
}

/**
 * Génère le MP3 (cascade OpenAI → Google Cloud → edge-tts) et l'upload dans
 * le bucket public brief-audio. Retourne l'URL publique, ou null si les
 * trois providers échouent (jamais bloquant pour le brief texte).
 */
export async function generateBriefAudio(
  sb: SupabaseClient,
  contenu: string,
  dateMarche: string,
): Promise<string | null> {
  const texte = briefToSpeech(contenu, dateMarche);

  const buffer =
    (await tryOpenAi(texte)) ?? (await tryGoogleCloud(texte)) ?? (await tryEdgeTts(texte));
  if (!buffer) {
    logger.warn('brief audio : aucun provider TTS disponible — brief texte inchangé');
    return null;
  }

  try {
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
    logger.warn({ err: (err as Error).message }, 'brief audio : erreur upload — ignorée (non bloquant)');
    return null;
  }
}
