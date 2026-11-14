import { ArrowDown, ArrowUp } from 'lucide-react';
import { affichageReaction, type ReactionBrute } from '@/lib/evenements/reaction';

/** Réaction à 5 séances : écart à l'indice (flèche + valeur), « en cours » ou « — ». */
export default function ReactionCellule({ reaction }: { reaction: ReactionBrute | null | undefined }) {
  const a = affichageReaction(reaction);
  if (a.genre === 'en_cours') return <span className="text-xs text-warn">en cours</span>;
  if (a.genre === 'indisponible') return <span className="text-xs text-muted" title="Réaction non mesurable">—</span>;
  const Icone = a.sens === 'baisse' ? ArrowDown : a.sens === 'hausse' ? ArrowUp : null;
  const couleur = a.sens === 'hausse' ? 'text-up' : a.sens === 'baisse' ? 'text-down' : 'text-muted';
  return (
    <span className={`tabular inline-flex items-center gap-1 text-sm ${couleur}`}>
      {Icone && <Icone aria-hidden className="h-3.5 w-3.5" />}
      {a.texte}
    </span>
  );
}
