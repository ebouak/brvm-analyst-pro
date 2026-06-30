import { getCourseHtml } from '@/lib/academy/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/academy/[slug]
 * Sert le HTML charté d'un cours publié (consommé par l'iframe de la page cours).
 * 404 si le cours n'existe pas ou n'est pas publié.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const html = await getCourseHtml(params.slug);
  if (!html) {
    // NE PAS cacher le 404 : un brouillon publié ensuite doit s'afficher aussitôt.
    return new Response('Cours introuvable', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache court + revalidation : la republication / màj couverture se voit vite.
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
