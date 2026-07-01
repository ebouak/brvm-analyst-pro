import Link from 'next/link';

/**
 * « Ce que vous débloquez » — donne à voir les fonctionnalités réelles (souvent
 * invisibles depuis la landing). Chiffres vérifiés (48 actions, 260+ obligations).
 * Aucune source inventée (la veille ne prétend pas un nombre de sources).
 */

type Badge = 'GRATUIT' | 'PREMIUM' | 'UNIQUE';

const BADGE_CLS: Record<Badge, string> = {
  GRATUIT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PREMIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  UNIQUE: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const FEATURES: {
  icon: string;
  title: string;
  desc: string;
  badge: Badge;
  href: string;
}[] = [
  {
    icon: '🔔',
    title: 'Veille de marché',
    desc: 'Actualités agrégées, alertes par ticker, heatmap des mentions et sentiment automatique.',
    badge: 'GRATUIT',
    href: '/signup',
  },
  {
    icon: '⚡',
    title: 'Signaux BUY / HOLD / SELL',
    desc: '48 titres scorés chaque séance, score de confiance %, filtrables par secteur, export CSV.',
    badge: 'PREMIUM',
    href: '/pricing',
  },
  {
    icon: '🧠',
    title: 'Conseiller unifié',
    desc: 'Recommandation Acheter / Conserver / Vendre combinant DCF, RSI, dividende et signal quantitatif.',
    badge: 'PREMIUM',
    href: '/pricing',
  },
  {
    icon: '📊',
    title: 'Marché obligataire',
    desc: '260+ obligations BRVM analysées : YTM, durée modifiée, filtres par émetteur. Base la plus complète.',
    badge: 'UNIQUE',
    href: '/obligations',
  },
  {
    icon: '🔎',
    title: 'Screener RSI · MACD · Dividende',
    desc: 'Filtrez les 48 titres par RSI, score signal, rendement du dividende et secteur.',
    badge: 'PREMIUM',
    href: '/pricing',
  },
  {
    icon: '🌾',
    title: 'Analyses hebdo matières premières',
    desc: 'Impact cacao · pétrole · or sur les valeurs sensibles : SICC, SIFCA, SOGB, PALC…',
    badge: 'PREMIUM',
    href: '/pricing',
  },
];

export function AppPreview() {
  return (
    <section aria-label="Fonctionnalités de la plateforme" className="mt-16">
      <p className="overline text-gold-2">Plateforme complète</p>
      <h2 className="mt-1 font-display text-2xl text-ivory md:text-3xl">
        Tout ce dont un investisseur BRVM a besoin.
      </h2>
      <p className="mt-1 text-sm text-muted">Découvrez ce qui vous attend après inscription.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {FEATURES.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="group flex flex-col rounded-panel border border-white/10 bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-2xl" aria-hidden>{f.icon}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${BADGE_CLS[f.badge]}`}>
                {f.badge}
              </span>
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-white group-hover:text-accent transition-colors">
              {f.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.desc}</p>
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
        <Link href="/societes" className="text-sm text-muted underline underline-offset-4 hover:text-white">
          Voir tous les outils →
        </Link>
      </div>
    </section>
  );
}
