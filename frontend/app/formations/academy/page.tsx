import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { accesAcademy } from '@/lib/server/academyAccess';
import OffresNiveaux from '@/components/billing/OffresNiveaux';
import AcademyCatalogCoursera, { type CertificatEtat } from '@/components/academy/AcademyCatalogCoursera';
import { jsonLdScript } from '@/lib/jsonLd';
import { NIVEAUX, type CourseContent, type Niveau } from '@/lib/academy/types';
import { EMPTY_ACTIVITY_SNAPSHOT, evaluerMissions } from '@/lib/academy/missions';
import { chargerActiviteMissions } from '@/lib/academy/missionsServer';
import { courseProgress, resumeTarget, type ProgressRowFull } from '@/lib/academy/progressCalc';
import {
  calculerActiviteCalendrier,
  extraireCapsulesLecon,
  extraireMetadonneesCours,
  formatCours,
  type HubCourseEnriched,
  type LessonLike,
} from '@/lib/academy/capsules';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'WestBourse Academy · Formation complète BRVM',
  description:
    'Catalogue complet des parcours BRVM : cours interactifs par niveau, capsules intelligentes, simulateurs réels, quiz, examens et certificats.',
  alternates: { canonical: `${SITE_URL}/formations/academy` },
};

const rangNiveau = (n: string | null) => {
  const i = NIVEAUX.indexOf((n ?? '') as Niveau);
  return i === -1 ? NIVEAUX.length : i;
};

export default async function AcademyHubPage() {
  const acces = await accesAcademy();
  const complet = acces.abonnement.allowed;

  const svc = getServiceClient();
  const db = createClient();

  const [{ data: rows }, progRes] = await Promise.all([
    svc
      .from('academy_courses')
      .select('id, slug, titre, niveau, resume, content')
      .eq('published', true)
      .order('created_at', { ascending: true }),
    acces.userId
      ? db.from('academy_progress').select('course_id, lesson_idx, completed, updated_at')
      : Promise.resolve({ data: [] as ProgressRowFull[] }),
  ]);

  let displayName: string | null = null;
  let certificats: CertificatEtat[] = [];
  let examensReussis: string[] = [];
  let missions = evaluerMissions(EMPTY_ACTIVITY_SNAPSHOT);

  if (acces.userId) {
    const [profRes, certRes, examRes] = await Promise.all([
      db.from('profiles').select('display_name').eq('id', acces.userId).maybeSingle(),
      svc
        .from('academy_certificates')
        .select('id, niveau, display_name, consent_at, revoked')
        .eq('user_id', acces.userId),
      svc
        .from('academy_exam_attempts')
        .select('niveau, passed')
        .eq('user_id', acces.userId)
        .eq('passed', true),
    ]);
    displayName = (profRes.data as { display_name?: string | null } | null)?.display_name?.trim() || null;
    certificats = ((certRes.data ?? []) as CertificatEtat[]) || [];
    examensReussis = [...new Set(((examRes.data ?? []) as { niveau: string }[]).map((e) => e.niveau))];
    missions = evaluerMissions(await chargerActiviteMissions(acces.userId, examensReussis.length));
  }

  const progRows = (progRes.data ?? []) as ProgressRowFull[];
  const byCourse = new Map<string, ProgressRowFull[]>();
  for (const r of progRows) {
    if (!byCourse.has(r.course_id)) byCourse.set(r.course_id, []);
    byCourse.get(r.course_id)!.push(r);
  }

  const now = new Date();
  const rawCourses = ((rows ?? []) as {
    id: string;
    slug: string;
    titre: string;
    niveau: string | null;
    resume: string | null;
    content: CourseContent | null;
  }[])
    .slice()
    .sort((a, b) => {
      const fa = formatCours(a.slug) === 'parcours' ? 0 : 1;
      const fb = formatCours(b.slug) === 'parcours' ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return rangNiveau(a.niveau) - rangNiveau(b.niveau);
    });

  const accessibleSlugs: string[] = [];

  const courses: HubCourseEnriched[] = rawCourses.map((r) => {
    const hasAccess = complet || (r.niveau !== null && acces.niveaux.has(r.niveau as Niveau));
    if (hasAccess) accessibleSlugs.push(r.slug);

    const lessons = (r.content?.lessons ?? []) as LessonLike[];
    const meta = extraireMetadonneesCours(lessons, now, {
      niveau: r.niveau,
      slug: r.slug,
      titre: r.titre,
    });
    const p = courseProgress(lessons.length, byCourse.get(r.id) ?? []);
    const nextLesson = lessons[p.nextIdx];
    const cover =
      r.content?.coverUrl ??
      r.content?.lessons?.find((l) => l.image?.url)?.image?.url ??
      null;

    return {
      id: r.id,
      slug: r.slug,
      titre: r.titre,
      niveau: r.niveau,
      format: formatCours(r.slug),
      resume: r.resume,
      cover,
      lessonsCount: lessons.length,
      modulesCount: meta.modulesCount,
      totalMinutes: meta.totalMinutes,
      simulatorsCount: meta.simulatorsCount,
      quizCount: meta.quizCount,
      hasRealData: meta.hasRealData,
      hasVideo: meta.hasVideo,
      categories: meta.categories,
      themes: meta.themes,
      badge: meta.badge,
      capsules: meta.capsules,
      moduleTitles: meta.moduleTitles,
      nextLessonTitle: nextLesson?.titre ?? null,
      nextLessonCapsules: extraireCapsulesLecon(nextLesson),
      progress: p,
    };
  });

  const resume = resumeTarget(
    courses.filter((c) => accessibleSlugs.includes(c.slug)).map((c) => ({
      id: c.id,
      slug: c.slug,
      lessonsCount: c.lessonsCount,
    })),
    progRows,
  );
  const calendrier = calculerActiviteCalendrier(progRows, now);

  const catalogLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'WestBourse Academy — Catalogue des cours BRVM',
    itemListElement: courses.map((c, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Course',
        name: c.titre,
        description: c.resume ?? c.titre,
        url: `${SITE_URL}/formations/academy/${c.slug}`,
        inLanguage: 'fr',
        provider: { '@type': 'Organization', name: 'WESTBOURSE', url: SITE_URL },
      },
    })),
  };

  return (
    <div className="min-h-screen bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(catalogLd) }} />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <AcademyCatalogCoursera
          courses={courses}
          displayName={displayName}
          resumeTarget={resume}
          calendrier={calendrier}
          certificats={certificats}
          examensReussis={examensReussis}
          missions={missions}
          complet={complet}
          accessibleSlugs={accessibleSlugs}
          isLoggedIn={Boolean(acces.userId)}
        />

        {/* Pour les visiteurs / acheteurs à l'unité : offres claires sous le catalogue */}
        {!complet && (
          <div className="space-y-4">
            <OffresNiveaux userId={acces.userId} possedes={acces.niveaux} retour="/formations/academy" />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-ivory">
                  Ou accédez à toute l’Academy avec l’abonnement Premium WESTBOURSE
                </p>
                <p className="text-xs text-muted">
                  Inclut les 4 niveaux certifiants, tous les ateliers, les examens et les outils d’analyse BRVM.
                </p>
              </div>
              <Link
                href="/pricing"
                className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:bg-gold-2"
              >
                Voir les abonnements →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
