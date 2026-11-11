import { libelleSignal } from '@/lib/signalLabel';
import Link from 'next/link';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import NewsletterForm from '@/components/NewsletterForm';
import { RechercheSocietes } from '@/components/societes/RechercheSocietes';
import { HeroCarousel } from '@/components/landing/bis/HeroCarousel';
import { FilConducteur, type Fait } from '@/components/landing/bis/FilConducteur';
import { Billboard } from '@/components/landing/bis/Billboard';
import { Seance } from '@/components/landing/bis/Seance';
import { ProofBandBis, PreuveDonneeBis } from '@/components/landing/bis/Preuve';
import { BrvmAujourdhui } from '@/components/landing/bis/BrvmAujourdhui';
import { Terminal } from '@/components/landing/bis/Terminal';
import { getMemberCount } from '@/lib/landing/memberCount';
import { QuatreFacons } from '@/components/landing/bis/QuatreFacons';
import { LandingNav } from '@/components/landing/bis/LandingNav';
import { getLandingBisData, type Plan } from '@/lib/landing/bisData';
import { getArticlesLanding } from '@/lib/landing/articles';
import { NosArticles } from '@/components/landing/bis/NosArticles';
import { computeFreshness } from '@/lib/freshness';
import { fmtDateFR, fmtFcfa, fmtNumber } from '@/lib/format';
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
    'Cours BRVM toutes les 15 min, note A–F par action, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit, créez votre compte en 1 minute.',
};


const STEPS = [
  { k: '01', t: 'Données', d: 'Cours, volumes et publications collectés à la source.', bg: 'rgb(var(--color-accent) / .14)', c: 'rgb(var(--color-accent))', ic: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></> },
  { k: '02', t: 'Analyse', d: 'Fondamentaux, RSI, MACD, dividendes.', bg: 'rgb(var(--color-accent) / .14)', c: 'rgb(var(--color-accent))', ic: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></> },
  { k: '03', t: 'Note A–F', d: 'Un score quantitatif explicable par action.', bg: 'rgb(var(--color-up) / .14)', c: 'rgb(var(--color-up))', ic: <><path d="M4 20v-8M10 20V7M16 20V3M22 20H2" /></> },
  { k: '04', t: 'Signal', d: 'Haussier, neutre ou baissier, avec la complétude des données qui le fondent.', bg: 'rgb(var(--color-warn) / .14)', c: 'rgb(var(--color-warn))', ic: <path d="M3 16l5-6 4 4 5-8 4 5" /> },
  { k: '05', t: 'Dossier d’analyse', d: 'Forces, risques et valorisation mis en mots.', bg: 'rgb(var(--color-purple) / .14)', c: 'rgb(var(--color-purple))', ic: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3h1V4H9zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 3v1a3 3 0 0 1-3 3h-1V4h1z" /> },
  { k: '06', t: 'Simulation', d: 'Ce que la décision aurait donné, dividendes inclus.', bg: 'rgb(var(--color-accent) / .14)', c: 'rgb(var(--color-accent))', ic: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="rgb(var(--color-surface))" /><circle cx="15" cy="12" r="2" fill="rgb(var(--color-surface))" /><circle cx="8" cy="17" r="2" fill="rgb(var(--color-surface))" /></> },
  { k: '07', t: 'Décision', d: 'À vous de trancher, avec les chiffres sous les yeux.', bg: 'rgb(var(--color-up) / .14)', c: 'rgb(var(--color-up))', ic: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></> },
];

function PlanPrice({ p }: { p: Plan }) {
  if (!p) return null;
  return <p className="price num">{p.monthly === 0 ? '0 FCFA' : `${fmtNumber(p.monthly)} FCFA / mois · ${fmtNumber(p.yearly)} FCFA / an`}</p>;
}

/* Vignettes produit dessinées (mini-écrans de l'app) — pas des photos, et pas de crédit image. */
const Thumb = ({ children }: { children: React.ReactNode }) => <div className="thumb" aria-hidden="true"><svg viewBox="0 0 96 64"><rect width="96" height="64" fill="rgb(var(--color-surface))" />{children}</svg></div>;

export default async function Landing() {
  const [d, membres, articles] = await Promise.all([getLandingBisData(), getMemberCount().catch(() => null), getArticlesLanding()]);
  const fraicheur = computeFreshness(d.derniereCollecte, d.dateMarche, new Date());
  const dateLabel = d.dateMarche ? fmtDateFR(d.dateMarche) : null;
  const free = d.plans.find((p) => p.code === 'free');
  const premium = d.plans.find((p) => p.code === 'premium');
  const topH = d.topHausses[0] ?? null;
  const topB = d.topBaisses[0] ?? null;

  // Un fait RÉEL par étape du fil conducteur (null = le panneau le dira, jamais un exemple).
  const age = fraicheur.ageMinutes;
  const depuis = age == null ? null : age < 60 ? `il y a ${age} min` : age < 48 * 60 ? `il y a ${Math.round(age / 60)} h` : `il y a ${Math.round(age / 1440)} j`;
  const sig = d.spotlightSignal;
  const serie = d.brvmCSerie;
  const perf = serie.length >= 2 && serie[0].v > 0 ? ((serie[serie.length - 1].v / serie[0].v) - 1) * 100 : null;
  const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  const conf = sig?.confiance == null ? null : Math.round(Number(sig.confiance) * (Number(sig.confiance) <= 1 ? 100 : 1));
  const FAITS: (Fait | null)[] = [
    d.nbActions > 0 ? { libelle: 'Collecte de la dernière séance', valeur: `${d.nbActions} sociétés · ${d.hausses} hausses · ${d.baisses} baisses`, detail: `Cours relevés sur brvm.org${dateLabel ? ` pour la séance du ${dateLabel}` : ''}${depuis ? `, dernière collecte ${depuis}` : ''}. Toutes les 15 minutes en séance.`, href: '/societes', hrefLabel: 'Voir les sociétés' } : null,
    d.plusEchangee ? { libelle: 'Valeur la plus échangée', valeur: `${d.plusEchangee.code} · ${fmtFcfa(d.plusEchangee.valeur)}`, detail: 'Volumes, RSI, MACD et fondamentaux sont recalculés à chaque séance sur la fiche de chaque société.', href: `/societes/${d.plusEchangee.code}`, hrefLabel: 'Ouvrir la fiche' } : null,
    d.topNote?.grade ? { libelle: 'Meilleure note du jour', valeur: `${d.topNote.grade} · ${d.topNote.code}${d.topNote.nom ? ` · ${d.topNote.nom}` : ''}`, detail: 'Une note de A à F recalculée chaque séance à partir de signaux vérifiables (tendance, volume, RSI, liquidité) avec le poids de chacun.', href: `/societes/${d.topNote.code}`, hrefLabel: 'Voir la note' } : null,
    sig ? { libelle: `Signal du ${fmtDateFR(sig.date_marche)} · ${sig.code}`, valeur: `${libelleSignal(sig.signal)}${conf != null ? ` · complétude des données ${conf} %` : ''}`, detail: sig.signal === 'HOLD' ? 'Neutre signifie que rien n’est net : le moteur s’abstient plutôt que de fabriquer une recommandation. Ce n’est pas un conseil en investissement.' : 'Un signal n’est émis que lorsque plusieurs sous-scores concordent. Ce n’est pas un conseil en investissement.', href: '/signaux', hrefLabel: 'Tous les signaux' } : null,
    d.latestDiagnostic ? { libelle: 'Dernier diagnostic généré', valeur: `${d.latestDiagnostic.code}${d.latestDiagnostic.generated_at ? ` · ${fmtDateFR(d.latestDiagnostic.generated_at.slice(0, 10))}` : ''}`, detail: 'Forces, risques et valorisation rédigés à partir des chiffres de la plateforme, une analyse structurée, jamais une recommandation d’achat ou de vente.', href: `/premium/diagnostic/${d.latestDiagnostic.code}`, hrefLabel: 'Lire le diagnostic' } : null,
    perf != null ? { libelle: `BRVM Composite sur ${serie.length} séances`, valeur: pct(perf), detail: 'Le simulateur rejoue une décision sur l’historique réel, dividendes inclus, pour mesurer ce qu’elle aurait donné, avant de la prendre.', href: '/simulateur', hrefLabel: 'Simuler' } : null,
    { libelle: 'La décision vous appartient', valeur: membres != null && membres > 0 ? `${fmtNumber(membres)} membres inscrits` : 'Un compte gratuit, sans carte bancaire', detail: 'Explorez les sociétés, suivez la séance et testez vos idées avec un capital fictif. Les outils avancés viennent ensuite, quand vous en aurez besoin.', href: '/signup', hrefLabel: 'Créer mon compte gratuit' },
  ];

  return (
    <div className="lb">
      <div className="wrap">
        <LandingNav />

        <main>
          {/* 1 · LA COTE DU SOIR — l'argument à gauche, la séance réelle à droite */}
          <section className="hc" aria-labelledby="h1">
            <div>
              <h1 id="h1">Les {NB_SOCIETES_COTEES} valeurs de la BRVM, chiffre par chiffre, source à l&apos;appui.</h1>
              <p className="lead">Cours toutes les 15 minutes en séance, note de A à F par action, fondamentaux, dossiers et simulateur. Chaque chiffre porte sa source, sa date et son heure.</p>
              <div className="cta">
                <Link href="/signup" className="btn btn-gold">Créer mon compte gratuit</Link>
                <Link href="/societes" className="btn btn-ghost">Explorer les sociétés</Link>
              </div>
              <p className="apres">Sans carte bancaire. Vous débutez ? <Link href="/debutant">Commencez par le guide</Link></p>
            </div>
            <Seance d={d} fraicheur={fraicheur} dateLabel={dateLabel} />
          </section>

          {/* 1 bis · À LA UNE — carrousel et annonceurs, sous le premier écran */}
          <section className="une" aria-label="À la une">
            <HeroCarousel
              slides={d.slides} dateLabel={dateLabel} brvmCVar={d.brvmC?.variation ?? null}
              hausses={d.hausses} nbActions={d.nbActions} topNote={d.topNote}
              topHausse={topH ? { code: topH.code, variation: topH.variation } : null}
              topBaisse={topB ? { code: topB.code, variation: topB.variation } : null}
              sgi={d.sgi}
            />
          </section>

          {/* 1 ter · LA MÉTHODE — sept étapes, chacune illustrée par un fait réel */}
          <section className="methode" aria-labelledby="h-methode">
            <div className="methode-tete">
              <h2 id="h-methode">De la donnée à la décision</h2>
              <p>Chaque étape s&apos;appuie sur la précédente. Rien n&apos;est affirmé sans la donnée qui le justifie.</p>
            </div>
            <FilConducteur etapes={STEPS.map((s, k) => ({ ...s, fait: FAITS[k] ?? null }))} />
          </section>

          {/* 1 bis · PREUVES (sous les 7 étapes) */}
          <ProofBandBis nbActions={d.nbActions} />
          <PreuveDonneeBis fraicheur={fraicheur} exemple={topH ? { code: topH.code, nom: topH.nom, cours: topH.cours } : null} nbActions={d.nbActions} />

          {/* 1 ter · RECHERCHE EN LANGAGE NATUREL — connecté : Jev ; sinon invitation + recherche simple */}
          <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
            <RechercheSocietes retour="/" className="" />
          </div>

          {/* 2 · LA BRVM AUJOURD'HUI — aperçu de séance (réel, dérivé) */}
          <div id="marche">
            <BrvmAujourdhui d={d} fraicheur={fraicheur} />
          </div>

          <Billboard creations={d.bandeaux} slot="Emplacement annonceur, milieu de page" />

          {/* 2 bis · ÉCRANS DU TERMINAL — vidéo de séance, note quantitative, dossier d’analyse */}
          <Terminal d={d} dateMarche={d.dateMarche} />

          {/* 2 bis bis · NOS ARTICLES — décryptages et articles publiés (disparaît sans article) */}
          <NosArticles une={articles.une} autres={articles.autres} />

          {/* 2 ter · QUATRE FAÇONS DE TRAVAILLER LE MARCHÉ */}
          <QuatreFacons />

          {/* 2 quater · AVEC UN COMPTE GRATUIT — la valeur du gratuit AVANT Premium */}
          <section className="gratuit" aria-labelledby="h-gratuit">
            <div className="card grand">
              <div>
                                <h2 id="h-gratuit">Commencez par explorer. Gratuitement.</h2>
                <ul className="coches deux">
                  {[`Explorer les ${NB_SOCIETES_COTEES} sociétés cotées et leurs fiches`, 'Consulter les fondamentaux et les dividendes', 'Suivre la séance et les indices', 'Créer votre watchlist et votre portefeuille', 'Recevoir le brief du soir et vos alertes par email'].map((t) => <li key={t}><span className="check" aria-hidden="true" />{t}</li>)}
                </ul>
                <p className="muted">Sans carte bancaire, sans engagement. Les outils avancés viennent ensuite, quand vous en aurez besoin.</p>
              </div>
              <div className="cta-col">
                <Link href="/signup" className="btn btn-ink">Créer mon compte gratuit</Link>
                <small>Sans carte bancaire · Sans engagement</small>
              </div>
            </div>
          </section>

          {/* 3 · POUR ALLER PLUS LOIN — Premium, une seule fois */}
          <section id="premium" className="prem" aria-labelledby="h-prem">
            <div className="prem-copy">
                            <h2 id="h-prem">Pour aller plus loin, quand vous serez prêt.</h2>
              <p>Les essentiels pour suivre le marché sont gratuits. Premium vous donne plus d&apos;outils pour aller plus loin et saisir davantage d&apos;opportunités.</p>
              <Link href="/pricing" className="btn btn-ghost">Voir les offres <span aria-hidden="true">→</span></Link>
            </div>

            <div>
              <div className="offers">
                <div className="offer">
                  <div className="offer-h"><span className="tag free">GRATUIT</span><span>Pour suivre l&apos;essentiel</span></div>
                  {free && <PlanPrice p={free} />}
                  <Link className="feat" href="/actualites">
                    <Thumb><rect x="8" y="8" width="80" height="6" rx="2" fill="rgb(var(--color-accent))" /><rect x="8" y="20" width="60" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="28" width="70" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="36" width="50" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="48" width="36" height="8" rx="2" fill="rgb(var(--color-up))" /><rect x="50" y="48" width="36" height="8" rx="2" fill="rgb(var(--color-down))" /></Thumb>
                    <span><b>Veille de marché</b><p>Actualités agrégées, top hausses / baisses et brief quotidien.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/societes">
                    <Thumb><path d="M6 46 L20 40 L32 44 L44 30 L56 34 L68 22 L80 26 L90 14" fill="none" stroke="rgb(var(--color-up))" strokeWidth="2" /><path d="M6 46 L20 40 L32 44 L44 30 L56 34 L68 22 L80 26 L90 14 V58 H6z" fill="rgb(var(--color-up))" opacity=".15" /></Thumb>
                    <span><b>Marché &amp; données</b><p>Cours, volumes, indices et états financiers officiels.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/signup">
                    <Thumb><g fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))"><rect x="8" y="8" width="80" height="12" rx="3" /><rect x="8" y="24" width="80" height="12" rx="3" /><rect x="8" y="40" width="80" height="12" rx="3" /></g><g fill="rgb(var(--color-accent))"><rect x="12" y="11" width="20" height="6" rx="1" /><rect x="12" y="27" width="20" height="6" rx="1" /><rect x="12" y="43" width="20" height="6" rx="1" /></g><rect x="64" y="11" width="20" height="6" rx="1" fill="rgb(var(--color-up))" /><rect x="64" y="27" width="20" height="6" rx="1" fill="rgb(var(--color-down))" /><rect x="64" y="43" width="20" height="6" rx="1" fill="rgb(var(--color-up))" /></Thumb>
                    <span><b>Watchlist &amp; portefeuille</b><p>PRU, plus-value latente, alertes par email.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                </div>
                <div className="offer gold">
                  <div className="offer-h gold"><svg width="24" height="24" viewBox="0 0 24 24" fill="rgb(var(--color-accent))" aria-hidden="true"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /></svg><span className="tag prem">PREMIUM</span><span>Pour aller plus loin</span></div>
                  {premium && <PlanPrice p={premium} />}
                  <Link className="feat" href="/pricing">
                    <Thumb><rect x="8" y="10" width="26" height="14" rx="3" fill="rgb(var(--color-up))" /><rect x="35" y="10" width="26" height="14" rx="3" fill="rgb(var(--color-border))" /><rect x="62" y="10" width="26" height="14" rx="3" fill="rgb(var(--color-down))" opacity=".5" /><text x="21" y="20" fontSize="8" fontFamily="monospace" fill="rgb(var(--color-accent) / .18)" textAnchor="middle">BUY</text><text x="48" y="20" fontSize="8" fontFamily="monospace" fill="rgb(var(--color-muted))" textAnchor="middle">HOLD</text><text x="75" y="20" fontSize="8" fontFamily="monospace" fill="rgb(var(--color-surface))" textAnchor="middle">SELL</text><rect x="8" y="32" width="80" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="40" width="64" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="48" width="72" height="4" rx="2" fill="rgb(var(--color-border-strong))" /></Thumb>
                    <span><b>Signaux BUY / HOLD / SELL</b><p>Signaux quotidiens, historique, export CSV.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/pricing">
                    <Thumb><rect x="8" y="8" width="28" height="28" rx="6" fill="rgb(var(--color-accent))" opacity=".2" stroke="rgb(var(--color-accent))" /><text x="22" y="30" fontSize="20" fontFamily="monospace" fill="rgb(var(--color-accent))" textAnchor="middle">A</text><rect x="44" y="10" width="44" height="5" rx="2" fill="rgb(var(--color-muted))" /><rect x="44" y="20" width="36" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="44" y="28" width="40" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="44" width="80" height="4" rx="2" fill="rgb(var(--color-border-strong))" /><rect x="8" y="52" width="60" height="4" rx="2" fill="rgb(var(--color-border-strong))" /></Thumb>
                    <span><b>Conseiller unifié</b><p>Notation A–F, dossier d’analyse, position de chaque valeur par famille.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/pricing">
                    <Thumb><g fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))"><rect x="8" y="8" width="80" height="10" rx="2" /><rect x="8" y="22" width="80" height="10" rx="2" /><rect x="8" y="36" width="80" height="10" rx="2" /><rect x="8" y="50" width="80" height="8" rx="2" /></g><g fill="rgb(var(--color-accent))"><rect x="12" y="11" width="14" height="4" rx="1" /><rect x="12" y="25" width="14" height="4" rx="1" /><rect x="12" y="39" width="14" height="4" rx="1" /></g><rect x="60" y="11" width="24" height="4" rx="1" fill="rgb(var(--color-up))" /><rect x="60" y="25" width="16" height="4" rx="1" fill="rgb(var(--color-up))" /><rect x="60" y="39" width="20" height="4" rx="1" fill="rgb(var(--color-down))" /></Thumb>
                    <span><b>Screener RSI, MACD, dividendes</b><p>Filtres avancés, ratios, rendement.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                  <Link className="feat" href="/pricing">
                    <Thumb><rect x="30" y="6" width="36" height="56" rx="6" fill="rgb(var(--color-elevated))" stroke="rgb(var(--color-border))" /><rect x="36" y="14" width="24" height="8" rx="2" fill="rgb(var(--color-accent))" /><rect x="36" y="26" width="24" height="4" rx="1" fill="rgb(var(--color-border-strong))" /><rect x="36" y="34" width="18" height="4" rx="1" fill="rgb(var(--color-border-strong))" /><circle cx="58" cy="15" r="4" fill="rgb(var(--color-down))" /><rect x="36" y="46" width="24" height="8" rx="2" fill="rgb(var(--color-up))" /></Thumb>
                    <span><b>Alertes &amp; détection proactive</b><p>Seuils personnalisés, Telegram, événements clés.</p></span><span className="chev" aria-hidden="true">›</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* 4 · NEWSLETTER */}
          <section className="nl" aria-labelledby="h-nl">
            <div className="card">
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
              <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3 3-5 6-5s6 2 6 5M14 18c0-2 2-3.5 4-3.5s3 1.5 3 3.5" /></svg>{membres != null && membres > 0 ? <><b className="num">{fmtNumber(membres)}</b>&nbsp;membres inscrits</> : 'Une communauté d’investisseurs'}</li>
            </ul>
            <span className="disc">Ceci n&apos;est pas un conseil en investissement.</span>
          </div>

          {/* 6 · CTA FINAL */}
          <section className="final" aria-labelledby="h-final">
            <div>
              <h2 id="h-final">Votre première analyse peut commencer maintenant.</h2>
              <p>Explorez gratuitement la BRVM, découvrez les sociétés cotées et entraînez-vous avant d&apos;aller plus loin.</p>
              <div className="cta">
                <Link href="/signup" className="btn btn-gold">Créer mon compte gratuit</Link>
                <Link href="/societes" className="btn btn-ghost-inv">Explorer les sociétés</Link>
              </div>
              <small>Gratuit · Sans carte bancaire · À votre rythme · Ceci n&apos;est pas un conseil en investissement.</small>
            </div>
            <ul className="final-l">
              {[['Données', 'fiables et datées'], ['Analyse', 'indépendante'], ['Outils', 'simples'], ['Décision', 'la vôtre']].map(([a, b]) => <li key={a}><b>{a}</b><span>{b}</span></li>)}
            </ul>
          </section>

          {/* Pied de page : le footer global du site (ConditionalShell) suit — pas de doublon ici. */}
        </main>
      </div>
    </div>
  );
}
