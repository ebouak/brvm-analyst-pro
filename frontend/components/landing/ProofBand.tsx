/**
 * Bandeau de preuve PRODUIT (factuelle) — affiché sous le Hero.
 * Pas de faux témoignages ni de faux compteur d'utilisateurs : uniquement des
 * métriques vraies et vérifiables sur la plateforme. L'emplacement témoignages
 * (prop `testimonials`) est prêt à recevoir de VRAIES citations quand elles existent.
 */

export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

const METRICS: { value: string; label: string }[] = [
  { value: '48', label: 'sociétés cotées suivies' },
  { value: '15 min', label: 'fraîcheur des cours en séance' },
  { value: 'A–F', label: 'note quantitative par action' },
  { value: '100%', label: 'données vérifiées à la source' },
];

export function ProofBand({ testimonials = [] }: { testimonials?: Testimonial[] }) {
  return (
    <section aria-label="Preuves" className="mt-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-white/10 bg-white/[0.02] sm:grid-cols-4">
        {METRICS.map((m) => (
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
              className="rounded-panel border border-white/10 bg-white/[0.02] p-4"
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
