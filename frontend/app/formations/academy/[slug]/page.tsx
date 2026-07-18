import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadCourseForLearning } from '@/lib/academy/learn';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import AcademyShell from '@/components/academy/AcademyShell';

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
 * Cours Academy en RENDU NATIF (shell type Coursera). L'iframe historique est
 * abandonnée ; /api/academy/[slug] reste en legacy (rollback) mais n'est plus
 * référencée. Le niveau d'accès vient de feature_flags (`formations`).
 */
export default async function AcademyCoursePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { lecon?: string };
}) {
  const gate = await canAccess('formations');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="La WestBourse Academy"
        hint="Cours interactifs, progression, quiz et certificats."
      />
    );
  }

  const data = await loadCourseForLearning(params.slug);
  if (!data) notFound();

  // ?lecon=N est 1-indexé côté URL (humain) ; le shell clamp les bornes.
  const n = Number.parseInt(searchParams.lecon ?? '1', 10);
  const initialLesson = Number.isFinite(n) ? n - 1 : 0;

  return <AcademyShell data={data} initialLesson={initialLesson} />;
}
