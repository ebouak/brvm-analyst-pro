import { NextResponse } from 'next/server';

/** Réponse JSON d'API publique : CORS ouvert (données de marché publiques) + cache CDN. */
export function apiJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export function apiError(message: string, status = 400) {
  return apiJson({ error: message }, status);
}

// ── Rate-limiting (best-effort, en mémoire) ────────────────────────────────
// Fenêtre glissante par IP. Sur serverless c'est par-instance (pas global),
// donc complémentaire — l'essentiel de la protection vient du cache CDN
// (s-maxage 300). Pour un quota strict, brancher Upstash/Redis.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // 60 requêtes / minute / IP
const hits = new Map<string, number[]>();

export function checkRateLimit(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Garde-fou mémoire : purge si trop d'IP suivies.
  if (hits.size > 5000) hits.clear();
  return true;
}

/** Réponse 429 standard. */
export function tooManyRequests() {
  return apiError('Trop de requêtes — réessayez dans une minute.', 429);
}
