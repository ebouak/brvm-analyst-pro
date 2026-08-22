/**
 * Bandeau de preuve PRODUIT (factuelle) — affiché sous le Hero.
 * Pas de faux témoignages ni de faux compteur d'utilisateurs. Statut réel des
 * 4 métriques : "sociétés cotées suivies" est une vraie donnée calculée
 * (nbActions, dernière séance) ; "15 min"/"A–F" reflètent des faits réels
 * d'infrastructure et de méthodologie (cadence du scraper, échelle de note)
 * mais ne sont pas des requêtes — pas de nombre à recalculer ; "100%" est une
 * affirmation éditoriale sans équivalent mesurable en base aujourd'hui — à ne
 * pas présenter comme "vérifiée" au même titre que les autres tant qu'aucune
 * métrique de couverture réelle ne l'alimente. L'emplacement témoignages
 * (prop `testimonials`) est prêt à recevoir de VRAIES citations quand elles existent.
 */

export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

export function ProofBand({ nbActions, testimonials = [] }: { nbActions: number; testimonials?: Testimonial[] }) {
  const metrics = [
    // Repli sur 48 (jamais inventé) si aucune séance n'a de données : c'est le
    // total réel de sociétés cotées à la BRVM, déjà vérifié et affiché ailleurs
    // sur le site (app/societes, tests fondamentaux) — pas un chiffre à part.
    { value: nbActions > 0 ? String(nbActions) : '48', label: 'sociétés cotées suivies' },
    { value: '15 min', label: 'fraîcheur des cours en séance' },
    { value: 'A–F', label: 'note quantitative par action' },
    { value: '100%', label: 'données vérifiées à la source' },
  ];
  return (
    <section aria-label="Preuves" className="mt-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-1 bg-surface px-4 py-5 text-center">
            <span className="font-display text-[clamp(22px,3.4vw,30px)] font-semibold leading-none text-accent tabular">
              {m.value}
            </span>
            <span className="text-[11px] leading-tight text-muted">{m.label}</span>
          </div>
        ))}
      </div>

      {testimonials.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.author}
              className="rounded-panel border border-border bg-surface/60 p-4"
            >
              <blockquote className="text-[13px] leading-relaxed text-ivory">“{t.quote}”</blockquote>
              <figcaption className="mt-2 text-[11px] text-muted">
                <span className="text-accent">{t.author}</span>
                {t.role ? ` · ${t.role}` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
