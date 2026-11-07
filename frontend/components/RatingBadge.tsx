import { scoreToRating, RATING_DISCLAIMER, type Rating } from '@/lib/rating';

/**
 * Badge « Note BRVM » A–F dérivé du scoring quantitatif.
 * Composant serveur (aucun hook) — utilisable partout, y compris pages publiques.
 */

/**
 * Gradation NEUTRE par lettre (DESIGN.md : rouge = baisse, vert = hausse,
 * cyan = accent actif — jamais une note). A le plus marqué, F le plus effacé.
 * Texte ivory (A–C) ou muted (D–F/NR) : contraste ≥ 4,5:1 dans les deux thèmes.
 */
const NOTE_CLASSES: Record<string, string> = {
  A: 'text-ivory border-ivory/70 bg-elevated',
  B: 'text-ivory border-ivory/45 bg-elevated',
  C: 'text-ivory border-border-strong bg-elevated',
  D: 'text-muted border-border-strong bg-surface',
  E: 'text-muted border-border bg-surface',
  F: 'text-muted border-border bg-surface',
};
const NOTE_PAR_DEFAUT = 'text-muted border-border bg-surface';

function classesNote(note: string): string {
  return NOTE_CLASSES[note.charAt(0)] ?? NOTE_PAR_DEFAUT;
}

export default function RatingBadge({
  scoreTotal,
  confiance,
  size = 'sm',
  showLabel = false,
  neutre = false,
}: {
  scoreTotal: number | null | undefined;
  confiance: number | null | undefined;
  size?: 'sm' | 'lg';
  showLabel?: boolean;
  /** Pages publiques : ni « Achat » ni aucun libellé d'action dans title / aria-label — la lettre et le disclaimer seuls. */
  neutre?: boolean;
}) {
  const rating = scoreToRating(scoreTotal, confiance);
  const sizeClasses =
    size === 'lg'
      ? 'text-xl px-3.5 py-1.5 rounded-xl font-bold'
      : 'text-xs px-2 py-0.5 rounded-md font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border tabular transition-colors ${rating.note === 'NR' ? NOTE_PAR_DEFAUT : classesNote(rating.note)} ${sizeClasses}`}
      title={neutre ? `Note BRVM ${rating.note}. ${RATING_DISCLAIMER}` : `Note BRVM : ${rating.note} — ${rating.label}. ${RATING_DISCLAIMER}`}
      aria-label={neutre ? `Note BRVM ${rating.note}` : `Note BRVM ${rating.note} : ${rating.label}`}
    >
      {rating.note}
      {showLabel && !neutre && rating.note !== 'NR' && (
        <span className="font-normal text-[0.85em] opacity-80">{rating.label}</span>
      )}
    </span>
  );
}
