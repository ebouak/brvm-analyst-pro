import { notFound } from 'next/navigation';
import { getRevue, type YearRow } from '@/lib/reports/server';
import BoutonImprimer from '@/components/revue/BoutonImprimer';
import SousPageNav from '@/components/sousPage/SousPageNav';
import { PriceChart, FinancialsBars } from '@/components/reports/RevueCharts';
import CascadeResultat from '@/components/revue/CascadeResultat';
import { fmtFcfa, fmtNumber, fmtDateCourte } from '@/lib/format';
import { classeValeur } from '@/lib/fiche/prose';
import { reperesSurCourbe } from '@/lib/reports/reperes';
import { phraseDetachement } from '@/lib/reports/detachementRevue';
import { nomPays } from '@/lib/crm/geo';
import { perAffichable, distributionAffichable, evolutionResultat, evolutionResultatDetail, horsExploitation, syntheseExercice, dividendeCourant } from '@/lib/fiche/affichage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revue de résultats' };

interface Props { params: Promise<{ code: string }> }

// Une seule mise en forme des montants, unité adaptée (M sous 1 Md) : 4,3 M n'est jamais arrondi en « 0 Md ».
const moins = (s: string) => s.replace('-', '−'); // U+2212, comme le reste du site
const md = (n: number | null | undefined) => moins(fmtFcfa(n));
const fcfa = (n: number | null | undefined) =>
  n == null ? '—' : moins(`${fmtNumber(Math.round(n), 0)} FCFA`);
// BPA : deux décimales (même valeur que la fiche), jamais arrondi à l'entier.
const bpaTxt = (n: number | null | undefined) =>
  n == null ? '—' : moins(`${fmtNumber(n, 2)} FCFA`);
const nf1 = (x: number) => fmtNumber(x, 1);
const nf2 = (x: number) => fmtNumber(x, 2);
// Lignes de résultat : un pourcentage brut est trompeur quand un des exercices est une perte.
const EN_MOTS = new Set(["Résultat d'exploitation", 'Résultat avant impôt', 'Résultat net', 'BPA']);
const yoy = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || b === 0 ? '—' : `${a / b - 1 >= 0 ? '+' : '−'}${nf1(Math.abs((a / b - 1) * 100))} %`;

export default async function RevuePage(props: Props) {
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  const d = await getRevue(code).catch(() => null);
  if (!d) notFound();

  const { latest, prev, profil } = d;
  const today = new Date(d.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const reperes = reperesSurCourbe(d.priceSeries.map((p) => p.date), d.evenements);
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
  const signeMots = (v: number | null) => (v == null ? null : `${v >= 0 ? '+' : '−'}${nf1(Math.abs(v))} %`);

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

  const carte = 'rounded-card border border-border bg-surface p-2.5';
  const h2 = 'mb-2 border-b border-border pb-1 text-sm font-semibold text-ivory';

  return (
    // Surfaces et textes du thème (sombre et clair). À l'impression, le bloc @media print de
    // globals.css repasse fond blanc et texte noir, et .doc-impression redéfinit les jetons
    // lus par les graphiques SVG.
    <div className="doc-impression min-h-screen bg-bg font-sans text-ivory">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6 print:max-w-none print:px-0 print:py-2">
        <SousPageNav code={d.code} courant="Revue de résultats" />

        {/* En-tête */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-strong pb-3">
          <div>
            <h1 className="font-display text-2xl text-ivory">Revue de résultats · {d.designation}</h1>
            <p className="mt-0.5 text-sm text-muted">{[d.code, d.secteur, d.pays ? nomPays(d.pays) : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="space-y-2 text-right text-xs text-muted">
            <p>Générée le {today}</p>
            <p className="ml-auto max-w-[220px]">Document informatif : ne constitue pas un conseil en investissement</p>
            <BoutonImprimer />
          </div>
        </div>

        {/* Instantané marché & valorisation */}
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {([
            ['Cours', fcfa(d.price?.cours), d.price?.date ? `au ${fmtDateCourte(d.price.date)}` : ''],
            ['Capitalisation', md(d.price?.mcap), ''],
            ['P/E', per.valeur != null ? `${nf1(per.valeur)}x` : (per.motif ?? 'non calculable'), per.valeur != null && latest?.bpa ? `BPA ${bpaTxt(latest.bpa)}` : ''],
            ['Rendement du dividende', rendementDiv != null ? `${nf2(rendementDiv)} %` : '—', divCourant ? `${fcfa(divCourant.montant)} · ex. ${divCourant.exercice}` : ''],
          ] as [string, string, string][]).map(([l, v, sub]) => (
            <div key={l} className={carte}>
              <p className="text-xs text-muted">{l}</p>
              <p className={`${classeValeur(v)} mt-0.5 text-base font-semibold leading-tight text-ivory`}>{v}</p>
              {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Bandeau cyclique pour l'agro */}
        {profil.cyclique && (
          <div className="rounded-card border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-ivory">
            <b>Activité cyclique.</b> Le secteur agro-industriel est sensible aux campagnes et aux cours
            des matières premières : la performance d&apos;un exercice isolé n&apos;est pas représentative.
            Cette revue privilégie une <b>lecture pluriannuelle</b> (jusqu&apos;à 5 exercices) pour situer
            la société dans son cycle.
          </div>
        )}

        {/* Synthèse de l'exercice : une phrase construite sur quatre chiffres affichés plus bas */}
        {latest && (phrase || latest.revenu != null) && (
          <div>
            {phrase && <p className="mb-3 text-base font-semibold leading-snug text-ivory">{phrase}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {([
                ["Chiffre d'affaires", md(latest.revenu), signeMots(croissanceCa) ? `${signeMots(croissanceCa)} sur un an` : ''],
                ["Résultat d'exploitation", md(latest.resultatExploitation), prev?.resultatExploitation != null ? `${prev.periode} : ${md(prev.resultatExploitation)}` : ''],
                ['Résultat net', md(latest.resultatNet), evolutionRn ?? ''],
                ['Capitaux propres', md(latest.capitauxPropres), signeMots(variationCp) ? `${signeMots(variationCp)} sur un an` : ''],
              ] as [string, string, string][]).map(([l, v, sub]) => (
                <div key={l} className={carte}>
                  <p className="text-xs text-muted">{l}</p>
                  <p className={`${classeValeur(v)} mt-0.5 text-base font-semibold leading-tight text-ivory`}>{v}</p>
                  {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
                </div>
              ))}
            </div>
            {latest.resultatExploitation != null && horsExpl != null && latest.resultatAvantImpot != null && latest.impots != null && latest.resultatNet != null && (
              <div className="mt-4">
                <p className="mb-1 text-xs text-muted">Du résultat d&apos;exploitation au résultat net, exercice {latest.periode}.</p>
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
        <div>
          <h2 className={h2}>
            Résultats {latest ? `· exercice ${latest.periode}` : ''}
          </h2>
          <div className="overflow-x-auto">
            <table className="mb-2 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-1 text-left font-medium">Indicateur</th>
                  <th className="text-right font-medium">{latest?.periode ?? '—'}</th>
                  <th className="text-right font-medium">{prev?.periode ?? '—'}</th>
                  <th className="text-right font-medium">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-border/40">
                    <td className="py-1 text-muted">{r.label}</td>
                    <td className="tabular text-right font-semibold text-ivory">{md(r.cur)}</td>
                    <td className="tabular text-right text-muted">{md(r.prv)}</td>
                    <td className={`${classeValeur(EN_MOTS.has(r.label) ? (evolutionResultat(r.cur, r.prv) ?? '—') : yoy(r.cur, r.prv))} text-right text-ivory`}>{EN_MOTS.has(r.label) ? (evolutionResultat(r.cur, r.prv) ?? '—') : yoy(r.cur, r.prv)}</td>
                  </tr>
                ))}
                <tr className="border-b border-border/40">
                  <td className="py-1 text-muted">BPA</td>
                  <td className="tabular text-right font-semibold text-ivory">{bpaTxt(latest?.bpa)}</td>
                  <td className="tabular text-right text-muted">{bpaTxt(prev?.bpa)}</td>
                  <td className={`${classeValeur(evolutionResultat(latest?.bpa ?? null, prev?.bpa ?? null) ?? '—')} text-right text-ivory`}>{evolutionResultat(latest?.bpa ?? null, prev?.bpa ?? null) ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mb-4 text-xs text-muted">Montants en FCFA. Source : états financiers publiés (extraction WESTBOURSE).</p>
        </div>

        {d.years.length >= 2 && (
          <div>
            <h2 className={h2}>
              {Math.min(d.years.length, 5)} derniers exercices
            </h2>
            <div className="overflow-x-auto">
              <table className="mb-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-1 text-left font-medium">Exercice</th>
                    <th className="text-right font-medium">Chiffre d&apos;affaires</th>
                    <th className="text-right font-medium">Résultat d&apos;exploitation</th>
                    <th className="text-right font-medium">Résultat net</th>
                    <th className="text-right font-medium">BPA</th>
                  </tr>
                </thead>
                <tbody>
                  {d.years.slice(0, 5).map((y) => (
                    <tr key={y.periode} className="border-b border-border/40">
                      <td className="py-1 text-muted">{y.periode}</td>
                      <td className="tabular text-right text-ivory">{md(y.revenu)}</td>
                      <td className="tabular text-right text-ivory">{md(y.resultatExploitation)}</td>
                      <td className="tabular text-right font-semibold text-ivory">{md(y.resultatNet)}</td>
                      <td className="tabular text-right text-ivory">{bpaTxt(y.bpa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {comptesEnRetard && latest && (
              <p className="-mt-2 mb-4 text-xs text-warn">
                Derniers comptes disponibles : exercice {latest.periode}. Aucun compte plus récent ne figure dans
                les publications officielles de la société ; le P/E rapporte donc le cours du jour à un bénéfice
                de {latest.periode}.
              </p>
            )}
          </div>
        )}

        {/* Graphique financier pluriannuel */}
        {d.years.length >= 2 && (
          <div>
            <FinancialsBars data={d.years.map((y) => ({ periode: y.periode, revenu: y.revenu, resultatNet: y.resultatNet }))} />
            <p className="mt-1 text-center text-xs text-muted">
              Chiffre d&apos;affaires (cyan) et résultat net (gris){profil.cyclique ? ' sur plusieurs exercices · lecture du cycle' : ''}.
            </p>
          </div>
        )}

        {/* Activité — qualitatif des rapports */}
        {d.highlights && (d.highlights.synthese || d.highlights.items.length > 0) && (
          <div>
            <h2 className={h2}>
              {hlAncien
                ? `Activité · dernier rapport disponible (exercice ${d.highlights.exercice})`
                : <>Activité · ce qui se passe dans l&apos;entreprise</>}
            </h2>
            {hlAncien && latest && (
              <p className="mb-2 text-xs text-warn">
                Ce rapport porte sur l&apos;exercice {d.highlights.exercice}, antérieur aux comptes {latest.periode} présentés
                ci-dessus : aucun rapport d&apos;activité plus récent n&apos;est disponible pour cette valeur.
              </p>
            )}
            {d.highlights.synthese && <p className="mb-2 text-sm leading-relaxed text-muted">{d.highlights.synthese}</p>}
            <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {d.highlights.items.map((it, i) => (
                <li key={i}><b className="text-ivory">{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
              ))}
            </ul>
            {d.highlights.source_libelle && (
              <p className="mb-4 text-xs text-muted">
                Source :{' '}
                {d.highlights.source_url ? (
                  <a href={d.highlights.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">
                    {d.highlights.source_libelle}
                  </a>
                ) : d.highlights.source_libelle}
                {' '}(document publié à la BRVM).
              </p>
            )}
          </div>
        )}

        {/* Cours vs résultats & dividendes */}
        <div>
          <h2 className={h2}>
            Cours de bourse, résultats et dividendes
          </h2>
          <PriceChart data={d.priceSeries} reperes={reperes} />
          <p className="mb-3 mt-1 text-center text-xs text-muted">
            Cours de clôture sur la période disponible.
            {reperes.length > 0 && ' Traits au pied du graphique : R, publication des états financiers (trait plein) ; D, détachement du dividende (trait pointillé).'}
            {' '}Source : brvm.org (via WESTBOURSE).
          </p>
          <p className="mb-2 text-sm leading-relaxed text-muted">
            {divCourant
              ? `Dernier versement connu : ${fcfa(divCourant.montant)} par action, au titre de l'exercice ${divCourant.exercice}${divCourant.ancien ? `, soit plus d'un exercice avant le dernier exercice publié (${latest?.periode}) : ce dividende n'est pas un point d'appui pour l'avenir` : ''}. Rendement au cours actuel : ${rendementDiv != null ? nf2(rendementDiv) + ' %' : '—'} (exercice ${divCourant.exercice}). Taux de distribution : ${distribution.valeur != null ? `environ ${fmtNumber(distribution.valeur, 0)} % du bénéfice` : distribution.motif}.`
              : 'Aucun dividende récent enregistré pour cette valeur.'}
          </p>
          {d.detachement && <p className="mb-2 text-sm leading-relaxed text-muted">{phraseDetachement(d.detachement)}</p>}
        </div>

        {/* Avant la prochaine publication (earnings preview qualitatif) */}
        {d.years.length >= 2 && latest && prev && (
          <div>
            <h2 className={h2}>
              À suivre · avant la prochaine publication
            </h2>
            <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                <b className="text-ivory">Trajectoire récente</b> : chiffre d&apos;affaires {yoy(latest.revenu, prev.revenu)} et résultat net{' '}
                ({evolutionRn ?? '—'}) sur le dernier exercice connu ({latest.periode}).
                {' '}À publication, vérifier si cette tendance se poursuit ou s&apos;inverse.
              </li>
              {d.dividends.length >= 2 && (
                <li>
                  <b className="text-ivory">Dividende</b> : sur les derniers exercices connus, il s&apos;est situé entre{' '}
                  {fcfa(Math.min(...d.dividends.map((x) => x.montant)))} et {fcfa(Math.max(...d.dividends.map((x) => x.montant)))}.
                  {' '}Repère, à confirmer par l&apos;affectation du résultat (pas une prévision).
                </li>
              )}
              {d.profil.cyclique && (
                <li><b className="text-ivory">Activité cyclique</b> : surveiller la position dans le cycle (campagne, cours des matières premières) plutôt que le seul exercice.</li>
              )}
              {!hlAncien && d.highlights?.items.slice(0, 2).map((it, i) => (
                <li key={i}><b className="text-ivory">{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
              ))}
            </ul>
            <p className="mb-4 text-xs italic text-muted">
              Repères qualitatifs dérivés de l&apos;historique réel : il ne s&apos;agit pas d&apos;un consensus
              d&apos;analystes ni d&apos;une prévision chiffrée.
            </p>
          </div>
        )}

        <p className="mt-6 border-t border-border pt-2 text-xs italic text-muted">
          Source : WESTBOURSE · {today}. Données dérivées de publications réelles (états financiers, rapports
          d&apos;activité, cours BRVM), aucune valeur inventée. Les ordres s&apos;exécutent via une SGI agréée.
          Les performances passées ne préjugent pas des performances futures.
        </p>
      </div>
    </div>
  );
}
