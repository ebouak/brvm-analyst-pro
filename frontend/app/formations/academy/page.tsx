import type { Metadata } from 'next';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { accesAcademy } from '@/lib/server/academyAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import OffresNiveaux from '@/components/billing/OffresNiveaux';
import { Lecon0Carte } from '@/components/academy/Lecon0Carte';
import AcademyCatalogCoursera, { type CertificatEtat } from '@/components/academy/AcademyCatalogCoursera';
import { NIVEAUX, type CourseContent, type Niveau } from '@/lib/academy/types';
import { courseProgress, resumeTarget, type ProgressRowFull } from '@/lib/academy/progressCalc';
import {
  calculerActiviteCalendrier,
  extraireCapsulesLecon,
  extraireMetadonneesCours,
  type HubCourseEnriched,
  type LessonLike,
} from '@/lib/academy/capsules';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'WestBourse Academy · Formation complète BRVM',
  description: 'Cours interactifs par niveau, capsules intelligentes, progression, quiz et certificats BRVM.',
};

const rangNiveau = (n: string | null) => {
  const i = NIVEAUX.indexOf((n ?? '') as Niveau);
  return i === -1 ? NIVEAUX.length : i;
};

export default async function AcademyHubPage() {
  // Abonnement premium = tout ; sinon, seuls les niveaux achetés à l'unité.
  const acces = await accesAcademy();
  const complet = acces.abonnement.allowed;
  if (!complet && acces.niveaux.size === 0) {
    // La leçon 0 reste offerte à tous, au-dessus du bloc d'accès premium.
    return (
      <>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 sm:px-6">
          <h1 className="font-display text-3xl font-medium tracking-tight text-ivory md:text-4xl">WestBourse Academy</h1>
          <Lecon0Carte />
          <OffresNiveaux userId={acces.userId} possedes={acces.niveaux} retour="/formations/academy" />
        </div>
        <AccessGate
          required={acces.abonnement.required === 'free' ? 'premium' : acces.abonnement.required}
          feature="La WestBourse Academy"
          hint="Cours interactifs, progression, quiz et certificats."
        />
      </>
    );
  }

  const svc = getServiceClient();
  const db = createClient();

  const [{ data: rows }, { data: prog }] = await Promise.all([
    svc
      .from('academy_courses')
      .select('id, slug, titre, niveau, resume, content')
      .eq('published', true)
      .order('created_at', { ascending: true }),
    db.from('academy_progress').select('course_id, lesson_idx, completed, updated_at'),
  ]);

  let displayName: string | null = null;
  let certificats: CertificatEtat[] = [];
  let examensReussis: string[] = [];

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
  }

  const progRows = (prog ?? []) as ProgressRowFull[];
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
    .filter((r) => complet || (r.niveau !== null && acces.niveaux.has(r.niveau as Niveau)))
    .sort((a, b) => rangNiveau(a.niveau) - rangNiveau(b.niveau));

  const courses: HubCourseEnriched[] = rawCourses.map((r) => {
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
    courses.map((c) => ({ id: c.id, slug: c.slug, lessonsCount: c.lessonsCount })),
    progRows,
  );
  const calendrier = calculerActiviteCalendrier(progRows, now);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <AcademyCatalogCoursera
          courses={courses}
          displayName={displayName}
          resumeTarget={resume}
          calendrier={calendrier}
          certificats={certificats}
          examensReussis={examensReussis}
          complet={complet}
        />

        {/* Acheteur à l'unité : les autres niveaux restent à sa portée. */}
        {!complet && (
          <OffresNiveaux userId={acces.userId} possedes={acces.niveaux} retour="/formations/academy" />
        )}
      </div>
    </div>
  );
}
