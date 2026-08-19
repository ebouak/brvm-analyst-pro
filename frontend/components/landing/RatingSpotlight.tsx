// frontend/components/landing/RatingSpotlight.tsx
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import type { SignalDaily } from '@/lib/types';

interface Props {
  signal: (SignalDaily & { code: string }) | null;
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, ((value + 100) / 200) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tabular text-faint">{value != null ? value.toFixed(0) : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RatingSpotlight({ signal }: Props) {
  if (!signal) return null;
  return (
    <section className="mt-10 rounded-panel border border-white/10 bg-white/[0.02] p-6 md:p-8">
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
            Voir les 48 sociétés <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-ivory">{signal.code}</span>
            <RatingBadge scoreTotal={signal.score_total} confiance={signal.confiance} />
          </div>
          <div className="space-y-3">
            <Bar label="Variation" value={signal.score_variation ?? null} />
            <Bar label="Volume" value={signal.score_volume ?? null} />
            <Bar label="RSI" value={signal.score_rsi ?? null} />
            <Bar label="Tendance (bonus)" value={signal.bonus_tendance ?? null} />
            <Bar label="Liquidité (pénalité)" value={signal.penalite_liquidite ?? null} />
          </div>
          <p className="mt-4 text-[10px] text-faint">
            {signal.signal} · confiance {signal.confiance ?? '—'}% · exemple réel de la séance en cours
          </p>
        </div>
      </div>
    </section>
  );
}
