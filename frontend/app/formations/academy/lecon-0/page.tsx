import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/premium';
import { jsonLdScript } from '@/lib/jsonLd';
import { FAMILLES, LECON0, TRANSCRIPTION } from '@/lib/academy/lecon0';

/**
 * Leçon 0 — gratuite, ouverte à tous, sans compte (décision du 2026-09-29).
 *
 * Le reste de la WestBourse Academy est réservé au premium (canAccess
 * 'formations') ; cette page ne passe PAS par ce contrôle, volontairement :
 * c'est la porte d'entrée, envoyée par email à chaque inscription et à
 * chaque abonnement payant. Route statique : elle a priorité sur
 * /formations/academy/[slug], et /formations est déjà public dans le
 * middleware.
 *
 * `<video controls preload="metadata">` servi depuis notre stockage : aucun
 * script, aucun lecteur tiers, rien à gérer pour prefers-reduced-motion.
 * La transcription est affichée en clair : seul accès pour qui ne peut pas
 * écouter, et contenu indexable.
 */

export const metadata: Metadata = {
  title: `Leçon 0 · ${LECON0.titre} — WestBourse Academy`,
  description: LECON0.resume,
  alternates: { canonical: LECON0.chemin },
  openGraph: {
    title: `Leçon 0 · ${LECON0.titre}`,
    description: LECON0.resume,
    images: [{ url: LECON0.vignette }],
    type: 'video.other',
  },
};

const videoLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: `Leçon 0 · ${LECON0.titre}`,
  description: LECON0.resume,
  thumbnailUrl: [LECON0.vignette],
  contentUrl: LECON0.video,
  uploadDate: '2026-09-29',
  duration: 'PT1M42S',
  inLanguage: 'fr',
  transcript: TRANSCRIPTION.join(' '),
  isAccessibleForFree: true,
};

export default function Lecon0Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(videoLd) }} />
      <Link href="/formations" className="mb-4 inline-block text-sm text-muted transition hover:text-accent">
        ← Formations
      </Link>
      <SectionHeader
        kicker="Académie · Leçon 0 · gratuite"
        title={LECON0.titre}
        subtitle={LECON0.resume}
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <video
          controls
          preload="metadata"
          playsInline
          poster={LECON0.affiche}
          className="mx-auto w-full max-w-[340px] rounded-xl border border-border/60 bg-black"
        >
          <source src={LECON0.video} type="video/mp4" />
          Votre navigateur ne lit pas la vidéo. <a href={LECON0.video}>Télécharger la leçon 0</a>.
        </video>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-border/60 bg-surface/60 p-5">
            <p className="text-sm text-muted">Vidéo · {LECON0.duree} · voix off</p>
            <p className="mt-2 leading-relaxed text-ivory">
              Avant d’investir à la BRVM, savoir qui fait quoi : qui surveille, qui organise la cotation, qui
              conserve vos titres, par qui passer pour acheter une action.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-90">
                Créer mon compte gratuit
              </Link>
              <Link href="/comparateur-sgi" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ivory transition hover:border-accent/50 hover:text-accent">
                Comparer les SGI agréées
              </Link>
            </div>
          </div>

          <section aria-labelledby="h-acteurs" className="rounded-xl border border-border/60 bg-surface/60 p-5">
            <h2 id="h-acteurs" className="font-display text-lg text-white">La carte des acteurs</h2>
            <ol className="mt-3 space-y-4">
              {FAMILLES.map((f) => (
                <li key={f.numero}>
                  <p className="text-xs uppercase tracking-widest text-accent">{f.numero} · {f.nom}</p>
                  <ul className="mt-2 space-y-2">
                    {f.acteurs.map((a) => (
                      <li key={a.sigle} className="text-sm leading-relaxed">
                        <span className="font-semibold text-ivory">{a.sigle}</span>
                        <span className="text-muted"> — {a.nom}.</span>{' '}
                        <span className="text-ivory/85">{a.roles.join(' · ')}.</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <section aria-labelledby="h-transcription" className="mt-8 rounded-xl border border-border/60 bg-surface/60 p-5">
        <h2 id="h-transcription" className="font-display text-lg text-white">Transcription</h2>
        <div className="mt-3 max-w-[70ch] space-y-3 text-sm leading-relaxed text-ivory/90">
          {TRANSCRIPTION.map((p) => <p key={p}>{p}</p>)}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted">
        Contenu pédagogique — pas un conseil en investissement. La suite de la WestBourse Academy (cours par niveau,
        quiz, examens et certificats) est incluse dans l’abonnement premium.{' '}
        <Link href="/formations/academy" className="underline transition hover:text-accent">Voir l’Academy</Link>
      </p>
    </main>
  );
}
