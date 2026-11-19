import type { Metadata } from 'next';
import Link from 'next/link';
import {
  COMPARABLES,
  CORIS_IPOS,
  CORIS_RATIOS,
  DIVIDENDE_STATS,
  INDICATEURS_SUIVI,
  MARCHE,
  SCENARIOS,
  SOURCES,
} from '@/lib/articles/corisIpo';
import {
  BridgeEventChart,
  DividendWindowChart,
  HeroLiquidityVisual,
  IpoAmountChart,
} from '@/components/articles/coris/Charts';
import WpliSimulator from '@/components/articles/coris/WpliSimulator';
import ReadingAids from '@/components/articles/coris/ReadingAids';
import { jsonLdScript } from '@/lib/jsonLd';
import './coris-ipo.css';

export const dynamic = 'force-static';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
const TITLE = 'Coris en bourse : 81 milliards peuvent-ils faire bouger la BRVM ?';
const DESCRIPTION =
  'Coris Bank Côte d’Ivoire et Coris Bank Bénin préparent 81 Md FCFA d’IPO. Analyse des flux, du précédent Bridge et des comportements autour des dividendes.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/analyses/coris-bank-ipo-2027` },
  openGraph: {
    type: 'article',
    title: TITLE,
    description: DESCRIPTION,
    publishedTime: '2026-11-19T14:00:00+01:00',
    authors: ['WESTBOURSE Recherche'],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

const MATRICE = [
  {
    phase: 'Annonce / roadshow',
    particulier: 'Constitue du cash, reporte des achats secondaires.',
    institutionnel: 'Recalibre la pondération banques et la valorisation.',
    marche: 'Effet faible isolément, plus de dispersion.',
  },
  {
    phase: 'Ouverture IPO',
    particulier: 'Vend parfois une position liquide pour souscrire.',
    institutionnel: 'Mobilise cash disponible ou rotations sectorielles.',
    marche: 'Volume secondaire en retrait, valeurs bancaires sous pression.',
  },
  {
    phase: 'Allocation / remboursement',
    particulier: 'Attend le résultat puis récupère le trop-perçu.',
    institutionnel: 'Repositionne les allocations non servies.',
    marche: 'Stabilisation possible, pas une hausse automatique.',
  },
  {
    phase: 'Première cotation',
    particulier: 'Prise de position ou bénéfice si prime.',
    institutionnel: 'Construction graduelle, comparaison avec les pairs.',
    marche: 'Attention concentrée sur le nouveau titre ; effet large non garanti.',
  },
] as const;

const GROUPES_INDICATEURS = [
  { titre: 'Liquidité secondaire', debut: 0, fin: 4 },
  { titre: 'Souscriptions & flux', debut: 4, fin: 9 },
  { titre: 'Performance & comportement', debut: 9, fin: 12 },
] as const;

export default function CorisIpoArticle() {
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: TITLE,
    description: DESCRIPTION,
    datePublished: '2026-11-19T14:00:00+01:00',
    dateModified: '2026-11-19T14:00:00+01:00',
    author: { '@type': 'Organization', name: 'WESTBOURSE Recherche' },
    publisher: { '@type': 'Organization', name: 'WESTBOURSE' },
    mainEntityOfPage: `${SITE}/analyses/coris-bank-ipo-2027`,
    isAccessibleForFree: true,
  };

  return (
    <main className="coris-article">
      <ReadingAids />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleLd) }} />

      <header className="coris-masthead">
        <Link href="/">WESTBOURSE</Link>
        <nav aria-label="Fil d’Ariane">
          <Link href="/analyses">Analyses</Link>
          <span> / </span>
          <Link href="/actualites">Marchés</Link>
        </nav>
        <span>RECHERCHE · 19 NOVEMBRE 2026</span>
      </header>

      <article>
        <header className="coris-headline">
          <div>
            <p className="coris-rubrique">IPO &amp; liquidité · Analyse BRVM</p>
            <div className="coris-brand-lockup" aria-label="Identités officielles">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/coris-bank-logo.svg" alt="Coris Bank" width="132" height="60" />
              <span aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/brvm-logo.png" alt="Bourse Régionale des Valeurs Mobilières" width="136" height="72" />
            </div>
            <h1>81 milliards.<br />Deux IPO Coris.<br />Un test de liquidité.</h1>
          </div>
          <div className="coris-headline__deck">
            <p>{DESCRIPTION}</p>
            <div>
              <span>Par WESTBOURSE Recherche</span>
              <span>9 min de lecture</span>
              <span>Mis à jour le 19 novembre 2026</span>
            </div>
          </div>
        </header>

        <section className="coris-hero-grid">
          <HeroLiquidityVisual />
          <aside className="coris-lede">
            <p className="coris-lede__drop">
              <span>L</span>’échelle est inhabituelle : 81 milliards de FCFA annoncés, à quelques jours
              d’intervalle, pour deux filiales du même groupe bancaire.
            </p>
            <p>
              Rapporté à la capitalisation du marché actions, le montant est faible. Rapporté à la
              valeur traitée lors d’une séance, il devient stratégique : le cash peut être garé,
              déplacé ou remboursé plus vite que les marchés ne peuvent l’absorber.
            </p>
            <p>
              Le précédent Bridge montre un effet plausible mais court. Les dividendes racontent une
              autre histoire : anticipation avant le détachement, puis pression après. Ce sont deux
              calendriers de trésorerie différents, qu’il faut lire séparément.
            </p>
            <div className="coris-lede__verdict">
              <span>EN UNE PHRASE</span>
              <strong>Le risque n’est pas l’existence de deux IPO. C’est leur proximité et la quantité de cash déjà financée.</strong>
            </div>
          </aside>
        </section>

        <section className="coris-stat-strip" aria-label="Chiffres clés">
          <div><span>IPO annoncées</span><strong>{MARCHE.totalIpoMd} Md</strong><small>62 Md CI + 19 Md Bénin</small></div>
          <div><span>Équivalent séance</span><strong>{number(CORIS_RATIOS.foisSeance, 1)}×</strong><small>81 Md / {number(MARCHE.valeurSeanceMd, 3)} Md observés intraday</small></div>
          <div><span>Capitalisation actions</span><strong>{number(CORIS_RATIOS.capitalisationPct, 2)} %</strong><small>part des 81 Md annoncés</small></div>
        </section>

        <section className="coris-section coris-section--split" id="operations">
          <div className="coris-section__intro">
            <span className="coris-section__number">01</span>
            <p className="coris-rubrique">Les opérations</p>
            <h2>Ce que l’on sait — et tout ce qui manque encore.</h2>
          </div>
          <div className="coris-copy">
            <p>
              Coris Bank International Côte d’Ivoire et Coris Bank Bénin sont annoncées à la BRVM
              à quelques jours d’intervalle en janvier 2027. Les autorisations de l’AMF-UMOA sont
              présentées comme obtenues. Les campagnes de communication doivent encore fixer le
              prix, le nombre d’actions, la part du capital et les dates exactes.
            </p>
            <p>
              Une distinction est décisive : une <strong>OPV</strong> vend des actions existantes
              et rémunère les actionnaires sortants ; une augmentation de capital apporte des fonds
              à la banque. Sans prospectus, il est prématuré d’annoncer que les 81 Md renforceront
              intégralement les fonds propres.
            </p>
          </div>
          <div className="coris-operation-brands">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/coris-bank-logo.svg" alt="Coris Bank — identité officielle du groupe" width="150" height="68" />
            <div>
              <strong>Deux filiales. Une seule signature institutionnelle.</strong>
              <p className="coris-logo-note">
                Logos officiels utilisés pour identifier les institutions citées. Aucune affiliation,
                validation de l’offre ni recommandation de souscription.
              </p>
            </div>
          </div>
          <IpoAmountChart />
          <div className="coris-table-wrap">
            <table className="coris-data-table">
              <caption>Deux banques, deux profils d’actifs</caption>
              <thead>
                <tr><th>Banque</th><th>Montant IPO</th><th>Bilan 2025</th><th>PNB</th><th>Résultat net</th><th>ROE</th></tr>
              </thead>
              <tbody>
                {CORIS_IPOS.map((ipo) => (
                  <tr key={ipo.code}>
                    <th>{ipo.nom}</th>
                    <td>{ipo.montantMd} Md</td>
                    <td>{number(ipo.bilanMd, 1)} Md</td>
                    <td>{number(ipo.pnbMd, 1)} Md</td>
                    <td>{number(ipo.resultatNetMd, 2)} Md</td>
                    <td>{number(ipo.roePct, 1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="coris-bank-cards">
            {CORIS_IPOS.map((ipo) => (
              <article key={ipo.code}>
                <span>{ipo.code}</span>
                <h3>{ipo.nom}</h3>
                <dl>
                  <div><dt>IPO</dt><dd>{ipo.montantMd} Md</dd></div>
                  <div><dt>Bilan 2025</dt><dd>{number(ipo.bilanMd, 1)} Md</dd></div>
                  <div><dt>PNB</dt><dd>{number(ipo.pnbMd, 1)} Md</dd></div>
                  <div><dt>Résultat net</dt><dd>{number(ipo.resultatNetMd, 2)} Md</dd></div>
                  <div><dt>ROE</dt><dd>{number(ipo.roePct, 1)} %</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="coris-growth-grid">
            {CORIS_IPOS.map((ipo) => (
              <article key={ipo.code}>
                <span>{ipo.code} · 2025</span>
                <h3>{ipo.croissanceResultatPct > 20 ? 'Une croissance forte à valoriser.' : 'Une rentabilité solide, une croissance plus mesurée.'}</h3>
                <dl>
                  <div><dt>Bilan</dt><dd>+{number(ipo.croissanceBilanPct, 1)} %</dd></div>
                  <div><dt>PNB</dt><dd>{ipo.croissancePnbPct === 0 ? 'Stable' : `+${number(ipo.croissancePnbPct, 1)} %`}</dd></div>
                  <div><dt>Résultat net</dt><dd>+{number(ipo.croissanceResultatPct, 1)} %</dd></div>
                  <div><dt>Coefficient d’exploitation</dt><dd>{ipo.coefficientExploitationPct == null ? 'À documenter' : `${number(ipo.coefficientExploitationPct, 1)} %`}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <aside className="coris-ratio-note">
            <div>
              <p className="coris-rubrique">Valorisation bancaire</p>
              <h3>Les ratios décisifs restent à calculer.</h3>
              <p>
                Sans prix d’introduction, nombre d’actions et fonds propres par titre, aucun PER ni
                P/B fiable ne peut être publié. Les prospectus devront aussi documenter NPL,
                coût du risque, CET1 et périmètre exact des fonds propres.
              </p>
            </div>
            <dl>
              <div><dt>PER</dt><dd>Prix / bénéfice par action</dd><span>Prospectus requis</span></div>
              <div><dt>P/B</dt><dd>Prix / fonds propres par action</dd><span>Prospectus requis</span></div>
              <div><dt>NPL</dt><dd>Créances douteuses / encours</dd><span>Non publié ici</span></div>
              <div><dt>CET1</dt><dd>Fonds propres prudentiels / actifs pondérés</dd><span>Non publié ici</span></div>
            </dl>
            <p className="coris-comparables">
              Comparables à surveiller après publication des prix : {COMPARABLES.join(' · ')}.
            </p>
          </aside>
        </section>

        <section className="coris-section" id="bridge">
          <div className="coris-section__intro">
            <span className="coris-section__number">02</span>
            <p className="coris-rubrique">Le précédent Bridge</p>
            <h2>Le premier mouvement de cash s’observe dans le carnet, pas dans la surface des indices.</h2>
          </div>
          <BridgeEventChart />
          <div className="coris-observations">
            <article>
              <span>20 JUILLET</span>
              <strong>46,8 %</strong>
              <p>La valeur échangée tombe à 1,136 Md, moins de la moitié des cinq séances précédentes.</p>
            </article>
            <article>
              <span>57,4 %</span>
              <strong>des titres baissent</strong>
              <p>Le BRVM-C cède 1,06 % et l’indice financier 2,07 % à l’ouverture de l’OPV.</p>
            </article>
            <article>
              <span>24 SEPTEMBRE</span>
              <strong>+2,97 %</strong>
              <p>À la première cotation, le marché rebondit. Le retrait de liquidité n’est donc pas durable.</p>
            </article>
          </div>
          <p className="coris-caption">
            Bridge a attiré 95,8 Md de demandes pour 67,5 Md d’actions, soit 142 %, avec 58 %
            des montants souscrits par des personnes physiques. C’est une preuve de demande,
            pas la preuve à elle seule de ventes forcées sur le marché secondaire.
          </p>
        </section>

        <section className="coris-section coris-section--dividend" id="dividendes">
          <div className="coris-section__intro">
            <span className="coris-section__number">03</span>
            <p className="coris-rubrique">Dividendes : une autre mécanique</p>
            <h2>Le coupon attire le cash avant le détachement. Il ne le garantit pas après.</h2>
          </div>
          <DividendWindowChart />
          <div className="coris-copy coris-copy--two">
            <p>
              Dans les {DIVIDENDE_STATS.echantillon} cas complets observés, la médiane ajustée
              gagne 1,09 % sur les cinq séances précédant le détachement. Cela est compatible avec
              l’accumulation de titres pour devenir éligible, sans prouver le motif des ordres.
            </p>
            <p>
              Le jour de l’ex-date, la variation officielle médiane est de −1,96 % par rapport à
              une référence déjà ajustée du dividende. Elle reste −1,76 % cinq séances plus tard.
              Le réinvestissement du cash versé n’est donc pas automatique.
            </p>
          </div>
        </section>

        <section className="coris-section" id="comportements">
          <div className="coris-section__intro">
            <span className="coris-section__number">04</span>
            <p className="coris-rubrique">Matrice comportementale</p>
            <h2>Qui bouge, quand et sous quelle contrainte.</h2>
          </div>
          <div className="coris-matrix-wrap">
            <table className="coris-matrix">
              <thead>
                <tr><th>Phase</th><th>Particuliers</th><th>Institutionnels / HNW</th><th>Marché observable</th></tr>
              </thead>
              <tbody>
                {MATRICE.map((row) => (
                  <tr key={row.phase}>
                    <th>{row.phase}</th>
                    <td>{row.particulier}</td>
                    <td>{row.institutionnel}</td>
                    <td>{row.marche}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="coris-matrix-cards">
            {MATRICE.map((row) => (
              <article key={row.phase}>
                <h3>{row.phase}</h3>
                <dl>
                  <div><dt>Particuliers</dt><dd>{row.particulier}</dd></div>
                  <div><dt>Institutionnels / HNW</dt><dd>{row.institutionnel}</dd></div>
                  <div><dt>Marché observable</dt><dd>{row.marche}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="coris-section coris-section--cash" id="origine-cash">
          <div className="coris-section__intro">
            <span className="coris-section__number">05</span>
            <p className="coris-rubrique">Le vrai sujet : d’où viendra le cash ?</p>
            <h2>81 milliards souscrits ne signifient pas 81 milliards vendus sur le secondaire.</h2>
          </div>
          <div className="coris-copy coris-copy--two">
            <p>
              Lorsqu’un investisseur utilise son épargne déjà disponible ou qu’un nouveau souscripteur
              entre sur le marché, il peut acheter sans céder une action déjà cotée. Une souscription
              financée par crédit exerce elle aussi une pression indirecte, différente d’une liquidation.
            </p>
            <p>
              La vente d’une position existante est le seul canal qui exerce immédiatement une pression
              d’offre sur le secondaire. C’est pourquoi le montant brut de l’IPO doit être multiplié par
              une hypothèse de financement avant d’être comparé à la liquidité quotidienne.
            </p>
          </div>
          <WpliSimulator />
        </section>

        <section className="coris-section coris-section--structure" id="impact-structurel">
          <div className="coris-section__intro">
            <span className="coris-section__number">06</span>
            <p className="coris-rubrique">Effet structurel</p>
            <h2>Le succès ne se mesure pas seulement au montant collecté.</h2>
          </div>
          <div className="coris-structure-grid">
            <article><span>01</span><h3>Plus de titres bancaires</h3><p>Deux nouvelles valeurs élargissent l’univers de sélection et les arbitrages de valorisation.</p></article>
            <article><span>02</span><h3>Diversification géographique</h3><p>La représentation ivoirienne et béninoise renforce la lecture régionale du secteur financier.</p></article>
            <article><span>03</span><h3>Transparence accrue</h3><p>La cotation impose publications, gouvernance et information régulière aux actionnaires.</p></article>
            <article><span>04</span><h3>Actionnariat populaire</h3><p>Bridge a mobilisé 17 544 investisseurs ; cette base peut devenir un foyer de profondeur secondaire si elle échange régulièrement.</p></article>
          </div>
          <div className="coris-capital-cycle" aria-label="Cycle entre mobilisation d’épargne et liquidité durable">
            {['Épargne mobilisée', 'Allocation', 'Cotation', 'Transactions secondaires', 'Liquidité durable'].map((etape, index) => (
              <div key={etape}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{etape}</strong>
              </div>
            ))}
          </div>
          <p className="coris-caption">
            Une IPO sursouscrite peut rester peu liquide après sa première cotation. Le vrai enjeu
            est la régularité des ordres acheteurs et vendeurs, pas seulement le nombre d’acheteurs initiaux.
          </p>
        </section>

        <section className="coris-section coris-section--scenarios" id="scenarios">
          <div className="coris-section__intro">
            <span className="coris-section__number">07</span>
            <p className="coris-rubrique">Trois scénarios, sans probabilité artificielle</p>
            <h2>La provenance du cash décide de la trajectoire.</h2>
          </div>
          <div className="coris-scenario-grid">
            {SCENARIOS.map((scenario) => (
              <article key={scenario.code} className={`coris-scenario coris-scenario--${scenario.code}`}>
                <span>{scenario.niveau}</span>
                <h3>{scenario.titre}</h3>
                <ul>{scenario.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
                <p>{scenario.consequence}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="coris-conclusion">
          <p className="coris-rubrique">Lecture de marché</p>
          <h2>Le scénario central : une rotation courte, pas une fuite durable.</h2>
          <div>
            <p>
              Si les deux offres sont lancées à quelques jours d’intervalle, le scénario le plus
              probable est une mise en réserve du cash pendant les souscriptions, une activité
              réduite sur les titres existants puis une normalisation à mesure que les allocations
              et remboursements sont connus.
            </p>
            <p>
              Le risque devient plus fort si la demande est très concentrée chez les particuliers,
              si les souscriptions ne sont pas préfinancées et si les investisseurs vendent des
              banques ou de grandes valeurs liquides pour lever les fonds. Il diminue si la trésorerie
              vient de dépôts, de lignes de crédit ou de nouveaux entrants.
            </p>
          </div>
          <blockquote>
            Pour Coris, le bon indicateur n’est pas seulement le taux de souscription. C’est le
            délai entre clôture, allocation, remboursement du trop-perçu et retour des ordres sur
            le marché secondaire.
          </blockquote>
        </section>

        <section className="coris-watchlist">
          <h2>Douze indicateurs pour confronter les scénarios au réel.</h2>
          <div className="coris-watch-groups">
            {GROUPES_INDICATEURS.map((groupe) => (
              <section key={groupe.titre}>
                <h3>{groupe.titre}</h3>
                <ol>
                  {INDICATEURS_SUIVI.slice(groupe.debut, groupe.fin).map(([frequence, indicateur, utilite], index) => (
                    <li key={indicateur}>
                      <span>{String(groupe.debut + index + 1).padStart(2, '0')}</span>
                      <strong>{indicateur}</strong>
                      <small>{frequence}</small>
                      <p>{utilite}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>

        <footer className="coris-footer" id="methodologie">
          <div>
            <h2>Sources &amp; méthode</h2>
            <ul>
              {SOURCES.map((source) => (
                <li key={source.label}>
                  <Link href={source.url}>{source.label} →</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p>
              Analyse fondée sur les données WESTBOURSE du 26 mai au 19 novembre 2026,
              les annonces Coris publiées le 17 novembre, le précédent Bridge Bank et le
              relevé intraday BRVM du 19 novembre.
            </p>
            <p>
              Les coïncidences de dates ne prouvent pas seules une causalité. Cette analyse est
              informative et ne constitue ni une recommandation d’achat, ni une promesse de rendement.
            </p>
            <p className="coris-logo-disclaimer">
              Les logos Coris Bank, Bridge Bank Group et BRVM sont reproduits uniquement pour
              identifier les institutions citées. Ils restent la propriété de leurs titulaires
              respectifs et n’impliquent aucun partenariat ni aucune approbation de cette analyse.
            </p>
          </div>
        </footer>
      </article>
    </main>
  );
}
