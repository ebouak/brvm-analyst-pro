import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { Bulletin } from '@/lib/stress/bulletin';
import { fmtDateCourte, fmtNumber } from '@/lib/format';

/**
 * Haut de page du Stress Monitor : verdict, jauge, résumé, « Pourquoi ? », repère historique.
 * Tous les textes variables viennent de construireBulletin (lib/stress/bulletin.ts).
 */
export function BulletinMarche({ b, dateSeance }: { b: Bulletin; dateSeance: string }) {
  const pos = Math.min(100, Math.max(0, b.note));
  return (
    <section aria-labelledby="bulletin-titre" className="rounded-panel border border-border bg-surface p-5 md:p-6">
      <p className="text-xs text-muted">Bulletin du marché · séance du {fmtDateCourte(dateSeance)}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 id="bulletin-titre" className="font-display text-2xl font-semibold text-ivory md:text-3xl">
          {b.verdict}
        </h2>
        <span className="tabular rounded-full border border-border-strong px-3 py-1 text-sm font-semibold text-ivory">
          {b.note} / 100 · tension {b.niveau}
        </span>
      </div>

      <div className="mt-4">
        <div
          role="meter"
          aria-label="Indice de tension du marché"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pos}
          aria-valuetext={`${pos} sur 100, tension ${b.niveau}`}
          className="relative h-2.5 w-full rounded-full"
          style={{ background: 'linear-gradient(90deg, rgb(var(--color-accent-ink) / .12), rgb(var(--color-accent-ink) / .9))' }}
        >
          {[25, 50, 75].map((t) => (
            <span key={t} aria-hidden="true" className="absolute top-0 h-full w-px bg-surface" style={{ left: `${t}%` }} />
          ))}
          <span
            aria-hidden="true"
            className="absolute -top-1.5 h-5 w-1 -translate-x-1/2 rounded-full bg-ivory"
            style={{ left: `${pos}%` }}
          />
        </div>
        <div aria-hidden="true" className="mt-1.5 grid grid-cols-4 text-[11px] text-faint">
          <span>Calme</span>
          <span className="text-center">Modérée</span>
          <span className="text-center">Élevée</span>
          <span className="text-right">Extrême</span>
        </div>
      </div>

      {b.phrases.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-ivory md:text-base">
          {b.phrases.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {b.facteurs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ivory">Pourquoi {b.note} ?</h3>
          <p className="text-xs text-muted">Les trois mesures qui pèsent le plus dans la note du jour.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {b.facteurs.map((f) => (
              <details key={f.cle} className="group rounded-lg border border-border bg-sunken p-3 text-sm">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="block font-medium text-ivory">{f.titre}</span>
                  <span className="tabular mt-0.5 block text-xs text-muted">{f.mesure}</span>
                  <span className="mt-1 block text-xs text-accent-ink group-open:hidden">Voir le détail</span>
                </summary>
                <dl className="mt-2 space-y-1 text-xs text-muted">
                  <div className="flex justify-between gap-2">
                    <dt>Score de la mesure</dt>
                    <dd className="tabular text-ivory">{fmtNumber(f.score, 0)} / 100</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Poids dans la note</dt>
                    <dd className="tabular text-ivory">{fmtNumber(f.poids * 100, 0)} %</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-relaxed text-muted">{f.definition}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {b.passe && (
        <div className="mt-6 rounded-lg border border-border/70 p-3 text-sm">
          <h3 className="font-semibold text-ivory">Et dans le passé ?</h3>
          <p className="mt-1 leading-relaxed text-muted">
            La situation la plus proche dans l&apos;historique : <span className="text-ivory">{b.passe.libelle}</span>{' '}
            (ressemblance <span className="tabular">{fmtNumber(b.passe.ressemblance, 0)} / 100</span>). Un repère pour
            situer la séance, ce n&apos;est pas une prévision.
          </p>
          <Link href="/stress-monitor/crises" className="mt-1 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
            Comparer avec les crises historiques
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      )}

      <Link
        href="/stress-monitor/methodologie"
        className="print:hidden mt-4 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"
      >
        <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Comment est calculé cet indice
      </Link>
    </section>
  );
}
