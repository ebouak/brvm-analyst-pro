import { getCourseHtml } from '@/lib/academy/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/academy/[slug] — LEGACY (l'iframe n'est plus référencée, voir
 * app/formations/academy/[slug]/page.tsx), conservée pour rollback.
 *
 * Servait le HTML COMPLET d'un cours sans aucun contrôle, avec un cache
 * public : le contenu payant était lisible par n'importe qui. Elle applique
 * désormais le même verrou que la page de cours, et la réponse n'est plus
 * jamais mise en cache partagé (elle dépend de l'utilisateur).
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const introuvable = () =>
    new Response('Cours introuvable', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });

  const { data: card } = await getServiceClient()
    .from('academy_courses')
    .select('niveau')
    .eq('slug', params.slug)
    .eq('published', true)
    .maybeSingle();
  if (!card) return introuvable();

  const gate = await peutSuivreNiveau((card as { niveau: string | null }).niveau);
  if (!gate.allowed) {
    return new Response('Accès réservé', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const html = await getCourseHtml(params.slug);
  if (!html) return introuvable();
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}
