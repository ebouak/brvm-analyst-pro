import { scoreToRating, RATING_DISCLAIMER, type Rating } from '@/lib/rating';

/**
 * Badge « Note BRVM » A–F dérivé du scoring quantitatif.
 * Composant serveur (aucun hook) — utilisable partout, y compris pages publiques.
 */

const TONE_CLASSES: Record<Rating['tone'], string> = {
  up: 'text-up border-up/40 bg-up/10',
  mid: 'text-accent border-accent/40 bg-accent/10',
  neutral: 'text-white border-border-strong bg-elevated',
  down: 'text-down border-down/40 bg-down/10',
  muted: 'text-muted border-border bg-surface',
};

export default function RatingBadge({
  scoreTotal,
  confiance,
  size = 'sm',
  showLabel = false,
}: {
  scoreTotal: number | null | undefined;
  confiance: number | null | undefined;
  size?: 'sm' | 'lg';
  showLabel?: boolean;
}) {
  const rating = scoreToRating(scoreTotal, confiance);
  const sizeClasses =
    size === 'lg'
      ? 'text-xl px-3.5 py-1.5 rounded-xl font-bold'
      : 'text-xs px-2 py-0.5 rounded-md font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border tabular transition-colors ${TONE_CLASSES[rating.tone]} ${sizeClasses}`}
      title={`Note BRVM : ${rating.note} — ${rating.label}. ${RATING_DISCLAIMER}`}
      aria-label={`Note BRVM ${rating.note} : ${rating.label}`}
    >
      {rating.note}
      {showLabel && rating.note !== 'NR' && (
        <span className="font-normal text-[0.85em] opacity-80">{rating.label}</span>
      )}
    </span>
  );
}
