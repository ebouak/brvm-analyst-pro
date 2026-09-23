import { commenterSeance, type ActualiteRecente, type CarnetSeance, type SignalSeance } from '@/lib/carnet/commentaire';

/**
 * « Ce que dit la séance » — carnet, signal et actualité mis côte à côte.
 *
 * Le texte vient d'un module pur et testé : aucun modèle de langage n'écrit
 * ici. Les trois sources sont juxtaposées, jamais reliées par une cause, et
 * les limites sont affichées AVEC les constats — pas repliées derrière un
 * « en savoir plus » que personne n'ouvre.
 */

const PASTILLE: Record<string, { fond: string; texte: string; libelle: string }> = {
  carnet: { fond: 'bg-accent/12', texte: 'text-accent-ink', libelle: 'Carnet' },
  signal: { fond: 'bg-purple/12', texte: 'text-purple', libelle: 'Signal' },
  actualite: { fond: 'bg-warn/12', texte: 'text-warn', libelle: 'Actualité' },
};

export default function CarnetCommentaire({
  carnet,
  signal,
  actualites,
  compact = false,
}: {
  carnet: CarnetSeance | null;
  signal: SignalSeance | null;
  actualites?: ActualiteRecente[];
  /** Variante resserrée pour le tableau de bord : constats seuls, limites abrégées. */
  compact?: boolean;
}) {
  // Rien à dire : on n'affiche pas un cadre vide.
  if (!carnet && !signal && !(actualites && actualites.length > 0)) return null;

  const { constats, limites } = commenterSeance({ carnet, signal, actualites });

  return (
    <section className={compact ? 'space-y-2' : 'mb-6 rounded-xl border border-border bg-surface p-5'}>
      {!compact && <h2 className="mb-3 text-sm text-muted">Ce que dit la séance</h2>}
      <ul className="space-y-2">
        {constats.map((c) => {
          const p = PASTILLE[c.origine] ?? PASTILLE.carnet!;
          return (
            <li key={c.texte} className="flex gap-2.5">
              <span className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${p.fond} ${p.texte}`}>
                {p.libelle}
              </span>
              <span className="text-sm leading-relaxed text-ivory">{c.texte}</span>
            </li>
          );
        })}
      </ul>
      <p className={`${compact ? 'mt-2' : 'mt-4'} text-[11px] leading-relaxed text-faint`}>
        {compact ? limites[limites.length - 1] : limites.join(' ')}
      </p>
    </section>
  );
}
