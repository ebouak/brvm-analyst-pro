import OffresNiveaux from '@/components/billing/OffresNiveaux';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadCourseForLearning } from '@/lib/academy/learn';
import { videosDisponibles } from '@/lib/academy/videos';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import AcademyShell from '@/components/academy/AcademyShell';
import ApercuCours, { type LeconApercu } from '@/components/academy/ApercuCours';
import type { Nouveaute } from '@/lib/academy/nouveaute';
import { estLeconGratuite } from '@/lib/academy/capsules';
import { filigraneUtilisateur } from '@/lib/academy/videoProtection';
import { produitsActifs } from '@/lib/billing/chariow/catalogue';
import { jsonLdScript } from '@/lib/jsonLd';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

async function getCard(slug: string) {
  const { data } = await getServiceClient()
    .from('academy_courses')
    .select('titre, resume, published, niveau')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  return data as { titre: string; resume: string | null; published: boolean; niveau: string | null } | null;
}

/** `nouveaute` lue sans confiance (contenu jsonb) : forme exacte ou rien. */
function nouveauteDe(v: unknown): Nouveaute | null {
  if (!v || typeof v !== 'object') return null;
  const { type, depuis } = v as { type?: unknown; depuis?: unknown };
  if ((type !== 'nouveau' && type !== 'mis_a_jour') || typeof depuis !== 'string') return null;
  return { type, depuis };
}

/**
 * Ce que l'aperçu montre d'un cours : titres, sous-titres, résumés, modules,
 * durées, compteurs et titres de sections. Le corps des sections n'est jamais lu ici.
 */
async function getContenuApercu(slug: string): Promise<{ intro: string | null; lessons: LeconApercu[] } | null> {
  const { data } = await getServiceClient()
    .from('academy_courses')
    .select('content')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  const c = (data as { content: { intro?: unknown; lessons?: unknown } | null } | null)?.content;
  if (!c || !Array.isArray(c.lessons)) return null;
  const texte = (v: unknown) => (typeof v === 'string' ? v : null);
  const lessons = (c.lessons as Record<string, unknown>[]).map((l) => {
    const secs = Array.isArray(l.sections) ? (l.sections as Record<string, unknown>[]) : [];
    const quizCount = Array.isArray(l.quiz) && l.quiz.length > 0 ? l.quiz.length : l.qcm ? 1 : 0;
    const simCount = secs.reduce(
      (acc, s) => acc + (s.simulation ? 1 : 0) + (Array.isArray(s.simulations) ? s.simulations.length : 0),
      0,
    );
    const hasRealData = secs.some((s) => Boolean(s.donnees_reelles) || Boolean(s.reel));
    return {
      titre: texte(l.titre) ?? 'Leçon',
      module: texte(l.module),
      sous_titre: texte(l.sous_titre),
      resume: texte(l.resume) ?? '',
      duree_min: typeof l.duree_min === 'number' ? l.duree_min : null,
      quizCount,
      simCount,
      hasRealData,
      sections: secs.map((s) => ({ titre: texte(s.titre) ?? '' })).filter((s) => s.titre),
      nouveaute: nouveauteDe(l.nouveaute),
    };
  });
  return { intro: texte(c.intro), lessons };
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const card = await getCard(params.slug);
  return {
    title: card ? `${card.titre} · WestBourse Academy` : 'Cours — WestBourse Academy',
    description: card?.resume ?? undefined,
    alternates: { canonical: `${SITE_URL}/formations/academy/${params.slug}` },
  };
}

/**
 * Cours Academy en RENDU NATIF (shell type Coursera).
 * La Leçon 1 du Niveau 1 reste ouverte en essai gratuit interactif pour tous.
 */
export default async function AcademyCoursePage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ lecon?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const card = await getCard(params.slug);
  if (!card) notFound();

  const n = Number.parseInt(searchParams.lecon ?? '1', 10);
  const requestedIdx = Number.isFinite(n) ? Math.max(0, n - 1) : 0;

  const courseLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: card.titre,
    description: card.resume ?? card.titre,
    url: `${SITE_URL}/formations/academy/${params.slug}`,
    inLanguage: 'fr',
    provider: { '@type': 'Organization', name: 'WESTBOURSE', url: SITE_URL },
  };

  // Abonnement premium OU niveau du cours acheté à l'unité (Chariow) OU Leçon 1 du Niveau 1 offerte.
  const gate = await peutSuivreNiveau(card.niveau);
  const freeTrial = !gate.allowed && estLeconGratuite(params.slug, requestedIdx);

  if (!gate.allowed && !freeTrial) {
    const required = gate.acces.abonnement.required;
    const [content, formations, modules] = await Promise.all([
      getContenuApercu(params.slug),
      produitsActifs('formation'),
      produitsActifs('module'),
    ]);
    const offreAchat = formations.length + modules.length > 0;
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(courseLd) }} />
        <ApercuCours
          titre={card.titre}
          intro={content?.intro ?? null}
          lecons={content?.lessons ?? []}
          indexDemande={requestedIdx}
          slug={params.slug}
        />
        {offreAchat ? (
          <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
            <OffresNiveaux userId={gate.acces.userId} possedes={gate.acces.niveaux} retour={`/formations/academy/${params.slug}`} />
            <p className="mt-3 text-sm text-muted">La formation est aussi incluse dans l’abonnement Premium.</p>
          </div>
        ) : (
          <AccessGate
            required={required === 'free' ? 'premium' : required}
            feature="La WestBourse Academy"
            hint="Cours interactifs, progression, quiz et certificats."
          />
        )}
      </>
    );
  }

  const [data, videos] = await Promise.all([loadCourseForLearning(params.slug), videosDisponibles(params.slug)]);
  if (!data) notFound();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(courseLd) }} />
      <AcademyShell
        data={data}
        initialLesson={requestedIdx}
        videos={videos}
        niveau={card.niveau ?? null}
        freeTrial={freeTrial}
        watermark={filigraneUtilisateur(gate.acces.userId)}
      />
    </>
  );
}
