import Link from 'next/link';

/**
 * Section 18 — ce qui est gratuit, ce qui est Premium.
 *
 * Donne à voir des fonctionnalités réelles, souvent invisibles depuis la
 * landing, en indiquant clairement leur palier d'accès. Aucune source
 * inventée : la veille ne prétend pas un nombre de sources.
 *
 * Icônes au trait 20×20 héritant de `currentColor` (donc de l'accent au
 * survol), même famille que PlatformUniverses. Elles ont remplacé des emoji,
 * qui juraient dans un produit financier institutionnel. Ne pas réintroduire
 * d'emoji ici.
 *
 * Les badges de palier utilisent les tokens du thème (`up`, `warn`, `purple`)
 * et non la palette Tailwind brute : les couleurs doivent suivre le thème.
 */

type Badge = 'GRATUIT' | 'PREMIUM' | 'UNIQUE';

const BADGE_CLS: Record<Badge, string> = {
  GRATUIT: 'border-up/30 bg-up/10 text-up',
  PREMIUM: 'border-warn/30 bg-warn/10 text-warn',
  UNIQUE: 'border-purple/30 bg-purple/10 text-purple',
};

/** Tracés 20×20, épaisseur uniforme 1.4 — une seule famille sur toute la page. */
const I = {
  cloche: 'M10 3a4.6 4.6 0 00-4.6 4.6c0 4-2 5.1-2 5.1h13.2s-2-1.1-2-5.1A4.6 4.6 0 0010 3zM8.5 15.6a1.8 1.8 0 003 0',
  eclair: 'M11 2.5L4.5 11h4l-.5 6.5L15 9h-4l.5-6.5z',
  boussole: 'M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM12.9 7.1l-1.6 4.2-4.2 1.6 1.6-4.2 4.2-1.6z',
  obligations: 'M3 16.5h14M5 16.5V9M9 16.5V5.5M13 16.5v-4M17 16.5v-7',
  entonnoir: 'M3 4h14l-5.4 6.3v5.2l-3.2 1.8v-7L3 4z',
  epi: 'M10 17.5V8M10 8c0-2.2 1.2-4 3-4.5.4 2.4-.6 4.4-3 4.5zM10 8C10 5.8 8.8 4 7 3.5 6.6 5.9 7.6 7.9 10 8zM10 12.5c0-2.2 1.2-4 3-4.5.4 2.4-.6 4.4-3 4.5zM10 12.5c0-2.2-1.2-4-3-4.5-.4 2.4.6 4.4 3 4.5z',
} as const;

function Ico({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const FEATURES: { icon: string; title: string; desc: string; badge: Badge; href: string }[] = [
  {
    icon: I.cloche,
    title: 'Veille de marché',
    desc: 'Actualités agrégées, alertes par ticker, heatmap des mentions et sentiment automatique.',
    badge: 'GRATUIT',
    href: '/signup',
  },
  {
    icon: I.eclair,
    title: 'Signaux BUY / HOLD / SELL',
    desc: 'Chaque titre scoré à la séance, score de confiance, filtrable par secteur, export CSV.',
    badge: 'PREMIUM',
    href: '/pricing',
  },
  {
    icon: I.boussole,
    title: 'Conseiller unifié',
    desc: 'Recommandation Acheter / Conserver / Vendre combinant DCF, RSI, dividende et signal quantitatif.',
    badge: 'PREMIUM',
    href: '/pricing',
  },
  {
    icon: I.obligations,
    title: 'Marché obligataire',
    desc: 'Obligations BRVM analysées : YTM, durée modifiée, filtres par émetteur.',
    badge: 'UNIQUE',
    href: '/obligations',
  },
  {
    icon: I.entonnoir,
    title: 'Screener RSI · MACD · Dividende',
    desc: 'Filtrez la cote par RSI, score signal, rendement du dividende et secteur.',
    badge: 'PREMIUM',
    href: '/pricing',
  },
  {
    icon: I.epi,
    title: 'Analyses hebdo matières premières',
    desc: 'Impact cacao · pétrole · or sur les valeurs sensibles : SICC, SIFCA, SOGB, PALC…',
    badge: 'PREMIUM',
    href: '/pricing',
  },
];

export function AppPreview({ nbObligations }: { nbObligations?: number | null }) {
  return (
    <section aria-labelledby="paliers-titre" className="mt-16">
      <div className="mb-6 max-w-[52ch]">
        <p className="overline mb-3 text-gold-2">Paliers d&apos;accès</p>
        <h2 id="paliers-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
          Ce qui est gratuit, ce qui est Premium.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          L&apos;essentiel du marché reste accessible sans payer. Premium ouvre les outils
          d&apos;analyse avancée.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="group flex flex-col rounded-panel border border-border bg-surface/60 p-5 transition-colors duration-200 hover:border-accent/30 hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted transition-colors group-hover:text-accent">
                <Ico d={f.icon} />
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${BADGE_CLS[f.badge]}`}>
                {f.badge}
              </span>
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-ivory transition-colors group-hover:text-accent">
              {f.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {f.desc}
              {/* Compte réel de la dernière séance obligataire, jamais figé dans le texte. */}
              {f.badge === 'UNIQUE' && nbObligations != null && nbObligations > 0 && (
                <span className="text-ivory"> {nbObligations} lignes cotées à la dernière séance.</span>
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          href="/signup"
          className="landing-hero-cta inline-flex min-h-[46px] items-center rounded-full px-6 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
        >
          Créer mon compte gratuit
        </Link>
        <Link href="/pricing" className="text-sm text-muted underline underline-offset-4 hover:text-ivory">
          Comparer les formules →
        </Link>
      </div>
    </section>
  );
}
