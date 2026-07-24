import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { computeValuation, VERDICT_LABELS, VERDICT_COLORS } from '@/lib/financials/valuation';
import WeekRange52 from '@/components/financials/WeekRange52';
import FundamentalAnalysis from '@/components/financials/FundamentalAnalysis';
import FundamentalsCharts, { type FundaChartPoint } from '@/components/financials/FundamentalsCharts';
import ChartBuilder from '@/components/financials/ChartBuilder';
import PasseportPopover from '@/components/provenance/PasseportPopover';
import { buildPassport } from '@/lib/provenance/passport';
import { loadProvenance } from '@/lib/provenance/queries';
import { buildChartRows } from '@/lib/financials/chartBuilder';
import BankScorecard from '@/components/financials/BankScorecard';
import ValueTrapBadge from '@/components/fundamentals/ValueTrapBadge';
import { assessValueTrap } from '@/lib/fundamentals/valueTrap';
import { extractBankYear, computeBankKpis, scoreBanqueUemoa } from '@/lib/bank/kpis';
import FinancialTabs from '@/components/financials/FinancialTabs';
import ExportBar from '@/components/financials/ExportBar';
import { canAccess } from '@/lib/server/featureAccess';
import { SectionLock } from '@/components/premium/SectionLock';

const lockLevel = (required: string): 'premium' | 'pro' | 'disabled' =>
  required === 'pro' ? 'pro' : required === 'disabled' ? 'disabled' : 'premium';

interface Props {
  params: { code: string };
}

export default async function FinancialsPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const data = await loadCompanyFinancials(code);
  if (!data) notFound();

  // Provenance du dernier exercice publié — celui qu'affichent les cartes de tête.
  const provenance = await loadProvenance(code);
  const periodeAffichee = data.incomeStatements[0]?.periode ?? null;
  const pubsById = new Map(data.publications.map((p) => [p.id, p]));
  const provIncome = periodeAffichee
    ? provenance.get(`${periodeAffichee}|income_statements`) ?? null
    : null;
  const passeport = buildPassport(
    provIncome,
    provIncome?.publication_id ? pubsById.get(provIncome.publication_id) ?? null : null,
    data.cashFlowStatements.find((c) => c.periode === periodeAffichee) ?? null,
  );


  const latestIncome = data.incomeStatements[0] ?? null;
  const prevIncome = data.incomeStatements[1] ?? null;
  const latestBalance = data.balanceSheets[0] ?? null;
  const latestCashflow = data.cashFlowStatements[0] ?? null;

  // NB : les lignes sectorielles (PNB, primes, dépôts, provisions…) ne sont plus
  // affichées dans un encadré séparé — elles sont désormais intégrées AU BON
  // ENDROIT de la cascade du compte de résultat et du bilan (statementRows.ts).

  const ratios = calculateFundamentals({
    coursActuel: data.latestDaily?.cours_jour ?? null,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: latestIncome,
    incomePrev: prevIncome,
    balance: latestBalance,
    cashflow: latestCashflow,
  });

  const valuation = computeValuation(
    ratios,
    data.latestDaily?.cours_jour ?? null,
    latestCashflow?.flux_tresorerie_disponible ?? null,
    data.instrument.shares,
  );

  // Analyse bancaire UEMOA : postes spécifiques (prêts, dépôts, marge
  // d'intérêts…) + score /100 — uniquement pour la famille banque.
  const bankAnalysis = (() => {
    if (data.instrument.famille_comptable !== 'banque') return null;
    const cur = extractBankYear(latestIncome, latestBalance);
    if (!cur) return null;
    const prev = extractBankYear(prevIncome, data.balanceSheets[1] ?? null);
    const kpis = computeBankKpis(cur, prev, {
      cours: data.latestDaily?.cours_jour ?? null,
      shares: data.instrument.shares,
      dividendeParAction: latestIncome?.dividende_par_action ?? null,
    });
    return { kpis, score: scoreBanqueUemoa(kpis), periode: latestIncome?.periode ?? null };
  })();

  // Alerte value trap : PER (ratios) croisé avec la trajectoire du résultat net.
  const trap = assessValueTrap({
    per: ratios.per,
    netIncomeSeries: [...data.incomeStatements]
      .sort((a, b) => a.periode.localeCompare(b.periode))
      .map((s) => s.resultat_net),
  });

  // Gating premium — aligné sur la fiche action : l'analyse fondamentale (ratios,
  // graphiques, analyse bancaire, value trap) suit le flag `fondamentaux`, la
  // valorisation (Graham/DCF/score) suit `dcf`. Les ÉTATS FINANCIERS BRUTS
  // restent publics (SEO/GEO). Éditable dans /admin/features sans redéploiement.
  const [gateFonda, gateValo] = await Promise.all([canAccess('fondamentaux'), canAccess('dcf')]);

  const isBank = data.instrument.famille_comptable === 'banque';
  const revenuLabel = isBank ? 'PNB' : data.instrument.famille_comptable === 'assurance' ? 'Primes' : 'CA';

  // Points du graphique : croisement compte de résultat + bilan par période.
  const balanceByPeriode = new Map(data.balanceSheets.map((b) => [b.periode, b]));
  const chartPoints: FundaChartPoint[] = data.incomeStatements.map((s) => {
    const bal = balanceByPeriode.get(s.periode);
    return {
      periode: s.periode,
      revenu: s.revenu_total,
      net: s.resultat_net,
      bpa: s.benefice_par_action,
      dividende: s.dividende_par_action,
      credits: bal?.lignes_specifiques?.credits_clientele ?? null,
      depots: bal?.lignes_specifiques?.depots_clientele ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/actions" className="text-muted hover:text-white transition-colors">Marché</Link>
          <span className="text-faint">/</span>
          <Link href={`/actions/${code}`} className="text-muted hover:text-white transition-colors">{code}</Link>
          <span className="text-faint">/</span>
          <span className="text-white">Données financières</span>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">{code}</h1>
            {data.instrument.designation && (
              <p className="text-sm text-muted">{data.instrument.designation}</p>
            )}
            {data.instrument.secteur && (
              <p className="text-xs text-faint">{data.instrument.secteur}</p>
            )}
            {data.instrument.famille_comptable !== 'general' && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-info/10 text-info border border-info/20 font-medium">
                {data.instrument.famille_comptable === 'banque' ? 'Banque' : 'Assurance'}
              </span>
            )}
          </div>
          {/* Export (Excel/PDF) : embarque ratios + analyse bancaire → premium.
              Non rendu pour un gratuit (sinon la donnée premium fuit par le fichier). */}
          {gateFonda.allowed && (
            <ExportBar
              code={code}
              designation={data.instrument.designation}
              secteur={data.instrument.secteur}
              ratios={ratios}
              incomeStatements={data.incomeStatements}
              balanceSheets={data.balanceSheets}
              cashFlowStatements={data.cashFlowStatements}
              bank={bankAnalysis}
            />
          )}
        </div>

        {/* Panneau valorisation — premium (flag dcf) */}
        {!gateValo.allowed ? (
          <SectionLock required={lockLevel(gateValo.required)} titre="Valorisation (Graham, DCF, score)" pitch="Juste prix, marge de sécurité et score de valorisation." />
        ) : (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted uppercase tracking-wide">Valorisation</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${VERDICT_COLORS[valuation.verdict]}`}>
              {VERDICT_LABELS[valuation.verdict]}
            </span>
          </div>
          {valuation.grahamNumber !== null && (
            <div className="text-xs text-muted">
              Graham : <span className="tabular text-ivory font-medium">{Math.round(valuation.grahamNumber).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {valuation.dcfValue != null && (
            <div className="text-xs text-muted">
              DCF estimé : <span className="tabular text-ivory font-medium">{Math.round(valuation.dcfValue).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {valuation.marginOfSafety !== null && (
            <div className="text-xs text-muted">
              Marge sécurité : <span className={`tabular font-medium ${valuation.marginOfSafety >= 0 ? 'text-up' : 'text-down'}`}>
                {valuation.marginOfSafety >= 0 ? '+' : ''}{valuation.marginOfSafety.toFixed(1)}%
              </span>
            </div>
          )}
          {valuation.scoreValorisation !== null && (
            <div className="text-xs text-muted">
              Score : <span className="tabular text-ivory font-medium">{Math.round(valuation.scoreValorisation)}/100</span>
            </div>
          )}
          {valuation.verdict === 'inconnu' && (
            <p className="text-xs text-faint">BPA, PB ou FCF manquants pour calculer la valorisation.</p>
          )}
        </div>
        )}

        {/* 52-week range */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <WeekRange52
            bas={ratios.cours_bas_52s}
            haut={ratios.cours_haut_52s}
            actuel={ratios.cours_actuel}
          />
        </div>

        {/* ── Analyse fondamentale (premium, flag `fondamentaux`) ──
            Ratios, value trap, analyse bancaire et graphiques : réservés.
            Un anonyme/gratuit voit un cadenas, pas les valeurs (vrai verrou). */}
        {!gateFonda.allowed ? (
          <SectionLock
            required={lockLevel(gateFonda.required)}
            titre="Analyse fondamentale"
            pitch="Ratios (PER, ROE, marge…), détection de value trap, graphiques pluriannuels"
          />
        ) : (
          <>
            {/* Analyse bancaire UEMOA (banques uniquement) */}
            {bankAnalysis && (
              <div>
                <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">Analyse bancaire UEMOA</p>
                <BankScorecard kpis={bankAnalysis.kpis} score={bankAnalysis.score} periode={bankAnalysis.periode} />
              </div>
            )}

            {/* Alerte value trap (PER vs trajectoire des bénéfices) */}
            <ValueTrapBadge result={trap} />

            {/* Ratios fondamentaux */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <p className="text-xs text-muted uppercase tracking-widest">Ratios fondamentaux</p>
                {periodeAffichee && (
                  <PasseportPopover passeport={passeport} titre={`Exercice ${periodeAffichee}`} />
                )}
              </div>
              <FundamentalAnalysis ratios={ratios} famille={data.instrument.famille_comptable} />
            </div>

            {/* Analyse graphique pluriannuelle */}
            {chartPoints.length >= 2 && (
              <div>
                <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">Analyse graphique</p>
                <FundamentalsCharts points={chartPoints} revenuLabel={revenuLabel} isBank={isBank} />
              </div>
            )}

            {/* Constructeur de graphique — séries au choix, axes automatiques.
                En-tête de section comme les blocs voisins : sans lui, le bloc se
                fondait dans la page et passait inaperçu. */}
            {data.incomeStatements.length >= 2 && (
              <div>
                <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">
                  Graphique personnalisé
                </p>
                <ChartBuilder rows={buildChartRows(data.incomeStatements, data.balanceSheets, data.cashFlowStatements)} />
              </div>
            )}
          </>
        )}

        {/* Financial statement tabs */}
        <div id="etats">
          <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">États financiers</p>
          <div className="bg-surface border border-border rounded-xl p-5">
            <FinancialTabs
              incomeStatements={data.incomeStatements}
              balanceSheets={data.balanceSheets}
              cashFlowStatements={data.cashFlowStatements}
              famille={data.instrument.famille_comptable}
            />
          </div>
        </div>

        {/* Publications disponibles — fallback si données absentes */}
        {data.incomeStatements.length === 0 && data.publications.length > 0 && (
          <div className="bg-surface border border-warn/30 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-warn">📄 Données financières non importées</p>
                <p className="text-xs text-muted mt-1">
                  {data.publications.length} publication{data.publications.length > 1 ? 's' : ''} disponible{data.publications.length > 1 ? 's' : ''} pour {code}.
                  Importez-les via l&apos;IA pour remplir automatiquement les états financiers.
                </p>
              </div>
              <a
                href={`/admin/import-fondamentaux?code=${code}`}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-up text-bg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
              >
                Importer via IA →
              </a>
            </div>
            <div className="divide-y divide-border/40">
              {data.publications.map((pub) => (
                <div key={pub.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">{pub.libelle ?? pub.type_publication ?? 'Publication'}</p>
                    <p className="text-xs text-muted">{new Date(pub.date_publication).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {pub.source_url && (
                    <a
                      href={pub.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-up hover:underline shrink-0"
                    >
                      Voir le PDF ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aucune donnée du tout */}
        {data.incomeStatements.length === 0 && data.publications.length === 0 && (
          <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-3">
            <p className="text-muted text-sm">Aucune donnée financière ni publication disponible pour {code}.</p>
            <a
              href={`/admin/import-fondamentaux?code=${code}`}
              className="inline-block px-4 py-2 rounded-lg bg-up text-bg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
            >
              Importer via IA
            </a>
          </div>
        )}

        {/* Publications d'états financiers + résumé chiffres clés */}
        {data.publications.filter((p) => p.type_publication === 'etats_financiers').length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Publications — états financiers</h2>
            <ul className="space-y-2">
              {data.publications.filter((p) => p.type_publication === 'etats_financiers').map((p) => {
                const an = (p.libelle ?? '').match(/[Ee]xercice\s+(20\d{2})/)?.[1] ?? null;
                const inc = an ? data.incomeStatements.find((s) => s.periode === an) : undefined;
                return (
                  <li key={p.id} className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted">{p.libelle}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {inc && <a href="#etats" className="text-xs text-up hover:underline">Voir les états →</a>}
                        {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-info hover:underline">PDF</a>}
                      </div>
                    </div>
                    {inc && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-faint tabular">
                        <span>CA&nbsp;: {inc.revenu_total != null ? (inc.revenu_total / 1e9).toFixed(1) + ' Md' : 'N/D'}</span>
                        <span>RN&nbsp;: {inc.resultat_net != null ? (inc.resultat_net / 1e9).toFixed(1) + ' Md' : 'N/D'}</span>
                        <span>BPA&nbsp;: {inc.benefice_par_action ?? 'N/D'}</span>
                        <span>Div&nbsp;: {inc.dividende_par_action ?? 'N/D'}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Lien vers le diagnostic Premium */}
        <div className="bg-surface border border-warn/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-warn">✦ Diagnostic financier &amp; économique</p>
            <p className="text-xs text-muted mt-0.5">
              Analyse générée automatiquement à partir des états financiers publiés — vérifiée par
              nos garde-fous de plausibilité. Réservée aux membres Premium.
            </p>
          </div>
          <Link
            href={`/premium/diagnostic/${code}`}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-warn/10 border border-warn/30 text-warn text-xs font-semibold hover:bg-warn/20 transition-all"
          >
            Voir le diagnostic →
          </Link>
        </div>

      </div>
    </div>
  );
}
