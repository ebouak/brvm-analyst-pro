import Link from 'next/link';

/**
 * « Quatre façons de travailler le marché » — Analyser, Surveiller, Simuler,
 * Explorer. Chaque outil pointe vers une route qui EXISTE (vérifié au
 * moment d'écrire : /societes, /signaux, /screener, /fondamentaux,
 * /portefeuille, /parametres/alertes, /brief, /actualites, /simulateur,
 * /simulateur-budget, /premium/paper-trading, /backtest, /obligations,
 * /weekly, /comparateur-sgi, /analyses/hebdo, /formations, /developers).
 * Les visuels de tête sont des mini-écrans dessinés (SVG), pas des photos.
 */

interface Outil { t: string; d: string; href: string; ic: React.ReactNode }

/** Routes derrière le login (lib/supabase/middleware.ts) : on le dit avant le clic. */
const PROTEGEES = new Set(['/signaux', '/fondamentaux', '/screener', '/parametres/alertes', '/portefeuille', '/premium/paper-trading', '/backtest', '/obligations', '/weekly']);
interface Colonne { k: string; t: string; d: string; c: string; bg: string; href: string; visuel: React.ReactNode; outils: Outil[] }

const I = {
  bolt: <path d="M13 3L4 14h6l-1 7 9-11h-6z" />,
  doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  trend: <path d="M3 16l5-6 4 4 5-8 4 5" />,
  bell: <><path d="M6 9a6 6 0 0 1 12 0v5l2 2H4l2-2z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  pie: <><path d="M12 3v9h9" /><circle cx="12" cy="12" r="9" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  news: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  sim: <><path d="M4 18l5-7 4 4 7-9" /><path d="M4 21h16" /></>,
  piggy: <><path d="M5 12a7 7 0 0 1 14 0v3a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" /><path d="M9 21v-3M15 21v-3M19 10h2" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8l6 4-6 4z" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
  bond: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 12h10M7 15h6" /></>,
  drop: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />,
  scale: <><path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z" /></>,
  weekly: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  cap: <><path d="M3 9l9-4 9 4-9 4z" /><path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" /></>,
  api: <><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
};

const Ic = ({ c }: { c: React.ReactNode }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c}</svg>;

/* Visuels de tête : mini-écrans dessinés, mêmes couleurs que l'app. */
const V = {
  analyser: (
    <svg viewBox="0 0 320 150" aria-hidden="true"><rect width="320" height="150" fill="rgb(var(--color-surface))" /><rect x="14" y="14" width="200" height="122" rx="8" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><text x="26" y="34" fontSize="11" fontFamily="monospace" fill="rgb(var(--color-accent))">BRVM-C</text><path d="M26 110 L60 96 L94 102 L128 78 L162 84 L196 60" fill="none" stroke="rgb(var(--color-up))" strokeWidth="2" /><path d="M26 110 L60 96 L94 102 L128 78 L162 84 L196 60 V126 H26z" fill="rgb(var(--color-up))" opacity=".12" /><rect x="228" y="14" width="78" height="122" rx="8" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><text x="240" y="34" fontSize="9" fontFamily="monospace" fill="rgb(var(--color-muted))">NOTE</text><text x="267" y="88" fontSize="44" fontFamily="monospace" fill="rgb(var(--color-accent))" textAnchor="middle">A</text><rect x="240" y="104" width="54" height="6" rx="3" fill="rgb(var(--color-up))" /><rect x="240" y="116" width="36" height="6" rx="3" fill="rgb(var(--color-accent))" /></svg>
  ),
  surveiller: (
    <svg viewBox="0 0 320 150" aria-hidden="true"><rect width="320" height="150" fill="rgb(var(--color-surface))" /><rect x="110" y="8" width="100" height="160" rx="14" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><rect x="122" y="40" width="76" height="46" rx="8" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><rect x="128" y="46" width="10" height="10" rx="3" fill="rgb(var(--color-accent))" /><text x="142" y="55" fontSize="8" fontFamily="sans-serif" fill="rgb(var(--color-ivory))">Alerte</text><text x="128" y="70" fontSize="8" fontFamily="monospace" fill="rgb(var(--color-up))">SONATEL +5,2 %</text><text x="128" y="80" fontSize="7" fontFamily="sans-serif" fill="rgb(var(--color-muted))">Seuil atteint</text><rect x="122" y="96" width="76" height="28" rx="8" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><rect x="128" y="104" width="40" height="5" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="128" y="113" width="60" height="5" rx="2" fill="rgb(var(--color-border-strong))" /></svg>
  ),
  simuler: (
    <svg viewBox="0 0 320 150" aria-hidden="true"><rect width="320" height="150" fill="rgb(var(--color-surface))" /><rect x="14" y="14" width="292" height="122" rx="8" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><text x="26" y="34" fontSize="11" fontFamily="sans-serif" fill="rgb(var(--color-ivory))">Simulateur</text><path d="M26 108 L66 100 L106 104 L146 82 L186 86 L226 62 L262 50" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2" /><path d="M26 112 L66 108 L106 110 L146 98 L186 100 L226 88 L262 84" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2" /><rect x="216" y="22" width="80" height="30" rx="6" fill="rgb(var(--color-up) / .25)" stroke="rgb(var(--color-up))" /><text x="256" y="36" fontSize="11" fontFamily="monospace" fill="rgb(var(--color-up))" textAnchor="middle">+28,4 %</text><text x="256" y="46" fontSize="7" fontFamily="sans-serif" fill="rgb(var(--color-muted))" textAnchor="middle">avec dividendes</text><text x="26" y="128" fontSize="8" fontFamily="sans-serif" fill="rgb(var(--color-muted))">Investissement 1 000 000 FCFA · 3 ans · dividendes inclus</text></svg>
  ),
  explorer: (
    <svg viewBox="0 0 320 150" aria-hidden="true"><rect width="320" height="150" fill="rgb(var(--color-surface))" /><rect x="14" y="14" width="150" height="122" rx="8" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" />{['Actions', 'Obligations', 'Matières premières', 'SGI', 'Analyses & Academy', 'API & données'].map((t, i) => (<g key={t}><rect x="24" y={24 + i * 18} width="10" height="10" rx="3" fill="rgb(var(--color-accent))" /><text x="40" y={33 + i * 18} fontSize="9" fontFamily="sans-serif" fill="rgb(var(--color-ivory))">{t}</text></g>))}<circle cx="240" cy="75" r="48" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><path d="M200 60 Q240 40 280 62 M196 82 Q240 100 284 80 M240 27 Q225 75 240 123 M240 27 Q255 75 240 123" fill="none" stroke="rgb(var(--color-border-strong))" strokeWidth="1.2" /><path d="M222 58 c6 -4 12 2 10 8 c-2 6 4 10 -2 14 c-6 4 -14 -2 -12 -8 c2 -6 -2 -10 4 -14z" fill="rgb(var(--color-accent))" opacity=".85" /></svg>
  ),
};

const COLONNES: Colonne[] = [
  { k: '01', t: 'Analyser', d: 'Comprendre ce qui vaut une action.', c: 'rgb(var(--color-accent))', bg: 'rgb(var(--color-accent) / .14)', href: '/societes', visuel: V.analyser, outils: [
    { t: 'Note A–F', d: 'Score quantitatif par action', href: '/signaux', ic: I.bolt },
    { t: 'Fondamentaux', d: 'États financiers officiels', href: '/fondamentaux', ic: I.doc },
    { t: 'Screener', d: 'RSI, MACD, dividendes…', href: '/screener', ic: I.search },
    { t: 'Signaux', d: 'BUY / HOLD / SELL', href: '/signaux', ic: I.trend },
  ] },
  { k: '02', t: 'Surveiller', d: 'Ne rien manquer de la séance.', c: 'rgb(var(--color-up))', bg: 'rgb(var(--color-up) / .14)', href: '/portefeuille', visuel: V.surveiller, outils: [
    { t: 'Watchlist & alertes', d: 'Seuils personnalisés, e-mail et Telegram', href: '/parametres/alertes', ic: I.bell },
    { t: 'Portefeuille', d: 'PRU, plus-value latente, composition', href: '/portefeuille', ic: I.pie },
    { t: 'Brief quotidien', d: 'La séance résumée chaque soir', href: '/brief', ic: I.mail },
    { t: 'Actualités', d: 'Toute l’actualité BRVM et UEMOA', href: '/actualites', ic: I.news },
  ] },
  { k: '03', t: 'Simuler', d: 'Éprouver une décision avant de la prendre.', c: 'rgb(var(--color-warn))', bg: 'rgb(var(--color-warn) / .14)', href: '/simulateur', visuel: V.simuler, outils: [
    { t: 'Simulateur', d: 'Et si vous aviez investi ?', href: '/simulateur', ic: I.sim },
    { t: 'Simulateur budget', d: 'Construire un plan d’épargne', href: '/simulateur-budget', ic: I.piggy },
    { t: 'Paper trading', d: 'Capital virtuel, conditions réelles', href: '/premium/paper-trading', ic: I.play },
    { t: 'Backtesting', d: 'Rejouer une stratégie sur l’historique', href: '/backtest', ic: I.history },
  ] },
  { k: '04', t: 'Explorer', d: 'Élargir au-delà des actions.', c: 'rgb(var(--color-purple))', bg: 'rgb(var(--color-purple) / .14)', href: '/obligations', visuel: V.explorer, outils: [
    { t: 'Marché obligataire', d: 'YTM, duration, courbe des taux', href: '/obligations', ic: I.bond },
    { t: 'Matières premières', d: 'Cacao, pétrole, or et valeurs sensibles', href: '/weekly', ic: I.drop },
    { t: 'Comparateur SGI', d: 'Courtage, tenue de compte, dépôt minimum', href: '/comparateur-sgi', ic: I.scale },
    { t: 'Analyses hebdo', d: 'Les valeurs à suivre de la semaine', href: '/analyses/hebdo', ic: I.weekly },
    { t: 'Academy', d: 'Se former, passer l’examen, être certifié', href: '/formations', ic: I.cap },
    { t: 'API & données', d: 'Intégrer nos données à vos outils', href: '/developers', ic: I.api },
  ] },
];

export function QuatreFacons() {
  return (
    <section className="facons" aria-labelledby="h-facons">
      <div className="facons-head">
        <div>
          <p className="over">La plateforme</p>
          <h2 id="h-facons">Quatre façons de travailler<br />le <span className="accent">marché</span>.</h2>
          <p className="lead">Comprendre, surveiller, tester et explorer — WESTBOURSE réunit les outils dont vous avez besoin, au même endroit.</p>
        </div>
        <div className="annot-2" aria-hidden="true"><span className="hand">Des outils concrets<br />pour aller plus loin.</span><svg className="stroke" viewBox="0 0 90 8"><path d="M2 5 C 25 1, 60 8, 88 3" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="3" strokeLinecap="round" /></svg></div>
      </div>
      <div className="cols">
        {COLONNES.map((col) => (
          <article key={col.k} className="col" style={{ ['--col' as string]: col.c, ['--col-bg' as string]: col.bg }}>
            <header>
              <span className="k">{col.k}</span>
              <h3>{col.t}</h3>
              <p>{col.d}</p>
            </header>
            <div className="visuel">{col.visuel}</div>
            <ul>
              {col.outils.map((o) => (
                <li key={o.t}>
                  <Link href={o.href}>
                    <span className="ic"><Ic c={o.ic} /></span>
                    <span><b>{o.t}{PROTEGEES.has(o.href) && <em className="cg" title="Accessible avec un compte gratuit">compte gratuit</em>}</b><small>{o.d}</small></span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={col.href} className="voir">Voir les outils <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </div>
      <div className="banner">
        <div className="leaf" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20c0-8 6-14 16-16-1 10-7 16-16 16z" /><path d="M4 20c4-6 8-9 12-11" /></svg></div>
        <div className="t"><b>Une plateforme. Plusieurs façons de travailler le marché.</b><span>Des données fiables · Des analyses claires · Des outils concrets</span></div>
        <Link href="/signup" className="btn btn-gold">Créer mon compte gratuit <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
