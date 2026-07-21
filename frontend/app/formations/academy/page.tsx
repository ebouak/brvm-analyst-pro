import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { SectionHeader } from '@/components/ui/premium';
import { NIVEAUX, NIVEAU_LABEL, type CourseContent } from '@/lib/academy/types';
import { courseProgress, resumeTarget, type ProgressRowFull } from '@/lib/academy/progressCalc';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'WestBourse Academy — Formation complète BRVM',
  description: 'Cours interactifs par niveau, progression, quiz. Maîtrisez l’investissement à la BRVM.',
};

interface HubCourse {
  id: string;
  slug: string;
  titre: string;
  niveau: string | null;
  resume: string | null;
  lessonsCount: number;
  cover: string | null;
}

export default async function AcademyHubPage() {
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

  const svc = getServiceClient();
  const { data: rows } = await svc
    .from('academy_courses')
    .select('id, slug, titre, niveau, resume, content')
    .eq('published', true)
    .order('created_at', { ascending: true });

  const courses: HubCourse[] = ((rows ?? []) as {
    id: string; slug: string; titre: string; niveau: string | null; resume: string | null;
    content: CourseContent | null;
  }[]).map((r) => ({
    id: r.id, slug: r.slug, titre: r.titre, niveau: r.niveau, resume: r.resume,
    lessonsCount: r.content?.lessons?.length ?? 0,
    cover: r.content?.lessons?.find((l) => l.image?.url)?.image?.url ?? null,
  }));

  // Progression de l'utilisateur (RLS owner via session).
  const db = createClient();
  const { data: prog } = await db
    .from('academy_progress')
    .select('course_id, lesson_idx, completed, updated_at');
  const progRows = (prog ?? []) as ProgressRowFull[];

  const resume = resumeTarget(
    courses.map((c) => ({ id: c.id, slug: c.slug, lessonsCount: c.lessonsCount })),
    progRows,
  );

  const byCourse = new Map<string, ProgressRowFull[]>();
  for (const r of progRows) {
    if (!byCourse.has(r.course_id)) byCourse.set(r.course_id, []);
    byCourse.get(r.course_id)!.push(r);
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <Link href="/formations" className="text-sm text-muted transition-colors hover:text-white">
          ← Formations
        </Link>
        <SectionHeader
          kicker="Académie"
          title="WestBourse Academy"
          subtitle="Des cours interactifs par niveau : progression sauvegardée, quiz, et bientôt examens et certificats."
        />

        {resume && (
          <Link
            href={`/formations/academy/${resume.slug}?lecon=${resume.lessonIdx + 1}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/[0.06] px-5 py-4 transition hover:border-accent/60"
          >
            <div>
              <p className="overline text-accent">Reprendre où j’en étais</p>
              <p className="mt-0.5 text-sm text-ivory">Leçon {resume.lessonIdx + 1} — continuer le cours en cours</p>
            </div>
            <span aria-hidden className="text-accent">→</span>
          </Link>
        )}

        {NIVEAUX.map((niveau) => {
          const list = courses.filter((c) => c.niveau === niveau);
          if (list.length === 0) return null;
          return (
            <section key={niveau} className="space-y-3">
              <h2 className="font-display text-lg text-white">{NIVEAU_LABEL[niveau]}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {list.map((c) => {
                  const p = courseProgress(c.lessonsCount, byCourse.get(c.id) ?? []);
                  return (
                    <div
                      key={c.slug}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-accent/40"
                    >
                      <Link
                        href={`/formations/academy/${c.slug}${p.done > 0 ? `?lecon=${p.nextIdx + 1}` : ''}`}
                        className="flex flex-1 flex-col"
                      >
                        {c.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.cover} alt="" className="h-28 w-full object-cover" loading="lazy" />
                        )}
                        <div className="flex flex-1 flex-col p-5 pb-0">
                        <h3 className="font-display text-base text-white transition group-hover:text-accent">
                          {c.titre}
                        </h3>
                        {c.resume && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.resume}</p>}
                        <div className="mt-4">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${p.pct}%` }} />
                          </div>
                          <p className="mt-1.5 text-[11px] text-faint">
                            {c.lessonsCount} leçons ·{' '}
                            {p.pct === 0 ? 'non commencé' : p.pct === 100 ? 'terminé ✓' : `${p.pct} %`}
                          </p>
                        </div>
                        </div>
                      </Link>
                      {c.niveau && (
                        <div className="px-5 pb-5">
                          {p.pct === 100 ? (
                            <Link
                              href={`/formations/academy/examen/${c.niveau}`}
                              className="mt-3 inline-block rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20"
                            >
                              Passer l’examen →
                            </Link>
                          ) : (
                            <span className="mt-3 inline-block text-[11px] text-faint">
                              Terminez les leçons pour débloquer l’examen
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Édition Intégrale statique — legacy jusqu'à sa migration en cours DB (P3). */}
        <Link
          href="/formations/academy/integrale"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 transition hover:border-accent/30"
        >
          <div>
            <p className="text-sm font-semibold text-ivory">📚 Édition Intégrale (44 leçons) — version classique</p>
            <p className="text-xs text-muted">L’ancien format, en attendant sa migration vers les cours interactifs.</p>
          </div>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      </div>
    </div>
  );
}
