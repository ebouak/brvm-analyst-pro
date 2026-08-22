import Link from 'next/link';

/**
 * Grille « Tout ce dont vous avez besoin » — 12 outils en 3 colonnes, rendue
 * à côté de la cartographie du marché (2/3 de la largeur sur grand écran).
 *
 * Chaque `href` pointe vers une route réellement existante sous `frontend/app`.
 * Ne pas y ajouter d'entrée sans vérifier la route : un lien mort sur la page
 * d'accueil est pire que l'absence de l'entrée.
 */

interface Tool {
  label: string;
  href: string;
  desc: string;
  icon: JSX.Element;
}

/** Icônes au trait, 20×20, héritant de `currentColor` (donc de l'accent au survol). */
const I = {
  note: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M6.5 10.5h3M6.5 13h5" />
      <path d="M6.5 7h7" />
    </>
  ),
  loupe: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
    </>
  ),
  obligations: (
    <>
      <path d="M3 16h14" />
      <rect x="4.5" y="9" width="3" height="7" />
      <rect x="9" y="5.5" width="3" height="10.5" />
      <rect x="13.5" y="11" width="3" height="5" />
    </>
  ),
  matieres: (
    <>
      <circle cx="7" cy="10" r="4" />
      <circle cx="13" cy="10" r="4" />
    </>
  ),
  conseiller: (
    <>
      <path d="M10 3l6 3v4.5c0 3.6-2.5 6.6-6 7.5-3.5-.9-6-3.9-6-7.5V6l6-3z" />
      <path d="M7.5 10l2 2 3.5-3.5" />
    </>
  ),
  signaux: (
    <>
      <path d="M10 3l6.5 12h-13L10 3z" />
      <path d="M10 8.5v3" />
      <path d="M10 13.2v.1" />
    </>
  ),
  paper: (
    <>
      <path d="M3 15l4.5-5 3 3L17 6" />
      <path d="M13 6h4v4" />
    </>
  ),
  alertes: (
    <>
      <path d="M10 3a4.5 4.5 0 00-4.5 4.5c0 4-2 5-2 5h13s-2-1-2-5A4.5 4.5 0 0010 3z" />
      <path d="M8.5 15.5a1.8 1.8 0 003 0" />
    </>
  ),
  simulateur: (
    <>
      <rect x="4.5" y="2.5" width="11" height="15" rx="2" />
      <path d="M7.5 6h5" />
      <path d="M7.5 9.5h1.5M11 9.5h1.5M7.5 12.5h1.5M11 12.5h1.5" />
    </>
  ),
  actus: (
    <>
      <rect x="3" y="4.5" width="14" height="11" rx="2" />
      <path d="M6 8h5M6 11h8" />
    </>
  ),
  brief: (
    <>
      <path d="M5 3h7l3 3v11H5z" />
      <path d="M12 3v3h3" />
      <path d="M7.5 10h5M7.5 13h3" />
    </>
  ),
  api: (
    <>
      <path d="M7 4L3 10l4 6" />
      <path d="M13 4l4 6-4 6" />
    </>
  ),
};

function Icon({ children }: { children: JSX.Element }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const TOOLS: Tool[] = [
  { label: 'Note A–F', href: '/notations', desc: 'Notation quantitative chaque jour', icon: I.note },
  { label: 'Screener avancé', href: '/screener', desc: 'RSI, MACD, dividendes, filtres multiples', icon: I.loupe },
  { label: 'Marché obligataire', href: '/obligations', desc: 'Obligations BRVM analysées', icon: I.obligations },
  { label: 'Matières premières', href: '/weekly', desc: 'Cacao, pétrole, or et valeurs sensibles', icon: I.matieres },
  { label: 'Conseiller unifié', href: '/conseiller', desc: 'Recommandations basées sur DCF, RSI…', icon: I.conseiller },
  { label: 'Signaux BUY / HOLD / SELL', href: '/signaux', desc: 'Scores, confiance, export CSV', icon: I.signaux },
  { label: 'Paper trading', href: '/premium/paper-trading', desc: 'Entraînez-vous sans risque, capital virtuel', icon: I.paper },
  { label: 'Watchlist & alertes', href: '/parametres/alertes', desc: 'Suivi personnalisé en temps réel', icon: I.alertes },
  { label: 'Simulateur', href: '/simulateur', desc: 'Et si vous aviez investi ? Dividendes inclus', icon: I.simulateur },
  { label: 'Actualités & analyses', href: '/actualites', desc: "Toute l'actualité BRVM et UEMOA", icon: I.actus },
  { label: 'Brief quotidien', href: '/brief', desc: 'La séance résumée en 30 secondes', icon: I.brief },
  { label: 'API & données', href: '/developers', desc: 'Intégrez nos données à vos outils', icon: I.api },
];

export function ToolsGrid() {
  return (
    <div className="rounded-panel border border-border bg-surface/60 p-5 md:p-6">
      <h2 className="overline mb-4 text-gold-2">Tout ce dont vous avez besoin pour investir intelligemment</h2>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-surface/60 px-3.5 py-3 transition-colors hover:border-accent/30 hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span className="mt-0.5 text-muted transition-colors group-hover:text-accent">
              <Icon>{t.icon}</Icon>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ivory">{t.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-faint">{t.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
