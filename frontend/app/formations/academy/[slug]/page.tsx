import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

async function getCard(slug: string) {
  const { data } = await getServiceClient()
    .from('academy_courses')
    .select('titre, resume, published')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  return data as { titre: string; resume: string | null; published: boolean } | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const card = await getCard(params.slug);
  return {
    title: card ? `${card.titre} — WestBourse Academy` : 'Cours — WestBourse Academy',
    description: card?.resume ?? undefined,
  };
}

/**
 * Page plein écran d'un cours Academy généré.
 * Le HTML charté est servi par /api/academy/[slug] et affiché en iframe.
 * Plein écran via ConditionalShell (préfixe /formations/academy).
 */
export default async function AcademyCoursePage({ params }: { params: { slug: string } }) {
  const card = await getCard(params.slug);
  if (!card) notFound();

  return (
    <div className="fixed inset-0 z-0">
      <iframe
        src={`/api/academy/${encodeURIComponent(params.slug)}`}
        title={card.titre}
        className="block w-full h-full border-0"
        allow="fullscreen"
        loading="eager"
      />
    </div>
  );
}
