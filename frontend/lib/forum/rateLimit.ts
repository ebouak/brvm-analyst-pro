// frontend/lib/forum/rateLimit.ts
import type { Result } from './validation';

export const MIN_POST_INTERVAL_MS = 20_000; // 20 s entre deux publications
export const MAX_TOPICS_PER_HOUR = 5;
const HOUR_MS = 3_600_000;

/** `lastAt` = ISO du dernier message de l'utilisateur, ou null. */
export function checkPostRate(lastAt: string | null, now = Date.now()): Result<true> {
  if (!lastAt) return { ok: true, value: true };
  const elapsed = now - new Date(lastAt).getTime();
  if (elapsed < MIN_POST_INTERVAL_MS) {
    const wait = Math.ceil((MIN_POST_INTERVAL_MS - elapsed) / 1000);
    return { ok: false, error: `Patientez ${wait} s avant de publier à nouveau.` };
  }
  return { ok: true, value: true };
}

/** `topicStamps` = ISO de création des sujets récents de l'utilisateur. */
export function checkTopicRate(topicStamps: string[], now = Date.now()): Result<true> {
  const inWindow = topicStamps.filter((s) => now - new Date(s).getTime() < HOUR_MS);
  if (inWindow.length >= MAX_TOPICS_PER_HOUR) {
    return { ok: false, error: `Limite de ${MAX_TOPICS_PER_HOUR} sujets par heure atteinte.` };
  }
  return { ok: true, value: true };
}
