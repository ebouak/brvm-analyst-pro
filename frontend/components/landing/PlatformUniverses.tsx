import Link from 'next/link';

/**
 * Section 14 — la plateforme, organisée en quatre univers plutôt qu'en une
 * grille monotone de cartes identiques.
 *
 * Chaque `href` pointe vers une route réellement existante sous `frontend/app`
 * (vérifiées une à une). Ne rien ajouter ici sans la route derrière : un lien
 * mort sur la page d'accueil coûte plus cher que l'entrée qu'il apporte.
 */

interface Univers {
  cle: string;
  titre: string;
  accroche: string;
  outils: { label: string; href: string; desc: string }[];
}

const UNIVERS: Univers[] = [
  {
    cle: 'analyser',
    titre: 'Analyser',
    accroche: 'Comprendre ce que vaut une action.',
    outils: [
      { label: 'Note A–F', href: '/notations', desc: 'Score quantitatif par action, recalculé chaque séance' },
      { label: 'Fondamentaux', href: '/societes', desc: 'États financiers extraits des publications officielles' },
      { label: 'Screener', href: '/screener', desc: 'RSI, MACD, dividendes, secteurs, filtres combinés' },
      { label: 'Signaux', href: '/signaux', desc: 'BUY / HOLD / SELL avec niveau de confiance' },
      { label: 'Conseiller unifié', href: '/conseiller', desc: 'Synthèse DCF, technique et fondamentale' },
      { label: 'Liquidité', href: '/liquidite', desc: 'Score de liquidité, spread estimé, flux acheteur' },
    ],
  },
  {
    cle: 'surveiller',
    titre: 'Surveiller',
    accroche: 'Ne rien manquer de la séance.',
    outils: [
      { label: 'Watchlist & alertes', href: '/parametres/alertes', desc: 'Seuils personnalisés, e-mail et Telegram' },
      { label: 'Portefeuille', href: '/portefeuille', desc: 'PRU, plus-value latente, composition' },
      { label: 'Brief quotidien', href: '/brief', desc: 'La séance résumée chaque soir' },
      { label: 'Actualités', href: '/actualites', desc: "Toute l'actualité BRVM et UEMOA" },
    ],
  },
  {
    cle: 'simuler',
    titre: 'Simuler',
    accroche: 'Éprouver une décision avant de la prendre.',
    outils: [
      { label: 'Simulateur', href: '/simulateur', desc: 'Et si vous aviez investi ? Dividendes inclus' },
      { label: 'Simulateur budget', href: '/simulateur-budget', desc: 'Construire un plan à partir de votre épargne' },
      { label: 'Paper trading', href: '/premium/paper-trading', desc: 'Capital virtuel, conditions réelles' },
      { label: 'Backtesting', href: '/premium/backtesting', desc: 'Rejouer une stratégie sur l’historique' },
    ],
  },
  {
    cle: 'explorer',
    titre: 'Explorer',
    accroche: 'Élargir au-delà des actions.',
    outils: [
      { label: 'Marché obligataire', href: '/obligations', desc: 'YTM, duration, courbe des taux' },
      { label: 'Matières premières', href: '/weekly', desc: 'Cacao, pétrole, or et valeurs sensibles' },
      { label: 'Comparateur SGI', href: '/comparateur-sgi', desc: 'Courtage, tenue de compte, dépôt minimum' },
      { label: 'Analyses hebdo', href: '/analyses', desc: 'Les valeurs en vogue de la semaine' },
      { label: 'Academy', href: '/formations/academy', desc: 'Se former, passer l’examen, être certifié' },
      { label: 'API & données', href: '/developers', desc: 'Intégrer nos données à vos outils' },
    ],
  },
];

export function PlatformUniverses() {
  return (
    <section aria-labelledby="plateforme-titre" className="mt-14">
      <div className="mb-8 max-w-[52ch]">
        <p className="overline mb-3 text-gold-2">La plateforme</p>
        <h2 id="plateforme-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
          Quatre façons de travailler le marché.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {UNIVERS.map((u) => (
          <div key={u.cle} className="flex flex-col rounded-panel border border-border bg-surface/60 p-5">
            <h3 className="font-display text-xl text-ivory">{u.titre}</h3>
            <p className="mt-1 text-[11.5px] leading-snug text-faint">{u.accroche}</p>

            <ul className="mt-4 flex-1 space-y-px">
              {u.outils.map((o) => (
                <li key={o.href}>
                  <Link
                    href={o.href}
                    className="group block rounded-lg px-2.5 py-2 transition-colors hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-ivory">{o.label}</span>
                      <span
                        className="text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden
                      >
                        →
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-faint">{o.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
