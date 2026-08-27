import Link from 'next/link';

/**
 * Ce qui est gratuit, ce qui est Premium.
 *
 * Donne à voir des fonctionnalités réelles, souvent invisibles depuis la
 * landing, en indiquant clairement leur palier d'accès. Aucune source
 * inventée : la veille ne prétend pas un nombre de sources.
 *
 * Trois choses distinguent cette version de la précédente :
 *
 * 1. L'en-tête passe sur DEUX colonnes au-dessus de 1024 px (titre à gauche,
 *    promesse à droite, séparées d'un filet). Sous ce seuil elles s'empilent :
 *    deux colonnes de texte à 390 px donneraient deux colonnes illisibles.
 * 2. Chaque carte porte un pied de coches. La description dit ce que fait
 *    l'outil ; les coches disent ce qu'on obtient. Sans elles, six cartes de
 *    deux lignes se ressemblent trop pour qu'on distingue les paliers.
 * 3. Un bandeau de conversion ferme la section, là où il n'y avait qu'un lien
 *    texte — au moment précis où le visiteur vient de lire ce que Premium
 *    ajoute.
 *
 * HONNÊTETÉ — deux écarts assumés avec la maquette d'origine :
 *
 * - Les alertes n'y sont PAS « en temps réel ». La BRVM ne publie aucun flux
 *   intraday et les alertes sont évaluées par un cron : la formulation a été
 *   retirée de toute la page, la réintroduire ici l'annulerait.
 * - « Marché & Données » est badgé GRATUIT, pas UNIQUE. Les cours, volumes et
 *   indices sont également publiés par brvm.org ; les dire uniques serait faux.
 *   Ce qui est réellement distinctif — la couverture obligataire — figure dans
 *   ses coches, avec le compte réel de la dernière séance.
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
  radar: 'M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM10 10l3.5-3.5M10 10h.01',
  eclair: 'M11 2.5L4.5 11h4l-.5 6.5L15 9h-4l.5-6.5z',
  bouclier: 'M10 2.8l5.8 2.3v4.4c0 3.4-2.4 6.2-5.8 7.2-3.4-1-5.8-3.8-5.8-7.2V5.1L10 2.8zM7.6 9.9l1.7 1.7 3.2-3.4',
  barres: 'M3 16.5h14M5 16.5V9M9 16.5V5.5M13 16.5v-4M17 16.5v-7',
  entonnoir: 'M3 4h14l-5.4 6.3v5.2l-3.2 1.8v-7L3 4z',
  cloche: 'M10 3a4.6 4.6 0 00-4.6 4.6c0 4-2 5.1-2 5.1h13.2s-2-1.1-2-5.1A4.6 4.6 0 0010 3zM8.5 15.6a1.8 1.8 0 003 0',
  diamant: 'M6 3h8l3 4.5-7 9.5-7-9.5L6 3zM3 7.5h14M8 3l-2 4.5 4 9.5 4-9.5L12 3',
} as const;

function Ico({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
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

/** Petite coche cerclée du pied de carte. */
function Coche() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" className="shrink-0 text-accent" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 8.2l2 2 4-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Feature {
  icon: string;
  title: string;
  desc: string;
  badge: Badge;
  href: string;
  /** Ce qu'on obtient concrètement — chaque entrée correspond à une capacité réelle. */
  points: string[];
}

const FEATURES: Feature[] = [
  {
    icon: I.radar,
    title: 'Veille de marché',
    desc: 'Actualités agrégées, alertes par ticker, heatmap des mentions et sentiment automatique.',
    badge: 'GRATUIT',
    href: '/actualites',
    points: ['Actualités clés', 'Top hausses / baisses', 'Brief quotidien'],
  },
  {
    icon: I.eclair,
    title: 'Signaux BUY / HOLD / SELL',
    desc: 'Chaque titre scoré à la séance, avec son score de confiance, filtrable par secteur.',
    badge: 'PREMIUM',
    href: '/pricing',
    points: ['Signaux quotidiens', 'Historique', 'Export CSV'],
  },
  {
    icon: I.bouclier,
    title: 'Conseiller unifié',
    desc: 'Recommandation Acheter / Conserver / Vendre combinant DCF, RSI, dividende et signal.',
    badge: 'PREMIUM',
    href: '/pricing',
    points: ['Notation A–F', 'Diagnostic IA', 'Recommandations'],
  },
  {
    icon: I.barres,
    title: 'Marché & Données',
    desc: 'Cours, volumes, indices et états financiers extraits des publications officielles.',
    badge: 'GRATUIT',
    href: '/societes',
    // Une 4ᵉ coche portant le compte réel d'obligations est ajoutée au rendu.
    points: ['Cours de séance', 'Volumes', 'Indices'],
  },
  {
    icon: I.entonnoir,
    title: 'Screener RSI, MACD, dividendes',
    desc: 'Filtrez la cote selon vos critères techniques et fondamentaux, combinés.',
    badge: 'PREMIUM',
    href: '/pricing',
    points: ['Filtres avancés', 'RSI / MACD', 'Dividendes', 'Ratios'],
  },
  {
    icon: I.cloche,
    title: 'Alertes & détection proactive',
    desc: 'Soyez prévenu dès qu’un seuil est franchi ou qu’un événement tombe, par e-mail ou Telegram.',
    badge: 'PREMIUM',
    href: '/pricing',
    points: ['Alertes personnalisées', 'Seuils', 'Événements clés'],
  },
];

export function AppPreview({ nbObligations }: { nbObligations?: number | null }) {
  return (
    <section aria-labelledby="paliers-titre" className="mt-16">
      {/* En-tête deux colonnes au-dessus de lg — la promesse répond au titre
          plutôt que de le suivre. Empilé en dessous. */}
      <div className="mb-8">
        <p className="overline mb-3 text-gold-2">Accédez à plus avec Premium</p>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <h2
            id="paliers-titre"
            className="font-display text-3xl leading-[1.08] text-ivory md:text-5xl [letter-spacing:-0.035em]"
          >
            Ce qui est gratuit,
            <br />
            ce qui est <span className="text-accent">Premium.</span>
          </h2>
          <p className="max-w-[46ch] self-center text-[15px] leading-[1.7] text-muted lg:border-l lg:border-border lg:pl-10">
            <span className="text-ivory">Découvrez</span> ce que vous pouvez analyser gratuitement,
            et ce que Premium ajoute à votre arsenal.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => {
          // Compte réel de la dernière séance obligataire, jamais figé dans le
          // texte : c'est la seule donnée vivante de cette section.
          const points =
            f.title === 'Marché & Données' && nbObligations != null && nbObligations > 0
              ? [...f.points, `${nbObligations} obligations`]
              : f.points;

          return (
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

              <h3 className="mt-3 font-display text-[17px] font-semibold text-ivory transition-colors group-hover:text-accent">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.desc}</p>

              {/* Pied de coches. `mt-auto` les cale en bas pour qu'elles
                  s'alignent d'une carte à l'autre malgré des descriptions de
                  longueurs différentes. */}
              <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3.5">
                {points.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-[11.5px] text-muted">
                    <Coche />
                    {p}
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>

      {/* Bandeau de conversion fermant la section. */}
      <div className="mt-4 flex flex-col gap-5 rounded-panel border border-border bg-surface/60 p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/[0.07] text-accent">
            <Ico d={I.diamant} size={26} />
          </span>
          <div>
            <p className="font-display text-xl text-ivory md:text-2xl [letter-spacing:-0.02em]">
              Passez à Premium et prenez une longueur d&apos;avance.
            </p>
            <p className="mt-1 text-[13.5px] text-muted">
              Plus d&apos;outils, plus d&apos;analyses, plus d&apos;opportunités.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="landing-hero-cta inline-flex min-h-[46px] items-center gap-2 rounded-full px-6 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
            >
              Découvrir Premium <span aria-hidden>→</span>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[46px] items-center rounded-full border border-border px-6 text-sm font-semibold text-ivory transition-colors hover:border-accent/40"
            >
              Comparer les plans
            </Link>
          </div>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <Coche /> Sans engagement
            </span>
            <span className="flex items-center gap-1.5">
              <Coche /> Résiliable à tout moment
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
