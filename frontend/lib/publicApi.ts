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
