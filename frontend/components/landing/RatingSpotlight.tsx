// frontend/components/landing/RatingSpotlight.tsx
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import type { SignalDaily } from '@/lib/types';
import { SubscoreBars } from '@/components/landing/SubscoreBars';

interface Props {
  signal: (SignalDaily & { code: string }) | null;
  // Optionnel pour ne pas casser l'appelant preview (retiré en Task 6) qui
  // ne la transmet pas encore — repli honnête sur le nombre de sociétés
  // suivies par la plateforme si la vraie séance n'est pas disponible.
  nbActions?: number;
}


export function RatingSpotlight({ signal, nbActions }: Props) {
  if (!signal) return null;
  return (
    <section className="mt-10 rounded-panel border border-border bg-surface/60 p-6 md:p-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <p className="overline mb-3 text-gold-2">Note quantitative</p>
          <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
            Chaque action. Une note.
          </h2>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted">
            Chaque note A–F est calculée à partir de signaux quantitatifs explicables (variation,
            volume, RSI, tendance et liquidité), jamais d&apos;opinion inventée.
          </p>

          {/* MICRO-LÉGENDE (2026-09-16). La note et le signal étaient affichés
              partout sans être définis nulle part : un débutant voyait « B+ »
              et « HOLD » sans savoir ce qu'ils valent. Deux phrases, au point
              de contact — et la seconde cadre l'abstention comme une rigueur,
              ce qu'elle est : 98 % des signaux sont HOLD parce que le moteur
              se tait quand rien n'est net. */}
          <dl className="mt-5 space-y-2 border-l-2 border-border pl-4">
            <div>
              <dt className="text-[12px] font-semibold text-ivory">A à F</dt>
              <dd className="text-[12px] leading-snug text-muted">
                Une note recalculée à chaque séance à partir de signaux vérifiables. A = les
                indicateurs sont bien orientés ; F = mal orientés. Ce n&apos;est pas un avis.
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold text-ivory">BUY · HOLD · SELL</dt>
              <dd className="text-[12px] leading-snug text-muted">
                Quand rien n&apos;est net, le moteur affiche HOLD et s&apos;abstient. C&apos;est un
                choix de rigueur, pas un manque d&apos;avis, et cela arrive souvent.
              </dd>
            </div>
          </dl>
          <Link
            href="/notations"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2"
          >
            Voir les {nbActions != null && nbActions > 0 ? nbActions : 48} sociétés <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-ivory">{signal.code}</span>
            <RatingBadge scoreTotal={signal.score_total} confiance={signal.confiance} />
          </div>
          <SubscoreBars signal={signal} />
          <p className="mt-4 text-[10px] text-faint">
            {signal.signal} · confiance {signal.confiance != null ? `${(signal.confiance * 100).toFixed(0)}%` : '—'} · exemple réel de la séance en cours
          </p>
        </div>
      </div>
    </section>
  );
}
