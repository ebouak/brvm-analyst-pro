import 'server-only';
import { resolvePexelsKey } from '@/lib/server/apiKeys';
import type { LessonImage } from './types';

/**
 * Récupère une photo Pexels pertinente pour des mots-clés (EN de préférence).
 * Renvoie null si aucune clé, aucun résultat, ou erreur — jamais d'exception
 * (la génération de cours ne doit pas échouer pour une image manquante).
 */
export async function fetchPexelsImage(query: string, key?: string | null): Promise<LessonImage | null> {
  const apiKey = key ?? (await resolvePexelsKey());
  if (!apiKey || !query.trim()) return null;

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const resp = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const photo = json?.photos?.[0];
    if (!photo) return null;
    const src: string | undefined = photo.src?.landscape ?? photo.src?.large ?? photo.src?.medium;
    if (!src) return null;
    return {
      url: src,
      alt: (photo.alt as string) || query,
      credit: `Photo : ${(photo.photographer as string) || 'Pexels'} / Pexels`,
    };
  } catch {
    return null;
  }
}
