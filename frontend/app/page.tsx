import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';
import { HeroCarousel } from '@/components/landing/bis/HeroCarousel';
import { ProofBandBis, PreuveDonneeBis } from '@/components/landing/bis/Preuve';
import { BrvmAujourdhui } from '@/components/landing/bis/BrvmAujourdhui';
import LandingHeatmap from '@/components/landing/LandingHeatmap';
import { QuatreFacons } from '@/components/landing/bis/QuatreFacons';
import { getLandingBisData, type Plan } from '@/lib/landing/bisData';
import { computeFreshness } from '@/lib/freshness';
import { fmtDateFR, fmtNumber } from '@/lib/format';
import '@/components/landing/bis/landing-bis.css';

/**
 * Landing « bis » — vitrine CLAIRE et éditoriale (l'app, elle, reste sombre :
 * toute la CSS vit sous `.lb`, voir landing-bis.css).
 *
 * Six sections au lieu de vingt-deux : hero à la une (carrousel : vues
 * permanentes + emplacements admin), méthode en sept étapes, séance réelle,
 * Gratuit / Premium, newsletter, confiance. Tout chiffre vient de Supabase.
 */
export const revalidate = 300;

export const metadata = {
  title: 'WESTBOURSE — Décidez sur la BRVM avec des données, pas des rumeurs',
  description:
    'Cours BRVM toutes les 15 min, note A–F par action, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit — créez votre compte en 1 minute.',
};


const STEPS = [
  { k: '01', t: 'Données', d: 'Cours, volumes et publications collectés à la source.', bg: '#e4eef9', c: '#1f6fb3', ic: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></> },
  { k: '02', t: 'Analyse', d: 'Fondamentaux, RSI, MACD, dividendes.', bg: '#e4eef9', c: '#1f6fb3', ic: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></> },
  { k: '03', t: 'Note A–F', d: 'Un score quantitatif explicable par action.', bg: '#e3f4ea', c: '#2f9e6b', ic: <><path d="M4 20v-8M10 20V7M16 20V3M22 20H2" /></> },
  { k: '04', t: 'Signal', d: 'BUY, HOLD ou SELL, avec son niveau de confiance.', bg: '#fbeede', c: '#d97b1e', ic: <path d="M3 16l5-6 4 4 5-8 4 5" /> },
  { k: '05', t: 'Diagnostic IA', d: 'Forces, risques et valorisation mis en mots.', bg: '#ece6f7', c: '#6b4fbb', ic: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3h1V4H9zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 3v1a3 3 0 0 1-3 3h-1V4h1z" /> },
  { k: '06', t: 'Simulation', d: 'Ce que la décision aurait donné, dividendes inclus.', bg: '#e4eef9', c: '#1f6fb3', ic: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="#fff" /><circle cx="15" cy="12" r="2" fill="#fff" /><circle cx="8" cy="17" r="2" fill="#fff" /></> },
  { k: '07', t: 'Décision', d: 'À vous de trancher, avec les chiffres sous les yeux.', bg: '#e3f4ea', c: '#2f9e6b', ic: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></> },
];

function PlanPrice({ p }: { p: Plan }) {
  if (!p) return null;
  return <p className="price num">{p.monthly === 0 ? '0 FCFA' : `${fmtNumber(p.monthly)} FCFA / mois · ${fmtNumber(p.yearly)} FCFA / an`}</p>;
}

/* Vignettes produit dessinées (mini-écrans de l'app) — pas des photos, et pas de crédit image. */
const Thumb = ({ children }: { children: React.ReactNode }) => <div className="thumb" aria-hidden="true"><svg viewBox="0 0 96 64"><rect width="96" height="64" fill="#0a1417" />{children}</svg></div>;

export default async function Landing() {
  const d = await getLandingBisData();
  const fraicheur = computeFreshness(d.derniereCollecte, d.dateMarche, new Date());
  const dateLabel = d.dateMarche ? fmtDateFR(d.dateMarche) : null;
  const free = d.plans.find((p) => p.code === 'free');
  const premium = d.plans.find((p) => p.code === 'premium');
  const topH = d.topHausses[0] ?? null;
  const topB = d.topBaisses[0] ?? null;

  return (
    <div className="lb">
      <div className="wrap">
        <header className="nav">
          <Link className="brand" href="/" aria-label="WESTBOURSE, accueil">
            <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 8l8 24 8-16 8 16 8-24" fill="none" stroke="#1f6fb3" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" /><path d="M12 8l8 16" stroke="#1ba8c9" strokeWidth="5" strokeLinecap="round" /></svg>
            <span><b>WESTBOURSE</b><small>Comprendre aujourd&apos;hui, investir demain</small></span>
          </Link>
          <nav className="nav-links" aria-label="Principal">
            <a href="#marche" className="opt">Marché</a>
            <a href="#methode" className="opt">Méthode</a>
            <Link href="/pricing" className="opt">Tarifs</Link>
            <Link href="/login" className="opt">Connexion</Link>
            <Link href="/signup" className="btn btn-ink btn-sm" style={{ marginLeft: 8 }}>Créer un compte</Link>
          </nav>
        </header>

        <main>
          {/* 1 · HERO + 7 ÉTAPES */}
          <section className="hero" aria-labelledby="h1">
            <div className="hero-grid">
              <div className="hero-copy">
                <div className="annot" aria-hidden="true"><span className="hand">Des données<br />à vos décisions,<br />tout simplement.</span><svg className="stroke" viewBox="0 0 90 8"><path d="M2 5 C 25 1, 60 8, 88 3" fill="none" stroke="#1ba8c9" strokeWidth="3" strokeLinecap="round" /></svg></div>
                <h1 id="h1">De la donnée<br />à la <span className="accent">décision.</span></h1>
                <p className="lead">Une méthode simple et transparente pour analyser la BRVM autrement, avec des données officielles et des outils concrets.</p>
                <ul className="assur" aria-label="Sans engagement">
                  {['Aucune carte bancaire', 'Compte en 1 minute', 'Sans engagement'].map((t) => (
                    <li key={t}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#2f9e6b" /><path d="M4.5 8.5l2.3 2.3L11.5 6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>{t}</li>
                  ))}
                </ul>
                <div className="cta">
                  <Link href="/signup" className="btn btn-ink">Créer mon compte gratuit <span aria-hidden="true">→</span></Link>
                  <a href="#marche" className="btn btn-ghost">Explorer la BRVM <span aria-hidden="true">→</span></a>
                </div>
              </div>
              <HeroCarousel
                slides={d.slides} dateLabel={dateLabel} brvmCVar={d.brvmC?.variation ?? null}
                hausses={d.hausses} nbActions={d.nbActions} topNote={d.topNote}
                topHausse={topH ? { code: topH.code, variation: topH.variation } : null}
                topBaisse={topB ? { code: topB.code, variation: topB.variation } : null}
              />
            </div>
            <div className="fil"><span className="tag-fil">Le fil conducteur</span><span>Chaque étape s&apos;appuie sur la précédente. Rien n&apos;est affirmé sans la donnée qui le justifie.</span></div>
            <ol className="steps" id="methode" aria-label="La méthode en sept étapes">
              {STEPS.map((s) => (
                <li className="step" key={s.k}>
                  <div className="ic" style={{ background: s.bg, color: s.c }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{s.ic}</svg></div>
                  <span className="k">{s.k}</span><h3>{s.t}</h3><p>{s.d}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* 1 bis · PREUVES (sous les 7 étapes) */}
          <ProofBandBis nbActions={d.nbActions} />
          <PreuveDonneeBis fraicheur={fraicheur} exemple={topH ? { code: topH.code, nom: topH.nom, cours: topH.cours } : null} nbActions={d.nbActions} />

          {/* 2 · LA BRVM AUJOURD'HUI — aperçu de séance (réel, dérivé) */}
          <div id="marche">
            <BrvmAujourdhui d={d} fraicheur={fraicheur} dateLabel={dateLabel} />
          </div>

          {/* 2 bis · CARTOGRAPHIE — écran du terminal (sombre), réutilisé tel quel */}
          {d.heatmap.length > 0 && (
            <section className="etat carto" aria-label="Cartographie du marché">
              <LandingHeatmap rows={d.heatmap} dateLabel={dateLabel} />
            </section>
          )}

          {/* 2 ter · QUATRE FAÇONS DE TRAVAILLER LE MARCHÉ */}
          <QuatreFacons />

          {/* 3 · GRATUIT / PREMIUM */}
          <section id="premium" className="prem" aria-labelledby="h-prem">
            <div className="prem-copy">
              <p className="over">Accédez à plus avec Premium</p>
              <h2 id="h-prem">Gratuit ou <span className="accent">Premium</span>,<br />à chacun ses ambitions.</h2>
              <p>Les essentiels pour suivre le marché sont gratuits. Premium vous donne plus d&apos;outils pour aller plus loin et saisir davantage d&apos;opportunités.</p>
              <Link href="/pricing" className="btn btn-ink">Découvrir Premium <span aria-hidden="true">→</span></Link>
              <div className="skyline" aria-hidden="true">
                <svg viewBox="0 0 600 210" preserveAspectRatio="xMidYMax slice">
                  <defs><linearGradient id="lb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7f5f0" /><stop offset=".55" stopColor="#cfe3ee" /><stop offset="1" stopColor="#7fb0c8" /></linearGradient><linearGradient id="lb-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a9fbb" /><stop offset="1" stopColor="#2f6f8f" /></linearGradient></defs>
                  <rect width="600" height="210" fill="url(#lb-sky)" />
                  <g fill="#3b5670" opacity=".85"><rect x="20" y="96" width="26" height="70" /><rect x="52" y="70" width="18" height="96" /><rect x="76" y="110" width="34" height="56" /><rect x="118" y="58" width="22" height="108" /><rect x="146" y="88" width="30" height="78" /><rect x="184" y="40" width="16" height="126" /><rect x="206" y="104" width="40" height="62" /><rect x="254" y="76" width="24" height="90" /><rect x="286" y="118" width="46" height="48" /><rect x="340" y="62" width="20" height="104" /><rect x="368" y="92" width="34" height="74" /><rect x="410" y="50" width="18" height="116" /><rect x="436" y="108" width="42" height="58" /><rect x="486" y="84" width="26" height="82" /><rect x="520" y="112" width="30" height="54" /><rect x="558" y="70" width="22" height="96" /></g>
                  <rect x="0" y="166" width="600" height="44" fill="url(#lb-sea)" />
                  <path d="M60 166 L60 150 L540 150 L540 166" fill="none" stroke="#1f3448" strokeWidth="3" />
                  <g stroke="#1f3448" strokeWidth="2" fill="none"><path d="M160 150 v-30 M440 150 v-30" /><path d="M60 150 Q160 120 260 150 M160 150 Q300 118 440 150 M440 150 Q490 130 540 150" /></g>
                </svg>
              </div>
              <span className="hand" aria-hidden="true">L&apos;Afrique<br />a du potentiel.</span>
            </div>

            <div>
              <div className="offers">
                <div className="offer">
                  <div className="offer-h"><span className="tag free">GRATUIT</span><span>Pour suivre l&apos;essentiel</span></div>
                  {free && <PlanPrice p={free} />}
                  <Link className="feat" href="/actualites">
                    <Thumb><rect x="8" y="8" width="80" height="6" rx="2" fill="#56D7FD" /><rect x="8" y="20" width="60" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="28" width="70" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="36" width="50" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="48" width="36" height="8" rx="2" fill="#3fe18b" /><rect x="50" y="48" width="36" height="8" rx="2" fill="#ff6b6b" /></Thumb>
                    <span><b>Veille de marché</b><p>Actualités agrégées, top hausses / baisses et brief quotidien.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/societes">
                    <Thumb><path d="M6 46 L20 40 L32 44 L44 30 L56 34 L68 22 L80 26 L90 14" fill="none" stroke="#3fe18b" strokeWidth="2" /><path d="M6 46 L20 40 L32 44 L44 30 L56 34 L68 22 L80 26 L90 14 V58 H6z" fill="#3fe18b" opacity=".15" /></Thumb>
                    <span><b>Marché &amp; données</b><p>Cours, volumes, indices et états financiers officiels.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/signup">
                    <Thumb><g fill="#0f1b1f" stroke="#2a3a40"><rect x="8" y="8" width="80" height="12" rx="3" /><rect x="8" y="24" width="80" height="12" rx="3" /><rect x="8" y="40" width="80" height="12" rx="3" /></g><g fill="#56D7FD"><rect x="12" y="11" width="20" height="6" rx="1" /><rect x="12" y="27" width="20" height="6" rx="1" /><rect x="12" y="43" width="20" height="6" rx="1" /></g><rect x="64" y="11" width="20" height="6" rx="1" fill="#3fe18b" /><rect x="64" y="27" width="20" height="6" rx="1" fill="#ff6b6b" /><rect x="64" y="43" width="20" height="6" rx="1" fill="#3fe18b" /></Thumb>
                    <span><b>Watchlist &amp; portefeuille</b><p>PRU, plus-value latente, alertes par email.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                </div>
                <div className="offer gold">
                  <div className="offer-h gold"><svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a23a" aria-hidden="true"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /></svg><span className="tag prem">PREMIUM</span><span>Pour aller plus loin</span></div>
                  {premium && <PlanPrice p={premium} />}
                  <Link className="feat" href="/pricing">
                    <Thumb><rect x="8" y="10" width="26" height="14" rx="3" fill="#3fe18b" /><rect x="35" y="10" width="26" height="14" rx="3" fill="#2a3a40" /><rect x="62" y="10" width="26" height="14" rx="3" fill="#ff6b6b" opacity=".5" /><text x="21" y="20" fontSize="8" fontFamily="monospace" fill="#052a35" textAnchor="middle">BUY</text><text x="48" y="20" fontSize="8" fontFamily="monospace" fill="#c0c8cc" textAnchor="middle">HOLD</text><text x="75" y="20" fontSize="8" fontFamily="monospace" fill="#fff" textAnchor="middle">SELL</text><rect x="8" y="32" width="80" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="40" width="64" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="48" width="72" height="4" rx="2" fill="#4a5a60" /></Thumb>
                    <span><b>Signaux BUY / HOLD / SELL</b><p>Signaux quotidiens, historique, export CSV.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/pricing">
                    <Thumb><rect x="8" y="8" width="28" height="28" rx="6" fill="#56D7FD" opacity=".2" stroke="#56D7FD" /><text x="22" y="30" fontSize="20" fontFamily="monospace" fill="#56D7FD" textAnchor="middle">A</text><rect x="44" y="10" width="44" height="5" rx="2" fill="#c0c8cc" /><rect x="44" y="20" width="36" height="4" rx="2" fill="#4a5a60" /><rect x="44" y="28" width="40" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="44" width="80" height="4" rx="2" fill="#4a5a60" /><rect x="8" y="52" width="60" height="4" rx="2" fill="#4a5a60" /></Thumb>
                    <span><b>Conseiller unifié</b><p>Notation A–F, diagnostic IA, recommandations.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/pricing">
                    <Thumb><g fill="#0f1b1f" stroke="#2a3a40"><rect x="8" y="8" width="80" height="10" rx="2" /><rect x="8" y="22" width="80" height="10" rx="2" /><rect x="8" y="36" width="80" height="10" rx="2" /><rect x="8" y="50" width="80" height="8" rx="2" /></g><g fill="#56D7FD"><rect x="12" y="11" width="14" height="4" rx="1" /><rect x="12" y="25" width="14" height="4" rx="1" /><rect x="12" y="39" width="14" height="4" rx="1" /></g><rect x="60" y="11" width="24" height="4" rx="1" fill="#3fe18b" /><rect x="60" y="25" width="16" height="4" rx="1" fill="#3fe18b" /><rect x="60" y="39" width="20" height="4" rx="1" fill="#ff6b6b" /></Thumb>
                    <span><b>Screener RSI, MACD, dividendes</b><p>Filtres avancés, ratios, rendement.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/pricing">
                    <Thumb><rect x="30" y="6" width="36" height="56" rx="6" fill="#0f1b1f" stroke="#2a3a40" /><rect x="36" y="14" width="24" height="8" rx="2" fill="#56D7FD" /><rect x="36" y="26" width="24" height="4" rx="1" fill="#4a5a60" /><rect x="36" y="34" width="18" height="4" rx="1" fill="#4a5a60" /><circle cx="58" cy="15" r="4" fill="#ff6b6b" /><rect x="36" y="46" width="24" height="8" rx="2" fill="#3fe18b" /></Thumb>
                    <span><b>Alertes &amp; détection proactive</b><p>Seuils personnalisés, Telegram, événements clés.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                </div>
                <div className="banner">
                  <div className="leaf" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20c0-8 6-14 16-16-1 10-7 16-16 16z" /><path d="M4 20c4-6 8-9 12-11" /></svg></div>
                  <div className="t"><b>Des marchés plus compréhensibles. Des opportunités plus accessibles.</b><span>Informations fiables · Analyses claires · Outils concrets</span></div>
                  <Link href="/pricing" className="btn btn-gold">Voir les offres Premium <span aria-hidden="true">→</span></Link>
                </div>
              </div>
            </div>
          </section>

          {/* 4 · NEWSLETTER */}
          <section className="nl" aria-labelledby="h-nl">
            <div className="card">
              <p className="over">Brief du soir</p>
              <h2 id="h-nl" style={{ fontSize: 26, marginTop: 8 }}>La séance résumée chaque soir.</h2>
              <p style={{ color: 'var(--muted)', marginTop: 8 }}>Cinq lignes, chaque jour de cotation à 18 h. Inscription confirmée par email, désabonnement en un clic.</p>
            </div>
            <div className="card nl-form"><p className="over" style={{ marginBottom: 8 }}>Recevoir le brief</p><NewsletterForm source="landing" compact /></div>
          </section>

          {/* 5 · CONFIANCE */}
          <div className="trust">
            <ul>
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>Données fiables et officielles</li>
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg><Link href="/methodologie">Une méthode transparente</Link></li>
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 20h16M6 16v-5M11 16V7M16 16v-3M21 16V4" /></svg>Des analyses actionnables</li>
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3 3-5 6-5s6 2 6 5M14 18c0-2 2-3.5 4-3.5s3 1.5 3 3.5" /></svg>Une communauté d&apos;investisseurs</li>
            </ul>
            <span className="disc">Ceci n&apos;est pas un conseil en investissement.</span>
          </div>

          <footer>
            <span>© {new Date().getFullYear()} WESTBOURSE · Abidjan</span>
            <nav aria-label="Légal"><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">CGU</Link><Link href="/developers">Développeurs</Link></nav>
          </footer>
        </main>
      </div>
    </div>
  );
}
