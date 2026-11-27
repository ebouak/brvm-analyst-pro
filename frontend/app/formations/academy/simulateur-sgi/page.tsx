import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/premium';
import ProtectedVideo from '@/components/academy/ProtectedVideo';
import { jsonLdScript } from '@/lib/jsonLd';
import { FISCALITE_SGI, GUIDE_SGI, SCENARIOS_SGI, TRANSCRIPTION_SGI } from '@/lib/academy/guideSgi';

/**
 * Cours vidéo gratuit — « Maîtriser le Simulateur & Comparateur SGI WESTBOURSE ».
 * Ouvert à tous sans compte pour apprendre à comparer les frais SGI et la fiscalité BRVM.
 */

export const metadata: Metadata = {
  title: `${GUIDE_SGI.titre} — Cours gratuit WestBourse Academy`,
  description: GUIDE_SGI.resume,
  alternates: { canonical: GUIDE_SGI.chemin },
  openGraph: {
    title: GUIDE_SGI.titre,
    description: GUIDE_SGI.resume,
    images: [{ url: GUIDE_SGI.vignette }],
    type: 'video.other',
  },
};

const videoLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: GUIDE_SGI.titre,
  description: GUIDE_SGI.resume,
  thumbnailUrl: [GUIDE_SGI.vignette],
  embedUrl: `https://www.westbourse.com${GUIDE_SGI.chemin}`,
  uploadDate: '2026-11-27',
  duration: 'PT4M15S',
  inLanguage: 'fr',
  transcript: TRANSCRIPTION_SGI.join(' '),
  isAccessibleForFree: true,
};

export default function SimulateurSgiCoursPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(videoLd) }} />
      <Link href="/formations" className="mb-4 inline-block text-sm text-muted transition hover:text-accent">
        ← Formations
      </Link>
      <SectionHeader
        title={GUIDE_SGI.titre}
        subtitle={GUIDE_SGI.resume}
      />

      <div className="mt-6 space-y-6">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-black">
          <ProtectedVideo
            src={GUIDE_SGI.video}
            poster={GUIDE_SGI.affiche}
            preload="metadata"
            className="aspect-video w-full bg-black"
            ariaLabel={GUIDE_SGI.titre}
            watermark="WESTBOURSE Academy"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-surface/80 px-4 py-3 text-xs text-muted">
            <span>Cours vidéo gratuit · {GUIDE_SGI.duree} · Voix Amadou · 40 SGI · 34 barèmes homologués AMF-UMOA</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/comparateur-sgi/simuler"
                className="rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-bg transition hover:bg-gold-2"
              >
                Lancer une simulation →
              </Link>
              <Link
                href="/comparateur-sgi/trouver"
                className="rounded-lg border border-border px-3.5 py-1.5 font-semibold text-ivory transition hover:border-accent/50 hover:text-accent"
              >
                Trouver ma SGI
              </Link>
            </div>
          </div>
        </div>

        <section aria-labelledby="h-scenarios" className="rounded-xl border border-border/60 bg-surface/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="h-scenarios" className="font-display text-lg text-ivory">
              Les 3 scénarios comparatifs analysés dans la vidéo
            </h2>
            <Link
              href="/formations/academy/academy-niveau-1-initiation?lecon=6"
              className="text-xs font-semibold text-accent-ink hover:underline"
            >
              Ouvrir la Leçon 6 · Niveau 1 SGI →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {SCENARIOS_SGI.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-bg/55 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">{s.profil}</p>
                <p className="mt-1 text-xs text-muted">{s.parametres}</p>
                <p className="mt-2.5 text-sm font-semibold text-up">{s.gagnant}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ivory">{s.economie}</p>
                <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted">{s.lecon}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-fiscalite" className="rounded-xl border border-border/60 bg-surface/60 p-5">
          <h2 id="h-fiscalite" className="font-display text-lg text-ivory">
            Points fiscaux à intégrer au rendement net
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {FISCALITE_SGI.map((f) => (
              <li key={f.poste} className="rounded-xl border border-border bg-bg/50 p-3.5 text-sm">
                <p className="font-semibold text-ivory">{f.poste}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{f.regle}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="h-transcription" className="rounded-xl border border-border/60 bg-surface/60 p-5">
          <h2 id="h-transcription" className="font-display text-lg text-ivory">Transcription complète</h2>
          <div className="mt-3 max-w-[75ch] space-y-3 text-sm leading-relaxed text-ivory">
            {TRANSCRIPTION_SGI.map((p) => <p key={p}>{p}</p>)}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/60 p-4">
          <p className="text-xs text-muted">
            Ceci n’est pas un conseil en investissement ni un conseil fiscal. Poursuivez avec la{' '}
            <Link href="/formations/academy/academy-niveau-1-initiation?lecon=6" className="underline transition hover:text-accent">
              Leçon 6 du Niveau 1
            </Link>{' '}
            ou explorez tout le catalogue de l’Academy.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/signup" className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:opacity-90">
              Créer mon compte gratuit
            </Link>
            <Link href="/formations/academy" className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-ivory transition hover:border-accent/50 hover:text-accent">
              Voir l’Academy
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
