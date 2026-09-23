import {
  commenterSeance,
  type ActualiteRecente, type BruitSeance, type CarnetSeance,
  type ContexteSeance, type EconomieSociete, type SignalSeance,
} from '@/lib/carnet/commentaire';

/**
 * « Ce que dit la séance » — bruit, carnet, technique, comptes, actualité,
 * puis ce que ces lectures disent ensemble.
 *
 * Le texte vient d'un module pur et testé : aucun modèle de langage n'écrit
 * ici. Deux partis pris d'affichage, tirés d'une capture où le commentaire
 * était juste mais illisible :
 *
 *  1. chaque constat est sur DEUX niveaux — le fait, puis sa portée en gris.
 *     Un chiffre sans son échelle se lit de travers ; les coller sur la même
 *     ligne les faisait se concurrencer.
 *  2. les limites sont repliées derrière un dépliant, SAUF la dernière (« ce
 *     n'est pas un conseil »), qui reste toujours visible. Un pavé gris plus
 *     long que le contenu ne se lit pas : le replier le rend consultable, le
 *     supprimer serait malhonnête.
 */

const PASTILLE: Record<string, { classe: string; libelle: string }> = {
  bruit: { classe: 'bg-muted/15 text-muted', libelle: 'Séance' },
  carnet: { classe: 'bg-accent/12 text-accent-ink', libelle: 'Carnet' },
  signal: { classe: 'bg-purple/12 text-purple', libelle: 'Technique' },
  economie: { classe: 'bg-gold/12 text-gold', libelle: 'Comptes' },
  actualite: { classe: 'bg-warn/12 text-warn', libelle: 'Actualité' },
};

export default function CarnetCommentaire({
  carnet,
  signal,
  actualites,
  contexte,
  bruit,
  economie,
  compact = false,
}: {
  carnet: CarnetSeance | null;
  signal: SignalSeance | null;
  actualites?: ActualiteRecente[];
  contexte?: ContexteSeance;
  bruit?: BruitSeance;
  economie?: EconomieSociete | null;
  /** Variante resserrée pour le tableau de bord : la synthèse d'abord, deux constats. */
  compact?: boolean;
}) {
  // Rien à dire : on n'affiche pas un cadre vide.
  if (!carnet && !signal && !economie && !bruit?.variationPct && !(actualites && actualites.length > 0)) return null;

  const { constats, synthese, limites } = commenterSeance({ carnet, signal, actualites, contexte, bruit, economie });
  const nonConseil = limites[limites.length - 1]!;
  const autres = limites.slice(0, -1);

  // Sur le tableau de bord, la synthèse porte l'essentiel : on ne garde que les
  // deux constats qui l'étayent le plus directement.
  const visibles = compact ? constats.slice(0, 2) : constats;

  return (
    <section className={compact ? 'space-y-3' : 'mb-6 rounded-xl border border-border bg-surface p-5'}>
      {!compact && (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Ce que dit la séance</h2>
      )}

      {/* La synthèse en tête : le lecteur qui ne lit qu'une ligne lit celle-ci. */}
      {synthese && (
        <p className={`${compact ? '' : 'mb-4'} rounded-lg border-l-2 border-accent bg-accent/[0.06] px-3.5 py-2.5 text-sm leading-relaxed text-ivory`}>
          {synthese}
        </p>
      )}

      <ul className="space-y-3.5">
        {visibles.map((c) => {
          const p = PASTILLE[c.origine] ?? PASTILLE.carnet!;
          return (
            <li key={c.fait} className="flex gap-3">
              <span className={`mt-[3px] h-fit w-[4.75rem] shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide ${p.classe}`}>
                {p.libelle}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm leading-relaxed text-ivory">{c.fait}</p>
                {c.portee && <p className="text-[13px] leading-relaxed text-muted">{c.portee}</p>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className={compact ? 'mt-3' : 'mt-5 border-t border-border pt-3'}>
        {autres.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[11px] text-faint underline decoration-dotted underline-offset-2 hover:text-muted">
              Ce que ce commentaire ne dit pas ({autres.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {autres.map((l) => (
                <li key={l} className="text-[11px] leading-relaxed text-faint">{l}</li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-faint">{nonConseil}</p>
      </div>
    </section>
  );
}
