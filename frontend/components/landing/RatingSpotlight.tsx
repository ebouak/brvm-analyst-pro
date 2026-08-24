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
            Chaque note A–F est calculée à partir de signaux quantitatifs explicables — variation,
            volume, RSI, tendance et liquidité — jamais d&apos;opinion inventée.
          </p>
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
