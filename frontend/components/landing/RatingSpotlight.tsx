// frontend/components/landing/RatingSpotlight.tsx
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import type { SignalDaily } from '@/lib/types';

interface Props {
  signal: (SignalDaily & { code: string }) | null;
  // Optionnel pour ne pas casser l'appelant preview (retiré en Task 6) qui
  // ne la transmet pas encore — repli honnête sur le nombre de sociétés
  // suivies par la plateforme si la vraie séance n'est pas disponible.
  nbActions?: number;
}

// Bornes réelles des sous-scores, cf. scraper/src/scoring/score.ts + docs/SCORING.md :
// variation/volume/rsi ∈ [-1,1], bonus_tendance ∈ [-0.1,0.1], penalite_liquidite ∈ [0,0.25].
function Bar({ label, value, min = -1, max = 1 }: { label: string; value: number | null; min?: number; max?: number }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tabular text-faint">{value != null ? value.toFixed(2) : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border/50">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
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
          <div className="space-y-3">
            <Bar label="Variation" value={signal.score_variation ?? null} />
            <Bar label="Volume" value={signal.score_volume ?? null} />
            <Bar label="RSI" value={signal.score_rsi ?? null} />
            <Bar label="Tendance (bonus)" value={signal.bonus_tendance ?? null} min={-0.1} max={0.1} />
            <Bar label="Liquidité (pénalité)" value={signal.penalite_liquidite ?? null} min={0} max={0.25} />
          </div>
          <p className="mt-4 text-[10px] text-faint">
            {signal.signal} · confiance {signal.confiance != null ? `${(signal.confiance * 100).toFixed(0)}%` : '—'} · exemple réel de la séance en cours
          </p>
        </div>
      </div>
    </section>
  );
}
