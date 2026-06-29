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
    return new Response('Cours introuvable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
