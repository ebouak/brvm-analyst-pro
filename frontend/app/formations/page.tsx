import Link from 'next/link';
import { listFormations, type FormationCard } from '@/lib/formations/server';
import { listPublishedCourses, type AcademyCourseCard } from '@/lib/academy/server';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';

export const metadata = { title: 'Formations & conférences — WESTBOURSE' };
// Garde par utilisateur (plan Platinium) : rendu dynamique.
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { cours: 'Cours', conference: 'Conférence', webinaire: 'Webinaire' };
const NIVEAU_LABEL: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

const NIVEAU_COURSE: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert' };

export default async function FormationsPage() {
  // Niveau requis LU EN BASE (feature_flags, editable dans /admin/features).
  // La page ne decide rien : elle demande.
  const gate = await canAccess('formations');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="Les formations & conférences"
        hint="Cours, webinaires et conférences de l'Académie WESTBOURSE."
      />
    );
  }

  const [formations, courses] = await Promise.all([
    listFormations().catch(() => [] as FormationCard[]),
    listPublishedCourses().catch(() => [] as AcademyCourseCard[]),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Académie"
        title="Formations & conférences"
        subtitle="Montez en compétence sur l'investissement à la BRVM : cours, replays et conférences. Accès réservé aux membres Premium."
      />

      {/* ── WestBourse Academy — mise en avant permanente ─────────────────── */}
      <Link href="/formations/academy"
        className="group relative flex flex-col sm:flex-row items-start gap-5 rounded-2xl border border-[#56D7FD]/25 bg-gradient-to-br from-[#0a1f25] to-[#050e11] p-6 overflow-hidden hover:border-[#56D7FD]/50 transition-all">
        {/* Halo déco */}
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-[#56D7FD]/8 blur-3xl" />
        {/* Icône */}
        <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-2xl bg-[#56D7FD]/10 border border-[#56D7FD]/20 text-3xl">
          🎓
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#56D7FD]">Académie</span>
            <StatPill tone="sapphire">44 leçons · 4 niveaux</StatPill>
            <StatPill tone="neutral">QCM interactifs</StatPill>
          </div>
          <h2 className="font-display text-xl text-white group-hover:text-[#56D7FD] transition-colors">
            WestBourse Academy — Édition Intégrale
          </h2>
          <p className="mt-1 text-sm text-[#7a9ea8] leading-relaxed max-w-xl">
            Formation complète en 8 sections par leçon : définition, cas réels BRVM, pièges fréquents, lexique ciblé et points à retenir. Du débutant au niveau Expert CREPMF.
          </p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-[#56D7FD] font-semibold group-hover:underline">Accéder à l'Academy →</span>
            <span className="text-[10px] text-[#4a7a85] border border-[#1a3540] rounded px-2 py-0.5">Inclus Premium</span>
          </div>
        </div>
      </Link>

      {/* ── Cours générés (Academy IA) ────────────────────────────────────── */}
      {courses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="overline text-faint">Cours de l&apos;Academy</p>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#56D7FD]/10 text-[#56D7FD] border border-[#56D7FD]/20">
              {courses.length} cours
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} href={`/formations/academy/${c.slug}`}
                className="group flex flex-col rounded-xl border border-border bg-surface p-4 hover:border-[#56D7FD]/40 transition">
                <div className="flex items-center gap-2 text-[11px] text-faint">
                  <span className="text-[#56D7FD]">📘 Cours</span>
                  {c.niveau && <span>· {NIVEAU_COURSE[c.niveau] ?? c.niveau}</span>}
                </div>
                <h3 className="mt-1 font-display text-white group-hover:text-[#56D7FD] transition line-clamp-2">{c.titre}</h3>
                {c.resume && <p className="mt-1 text-xs text-muted line-clamp-3">{c.resume}</p>}
                <span className="mt-auto pt-3 text-[11px] text-[#56D7FD] group-hover:underline">Commencer →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {formations.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">Aucune formation publiée pour l&apos;instant.</p>
          <p className="mt-1 text-xs text-faint">De nouveaux contenus arrivent prochainement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formations.map((f) => (
            <Link key={f.id} href={`/premium/formations/${f.id}`}
              className="group flex flex-col rounded-xl border border-border bg-surface overflow-hidden hover:border-info/40 transition">
              <div className="aspect-video bg-elevated relative">
                {f.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.cover_url} alt="" className="h-full w-full object-cover" />
                  : <div className="h-full w-full flex items-center justify-center text-3xl opacity-40">🎓</div>}
                <span className="absolute top-2 right-2 rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-semibold text-bg">Premium</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2 text-[11px] text-faint">
                  <span className="text-info">{TYPE_LABEL[f.type] ?? f.type}</span>
                  {f.niveau && <span>· {NIVEAU_LABEL[f.niveau] ?? f.niveau}</span>}
                  {f.duree_min && <span>· {f.duree_min} min</span>}
                </div>
                <h3 className="mt-1 font-display text-white group-hover:text-info transition line-clamp-2">{f.titre}</h3>
                {f.description && <p className="mt-1 text-xs text-muted line-clamp-2">{f.description}</p>}
                <div className="mt-auto pt-3 flex items-center justify-between text-[11px]">
                  <span className="text-faint">{fmtDate(f.date_evenement) ?? ''}</span>
                  <span className="text-info group-hover:underline">Accéder →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-[11px] text-faint">
        Les contenus (replays, supports) sont accessibles aux membres Premium.{' '}
        <Link href="/pricing" className="text-info hover:underline">Voir les offres →</Link>
      </p>
    </div>
  );
}
