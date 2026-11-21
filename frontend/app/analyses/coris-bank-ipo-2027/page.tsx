import type { Metadata } from 'next';
import Link from 'next/link';
import { BridgeEventChart } from '@/components/articles/coris/Charts';
import ReadingAids from '@/components/articles/coris/ReadingAids';
import { jsonLdScript } from '@/lib/jsonLd';
import './coris-ipo.css';

export const dynamic = 'force-static';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
const TITLE = 'Coris Bank International Côte d’Ivoire : étude de l’OPV et de l’introduction à la BRVM';
const DESCRIPTION =
  'Coris Holding cède 20 % de CBI CI à 7 720 FCFA du 30 novembre au 4 décembre 2026. Valorisation, comptes, plan d’affaires, dividendes, risques et effet sur la BRVM, d’après la note d’information visée par l’AMF-UMOA.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/analyses/coris-bank-ipo-2027` },
  openGraph: {
    type: 'article',
    title: TITLE,
    description: DESCRIPTION,
    publishedTime: '2026-11-19T14:00:00+01:00',
    modifiedTime: '2026-11-20T18:00:00+01:00',
    authors: ['WESTBOURSE Recherche'],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

type Row = readonly (string | number)[];

function DataTable({ caption, head, rows, note }: { caption: string; head: Row; rows: readonly Row[]; note?: string }) {
  return (
    <div className="coris-table-wrap">
      <table className="coris-data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>{head.map((h) => <th key={String(h)}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              <th>{row[0]}</th>
              {row.slice(1).map((cell, i) => <td key={i}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="coris-caption">{note}</p> : null}
    </div>
  );
}

function Intro({ n, rubrique, titre }: { n: string; rubrique: string; titre: string }) {
  return (
    <div className="coris-section__intro">
      <span className="coris-section__number">{n}</span>
      <p className="coris-rubrique">{rubrique}</p>
      <h2>{titre}</h2>
    </div>
  );
}

const OPERATION: readonly Row[] = [
  ['Émetteur', 'Coris Bank International Côte d’Ivoire (CBI CI), capital de 20,4 Md FCFA'],
  ['Cédant', 'Coris Holding SA'],
  ['Nature', 'Offre publique de vente d’actions existantes, suivie d’une introduction à la BRVM'],
  ['Actions offertes', '8 160 000 actions ordinaires, 20 % du capital et des droits de vote'],
  ['Actions au total', '40 800 000, valeur nominale 500 FCFA'],
  ['Code ISIN', 'CI0000010740'],
  ['Prix catégorie 1 (toute personne physique ou morale)', '7 720 FCFA'],
  ['Prix catégorie 2 (personnel du Groupe Coris)', '6 175 FCFA, décote de 20 %, titres bloqués 3 ans après la cotation'],
  ['Montant global', '62 743 056 000 FCFA'],
  ['Valorisation implicite (100 %)', '314,98 Md FCFA'],
  ['Jouissance', '1er janvier 2026 : droit au dividende de l’exercice 2026'],
  ['Compartiment visé', 'Prestige'],
  ['Visa AMF-UMOA', 'OA/26-05 du 11 novembre 2026'],
  ['Arrangeur et chef de file', 'Coris Bourse'],
  ['Syndicat de placement', 'SGI des pays de l’UEMOA'],
  ['Conseils', 'Adenka (conseil financier et évaluation), KF Conseils (conseil juridique)'],
];

const CALENDRIER: readonly Row[] = [
  ['Lancement de l’offre', '20 novembre 2026', '—'],
  ['Période de souscription', '30 novembre – 4 décembre', '30 novembre'],
  ['Compte rendu à l’AMF-UMOA', '9 décembre', '3 décembre'],
  ['Approbation de la BRVM', '16 décembre', '—'],
  ['Allocations définitives', '21 décembre', '15 décembre'],
  ['Règlement-livraison', '28 décembre', '18 décembre'],
  ['Avis de première cotation', '29 décembre', '18 décembre'],
  ['Première cotation', '15 janvier 2027', '15 janvier 2027'],
];

const REPARTITION: readonly Row[] = [
  ['1 : toute personne physique ou morale', '5 140 800 (63 %)', '2 856 000 (35 %)', '7 996 800 (98 %)'],
  ['2 : personnel du Groupe Coris', '163 200 (2 %)', '—', '163 200 (2 %)'],
  ['Total', '5 304 000 (65 %)', '2 856 000 (35 %)', '8 160 000 (100 %)'],
];

const ACTIONNARIAT: readonly Row[] = [
  ['Coris Holding SA', '84,60 %', '64,60 %'],
  ['Equity Finance Corporation', '10,00 %', '10,00 %'],
  ['Coris Bourse SA', '3,60 %', '3,60 %'],
  ['Coris Assurances SA', '1,80 %', '1,80 %'],
  ['Public (flottant BRVM)', '—', '20,00 %'],
];

const RESULTATS: readonly Row[] = [
  ['Produit net bancaire', '54 961', '42 024', '55 795'],
  ['Frais généraux', '−18 696', '−19 990', '−23 328'],
  ['Résultat brut d’exploitation', '36 265', '22 034', '32 467'],
  ['Coefficient d’exploitation', '34,0 %', '47,6 %', '41,8 %'],
  ['Coût du risque', '−10 257', '−3 128', '−9 166'],
  ['Résultat avant impôt', '26 843', '18 906', '26 604'],
  ['Impôt sur les bénéfices', '−2 553', '−2 050', '−2 097'],
  ['Résultat net', '24 290', '16 856', '24 507'],
  ['Rentabilité des fonds propres (ROE)', '26,5 %', '16,9 %', '21,1 %'],
  ['Rentabilité des actifs (ROA)', '2,45 %', '1,57 %', '1,85 %'],
];

const BILAN: readonly Row[] = [
  ['Total bilan', '992 787', '1 070 384', '1 323 065', ''],
  ['Dépôts de la clientèle', '716 594', '755 176', '999 869', ''],
  ['Crédits nets', '498 836', '534 117', '567 097', ''],
  ['Fonds propres', '91 512', '99 892', '115 974', ''],
  ['Taux brut de créances douteuses', '8,53 %', '6,96 %', '6,74 %', ''],
  ['Taux net de créances douteuses', '4,54 %', '2,74 %', '2,03 %', ''],
  ['Ratio de solvabilité', '20,88 %', '22,53 %', '15,01 %', '≥ 11,5 %'],
  ['Division des risques (grands risques)', '21,75 %', '20,26 %', '24,86 %', '≤ 25 %'],
  ['Ratio de levier', '9,05 %', '128,44 %', '6,64 %', '≥ 3 %'],
  ['Coefficient de liquidité', '121', '113', '145', ''],
];

const PNB = [
  ['2021', 36.1], ['2022', 42.3], ['2023', 55.0], ['2024', 42.0], ['2025', 55.8],
  ['2026', 71.4], ['2027', 79.7], ['2028', 88.2], ['2029', 97.9], ['2030', 106.7],
] as const;

const PLAN: readonly Row[] = [
  ['Résultat net', '32 636', '37 714', '41 009', '45 099', '49 267'],
  ['Coût du risque', '−6 478', '−5 339', '−6 364', '−6 937', '−6 737'],
  ['Coefficient d’exploitation', '37,0 %', '37,9 %', '38,3 %', '38,7 %', '38,7 %'],
  ['Crédits nets', '814 283', '891 315', '960 070', '1 039 194', '1 126 239'],
  ['Dépôts de la clientèle', '1 166 113', '1 266 413', '1 386 422', '1 500 965', '1 608 698'],
  ['Fonds propres', '136 357', '152 857', '169 352', '187 796', '207 748'],
  ['Ratio de solvabilité', '12,48 %', '12,38 %', '12,61 %', '12,88 %', '13,27 %'],
];

const ESTIMATIONS = [
  ['Comparables boursiers, PER', 217], ['Transactions, PER', 288], ['Dividendes actualisés (DDM)', 288],
  ['Comparables boursiers, P/B', 312], ['Transactions, P/B', 370], ['Excès de fonds propres', 373],
] as const;

const MULTIPLES: readonly Row[] = [
  ['BOA Côte d’Ivoire', 'Cours au 31/12/2025', '8,08x', '2,26x'],
  ['BICICI', 'Cours au 31/12/2025', '8,87x', '2,69x'],
  ['Société Ivoirienne de Banque', 'Cours au 31/12/2025', '10,34x', '2,81x'],
  ['BIIC (Bénin)', 'Introduction en 2025', '11,07x', '3,17x'],
  ['Bridge Bank Group Côte d’Ivoire', 'Introduction en 2026', '12,40x', '3,21x'],
  ['CBI CI', 'Prix d’offre, comptes 2025', '12,83x', '2,71x'],
];

const DIVIDENDES: readonly Row[] = [
  ['2026', '32 636', '21 213', '520', '6,7 %', '5,9 %'],
  ['2027', '37 714', '24 514', '601', '7,8 %', '6,9 %'],
  ['2028', '41 009', '26 656', '653', '8,5 %', '7,5 %'],
  ['2029', '45 099', '29 315', '718', '9,3 %', '8,2 %'],
  ['2030', '49 267', '32 023', '785', '10,2 %', '9,0 %'],
];

const SCENARIOS = [
  { code: 'fluide', niveau: 'Favorable', titre: 'Absorption fluide', conditions: ['Épargne disponible', 'Nouveaux investisseurs', 'Remboursement rapide'], consequence: 'L’offre élargit la cote sans désorganiser les échanges.' },
  { code: 'rotation', niveau: 'Central', titre: 'Rotation courte', conditions: ['Ventes de banques cotées pour souscrire', 'Cash rendu après l’allocation'], consequence: 'Tension temporaire sur les valeurs bancaires, puis normalisation.' },
  { code: 'contraction', niveau: 'Défavorable', titre: 'Contraction prolongée', conditions: ['Offre Coris Bénin rapprochée', 'Ventes importantes', 'Remboursement lent'], consequence: 'Moins de profondeur, fourchettes plus larges sur les valeurs liquides.' },
] as const;

const RISQUES: readonly Row[] = [
  ['Solvabilité', '15,01 % fin 2025, environ 12,4 % à 13,3 % prévus jusqu’en 2030 pour un minimum de 11,5 %', 'Une croissance plus rapide ou des pertes réduiraient la marge, donc le dividende'],
  ['Concentration', 'Grands risques à 24,86 % pour une limite de 25 % ; aucun chiffre sur les 20 premiers emprunteurs', 'Peu de place pour un nouveau gros client ; une défaillance importante pèserait vite'],
  ['Plan d’affaires', '+28 % de PNB et +44 % de crédits nets dès 2026', 'Le prix et le rendement dépendent de ce saut'],
  ['Pas d’engagement de conservation', 'Coris Holding garde 64,6 % sans engagement de ne pas vendre ; les titres invendus lui restent « jusqu’à une cession ultérieure »', 'De nouvelles ventes du majoritaire restent possibles'],
  ['Liquidité du titre', 'Aucun contrat de liquidité ni d’animation de marché n’est mentionné', 'Après la cotation, les échanges dépendront des seuls ordres des investisseurs'],
  ['Souverains et pays', 'Exposition aux États de l’Union non chiffrée ; risque sécuritaire régional cité', 'Sensibilité à la situation des finances publiques'],
  ['Opérationnel et conformité', 'Fraude, cybersécurité, lutte anti-blanchiment, fiscalité', 'Voir l’enquête pénale ci-dessous'],
];

const INDICATEURS: readonly Row[] = [
  ['30 novembre', 'Clôture anticipée ou non', 'L’intensité de la demande dès le premier jour'],
  ['Pendant l’offre', 'Valeur échangée sur la cote et sur les banques, contre leur moyenne de 20 séances', 'Si des investisseurs vendent pour souscrire'],
  ['Pendant l’offre ', 'Fourchettes et quantités du carnet des banques cotées', 'Si la liquidité se dégrade'],
  ['Compte rendu (9 décembre)', 'Taux de souscription, part des particuliers, nombre de souscripteurs', 'La base d’actionnaires et la quantité minimale servie'],
  ['Allocation (21 décembre)', 'Taux de service et délai de remboursement', 'Quand le cash bloqué revient sur le marché'],
  ['Première cotation (15 janvier 2027)', 'Cours d’ouverture contre 7 720 FCFA', 'Le jugement du marché sur le prix'],
  ['J+5 et J+20', 'Cours et volumes', 'Si l’intérêt tient après l’introduction'],
  ['Avril 2027', 'Comptes 2026 : PNB, résultat, solvabilité', 'Si le saut du plan d’affaires se réalise'],
  ['Mi-2027', 'Dividende de l’exercice 2026', 'Si les 65 % promis sont versés'],
  ['À tout moment', 'Ventes de Coris Holding, note de Coris Bank Bénin', 'L’offre de titres à venir'],
];

const SOURCES: readonly { label: string; url?: string }[] = [
  { label: 'Note d’information et page de souscription CBI CI — Coris Bourse' },
  { label: 'Coris Bank Côte d’Ivoire ouvre 20 % de son capital au public — Financial Afrik, 20/11/2026' },
  { label: 'Communiqué de CBI CI — L’Économiste du Faso, 20/11/2026' },
  { label: 'Coris Bank International ouvre 20 % de son capital — Burkina24, 20/11/2026' },
  { label: 'Coris Bank CI ouvre son capital dès le 30 novembre — Agence Ecofin, 20/11/2026' },
  { label: 'Le groupe Coris prépare l’introduction de ses filiales de Côte d’Ivoire et du Bénin — Sika Finance, 17/11/2026', url: 'https://www.sikafinance.com/marches/brvm-le-groupe-coris-prepare-lintroduction-en-bourse-de-ses-filiales-de-cote-divoire-et-du-benin_65787' },
  { label: 'GTFP Coris Côte d’Ivoire, actionnariat 2023 — IFC' },
  { label: 'OPV Coris Bank International Burkina, 291,8 % en 2016 — African Markets' },
  { label: 'BRVM — résultat de première cotation BBGC', url: 'https://www.brvm.org/fr/resultats-de-premiere-cotation-bridge-bank-group-cote-divoire-bbgc' },
  { label: 'BRVM — résumé de marché', url: 'https://www.brvm.org/fr/resume' },
  { label: 'Données de marché WESTBOURSE (séances du 26 mai au 19 novembre 2026, précédent Bridge Bank)' },
];

function PnbChart() {
  const max = 110;
  return (
    <figure className="coris-figure" aria-label="Produit net bancaire 2021-2030">
      <figcaption><strong>Le plan suppose un saut du PNB dès 2026</strong><br />PNB en Md FCFA. 2026 : +28 % sur 2025, contre +11,5 % par an de 2021 à 2025.</figcaption>
      <svg viewBox="0 0 600 240" role="img" style={{ width: '100%', height: 'auto' }}>
        {PNB.map(([an, v], i) => {
          const h = (v / max) * 180;
          const x = 20 + i * 58;
          const plan = Number(an) >= 2026;
          return (
            <g key={an}>
              <rect x={x} y={200 - h} width={40} height={h} fill={an === '2026' ? '#2f6fd6' : plan ? '#e2e2dc' : '#c4c4b4'} />
              <text x={x + 20} y={195 - h} textAnchor="middle" fontSize="12">{String(v).replace('.', ',')}</text>
              <text x={x + 20} y={218} textAnchor="middle" fontSize="12">{an}</text>
            </g>
          );
        })}
        <line x1={306} x2={306} y1={10} y2={205} stroke="#999" strokeDasharray="4 4" />
        <text x={300} y={20} textAnchor="end" fontSize="11">Réel</text>
        <text x={312} y={20} fontSize="11">Plan d’affaires</text>
      </svg>
      <p className="coris-caption">Note d’information CBI CI (visa OA/26-05), §3.1 et §4 · réel 2021-2025, plan 2026-2030</p>
    </figure>
  );
}

function ValuationChart() {
  return (
    <figure className="coris-figure" aria-label="Estimations de l’évaluateur">
      <figcaption><strong>Le prix se situe au milieu des estimations de l’évaluateur</strong><br />Valeur de 100 % des fonds propres, en Md FCFA. Six estimations de 217 à 373 Md ; prix d’offre : 315 Md.</figcaption>
      <svg viewBox="0 0 600 230" role="img" style={{ width: '100%', height: 'auto' }}>
        {ESTIMATIONS.map(([label, v], i) => (
          <g key={label}>
            <text x={200} y={28 + i * 32} textAnchor="end" fontSize="12">{label}</text>
            <rect x={210} y={14 + i * 32} width={(v / 400) * 370} height={20} fill="#c4c4b4" />
            <text x={214 + (v / 400) * 370} y={28 + i * 32} fontSize="12">{v}</text>
          </g>
        ))}
        <line x1={210 + (315 / 400) * 370} x2={210 + (315 / 400) * 370} y1={4} y2={210} stroke="#2f6fd6" strokeWidth={2} />
        <text x={210 + (315 / 400) * 370} y={225} textAnchor="middle" fontSize="12" fill="#2f6fd6">Prix d’offre 315</text>
      </svg>
      <p className="coris-caption">Note d’information CBI CI, §5.2 à 5.4 · calculs de l’évaluateur (Adenka), comptes 2025</p>
    </figure>
  );
}

export default function CorisIpoArticle() {
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: TITLE,
    description: DESCRIPTION,
    datePublished: '2026-11-19T14:00:00+01:00',
    dateModified: '2026-11-20T18:00:00+01:00',
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
        <span>RECHERCHE · 20 NOVEMBRE 2026</span>
      </header>

      <article>
        <header className="coris-headline">
          <div>
            <p className="coris-rubrique">OPV &amp; introduction · Étude BRVM</p>
            <div className="coris-brand-lockup" aria-label="Identités officielles">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/coris-bank-logo.svg" alt="Coris Bank" width="132" height="60" />
              <span aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/brvm-logo.png" alt="Bourse Régionale des Valeurs Mobilières" width="136" height="72" />
            </div>
            <h1>20 % de CBI CI.<br />7 720 FCFA l’action.<br />315 milliards de valorisation.</h1>
          </div>
          <div className="coris-headline__deck">
            <p>{DESCRIPTION}</p>
            <div>
              <span>Par WESTBOURSE Recherche</span>
              <span>14 min de lecture</span>
              <span>Mis à jour le 20 novembre 2026</span>
            </div>
          </div>
        </header>

        <section className="coris-hero-grid" id="synthese">
          <aside className="coris-lede">
            <p className="coris-lede__drop">
              <span>C</span>oris Holding cède au public 20 % de Coris Bank International Côte d’Ivoire
              (CBI CI), soit 8 160 000 actions, du 30 novembre au 4 décembre 2026. Au prix de 7 720 FCFA,
              la banque vaut 315 Md FCFA : 12,8 fois son résultat 2025 et 2,7 fois ses fonds propres.
              La première cotation est prévue le 15 janvier 2027, au compartiment Prestige de la BRVM.
            </p>
            <ul>
              <li><strong>Une cession, pas une levée de fonds.</strong> Les 62,74 Md FCFA reviennent à Coris Holding. Les fonds propres de la banque ne bougent pas.</li>
              <li><strong>Une banque rentable.</strong> En 2025 : PNB 55,8 Md, résultat net 24,5 Md, ROE 21,1 %, coefficient d’exploitation 41,8 %.</li>
              <li><strong>Un prix au-dessus des banques cotées sur le PER.</strong> Fin 2025, BOA CI, BICICI et SIB cotaient entre 8,1 et 10,3 fois leurs bénéfices. Sur le P/B, le prix est dans leur fourchette (2,3x à 2,8x).</li>
              <li><strong>Entre les deux dernières introductions bancaires.</strong> BIIC est entrée à 11,1 fois ses bénéfices en 2025, Bridge Bank à 12,4 fois en 2026.</li>
              <li><strong>Un rendement qui repose sur une promesse.</strong> La banque vise une distribution de 65 % du résultat dès 2026. Sur son plan d’affaires, le dividende 2026 serait d’environ 520 FCFA, soit 6,7 % brut au prix d’offre.</li>
              <li><strong>Un plan d’affaires ambitieux.</strong> Il prévoit +28 % de PNB et +44 % de crédits nets dès 2026. Or la solvabilité est tombée de 22,5 % à 15,0 % en 2025, pour un minimum de 11,5 %.</li>
              <li><strong>Des points de vigilance.</strong> Les grands risques atteignent 24,86 % pour une limite de 25 %. Un litige de 717 M FCFA est provisionné et une enquête pénale est en cours. Coris Holding ne prend aucun engagement de conservation.</li>
              <li><strong>Pour la BRVM, un test de liquidité.</strong> 62,7 Md représentent environ 5,7 séances au rythme du 19 novembre 2026. L’OPV Bridge Bank avait réduit de moitié les échanges le jour de son ouverture.</li>
            </ul>
            <div className="coris-lede__verdict">
              <span>EN UNE PHRASE</span>
              <strong>Une banque rentable vendue au prix des dernières introductions, dont le rendement dépend d’un plan d’affaires ambitieux et d’une marge de capital mince.</strong>
            </div>
          </aside>
        </section>

        <section className="coris-stat-strip" aria-label="Chiffres clés">
          <div><span>Montant de l’offre</span><strong>62,74 Md</strong><small>8 160 000 actions · 20 % du capital</small></div>
          <div><span>Prix d’offre</span><strong>7 720 FCFA</strong><small>PER 12,83x · P/B 2,71x (comptes 2025)</small></div>
          <div><span>Équivalent séance</span><strong>5,7×</strong><small>62,7 Md / 11,1 Md échangés le 19/11/2026</small></div>
        </section>

        <section className="coris-section" id="operation">
          <Intro n="01" rubrique="L’opération en détail" titre="Aucune action nouvelle : Coris Holding passe de 84,6 % à 64,6 %." />
          <DataTable caption="Caractéristiques de l’offre" head={['Élément', 'Détail']} rows={OPERATION} />
          <div className="coris-copy coris-copy--two">
            <p>
              Le montant global n’est pas 8 160 000 × 7 720 FCFA : il combine les deux prix. 7 996 800
              actions à 7 720 FCFA (61,74 Md) et 163 200 actions à 6 175 FCFA (1,01 Md) donnent
              exactement 62 743 056 000 FCFA.
            </p>
            <p>
              L’argent ne reste pas dans la banque. La note prévoit de l’affecter à l’expansion du groupe
              (acquisitions ou nouvelles filiales), à la trésorerie du groupe et de la filiale, et au
              financement de la croissance de CBI CI. Aucune nouvelle levée sur le marché régional n’est
              prévue à moyen terme.
            </p>
          </div>
        </section>

        <section className="coris-section" id="calendrier">
          <Intro n="02" rubrique="Calendrier" titre="Six semaines entre la clôture et la première cotation." />
          <DataTable
            caption="Calendrier indicatif de la note d’information (§6.11)"
            head={['Étape', 'Sans clôture anticipée', 'Clôture anticipée le 30 nov.']}
            rows={CALENDRIER}
            note="En cas de clôture anticipée dès le 30 novembre, tout avance d’une semaine environ. La première cotation reste fixée au 15 janvier 2027."
          />
        </section>

        <section className="coris-section" id="souscrire">
          <Intro n="03" rubrique="Souscrire et être servi" titre="Un ordre couvert, irrévocable, et un seul par investisseur." />
          <div className="coris-copy">
            <p>
              Toute personne physique ou morale peut souscrire, résidente ou non de l’UEMOA, depuis un
              compte-titres ouvert chez une SGI du syndicat. L’ordre doit être entièrement couvert et
              devient irrévocable à la clôture.
            </p>
            <ul>
              <li><strong>Ordre :</strong> exprimé en nombre d’actions, un seul par investisseur. En cas d’ordres multiples, seul le plus élevé est retenu.</li>
              <li><strong>Couverture :</strong> la SGI vérifie les fonds avant d’accepter l’ordre. Ils restent bloqués jusqu’à l’allocation définitive ; le reliquat est rendu sans frais sous 48 heures.</li>
              <li><strong>Paiement :</strong> espèces, chèque ou virement ; chez Coris Bourse, aussi par Mobile Money depuis l’espace client.</li>
              <li><strong>Minimum :</strong> la note n’en fixe pas. La page de souscription de Coris Bourse indique une action.</li>
              <li><strong>Frais :</strong> la note ne les chiffre pas. Il faut les demander à sa SGI avant de passer l’ordre.</li>
            </ul>
          </div>
          <DataTable caption="Répartition des actions offertes" head={['Catégorie', 'Coris Bourse', 'Autres SGI du syndicat', 'Total']} rows={REPARTITION} />
          <div className="coris-copy">
            <p>Les règles d’allocation dépendent de la demande :</p>
            <ol>
              <li><strong>Demande inférieure à l’offre :</strong> chaque ordre est servi à 100 %. Les actions non placées restent à Coris Holding.</li>
              <li><strong>Demande supérieure à l’offre :</strong> chaque catégorie reçoit d’abord une quantité minimale par souscripteur, égale aux actions de la catégorie divisées par le nombre de souscripteurs. Le reste est réparti au prorata de la demande excédentaire, arrondi à l’unité inférieure.</li>
              <li><strong>Aucun transfert entre catégories :</strong> les actions non souscrites par le personnel ne basculent pas vers le public.</li>
            </ol>
            <p>
              Illustration WESTBOURSE, hypothétique : avec 20 000 souscripteurs en catégorie 1, la quantité
              minimale serait d’environ 400 actions (3,1 M FCFA). Bridge Bank avait réuni 17 544 souscripteurs
              en juillet 2026. Un ordre modeste a donc de bonnes chances d’être servi en entier ; un gros
              ordre sera réduit.
            </p>
            <p>
              Le vrai coût d’un gros ordre est l’immobilisation. L’argent bloqué dès la souscription ne
              revient qu’après l’allocation, prévue le 21 décembre (le 15 en cas de clôture anticipée).
            </p>
          </div>
        </section>

        <section className="coris-section" id="banque">
          <Intro n="04" rubrique="La banque" titre="9e banque de Côte d’Ivoire, qui vise le top 5." />
          <div className="coris-copy">
            <p>
              CBI CI est la 9e banque de Côte d’Ivoire par le total de bilan, sur 29 établissements. Elle
              détient 4,1 % des emplois du marché et 4,7 % des ressources (7e rang).
            </p>
            <ul>
              <li><strong>Origine :</strong> filiale du groupe burkinabè Coris, créée en 2012, ouverte au public en février 2013.</li>
              <li><strong>Métiers :</strong> banque de détail, financement des entreprises et des PME, banque privée, finance islamique, services numériques.</li>
              <li><strong>Taille fin 2025 :</strong> 140 190 clients, 26 agences selon la note (27 selon le communiqué), 328 salariés en équivalent temps plein.</li>
              <li><strong>Croissance externe :</strong> reprise en 2024 du portefeuille de détail de Standard Chartered Côte d’Ivoire (22 000 clients, 27 Md de dépôts).</li>
              <li><strong>Notation :</strong> Bloomfield Investment Corporation, A+ à long terme et A1 à court terme, perspective stable.</li>
              <li><strong>Gouvernance :</strong> 8 administrateurs dont 3 indépendants ; un directeur général, Alassane Kaboré, assisté de 2 adjoints ; comités des risques, de crédit et d’audit.</li>
            </ul>
          </div>
          <DataTable caption="Actionnariat" head={['Actionnaire', 'Avant l’offre', 'Après l’offre']} rows={ACTIONNARIAT} />
          <p className="coris-caption">
            Une question reste ouverte pour les actionnaires de Coris Bank International Burkina (CBIBF).
            En 2023, une fiche de l’IFC donnait 44,1 % du capital à Coris Holding et 40,5 % à la banque
            burkinabè cotée. Aujourd’hui, Coris Holding détient 84,6 %, soit la somme des deux, et la note
            ne cite plus la banque burkinabè. Les conditions de ce transfert ne sont pas décrites dans la
            partie lue de la note.
          </p>
        </section>

        <section className="coris-section" id="analyse-financiere">
          <Intro n="05" rubrique="Analyse financière" titre="Le résultat 2025 est revenu au niveau de 2023, pas au-delà." />
          <p className="coris-copy">
            De 2021 à 2025, le PNB est passé de 36,1 à 55,8 Md FCFA (+11,5 % par an). Le résultat net a
            moins progressé, de 19,7 à 24,5 Md (+5,6 % par an), à cause du creux de 2024.
          </p>
          <DataTable caption="Compte de résultat (M FCFA)" head={['En M FCFA', '2023', '2024', '2025']} rows={RESULTATS} />
          <div className="coris-copy">
            <ul>
              <li><strong>2024, l’année creuse :</strong> le PNB recule de 23,5 % et le résultat de 30,6 %. La note invoque la crise de liquidité du marché bancaire en 2024 ; les frais continuent de monter et le coefficient atteint 47,6 %.</li>
              <li><strong>2025, le rebond :</strong> PNB +32,8 %, résultat +45,4 %. Le coût du risque remonte à 9,2 Md, soit 1,6 % des crédits nets.</li>
              <li><strong>D’où vient le PNB 2025 :</strong> marge d’intérêts 40,6 Md (73 %), commissions 12,9 Md (23 %), autres produits 2,3 Md (4 %).</li>
              <li><strong>Un impôt faible :</strong> 2,1 Md pour 26,6 Md de résultat avant impôt, soit un taux apparent de 7,9 %. La note ne commente pas ce point ; sa durabilité compte pour le résultat futur.</li>
              <li><strong>Le bénéfice par action 2025</strong> ressort à 601 FCFA (24,5 Md pour 40,8 millions d’actions).</li>
            </ul>
            <p>La croissance récente est donc surtout un rattrapage.</p>
          </div>
        </section>

        <section className="coris-section" id="bilan">
          <Intro n="06" rubrique="Bilan, qualité des actifs, solvabilité" titre="De la liquidité à prêter, mais moins de capital pour le faire." />
          <p className="coris-copy">
            Le bilan a grossi de 24 % en 2025, à 1 323 Md FCFA, porté par les dépôts (+32 %). Les crédits
            nets n’ont progressé que de 6 %, et la solvabilité a perdu 7,5 points.
          </p>
          <DataTable caption="Bilan et ratios prudentiels" head={['En M FCFA ou %', '2023', '2024', '2025', 'Norme']} rows={BILAN} />
          <div className="coris-copy">
            <ul>
              <li><strong>Beaucoup de dépôts, peu prêtés :</strong> les crédits nets représentent 56,7 % des dépôts. La liquidité est abondante.</li>
              <li><strong>Qualité des crédits en amélioration :</strong> le taux brut de créances douteuses baisse depuis 2023. Les 40,1 Md de créances douteuses sont couverts à 71 % par 28,6 Md de dépréciations.</li>
              <li><strong>Solvabilité en forte baisse :</strong> de 22,53 % à 15,01 % en un an, sans explication dans la note. La marge au-dessus du minimum est de 3,5 points.</li>
              <li><strong>Grands risques au plafond :</strong> 24,86 % pour une limite de 25 %. Un seul gros client de plus et la norme serait dépassée.</li>
              <li><strong>Une coquille probable :</strong> le ratio de levier de 128,44 % en 2024 est incohérent avec les autres années (9 % et 7 %).</li>
            </ul>
            <p>C’est la contrainte centrale du plan d’affaires.</p>
          </div>
        </section>

        <section className="coris-section" id="plan">
          <Intro n="07" rubrique="Plan d’affaires 2026-2030" titre="+28 % de PNB dès 2026, puis environ +10 % par an." />
          <p className="coris-copy">
            Le plan prévoit un PNB de 71,4 Md FCFA dès 2026. Le résultat net doublerait, de 24,5 Md en
            2025 à 49,3 Md en 2030.
          </p>
          <PnbChart />
          <DataTable caption="Plan d’affaires (M FCFA ou %)" head={['En M FCFA ou %', '2026', '2027', '2028', '2029', '2030']} rows={PLAN} />
          <div className="coris-copy">
            <ul>
              <li><strong>Un saut dès la première année :</strong> les crédits nets passeraient de 567 à 814 Md en 2026 (+44 %), après +6 % en 2025. La note ne chiffre pas ce qui explique ce bond.</li>
              <li><strong>Les hypothèses citées :</strong> normalisation sécuritaire régionale, baisse de l’inflation, réseau porté de 26 à 49 agences, crédits à l’agriculture et aux énergies renouvelables, nouveaux produits de gestion de trésorerie.</li>
              <li><strong>Un exercice déjà presque écoulé :</strong> 2026 se termine dans six semaines, mais la partie lue de la note ne donne pas de comptes semestriels pour vérifier la trajectoire.</li>
              <li><strong>Une marge de capital mince :</strong> la solvabilité resterait entre 12,4 % et 13,3 %, à 1 à 2 points du minimum, tout en distribuant 65 % du résultat.</li>
              <li><strong>Les objectifs fixés :</strong> PNB et dépôts en hausse d’au moins 10 % et 9 % par an, crédits d’au moins 8 %, coefficient d’exploitation sous 45 %, ROE d’au moins 20 %.</li>
            </ul>
            <p>
              Sensibilité (calcul WESTBOURSE) : si le résultat 2026 restait au niveau de 2025, un dividende
              à 65 % vaudrait environ 390 FCFA, soit 5,1 % brut au prix d’offre, au lieu de 520 FCFA.
            </p>
          </div>
        </section>

        <section className="coris-section" id="valorisation">
          <Intro n="08" rubrique="Valorisation" titre="Plus chère par franc de bénéfice, pas par franc de fonds propres." />
          <p className="coris-copy">
            Au prix d’offre, CBI CI vaut 315 Md FCFA, au milieu des six estimations de l’évaluateur (217 à
            373 Md). Le prix fait ressortir un PER de 12,83x et un P/B de 2,71x sur les comptes 2025.
          </p>
          <ValuationChart />
          <DataTable caption="Multiples des banques comparables" head={['Banque', 'Référence', 'PER', 'P/B']} rows={MULTIPLES} />
          <div className="coris-copy">
            <ul>
              <li><strong>Au-dessus des banques cotées sur le PER :</strong> le P/B reste dans leur fourchette. L’écart tient au résultat 2025, revenu seulement au niveau de 2023.</li>
              <li><strong>Alignée sur les introductions récentes :</strong> le PER est proche de Bridge Bank (12,40x) ; le P/B est inférieur à BIIC et Bridge, malgré un ROE de 21,1 %.</li>
              <li><strong>Moins chère si le plan se réalise :</strong> sur le résultat prévu pour 2026 (32,6 Md), le PER tomberait à 9,7x (calcul WESTBOURSE). Ce chiffre dépend entièrement du plan.</li>
              <li><strong>Des comparables datés :</strong> les multiples boursiers sont ceux du 31 décembre 2025, retenus par la note ; les cours bancaires ont bougé depuis.</li>
            </ul>
            <p>
              Les méthodes de l’évaluateur : comparables boursiers (médianes de 8,87x le bénéfice et 2,69x les
              fonds propres), transactions BIIC et Bridge (11,75x et 3,19x), dividendes actualisés et excès de
              fonds propres. Ces deux dernières reposent sur le plan d’affaires, un coût des fonds propres de
              11,33 % et une distribution de 65 %.
            </p>
            <p>
              La note présente 314 Md comme valeur centrale et une fourchette de 217 à 412 Md ; la borne de
              412 Md n’est pas expliquée dans la partie lue. Notre recalcul : la moyenne des quatre méthodes
              (264,6 ; 329,1 ; 288,3 et 372,7 Md) donne 313,7 Md, cohérente avec la valeur retenue.
            </p>
          </div>
        </section>

        <section className="coris-section coris-section--dividend" id="dividendes">
          <Intro n="09" rubrique="Dividendes et rendement attendu" titre="65 % de distribution promis, contre 42 % en moyenne depuis 2020." />
          <div className="coris-copy">
            <p>
              Les souscripteurs ont droit au dividende de l’exercice 2026, versé en 2027. Le taux de
              distribution a été de 40 % en 2020 et 2021, 35 % en 2022 et 2023, puis 50 % en 2024 et 2025.
              Le dividende de l’exercice 2025 (12,25 Md FCFA) revient aux actionnaires actuels, pas aux
              souscripteurs.
            </p>
          </div>
          <DataTable
            caption="Dividendes projetés à 65 % du résultat du plan d’affaires"
            head={['Exercice (prévision)', 'Résultat net prévu (M FCFA)', 'Dividende total (M FCFA)', 'Dividende par action (FCFA)', 'Rendement brut', 'Rendement net d’IRVM 12 %']}
            rows={DIVIDENDES}
            note="Calculs WESTBOURSE sur 40,8 millions d’actions et un prix de 7 720 FCFA. Le taux de 12 % est l’IRVM ivoirien des personnes physiques ; l’IRVM dépend du pays de résidence de l’investisseur."
          />
          <div className="coris-copy">
            <p>
              Ces montants sont des projections. Ils supposent que le résultat progresse de 33 % en 2026 et
              que la solvabilité permette de distribuer 65 %. La note rappelle qu’ils restent soumis aux
              résultats, aux besoins en capital, aux exigences prudentielles et au vote des actionnaires.
            </p>
            <p>
              Pour comparer : au résultat 2025 et au taux de 50 % déjà pratiqué, le dividende serait de 300
              FCFA, soit 3,9 % brut.
            </p>
          </div>
        </section>

        <section className="coris-section" id="effet-brvm">
          <Intro n="10" rubrique="Effet sur la BRVM" titre="5,7 séances d’échanges, 0,33 % de la capitalisation." />
          <p className="coris-copy">
            L’offre pèse 62,7 Md FCFA, soit environ 5,7 séances d’échanges au rythme du 19 novembre 2026
            (11,1 Md). Elle représente aussi 23 % de la valeur échangée sur les actions en 2025 (274,4 Md),
            mais seulement 0,33 % de la capitalisation.
          </p>
          <BridgeEventChart />
          <div className="coris-observations">
            <article>
              <span>20 JUILLET · OUVERTURE OPV BRIDGE</span>
              <strong>47 %</strong>
              <p>La valeur échangée tombe à 1,14 Md, contre la moyenne des cinq séances précédentes. Le BRVM Composite cède 1,06 %, l’indice financier 2,07 %.</p>
            </article>
            <article>
              <span>21 JUILLET · CLÔTURE ANTICIPÉE</span>
              <strong>142 %</strong>
              <p>95,8 Md demandés pour 67,5 Md offerts, dont 58 % par des particuliers ; 17 544 souscripteurs.</p>
            </article>
            <article>
              <span>24 SEPTEMBRE · PREMIÈRE COTATION</span>
              <strong>+2,97 %</strong>
              <p>Le BRVM Composite rebondit. Le retrait de liquidité n’a pas duré.</p>
            </article>
          </div>
          <div className="coris-copy">
            <p>
              Le groupe Coris a aussi son propre précédent. En novembre 2016, l’OPV de la banque burkinabè
              avait été souscrite à 291,8 % et close en moins de six heures. Une clôture anticipée dès le 30
              novembre est donc un scénario réaliste.
            </p>
            <p>
              Une souscription ne vide pas forcément le marché secondaire. Seul l’investisseur qui vend des
              actions déjà cotées pour souscrire crée une pression vendeuse ; l’épargne disponible, l’argent
              nouveau ou le crédit n’en créent pas directement. Le calendrier ajoute une particularité :
              l’argent sera bloqué de fin novembre à fin décembre, puis la cotation arrivera mi-janvier, au
              moment où l’offre Coris Bénin est attendue.
            </p>
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

        <section className="coris-section" id="risques">
          <Intro n="11" rubrique="Risques et litiges" titre="Moins la qualité des crédits que le capital, la concentration et la gouvernance de la cession." />
          <DataTable caption="Principaux risques" head={['Risque', 'Ce que dit la note', 'Pourquoi c’est important']} rows={RISQUES} />
          <div className="coris-copy">
            <p>
              <strong>Litige civil (affaire KKF).</strong> En 2014, la banque a bloqué la seconde tranche d’un
              crédit faute de justificatifs, et le client l’a assignée. En 2021, la cour d’appel l’a condamnée à
              verser 717 258 215 FCFA. La Cour de cassation a suspendu l’exécution en 2022 ; le montant est
              entièrement provisionné.
            </p>
            <p>
              <strong>Enquête pénale.</strong> Le 16 mai 2023, la banque a exécuté des ordonnances de gel
              visant des comptes de clients. Selon la note, elle a été convoquée le 13 mars 2025 par le Pôle
              pénal économique et financier pour se voir notifier une inculpation (association de malfaiteurs,
              omission de déclaration de soupçon, blanchiment). La banque dit avoir fourni les justificatifs
              des mouvements ; le dossier est au parquet.
            </p>
            <p>
              <strong>Incohérences relevées dans la note.</strong> Le visa est daté du 11 novembre dans un
              passage et du 13 novembre dans le calendrier. Le ratio de levier 2024 (128,44 %) est sans doute
              une coquille. La part de Coris Holding est donnée à 64,6 % « fin 2025 » dans un passage, alors
              qu’elle détient 84,6 % avant l’offre.
            </p>
          </div>
        </section>

        <section className="coris-section" id="benin">
          <Intro n="12" rubrique="Coris Bank Bénin, la seconde opération" titre="Environ 19 Md annoncés, aucune condition officielle." />
          <div className="coris-copy">
            <p>
              Au 20 novembre 2026, aucune condition officielle n’est publiée pour Coris Bank Bénin. Seule la
              presse évoque une levée d’environ 19 Md FCFA et une cotation en janvier 2027, à quelques jours
              de celle de CBI CI.
            </p>
            <ul>
              <li><strong>Ce que l’on sait :</strong> les autorisations de l’AMF-UMOA sont présentées comme obtenues pour les deux filiales. Fin 2025, la banque affichait un bilan de 850 Md FCFA, un PNB de 20,5 Md, un résultat net de 8,1 Md et un ROE de 16,5 % (chiffres de presse, non recoupés avec une note d’information).</li>
              <li><strong>Ce qui manque :</strong> prix, nombre d’actions, part du capital, nature de l’opération (cession ou augmentation de capital) et dates.</li>
              <li><strong>Pourquoi c’est important :</strong> si les deux offres se suivent, l’ensemble atteint environ 81,7 Md FCFA. Le scénario de contraction prolongée devient alors plus probable.</li>
            </ul>
            <p>Cette section sera complétée dès la publication de la note d’information de Coris Bank Bénin.</p>
          </div>
        </section>

        <section className="coris-section" id="indicateurs">
          <Intro n="13" rubrique="Les indicateurs à surveiller" titre="Qui a souscrit, avec quel argent, et ce qui se passera après la cotation." />
          <DataTable caption="Calendrier de suivi" head={['Quand', 'Indicateur', 'Ce qu’il dira']} rows={INDICATEURS} note="Les dates d’avril et de mi-2027 sont des repères WESTBOURSE, pas des dates publiées par la banque." />
        </section>

        <footer className="coris-footer" id="methodologie">
          <div>
            <h2>Sources &amp; méthode</h2>
            <ul>
              {SOURCES.map((source) => (
                <li key={source.label}>
                  {source.url ? <Link href={source.url}>{source.label} →</Link> : source.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p>
              Les chiffres de l’opération et de la banque viennent de la note d’information visée par
              l’AMF-UMOA (visa OA/26-05), publiée le 20 novembre 2026. Les calculs par action, rendements,
              taux de croissance et ratios sont des calculs WESTBOURSE, signalés comme tels.
            </p>
            <p>
              Limites. La note a été lue en version électronique ; quelques passages (attestation d’équité,
              frais) n’ont pas pu être exploités et sont signalés comme manquants. Les comparables boursiers
              sont ceux de la note, au 31 décembre 2025 : les cours ont bougé depuis.
            </p>
            <p>
              Avertissement. Cette étude est informative. Elle ne constitue ni un conseil en investissement,
              ni une recommandation de souscrire, ni une promesse de rendement. Le visa de l’AMF-UMOA
              n’implique ni approbation de l’opportunité de l’opération ni authentification des informations.
              Investir en actions comporte un risque de perte en capital.
            </p>
            <p className="coris-logo-disclaimer">
              Les logos Coris Bank, Bridge Bank Group et BRVM sont reproduits uniquement pour identifier les
              institutions citées. Ils n’impliquent aucun partenariat ni aucune approbation de cette analyse.
            </p>
          </div>
        </footer>
      </article>
    </main>
  );
}
