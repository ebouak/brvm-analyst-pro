interface NotationProps {
  notation: {
    agence: string;
    note: string;
    perspective: string;
    date_notation: string;
    source_url?: string;
  };
}

export default function NotationBadge({ notation }: NotationProps) {
  const { agence, note, perspective, date_notation, source_url } = notation;

  const noteColor = note.startsWith('A')
    ? 'text-up'
    : note.startsWith('B')
    ? 'text-white'
    : 'text-down';

  const formattedDate = new Date(date_notation).toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-muted uppercase tracking-wider mb-3">Notation financière</p>
      <p className="font-medium">🏅 {agence}</p>
      <p className="text-sm mt-1">
        <span className={`font-semibold ${noteColor}`}>Note : {note}</span>
        <span className="text-muted mx-2">•</span>
        <span>Perspective : {perspective}</span>
      </p>
      <p className="text-xs text-muted mt-2">
        Mise à jour : {formattedDate}
        {source_url && (
          <a
            href={source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-up hover:underline ml-2"
          >
            Lire →
          </a>
        )}
      </p>
    </div>
  );
}
