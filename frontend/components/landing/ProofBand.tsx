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
 *
 * Sources : les trois revendications sont vérifiées en base avant d'être
 * affichées — cours BRVM, macro BCEAO (macro_indicators) et notations
 * Bloomfield (brvm_instruments.notation_json, 38 sociétés). Ne pas ajouter une
 * source ici sans que la donnée correspondante existe réellement.
 */

/**
 * Logos officiels des sources, téléchargés depuis les sites des institutions.
 * Chacun est posé sur une pastille blanche : les trois sont sombres sur fond
 * transparent et disparaîtraient en thème sombre. Même parti pris que
 * HeroSpotlight. Marques déposées de leurs propriétaires respectifs, citées
 * ici au titre de l'attribution factuelle des sources de données.
 */
const SOURCES = [
  { src: '/brand/brvm-logo.png', alt: 'BRVM' },
  { src: '/brand/bceao-logo.png', alt: 'BCEAO' },
  { src: '/brand/bloomfield-logo.png', alt: 'Bloomfield Investment' },
] as const;

export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  societes: 'M3 21h18M5 21V7l7-4 7 4v14M9 11h.01M9 15h.01M15 11h.01M15 15h.01',
  horloge: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  note: 'M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M17 3v3.5h-3.5M7 21v-3.5h3.5',
  sources: 'M12 3l8 3.5v5c0 4.2-3.2 7.8-8 8.5-4.8-.7-8-4.3-8-8.5v-5L12 3zM9 12l2 2 4-4',
} as const;

export function ProofBand({ nbActions, testimonials = [] }: { nbActions: number; testimonials?: Testimonial[] }) {
  const metrics = [
    // Repli sur 48 (jamais inventé) si aucune séance n'a de données : c'est le
    // total réel de sociétés cotées à la BRVM, déjà vérifié et affiché ailleurs
    // sur le site (app/societes, tests fondamentaux) — pas un chiffre à part.
    { value: nbActions > 0 ? String(nbActions) : '48', label: 'sociétés BRVM suivies', icon: ICONS.societes },
    { value: '15 min', label: 'actualisation en séance', icon: ICONS.horloge },
    { value: 'A–F', label: 'notation quantitative', icon: ICONS.note },
    { value: 'Sources', label: 'données vérifiées et officielles', icon: ICONS.sources },
  ];

  return (
    <section aria-label="Preuves" className="mt-4">
      <div className="grid grid-cols-1 gap-6 rounded-panel border border-border bg-surface px-5 py-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:gap-8 lg:px-7">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-start gap-3">
              <span className="mt-0.5 text-accent"><Ico d={m.icon} /></span>
              <span className="min-w-0">
                <span className="tabular block font-display text-[clamp(18px,2.2vw,24px)] font-semibold leading-none text-ivory">
                  {m.value}
                </span>
                <span className="mt-1.5 block text-[11px] leading-tight text-muted">{m.label}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="overline mb-3 text-faint">Nos données proviennent des sources du marché</p>
          <ul className="flex flex-wrap items-center gap-2.5">
            {SOURCES.map((s) => (
              <li key={s.alt} className="flex h-8 items-center rounded-md bg-white px-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.alt} className="h-4 w-auto" />
              </li>
            ))}
            <li className="text-[11px] font-medium text-muted">Publications des émetteurs</li>
          </ul>
        </div>
      </div>

      {testimonials.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.author} className="rounded-panel border border-border bg-surface/60 p-4">
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
