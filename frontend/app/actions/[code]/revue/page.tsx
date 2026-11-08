import { notFound } from 'next/navigation';
import { getRevue, type YearRow } from '@/lib/reports/server';
import PrintTrigger from '@/components/financials/PrintTrigger';
import { PriceChart, FinancialsBars } from '@/components/reports/RevueCharts';
import CascadeResultat from '@/components/revue/CascadeResultat';
import { fmtFcfa } from '@/lib/format';
import { perAffichable, distributionAffichable, evolutionResultat, evolutionResultatDetail, horsExploitation, syntheseExercice, dividendeCourant } from '@/lib/fiche/affichage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revue de résultats' };

interface Props { params: { code: string } }

const md = (n: number | null | undefined) =>
  n == null ? '—' : `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md`;
const fcfa = (n: number | null | undefined) =>
  n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const pct = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
// Lignes de résultat : un pourcentage brut est trompeur quand un des exercices est une perte.
const EN_MOTS = new Set(["Résultat d'exploitation", 'Résultat avant impôt', 'Résultat net']);
const yoy = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || b === 0 ? '—' : `${a / b - 1 >= 0 ? '+' : ''}${((a / b - 1) * 100).toFixed(1)}%`;

export default async function RevuePage({ params }: Props) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const d = await getRevue(code).catch(() => null);
  if (!d) notFound();

  const { latest, prev, profil } = d;
  const today = new Date(d.generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  // Dividende courant : dernière ligne > 0 AVEC exercice (une ligne sans exercice n'est pas datable).
  const divCourant = dividendeCourant(
    [...d.dividends].filter((x) => x.exercice > 0).reverse().map((x) => ({ montant: x.montant, exercice: x.exercice, ex_date: null, payment_date: null })),
    latest ? Number(latest.periode) : null,
  );
  const rendementDiv = divCourant && d.price?.cours ? (divCourant.montant / d.price.cours) * 100 : null;
  // Le taux de distribution n'a de sens que pour le dividende de l'exercice des comptes affichés.
  const payoutCalc = divCourant && latest?.bpa && latest.bpa > 0 && divCourant.exercice === Number(latest.periode)
    ? (divCourant.montant / latest.bpa) * 100 : null;
  const distribution = distributionAffichable(payoutCalc, latest?.resultatNet ?? null);
  const per = perAffichable(d.ratios.per, latest?.bpa ?? (latest?.resultatNet != null && latest.resultatNet <= 0 ? latest.resultatNet : null));
  const horsExpl = latest ? horsExploitation(latest.resultatAvantImpot, latest.resultatExploitation) : null;
  const croissanceCa = latest?.revenu != null && prev?.revenu != null && prev.revenu !== 0
    ? ((latest.revenu - prev.revenu) / Math.abs(prev.revenu)) * 100 : null;
  const evolutionRn = latest ? evolutionResultat(latest.resultatNet, prev?.resultatNet ?? null) : null;
  const phrase = latest
    ? syntheseExercice({
        croissanceCaPct: croissanceCa,
        evolution: evolutionResultatDetail(latest.resultatNet, prev?.resultatNet ?? null),
        resultatExploitation: latest.resultatExploitation,
        horsExpl,
      })
    : null;
  const variationCp = latest?.capitauxPropres != null && prev?.capitauxPropres != null && prev.capitauxPropres !== 0
    ? ((latest.capitauxPropres - prev.capitauxPropres) / Math.abs(prev.capitauxPropres)) * 100 : null;
  const signeMots = (v: number | null) => (v == null ? null : `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`);

  // Lignes du tableau de résultats (label, valeur).
  const isRow = (label: string, fn: (y: YearRow) => number | null) => ({
    label, cur: latest ? fn(latest) : null, prv: prev ? fn(prev) : null,
  });
  const rows = [
    isRow("Chiffre d'affaires", (y) => y.revenu),
    isRow("Résultat d'exploitation", (y) => y.resultatExploitation),
    isRow('Résultat avant impôt', (y) => y.resultatAvantImpot),
    isRow('Résultat net', (y) => y.resultatNet),
    isRow('Capitaux propres', (y) => y.capitauxPropres),
    isRow('Total actif', (y) => y.totalActif),
  ];

  // Rapport d'activité antérieur aux comptes affichés (UNLC : rapport 2021 sous
  // des comptes 2023) : on le date et on ne le recycle pas en « à surveiller ».
  const hlAncien = !!(d.highlights?.exercice && latest && d.highlights.exercice < Number(latest.periode));
  // Comptes en retard (UNLC au 31/10/2026 : dernier exercice en base 2023) : le
  // P/E rapporte alors le cours du jour à un bénéfice ancien, il faut le dire.
  const anneeRevue = new Date(d.generatedAt).getFullYear();
  const comptesEnRetard = !!latest && Number(latest.periode) < anneeRevue - 2;

  return (
    // Blanc LITTÉRAL : `bg-white` suit le jeton --color-ivory, qui vaut le brun
    // foncé du texte en thème clair — d'où un rapport noir sur brun, illisible.
    <div className="bg-[#ffffff] text-[#111111] font-sans p-8 max-w-3xl mx-auto print:p-4 print:max-w-none">
      <PrintTrigger />

      {/* En-tête */}
      <div className="flex items-start justify-between mb-5 border-b-2 border-gray-900 pb-3">
        <div>
          <p className="text-xs text-gray-500">WESTBOURSE · Revue de résultats</p>
          <h1 className="text-2xl font-bold mt-1">{d.code} — {d.designation}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{[d.secteur, d.pays].filter(Boolean).join(' · ')} · {profil.label}</p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p>Générée le {today}</p>
          <p className="mt-1 max-w-[180px]">Document informatif : ne constitue pas un conseil en investissement</p>
        </div>
      </div>

      {/* Instantané marché & valorisation */}
      <div className="grid grid-cols-4 gap-3 mb-5 text-sm">
        {([
          ['Cours', fcfa(d.price?.cours), d.price?.date ? `au ${d.price.date}` : ''],
          ['Capitalisation', md(d.price?.mcap), ''],
          ['P/E', per.valeur != null ? `${per.valeur.toFixed(1)}x` : 'non calculable', per.motif ?? (latest?.bpa ? `BPA ${fcfa(latest.bpa)}` : '')],
          ['Rendement div.', rendementDiv != null ? `${rendementDiv.toFixed(2)}%` : '—', divCourant ? `${fcfa(divCourant.montant)} · ex. ${divCourant.exercice}` : ''],
        ] as [string, string, string][]).map(([l, v, sub]) => (
          <div key={l} className="border border-gray-200 rounded p-2.5">
            <p className="text-xs uppercase text-gray-500">{l}</p>
            <p className="text-base font-bold leading-tight mt-0.5">{v}</p>
            {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Bandeau cyclique pour l'agro */}
      {profil.cyclique && (
        <div className="rounded-md bg-orange-50 px-3 py-2 mb-5 text-xs text-orange-950">
          <b>Activité cyclique.</b> Le secteur agro-industriel est sensible aux campagnes et aux cours
          des matières premières : la performance d&apos;un exercice isolé n&apos;est pas représentative.
          Cette revue privilégie une <b>lecture pluriannuelle</b> (jusqu&apos;à 5 exercices) pour situer
          la société dans son cycle.
        </div>
      )}

      {/* Synthèse de l'exercice : une phrase construite sur quatre chiffres affichés plus bas */}
      {latest && (phrase || latest.revenu != null) && (
        <div className="mb-5">
          {phrase && <p className="text-base font-semibold leading-snug mb-3">{phrase}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            {([
              ["Chiffre d'affaires", fmtFcfa(latest.revenu), signeMots(croissanceCa) ? `${signeMots(croissanceCa)} sur un an` : ''],
              ["Résultat d'exploitation", fmtFcfa(latest.resultatExploitation), prev?.resultatExploitation != null ? `${prev.periode} : ${fmtFcfa(prev.resultatExploitation)}` : ''],
              ['Résultat net', fmtFcfa(latest.resultatNet), evolutionRn ?? ''],
              ['Capitaux propres', fmtFcfa(latest.capitauxPropres), signeMots(variationCp) ? `${signeMots(variationCp)} sur un an` : ''],
            ] as [string, string, string][]).map(([l, v, sub]) => (
              <div key={l} className="border border-gray-200 rounded p-2.5">
                <p className="text-xs text-gray-500">{l}</p>
                <p className="text-base font-bold leading-tight mt-0.5 tabular-nums">{v}</p>
                {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
          {latest.resultatExploitation != null && horsExpl != null && latest.resultatAvantImpot != null && latest.impots != null && latest.resultatNet != null && (
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-1">Du résultat d&apos;exploitation au résultat net, exercice {latest.periode}.</p>
              <CascadeResultat
                resultatExploitation={latest.resultatExploitation}
                horsExploitation={horsExpl}
                resultatAvantImpot={latest.resultatAvantImpot}
                impot={latest.resultatAvantImpot - latest.resultatNet}
                resultatNet={latest.resultatNet}
              />
            </div>
          )}
        </div>
      )}

      {/* Résultats */}
      <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">
        Résultats {latest ? `· exercice ${latest.periode}` : ''}
      </h2>
      <table className="w-full text-sm mb-2">
        <thead>
          <tr className="text-[11px] text-gray-500 border-b border-gray-200">
            <th className="text-left font-medium py-1">Indicateur</th>
            <th className="text-right font-medium">{latest?.periode ?? '—'}</th>
            <th className="text-right font-medium">{prev?.periode ?? '—'}</th>
            <th className="text-right font-medium">Évolution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-gray-100">
              <td className="py-1 text-gray-600">{r.label}</td>
              <td className="text-right font-semibold tabular-nums">{md(r.cur)}</td>
              <td className="text-right text-gray-500 tabular-nums">{md(r.prv)}</td>
              <td className="text-right tabular-nums">{EN_MOTS.has(r.label) ? (evolutionResultat(r.cur, r.prv) ?? '—') : yoy(r.cur, r.prv)}</td>
            </tr>
          ))}
          <tr className="border-b border-gray-100">
            <td className="py-1 text-gray-600">BPA</td>
            <td className="text-right font-semibold tabular-nums">{fcfa(latest?.bpa)}</td>
            <td className="text-right text-gray-500 tabular-nums">{fcfa(prev?.bpa)}</td>
            <td className="text-right tabular-nums">{yoy(latest?.bpa, prev?.bpa)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-gray-600 mb-4">Montants en FCFA. Source : états financiers publiés (extraction WESTBOURSE).</p>
      {d.years.length >= 2 && (
        <>
          <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1 mt-5">
            {Math.min(d.years.length, 5)} derniers exercices
          </h2>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-[11px] text-gray-500 border-b border-gray-200">
                <th className="text-left font-medium py-1">Exercice</th>
                <th className="text-right font-medium">Chiffre d&apos;affaires</th>
                <th className="text-right font-medium">Rés. exploitation</th>
                <th className="text-right font-medium">Résultat net</th>
                <th className="text-right font-medium">BPA</th>
              </tr>
            </thead>
            <tbody>
              {d.years.slice(0, 5).map((y) => (
                <tr key={y.periode} className="border-b border-gray-100">
                  <td className="py-1 text-gray-600">{y.periode}</td>
                  <td className="text-right tabular-nums">{fmtFcfa(y.revenu)}</td>
                  <td className="text-right tabular-nums">{fmtFcfa(y.resultatExploitation)}</td>
                  <td className="text-right font-semibold tabular-nums">{fmtFcfa(y.resultatNet)}</td>
                  <td className="text-right tabular-nums">{y.bpa != null ? fcfa(y.bpa) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {comptesEnRetard && latest && (
        <p className="text-[11px] text-amber-700 -mt-2 mb-4">
          Derniers comptes disponibles : exercice {latest.periode}. Aucun compte plus récent ne figure dans
          les publications officielles de la société ; le P/E rapporte donc le cours du jour à un bénéfice
          de {latest.periode}.
        </p>
      )}

      {/* Graphique financier pluriannuel */}
      {d.years.length >= 2 && (
        <div className="mb-5">
          <FinancialsBars data={d.years.map((y) => ({ periode: y.periode, revenu: y.revenu, resultatNet: y.resultatNet }))} />
          <p className="text-xs text-gray-600 text-center mt-1">
            CA (orange) et résultat net (gris){profil.cyclique ? ' sur plusieurs exercices · lecture du cycle' : ''}.
          </p>
        </div>
      )}

      {/* Activité — qualitatif des rapports */}
      {d.highlights && (d.highlights.synthese || d.highlights.items.length > 0) && (
        <>
          <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">
            {hlAncien
              ? `Activité · dernier rapport disponible (exercice ${d.highlights.exercice})`
              : <>Activité · ce qui se passe dans l&apos;entreprise</>}
          </h2>
          {hlAncien && latest && (
            <p className="text-[11px] text-amber-700 mb-2">
              Ce rapport porte sur l&apos;exercice {d.highlights.exercice}, antérieur aux comptes {latest.periode} présentés
              ci-dessus : aucun rapport d&apos;activité plus récent n&apos;est disponible pour cette valeur.
            </p>
          )}
          {d.highlights.synthese && <p className="text-sm text-gray-700 leading-relaxed mb-2">{d.highlights.synthese}</p>}
          <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-1">
            {d.highlights.items.map((it, i) => (
              <li key={i}><b>{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
            ))}
          </ul>
          {d.highlights.source_libelle && (
            <p className="text-xs text-gray-600 mb-4">
              Source :{' '}
              {d.highlights.source_url ? (
                <a href={d.highlights.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {d.highlights.source_libelle}
                </a>
              ) : d.highlights.source_libelle}
              {' '}(document publié à la BRVM).
            </p>
          )}
        </>
      )}

      {/* Cours vs résultats & dividendes */}
      <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">
        Cours de bourse vs résultats & dividendes
      </h2>
      <PriceChart data={d.priceSeries} />
      <p className="text-xs text-gray-600 text-center mt-1 mb-3">
        Cours de clôture sur la période disponible. Source : brvm.org (via WESTBOURSE).
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-2">
        {divCourant
          ? `Dernier versement connu : ${fcfa(divCourant.montant)} par action, au titre de l'exercice ${divCourant.exercice}${divCourant.ancien ? `, soit plus d'un exercice avant le dernier exercice publié (${latest?.periode}) : ce dividende n'est pas un point d'appui pour l'avenir` : ''}. Rendement au cours actuel : ${rendementDiv != null ? rendementDiv.toFixed(2) + ' %' : '—'} (exercice ${divCourant.exercice}). Taux de distribution : ${distribution.valeur != null ? `environ ${distribution.valeur.toFixed(0)} % du bénéfice` : distribution.motif}. Le détachement du dividende (à l'AGO) provoque mécaniquement une baisse technique du cours égale au coupon : l'actionnaire reçoit en cash ce que le cours perd, sans destruction de valeur. Sur la durée, la trajectoire du cours suit surtout la progression des résultats.`
          : "Aucun dividende récent enregistré pour cette valeur."}
      </p>

      {/* Avant la prochaine publication (earnings preview qualitatif) */}
      {d.years.length >= 2 && latest && prev && (
        <>
          <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1 mt-5">
            À suivre · avant la prochaine publication
          </h2>
          <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-1">
            <li>
              <b>Trajectoire récente</b> : chiffre d&apos;affaires {yoy(latest.revenu, prev.revenu)} et résultat net{' '}
              ({evolutionRn ?? '—'}) sur le dernier exercice connu ({latest.periode}).
              {' '}À publication, vérifier si cette tendance se poursuit ou s&apos;inverse.
            </li>
            {d.dividends.length >= 2 && (
              <li>
                <b>Dividende</b> : sur les derniers exercices connus, il s&apos;est situé entre{' '}
                {fcfa(Math.min(...d.dividends.map((x) => x.montant)))} et {fcfa(Math.max(...d.dividends.map((x) => x.montant)))}.
                {' '}Repère, à confirmer par l&apos;affectation du résultat (pas une prévision).
              </li>
            )}
            {d.profil.cyclique && (
              <li><b>Activité cyclique</b> : surveiller la position dans le cycle (campagne, cours des matières premières) plutôt que le seul exercice.</li>
            )}
            {!hlAncien && d.highlights?.items.slice(0, 2).map((it, i) => (
              <li key={i}><b>{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
            ))}
          </ul>
          <p className="text-xs text-gray-600 mb-4 italic">
            Repères qualitatifs dérivés de l&apos;historique réel : il ne s&apos;agit PAS d&apos;un consensus
            d&apos;analystes ni d&apos;une prévision chiffrée.
          </p>
        </>
      )}

      <p className="text-xs text-gray-600 mt-6 border-t pt-2 italic">
        Source : WESTBOURSE · {today}. Données dérivées de publications réelles (états financiers, rapports
        d&apos;activité, cours BRVM), aucune valeur inventée. Les ordres s&apos;exécutent via une SGI agréée.
        Les performances passées ne préjugent pas des performances futures.
      </p>
    </div>
  );
}
