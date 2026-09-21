import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/bis/LandingNav';
import { StickyCta } from '@/components/landing/bis/StickyCta';
import { getDebutantData, type FicheDebutant, type SerieMois } from '@/lib/landing/debutantData';
import { fmtDateFR, fmtNumber } from '@/lib/format';
import { jsonLdScript } from '@/lib/jsonLd';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';
import '@/components/landing/bis/landing-bis.css';

/**
 * /debutant — « Je débute → je comprends → j'explore → j'analyse → je compare
 * → je simule → je me projette → je m'inscris ». Charte claire de la landing
 * (`.lb`). AUCUN chiffre saisi : cours, PER, dividende, note, simulation et
 * nombre de membres viennent de lib/landing/debutantData ; une donnée absente
 * s'affiche « — » ou fait disparaître son bloc. Pas de popup : la modale de
 * niveau de l'ancienne page a été retirée, le formulaire de contact aussi —
 * l'objectif de la page est le compte gratuit, pas un lead.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: 'Investir à la BRVM quand on débute | Westbourse' },
  description: 'Découvrez la BRVM pas à pas : apprenez à lire une action, comparer les sociétés et tester vos idées avec Westbourse.',
  alternates: { canonical: '/debutant' },
  openGraph: { title: 'Investir à la BRVM quand on débute | Westbourse', description: 'Comprenez le marché, apprenez à lire une action et entraînez-vous avant de prendre vos premières décisions.', type: 'website' },
};

const pct = (v: number | null, d = 2) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const tone = (v: number | null) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
const x1 = (v: number | null) => v == null ? '—' : `${v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} x`;
const fcfa = (v: number | null) => v == null ? '—' : `${fmtNumber(v)} FCFA`;

const ETAPES = [
  { k: '01', t: 'Comprendre', d: 'Découvrez la BRVM, les actions et les indices.', c: '#1f6fb3', bg: '#e4eef9', href: '/formations' },
  { k: '02', t: 'Observer', d: 'Explorez les sociétés cotées et leurs évolutions.', c: '#2f9e6b', bg: '#e3f4ea', href: '/societes' },
  { k: '03', t: 'Analyser', d: 'Apprenez à regarder les résultats, la valorisation et les dividendes.', c: '#b8860b', bg: '#fbf1d8', href: '/fondamentaux' },
  { k: '04', t: 'Simuler', d: 'Testez vos idées avec un capital fictif.', c: '#c4423f', bg: '#fbe4e3', href: '/simulateur' },
  { k: '05', t: 'Décider', d: 'Vous avez les informations. La décision vous appartient.', c: '#6b4fbb', bg: '#ece6f7', href: '/signup' },
];

/** Courbe SVG serveur (pas de Recharts : client-only, vide à l'impression). */
function Courbe({ serie, w = 520, h = 170, couleur = '#1ba8c9', ariaLabel }: { serie: SerieMois[]; w?: number; h?: number; couleur?: string; ariaLabel: string }) {
  if (serie.length < 2) return <p className="empty">Pas assez d&apos;historique pour tracer la courbe.</p>;
  const PL = 6, PR = 54, PT = 10, PB = 24;
  const vals = serie.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals), pad = (max - min || 1) * 0.1;
  const lo = min - pad, hi = max + pad;
  const x = (i: number) => PL + (i / (serie.length - 1)) * (w - PL - PR);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (h - PT - PB);
  const line = serie.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(serie.length - 1).toFixed(1)} ${h - PB} L${PL} ${h - PB} Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const mois = (d: string) => new Date(d).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const labels = [0, Math.floor((serie.length - 1) / 2), serie.length - 1];
  const gid = `g-${couleur.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="courbe" role="img" aria-label={ariaLabel}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={couleur} stopOpacity=".3" /><stop offset="1" stopColor={couleur} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={PL} x2={w - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity=".12" /><text x={w - PR + 8} y={y(t) + 4} fontSize="11" fill="currentColor" fillOpacity=".7" className="num">{fmtNumber(t)}</text></g>)}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={couleur} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(serie.length - 1)} cy={y(serie[serie.length - 1].v)} r="3.5" fill={couleur} stroke="#fff" strokeWidth="1.5" />
      {labels.map((i) => <text key={i} x={x(i)} y={h - 7} fontSize="11" fill="currentColor" fillOpacity=".7" textAnchor={i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle'}>{mois(serie[i].d)}</text>)}
    </svg>
  );
}

function Spark({ f }: { f: FicheDebutant }) {
  return f.spark ? <svg viewBox="0 0 44 16" width="56" height="18" aria-hidden="true"><path d={f.spark} fill="none" stroke={(f.variation ?? 0) >= 0 ? '#1f8f5a' : '#c4423f'} strokeWidth="1.6" /></svg> : <span className="empty-spark">—</span>;
}

const Check = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#2f9e6b" /><path d="M4.5 8.5l2.3 2.3L11.5 6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export default async function DebutantPage() {
  const d = await getDebutantData();
  const v = d.vedette;
  const dateLabel = d.dateMarche ? fmtDateFR(d.dateMarche) : null;
  const sim = d.simulation;

  const howTo = {
    '@context': 'https://schema.org', '@type': 'HowTo', name: 'Investir à la BRVM quand on débute',
    description: metadata.description,
    step: ETAPES.map((e, i) => ({ '@type': 'HowToStep', position: i + 1, name: e.t, text: e.d })),
  };

  return (
    <div className="lb db">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(howTo) }} />
      <div className="wrap">
        <LandingNav />

        <main>
          {/* 1 · HERO */}
          <section className="hero" aria-labelledby="h1">
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="over">Débutant</p>
                <h1 id="h1">Vous débutez sur la BRVM&nbsp;?<br />Commencez <span className="accent">simplement</span>.</h1>
                <p className="lead">Comprenez le marché, apprenez à lire une action et entraînez-vous avant de prendre vos premières décisions.</p>
                <ul className="assur" aria-label="Réassurance">
                  {['Gratuit pour commencer', 'Sans carte bancaire', 'À votre rythme'].map((t) => <li key={t}><Check />{t}</li>)}
                </ul>
                <div className="cta">
                  <Link href="/signup" className="btn btn-ink btn-lg">Créer mon compte gratuit <span aria-hidden="true">→</span></Link>
                  <Link href="/societes" className="btn btn-ghost">Explorer les sociétés</Link>
                </div>
                <p className="sous-cta">Créez votre compte en quelques secondes. Aucun engagement.</p>
              </div>
              <div className="hero-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/portrait-provisoire.jpg" alt="Un jeune investisseur réfléchit devant son ordinateur portable, une fiche WESTBOURSE à l’écran." width={900} height={672} loading="eager" />
                <div className="annot-photo" aria-hidden="true"><span className="hand">« Les bonnes décisions commencent<br />par une bonne compréhension. »</span><svg className="stroke" viewBox="0 0 90 8"><path d="M2 5 C 25 1, 60 8, 88 3" fill="none" stroke="#c9a23a" strokeWidth="3" strokeLinecap="round" /></svg></div>
                {v && v.cours != null && (
                  <div className="mini-fiche num" aria-label={`Aperçu de la fiche ${v.code}`}>
                    <span className="o">{v.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.logo} alt="" width={20} height={20} className="logo-soc" />}{v.code}{v.nom ? ` · ${v.nom}` : ''}</span>
                    <b>{fmtNumber(v.cours)} <small>FCFA</small></b>
                    <span className={`chip ${tone(v.variation)}`}>{pct(v.variation)}</span>
                    <dl><div><dt>Note</dt><dd>{v.note ?? '—'}</dd></div><div><dt>PER</dt><dd>{x1(v.per)}</dd></div><div><dt>Dividende</dt><dd>{v.dividende != null ? fmtNumber(v.dividende) : '—'}</dd></div></dl>
                  </div>
                )}
                {d.membres != null && d.membres > 0 && (
                  <div className="membres"><b className="num">{fmtNumber(d.membres)}</b><span>membres inscrits — une communauté qui fait grandir les investisseurs africains.</span></div>
                )}
              </div>
            </div>
          </section>

          {/* 2 · SITUATIONS */}
          <section className="situ" aria-labelledby="h-situ">
            <h2 id="h-situ">Vous voulez investir à la BRVM, mais vous ne savez pas par où commencer&nbsp;?</h2>
            <ul>
              <li><span className="k">01</span><b>« Je découvre la BRVM »</b><p>Je vois passer des actions, mais je ne sais pas lesquelles regarder.</p></li>
              <li><span className="k">02</span><b>« Je ne sais pas lire une action »</b><p>PER, dividende, rendement, résultats… difficile de savoir quoi regarder.</p></li>
              <li><span className="k">03</span><b>« J&apos;ai peur de me tromper »</b><p>Je préfère comprendre et tester avant d&apos;investir réellement.</p></li>
            </ul>
            <p className="transition">Westbourse vous accompagne du premier regard jusqu&apos;à votre première analyse. <a href="#parcours" className="lien">Voir comment ça fonctionne →</a></p>
          </section>

          {/* 3 · PARCOURS */}
          <section className="parcours" id="parcours" aria-labelledby="h-parcours">
            <div className="sec-head">
              <div><p className="over">Le parcours</p><h2 id="h-parcours">Votre parcours commence ici.</h2><p className="lead">Pas besoin d&apos;être expert. Avancez étape par étape.</p></div>
              <div className="annot-2" aria-hidden="true"><span className="hand">Avancez<br />à votre rythme.</span><svg className="stroke" viewBox="0 0 90 8"><path d="M2 5 C 25 1, 60 8, 88 3" fill="none" stroke="#1ba8c9" strokeWidth="3" strokeLinecap="round" /></svg></div>
            </div>
            <ol className="etapes">
              {ETAPES.map((e) => (
                <li key={e.k} style={{ ['--c' as string]: e.c, ['--bg' as string]: e.bg }}>
                  <Link href={e.href}><span className="k">{e.k}</span><b>{e.t}</b><p>{e.d}</p></Link>
                </li>
              ))}
            </ol>
            <div className="cta-row"><Link href="/signup" className="btn btn-ink">Commencer mon parcours gratuitement <span aria-hidden="true">→</span></Link></div>
          </section>

          {/* 4 · PROJECTION PRODUIT */}
          <section className="proj" aria-labelledby="h-proj">
            <div className="sec-head"><div><p className="over">Ce que vous pourrez faire</p><h2 id="h-proj">Demain, votre écran pourrait ressembler à ça.</h2></div></div>
            <div className="proj-grid">
              <div className="card fiche">
                {v && v.cours != null ? (
                  <>
                    <div className="fiche-head">
                      <div><p className="over">Fiche société · séance du {dateLabel}</p><h3>{v.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.logo} alt="" width={28} height={28} className="logo-soc grand" />}{v.nom ?? v.code} <span className="num code">{v.code}</span></h3></div>
                      <div className="prix num"><b>{fmtNumber(v.cours)} <small>FCFA</small></b><span className={`chip ${tone(v.variation)}`}>{pct(v.variation)}</span></div>
                    </div>
                    <Courbe serie={d.serie12m} ariaLabel={`Cours de ${v.code} sur 12 mois`} />
                    <dl className="kpis num">
                      <div><dt>Note</dt><dd className="note">{v.note ?? '—'}</dd></div>
                      <div><dt>PER</dt><dd>{x1(v.per)}</dd></div>
                      <div><dt>Dividende{v.exerciceDividende ? ` ${v.exerciceDividende}` : ''}</dt><dd>{fcfa(v.dividende)}</dd></div>
                      <div><dt>Rendement</dt><dd>{v.rendement != null ? `${v.rendement.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : '—'}</dd></div>
                    </dl>
                    <Link href={`/societes/${v.code}`} className="btn btn-ghost btn-sm">Voir la fiche complète <span aria-hidden="true">→</span></Link>
                  </>
                ) : <p className="empty">La fiche exemple est indisponible pour le moment.</p>}
              </div>
              <div className="proj-copy">
                <h3>Vous ne regardez plus seulement un cours.</h3>
                <p>Sur chaque société, vous pouvez voir :</p>
                <ul className="coches">
                  {['les fondamentaux', 'la tendance', 'le dividende', 'la valorisation', 'la note quantitative', 'l’évolution du titre'].map((t) => <li key={t}><Check />{t}</li>)}
                </ul>
                <Link href={v ? `/societes/${v.code}` : '/societes'} className="btn btn-ink btn-sm">Voir une fiche société <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </section>

          {/* 5 · AVANT / APRÈS */}
          <section className="avap" aria-labelledby="h-avap">
            <h2 id="h-avap">Passer de l&apos;intuition à une décision mieux informée.</h2>
            <div className="avap-grid">
              <div><p className="over muted">Avant Westbourse</p><ul>{['Je vois une action monter.', 'J’entends parler d’une société.', 'Je regarde seulement le cours.', 'Je ne sais pas quoi comparer.'].map((t) => <li key={t}>{t}</li>)}</ul></div>
              <div className="apres"><p className="over">Après avoir exploré Westbourse</p><ul>{['Je comprends les fondamentaux.', 'Je regarde plusieurs indicateurs.', 'Je compare plusieurs sociétés.', 'Je peux tester une stratégie.'].map((t) => <li key={t}><Check />{t}</li>)}</ul></div>
            </div>
          </section>

          {/* 6 · COMPARATEUR */}
          <section className="comp" aria-labelledby="h-comp">
            <div className="sec-head"><div><p className="over">Comparer</p><h2 id="h-comp">Ne choisissez pas une action au hasard.</h2><p className="lead">Comparez les sociétés avant de vous faire une opinion.</p></div></div>
            {d.comparees.length >= 2 ? (
              <div className="card table-wrap">
                <table className="comp-table">
                  <thead><tr><th scope="col">Séance du {dateLabel}</th>{d.comparees.map((c) => <th scope="col" key={c.code}>{c.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.logo} alt="" width={36} height={36} className="logo-soc th" loading="lazy" />}<b>{c.nom ?? c.code}</b><small className="num">{c.code}</small></th>)}</tr></thead>
                  <tbody className="num">
                    <tr><th scope="row">Cours (FCFA)</th>{d.comparees.map((c) => <td key={c.code}>{c.cours != null ? fmtNumber(c.cours) : '—'}</td>)}</tr>
                    <tr><th scope="row">PER</th>{d.comparees.map((c) => <td key={c.code}>{x1(c.per)}</td>)}</tr>
                    <tr><th scope="row">Dividende{d.comparees.some((c) => c.dividende != null && !c.dividendeVerifie) ? ' *' : ''}</th>{d.comparees.map((c) => <td key={c.code}>{fcfa(c.dividende)}{c.dividende != null && !c.dividendeVerifie ? ' *' : ''}{c.exerciceDividende ? <small className="ex"> ex. {c.exerciceDividende}</small> : null}</td>)}</tr>
                    <tr><th scope="row">Rendement</th>{d.comparees.map((c) => <td key={c.code}>{c.rendement != null ? `${c.rendement.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : '—'}</td>)}</tr>
                    <tr><th scope="row">Note</th>{d.comparees.map((c) => <td key={c.code}><span className="note">{c.note ?? '—'}</span></td>)}</tr>
                    <tr><th scope="row">Tendance <small>20 séances</small></th>{d.comparees.map((c) => <td key={c.code}><Spark f={c} /></td>)}</tr>
                  </tbody>
                </table>
              </div>
            ) : <p className="empty">Le comparatif sera disponible dès que deux sociétés auront des fondamentaux et un dividende publiés.</p>}
            {d.comparees.some((c) => c.dividende != null && !c.dividendeVerifie) && <p className="disc">* Dividende du dernier exercice publié, déclaré par la société (sans date de détachement en base) ; sans astérisque : détachement daté et vérifié.</p>}
            <p className="transition">En quelques secondes, vous pouvez mettre plusieurs sociétés face à face. <Link href="/societes" className="btn btn-ink btn-sm">Comparer les sociétés <span aria-hidden="true">→</span></Link></p>
          </section>

          {/* 7 · SIMULATEUR */}
          <section className="simu" aria-labelledby="h-simu">
            <div className="sec-head"><div><p className="over">Simuler</p><h2 id="h-simu">Et si vous pouviez essayer avant d&apos;investir&nbsp;?</h2><p className="lead">Testez vos idées avec un capital fictif.</p></div></div>
            <div className="simu-grid">
              <div className="card simu-param">
                <span className="ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg></span>
                <p className="over">Capital fictif</p>
                <b className="num">{fmtNumber(sim?.montant ?? 1_000_000)} <small>FCFA</small></b>
                <p className="muted">Exemple de simulation sur {sim ? `${sim.years.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ans` : '3 ans'}, dividendes encaissés ajoutés au résultat.</p>
                <Link href="/simulateur" className="btn btn-ink btn-sm">Tester le simulateur gratuitement <span aria-hidden="true">→</span></Link>
              </div>
              <div className="card simu-res">
                {sim ? (
                  <>
                    <p className="over">Exemple de simulation · {sim.code}{v?.nom ? ` · ${v.nom}` : ''}</p>
                    <Courbe serie={sim.serie} ariaLabel={`Cours de ${sim.code} sur ${Math.round(sim.years)} ans`} couleur="#1f6fb3" />
                    <dl className="kpis num">
                      <div><dt>Valeur initiale</dt><dd>{fmtNumber(sim.montant)} FCFA</dd></div>
                      <div><dt>Valeur simulée</dt><dd>{fmtNumber(Math.round(sim.finalValue))} FCFA</dd></div>
                      <div><dt>Résultat</dt><dd className={tone(sim.pct)}>{pct(sim.pct, 1)}</dd></div>
                      <div><dt>Dividendes inclus</dt><dd>{fmtNumber(Math.round(sim.totalDividends))} FCFA</dd></div>
                    </dl>
                    <p className="disc">Exemple calculé sur les clôtures réelles de {sim.code} et ses dividendes versés. Les performances passées ou simulées ne préjugent pas des performances futures.</p>
                  </>
                ) : <p className="empty">L&apos;exemple de simulation est indisponible pour le moment.</p>}
              </div>
            </div>
          </section>

          {/* 8 · APRÈS INSCRIPTION */}
          <section className="apres-inscr" aria-labelledby="h-inscr">
            <div className="card grand">
              <div>
                <p className="over">Après votre inscription</p>
                <h2 id="h-inscr">En créant votre compte, vous pourrez commencer à explorer.</h2>
                <ul className="coches deux">
                  {['Explorer les sociétés cotées', 'Consulter leurs données et fondamentaux', 'Suivre les marchés', 'Créer votre espace personnel', 'Tester vos premières idées'].map((t) => <li key={t}><Check />{t}</li>)}
                </ul>
                <p className="muted">Commencez gratuitement. Vous pourrez découvrir progressivement les fonctionnalités disponibles.</p>
              </div>
              <div className="cta-col">
                <Link href="/signup" className="btn btn-ink btn-lg">Créer mon compte gratuit <span aria-hidden="true">→</span></Link>
                <small>Sans carte bancaire · Sans engagement</small>
              </div>
            </div>
          </section>

          {/* 9 · PLUS LOIN (sans survendre) */}
          <section className="plusloin" aria-labelledby="h-plus">
            <p className="over">Lorsque vous serez prêt à aller plus loin</p>
            <h2 id="h-plus">Pour aller plus loin, Westbourse propose également des outils avancés.</h2>
            <ul className="chips">{['Signaux', 'Alertes', 'Screener', 'Conseiller unifié', 'Diagnostic IA', 'Dossiers PDF'].map((t) => <li key={t}>{t}</li>)}</ul>
            <Link href="/premium/outils" className="lien">Découvrir les outils →</Link>
          </section>

          {/* 10 · CONFIANCE */}
          <section className="conf" aria-labelledby="h-conf">
            <div className="sec-head"><div><p className="over">Confiance</p><h2 id="h-conf">Des données pour comprendre. Des outils pour explorer.</h2></div></div>
            <div className="conf-grid">
              <ul className="conf-l">{['Données', 'Fondamentaux', 'Dividendes', 'Indicateurs', 'Comparaisons', 'Simulations'].map((t) => <li key={t}>{t}</li>)}</ul>
              <div className="sources">
                <p className="over">Nos données proviennent des sources du marché</p>
                <ul>
                  {[{ src: '/brand/brvm-logo.png', alt: 'BRVM' }, { src: '/brand/bceao-logo.png', alt: 'BCEAO' }, { src: '/brand/bloomfield-logo.png', alt: 'Bloomfield Investment' }].map((s) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <li key={s.alt}><img src={s.src} alt={s.alt} height={22} loading="lazy" /></li>
                  ))}
                  <li className="txt">Publications des émetteurs</li>
                </ul>
                <p className="muted">Chaque chiffre affiché sur cette page est lu dans nos données à la dernière séance ({dateLabel ?? '—'}) ; rien n&apos;est saisi à la main. <Link href="/methodologie" className="lien">Notre méthode →</Link></p>
              </div>
            </div>
          </section>

          {/* 11 · PHILOSOPHIE */}
          <section className="philo" aria-labelledby="h-philo">
            <h2 id="h-philo">Nous vous donnons les informations.<br />Vous gardez la décision.</h2>
            <div className="philo-grid">
              <div><p className="over up">Westbourse fournit</p><ul>{['Données', 'Analyses', 'Indicateurs', 'Comparaisons', 'Simulations'].map((t) => <li key={t}><Check />{t}</li>)}</ul></div>
              <div><p className="over gold">Vous décidez</p><ul>{['Combien investir', 'Quand investir', 'Votre horizon', 'Votre stratégie', 'Votre niveau de risque'].map((t) => <li key={t}><span className="dot" aria-hidden="true" />{t}</li>)}</ul></div>
            </div>
            <p className="disc">Ceci n&apos;est pas un conseil en investissement.</p>
          </section>

          {/* 12 · CTA FINAL */}
          <section className="final" aria-labelledby="h-final">
            <div>
              <h2 id="h-final">Votre première analyse peut commencer maintenant.</h2>
              <p>Explorez gratuitement la BRVM, découvrez les sociétés cotées et entraînez-vous avant d&apos;aller plus loin.</p>
              <div className="cta">
                <Link href="/signup" className="btn btn-gold btn-lg">Créer mon compte gratuit <span aria-hidden="true">→</span></Link>
                <Link href="/societes" className="btn btn-ghost-inv">Explorer les sociétés</Link>
              </div>
              <small>Gratuit · Sans carte bancaire · À votre rythme</small>
            </div>
            <ul className="final-l">
              <li className="logo-cell"><AnimatedLogo size={44} variant="mark" animate={false} /><span>WESTBOURSE</span></li>
              {[['Données', 'fiables'], ['Analyse', 'indépendante'], ['Outils', 'simples'], ['Communauté', 'active']].map(([a, b]) => <li key={a}><b>{a}</b><span>{b}</span></li>)}
            </ul>
          </section>

          <footer>
            <span>© {new Date().getFullYear()} WESTBOURSE · Abidjan</span>
            <nav aria-label="Légal"><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">CGU</Link><Link href="/methodologie">Méthodologie</Link></nav>
          </footer>
        </main>
      </div>
      <StickyCta />
    </div>
  );
}
