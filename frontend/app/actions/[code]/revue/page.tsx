import { notFound } from 'next/navigation';
import { getRevue, type YearRow } from '@/lib/reports/server';
import PrintTrigger from '@/components/financials/PrintTrigger';
import { PriceChart, FinancialsBars, DividendBars } from '@/components/reports/RevueCharts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revue de résultats' };

interface Props { params: { code: string } }

const md = (n: number | null | undefined) =>
  n == null ? '—' : `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md`;
const fcfa = (n: number | null | undefined) =>
  n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const pct = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
const yoy = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || b === 0 ? '—' : `${a / b - 1 >= 0 ? '+' : ''}${((a / b - 1) * 100).toFixed(1)}%`;

export default async function RevuePage({ params }: Props) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const d = await getRevue(code).catch(() => null);
  if (!d) notFound();

  const { latest, prev, profil } = d;
  const today = new Date(d.generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const lastDiv = d.dividends.length ? d.dividends[d.dividends.length - 1] : null;

  // Lignes du tableau de résultats (label, valeur).
  const isRow = (label: string, fn: (y: YearRow) => number | null) => ({
    label, cur: latest ? fn(latest) : null, prv: prev ? fn(prev) : null,
  });
  const rows = [
    isRow("Chiffre d'affaires", (y) => y.revenu),
    isRow("Résultat d'exploitation", (y) => y.resultatExploitation),
    isRow('Résultat net', (y) => y.resultatNet),
    isRow('Capitaux propres', (y) => y.capitauxPropres),
    isRow('Total actif', (y) => y.totalActif),
  ];

  return (
    <div className="bg-white text-black font-sans p-8 max-w-3xl mx-auto print:p-4 print:max-w-none">
      <PrintTrigger />

      {/* En-tête */}
      <div className="flex items-start justify-between mb-5 border-b-2 border-gray-900 pb-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">WESTBOURSE · Revue de résultats</p>
          <h1 className="text-2xl font-bold mt-1">{d.code} — {d.designation}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{[d.secteur, d.pays].filter(Boolean).join(' · ')} · {profil.label}</p>
        </div>
        <div className="text-right text-[10px] text-gray-400">
          <p>Générée le {today}</p>
          <p className="mt-1 max-w-[180px]">Document informatif — ne constitue pas un conseil en investissement</p>
        </div>
      </div>

      {/* Instantané marché & valorisation */}
      <div className="grid grid-cols-4 gap-3 mb-5 text-sm">
        {([
          ['Cours', fcfa(d.price?.cours), d.price?.date ? `au ${d.price.date}` : ''],
          ['Capitalisation', md(d.price?.mcap), ''],
          ['P/E', d.ratios.per != null ? `${d.ratios.per.toFixed(1)}x` : '—', latest?.bpa ? `BPA ${fcfa(latest.bpa)}` : ''],
          ['Rendement div.', d.ratios.yieldPct != null ? `${d.ratios.yieldPct.toFixed(2)}%` : '—', lastDiv ? `${fcfa(lastDiv.montant)}` : ''],
        ] as [string, string, string][]).map(([l, v, sub]) => (
          <div key={l} className="border border-gray-200 rounded p-2.5">
            <p className="text-[10px] uppercase text-gray-500">{l}</p>
            <p className="text-base font-bold leading-tight mt-0.5">{v}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Bandeau cyclique pour l'agro */}
      {profil.cyclique && (
        <div className="border-l-4 border-orange-500 bg-orange-50 px-3 py-2 mb-5 text-xs text-gray-700">
          <b>Activité cyclique.</b> Le secteur agro-industriel est sensible aux campagnes et aux cours
          des matières premières : la performance d&apos;un exercice isolé n&apos;est pas représentative.
          Cette revue privilégie une <b>lecture pluriannuelle</b> (jusqu&apos;à 5 exercices) pour situer
          la société dans son cycle.
        </div>
      )}

      {/* Résultats */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1">
        Résultats {latest ? `· exercice ${latest.periode}` : ''}
      </h2>
      <table className="w-full text-sm mb-2">
        <thead>
          <tr className="text-[11px] text-gray-500 border-b border-gray-200">
            <th className="text-left font-medium py-1">Indicateur</th>
            <th className="text-right font-medium">{latest?.periode ?? '—'}</th>
            <th className="text-right font-medium">{prev?.periode ?? '—'}</th>
            <th className="text-right font-medium">Var.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-gray-100">
              <td className="py-1 text-gray-600">{r.label}</td>
              <td className="text-right font-semibold tabular-nums">{md(r.cur)}</td>
              <td className="text-right text-gray-500 tabular-nums">{md(r.prv)}</td>
              <td className="text-right tabular-nums">{yoy(r.cur, r.prv)}</td>
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
      <p className="text-[10px] text-gray-400 mb-4">Montants en FCFA. Source : états financiers publiés (extraction WESTBOURSE).</p>

      {/* Graphique financier pluriannuel */}
      {d.years.length >= 2 && (
        <div className="mb-5">
          <FinancialsBars data={d.years.map((y) => ({ periode: y.periode, revenu: y.revenu, resultatNet: y.resultatNet }))} />
          <p className="text-[10px] text-gray-400 text-center mt-1">
            CA (orange) et résultat net (gris){profil.cyclique ? ' sur plusieurs exercices — lecture du cycle' : ''}.
          </p>
        </div>
      )}

      {/* Activité — qualitatif des rapports */}
      {d.highlights && (d.highlights.synthese || d.highlights.items.length > 0) && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1">
            Activité — ce qui se passe dans l&apos;entreprise
          </h2>
          {d.highlights.synthese && <p className="text-sm text-gray-700 leading-relaxed mb-2">{d.highlights.synthese}</p>}
          <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-1">
            {d.highlights.items.map((it, i) => (
              <li key={i}><b>{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
            ))}
          </ul>
          {d.highlights.source_libelle && (
            <p className="text-[10px] text-gray-400 mb-4">
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
      <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1">
        Cours de bourse vs résultats & dividendes
      </h2>
      <PriceChart data={d.priceSeries} />
      <p className="text-[10px] text-gray-400 text-center mt-1 mb-3">
        Cours de clôture sur la période disponible. Source : brvm.org (via WESTBOURSE).
      </p>
      <div className="mb-2"><DividendBars data={d.dividends} /></div>
      <p className="text-sm text-gray-700 leading-relaxed mb-2">
        {lastDiv
          ? `Le dernier dividende connu (exercice ${lastDiv.exercice}) est de ${fcfa(lastDiv.montant)} par action, soit un rendement de ${d.ratios.yieldPct != null ? d.ratios.yieldPct.toFixed(2) + ' %' : '—'} au cours actuel${d.ratios.payout != null ? `, pour un taux de distribution d'environ ${d.ratios.payout.toFixed(0)} % du bénéfice` : ''}. Le détachement du dividende (à l'AGO) provoque mécaniquement une baisse technique du cours égale au coupon : l'actionnaire reçoit en cash ce que le cours perd, sans destruction de valeur. Sur la durée, la trajectoire du cours suit surtout la progression des résultats.`
          : "Aucun dividende récent connu en base pour cette valeur."}
      </p>

      {/* Avant la prochaine publication (earnings preview qualitatif) */}
      {d.years.length >= 2 && latest && prev && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1 mt-5">
            Avant la prochaine publication — à surveiller
          </h2>
          <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-1">
            <li>
              <b>Trajectoire récente</b> : chiffre d&apos;affaires {yoy(latest.revenu, prev.revenu)} et résultat net{' '}
              {yoy(latest.resultatNet, prev.resultatNet)} sur le dernier exercice connu ({latest.periode}).
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
            {d.highlights?.items.slice(0, 2).map((it, i) => (
              <li key={i}><b>{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-400 mb-4 italic">
            Repères qualitatifs dérivés de l&apos;historique réel — il ne s&apos;agit PAS d&apos;un consensus
            d&apos;analystes ni d&apos;une prévision chiffrée.
          </p>
        </>
      )}

      <p className="text-[10px] text-gray-400 mt-6 border-t pt-2 italic">
        Source : WESTBOURSE · {today}. Données dérivées de publications réelles (états financiers, rapports
        d&apos;activité, cours BRVM) — aucune valeur inventée. Les ordres s&apos;exécutent via une SGI agréée.
        Les performances passées ne préjugent pas des performances futures.
      </p>
    </div>
  );
}
