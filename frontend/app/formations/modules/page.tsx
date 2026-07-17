import Link from 'next/link';
import type { Metadata } from 'next';
import { listCourses } from '@/lib/video/server';
import { SectionHeader } from '@/components/ui/premium';

export const metadata: Metadata = { title: 'Modules vidéo — Formations' };
export const dynamic = 'force-dynamic';

const NIVEAU: Record<string, string> = {
  debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert',
};

export default async function ModulesPage() {
  const courses = await listCourses().catch(() => []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <SectionHeader
        kicker="Formations"
        title="Modules vidéo interactifs"
        subtitle="Des cours en vidéo, chapitrés, avec quiz et suivi de progression. Reprenez là où vous vous êtes arrêté."
      />

      {courses.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">Aucun module publié pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => {
            const pct = c.nbLecons ? Math.round((c.nbTerminees / c.nbLecons) * 100) : 0;
            return (
              <Link
                key={c.slug}
                href={`/formations/modules/${c.slug}`}
                className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition hover:border-accent/40"
              >
                <div className="flex items-center justify-between">
                  {c.niveau && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                      {NIVEAU[c.niveau] ?? c.niveau}
                    </span>
                  )}
                  <span className="text-[11px] text-faint">{c.nbLecons} leçon{c.nbLecons > 1 ? 's' : ''}</span>
                </div>
                <h2 className="mt-2 font-display text-lg text-white transition group-hover:text-accent">{c.titre}</h2>
                {c.resume && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.resume}</p>}
                <div className="mt-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-faint">
                    {pct === 0 ? 'Non commencé' : pct === 100 ? 'Terminé ✓' : `${c.nbTerminees}/${c.nbLecons} · ${pct}%`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
