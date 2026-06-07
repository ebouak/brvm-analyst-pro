import type { Publication } from './PublicationsModal';

// Rating scale — higher index = better
const RATING_SCALE = [
  'D', 'C', 'CC', 'CCC-', 'CCC', 'CCC+',
  'B-', 'B', 'B+', 'BB-', 'BB', 'BB+',
  'BBB-', 'BBB', 'BBB+',
  'A-', 'A', 'A+', 'AA-', 'AA', 'AA+', 'AAA',
  'B', 'A3', 'A2', 'A1', 'A1+',
];

function rank(note: string) {
  const i = RATING_SCALE.indexOf(note);
  return i === -1 ? 5 : i;
}

function noteColor(note: string): string {
  if (note.startsWith('AAA') || note.startsWith('AA')) return 'text-up';
  if (note.startsWith('A')) return 'text-up/80';
  if (note.startsWith('BBB')) return 'text-warn';
  if (note.startsWith('BB') || note.startsWith('B')) return 'text-warn/70';
  return 'text-down';
}

function buildComment(note: string, perspective: string, history: { note: string }[]): string {
  let level = '';
  if (note.startsWith('AAA')) level = 'qualité exceptionnelle';
  else if (note.startsWith('AA')) level = 'très haute qualité';
  else if (note.startsWith('A')) level = 'haute qualité';
  else if (note.startsWith('BBB')) level = 'qualité investment grade';
  else if (note.startsWith('BB')) level = 'catégorie spéculative';
  else level = 'risque élevé';

  const persp = perspective.toLowerCase() === 'stable'
    ? 'perspective stable'
    : perspective.toLowerCase() === 'positive'
    ? 'perspective positive'
    : 'perspective négative';

  let trend = '';
  if (history.length >= 2) {
    const d = rank(history[0].note) - rank(history[1].note);
    if (d > 0) trend = ' Tendance en amélioration sur la période récente.';
    else if (d < 0) trend = ' Tendance en dégradation sur la période récente.';
    else trend = ' Notation stable sur la période récente.';
  }

  return `Notation ${level}, ${persp}.${trend}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

interface HistoryEntry {
  note: string;
  court_terme?: string | null;
  long_terme?: string | null;
  perspective: string;
  date_notation: string;
}

interface NotationProps {
  notation: {
    agence: string;
    note: string;
    perspective: string;
    date_notation: string;
    source_url?: string;
    court_terme?: string | null;
    long_terme?: string | null;
    history?: HistoryEntry[];
  };
  notationPubs?: Publication[];
}

export default function NotationBadge({ notation, notationPubs = [] }: NotationProps) {
  const { agence, perspective } = notation;

  // Build history: prefer stored history[], fall back to single entry
  const entries: HistoryEntry[] = (notation.history && notation.history.length > 0)
    ? notation.history
    : [{
        note: notation.note,
        court_terme: notation.court_terme ?? null,
        long_terme: notation.long_terme ?? null,
        perspective: notation.perspective,
        date_notation: notation.date_notation,
      }];

  const latest = entries[0];
  const comment = buildComment(latest.note, latest.perspective ?? perspective, entries);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted uppercase tracking-wider">Notation financière</p>
      </div>

      {/* Agency + latest rating */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{agence}</span>
        <div className="flex items-center gap-2">
          <span className={`tabular text-xl font-bold ${noteColor(latest.note)}`}>{latest.note}</span>
          <span className="text-xs text-muted">{latest.perspective ?? perspective}</span>
        </div>
      </div>

      {/* Long/court terme detail */}
      {(latest.long_terme || latest.court_terme) && (
        <div className="flex gap-4 text-xs text-muted">
          {latest.long_terme && (
            <span>Long terme : <span className="text-white/80">{latest.long_terme}</span></span>
          )}
          {latest.court_terme && (
            <span>Court terme : <span className="text-white/80">{latest.court_terme}</span></span>
          )}
        </div>
      )}

      {/* History */}
      {entries.length > 1 && (
        <div className="border-t border-border/50 pt-3 space-y-1.5">
          <p className="text-xs text-faint mb-2">Évolution</p>
          {entries.map((e, i) => {
            const prev = entries[i + 1];
            let arrow = '';
            let arrowCls = 'text-muted';
            if (prev) {
              const d = rank(e.note) - rank(prev.note);
              if (d > 0) { arrow = '↑'; arrowCls = 'text-up'; }
              else if (d < 0) { arrow = '↓'; arrowCls = 'text-down'; }
              else { arrow = '→'; arrowCls = 'text-muted'; }
            }
            return (
              <div key={e.date_notation + i} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-muted w-20">{fmtDate(e.date_notation)}</span>
                <div className="flex items-center gap-2">
                  {arrow && <span className={`text-xs font-bold ${arrowCls}`}>{arrow}</span>}
                  <span className={`tabular text-xs font-semibold ${noteColor(e.note)}`}>{e.note}</span>
                  <span className="text-xs text-faint w-16">{e.perspective}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comment */}
      <p className="text-xs text-muted italic border-t border-border/50 pt-2">{comment}</p>

      {/* Publication links */}
      {notationPubs.length > 0 && (
        <div className="border-t border-border/50 pt-2 space-y-1">
          <p className="text-xs text-faint mb-1">Documents officiels</p>
          {notationPubs.slice(0, 3).map((pub) => (
            <div key={pub.id} className="flex items-center justify-between">
              <span className="text-xs text-muted truncate max-w-[60%]">
                {new Date(pub.date_publication).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                {' — '}{pub.libelle}
              </span>
              {pub.source_url ? (
                <a
                  href={pub.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-up border border-up/30 rounded px-2 py-0.5 hover:bg-up/10 transition whitespace-nowrap"
                >
                  Voir →
                </a>
              ) : (
                <span className="text-xs text-faint border border-border rounded px-2 py-0.5 whitespace-nowrap cursor-not-allowed">
                  Voir →
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
