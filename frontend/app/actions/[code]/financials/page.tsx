import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fmtDateCourte, fmtFcfa, fmtNumber } from '@/lib/format';
import RatioCard from '@/components/fundamentals/RatioCard';
import FluxComptable from '@/components/fiche/FluxComptable';
import { fluxCompteResultat, fluxBilan, type FluxCR, type FluxBilan } from '@/lib/fiche/flux';
import { formatRendementDividende, perAffichable, distributionAffichable, evolutionResultat, dividendeCourant, titrePublication } from '@/lib/fiche/affichage';
import { avecBpaCalcule, croissanceRnSignee, libelleValorisationSimplifiee, valorisationSimplifieeCalculable } from '@/lib/fiche/financialsAffichage';
import SousPageNav from '@/components/sousPage/SousPageNav';
import { plage52Semaines } from '@/lib/fiche/plages';
import { exerciceRetenu, mentionSecondJeu } from '@/lib/fiche/exerciceRetenu';
import { ratiosBilan } from '@/lib/fiche/ratiosBilan';
import { comptesIfrs } from '@/lib/fiche/comptesIfrs';
import { chargerComptesIfrs } from '@/lib/fiche/comptesIfrsServeur';
import ComptesIfrs from '@/components/fiche/ComptesIfrs';
import { capitalisationFcfa } from '@/lib/fiche/capitalisation';
import { formatXOF, formatPct, formatRatio, formatGrowth } from '@/lib/financials/formatters';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { computeValuation, VERDICT_LABELS } from '@/lib/financials/valuation';
import WeekRange52 from '@/components/financials/WeekRange52';
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
import { libelleAbsence, serieRetenue, dateArrete, type ObsIndicateur } from '@/lib/bank/prudentiel';
import { createClient } from '@/lib/supabase/server';
import FinancialTabs from '@/components/financials/FinancialTabs';
import ExportBar from '@/components/financials/ExportBar';
import { canAccess } from '@/lib/server/featureAccess';
import { SectionLock } from '@/components/premium/SectionLock';

const lockLevel = (required: string): 'premium' | 'pro' | 'disabled' =>
  required === 'pro' ? 'pro' : required === 'disabled' ? 'disabled' : 'premium';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function FinancialsPage(props: Props) {
  const params = await props.params;
  const code = params.code.toUpperCase();
  const brut = await loadCompanyFinancials(code);
  if (!brut) notFound();
  // BPA : même source que la fiche (résultat net ÷ nombre de titres), pour tous les exercices affichés.
  const data = { ...brut, incomeStatements: avecBpaCalcule(brut.incomeStatements, brut.instrument.shares) };

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

  // Comptes retenus : SYSCOHADA (income/balance), source unique des ratios publics. `fundamentals` ne sert qu'au repli et à signaler un second jeu.
  const { data: fondaTousRows } = await createClient().from('fundamentals').select('year, revenue, net_income, equity, debt').eq('code', code);
  const fondaTous = (fondaTousRows ?? []) as { year: number; revenue: number | null; net_income: number | null; equity: number | null; debt: number | null }[];
  const retenu = exerciceRetenu({ income: data.incomeStatements, balance: data.balanceSheets, fundamentals: fondaTous });
  const coursRef = data.latestDaily?.cours_jour ?? null;
  const rb = ratiosBilan({
    cours: coursRef, titres: data.instrument.shares,
    resultatNet: retenu.resultatNet, chiffreAffaires: retenu.chiffreAffaires,
    capitauxPropres: retenu.capitauxPropres, detteFinanciere: retenu.detteFinanciere,
    capitalisation: capitalisationFcfa({ valorisation: data.latestDaily?.valorisation, cours: coursRef, titres: data.instrument.shares }),
  });
  const mentionJeu = mentionSecondJeu(retenu.secondJeu);
  // Comptes IFRS du même exercice, s'ils sont publiés : en regard, jamais à la place des SYSCOHADA.
  const comparatifIfrs = retenu.source === 'syscohada'
    ? comptesIfrs({
      ligne: await chargerComptesIfrs(createClient(), code, retenu.exercice),
      exercice: retenu.exercice,
      syscohada: { resultatNet: retenu.resultatNet, chiffreAffaires: retenu.chiffreAffaires, capitauxPropres: retenu.capitauxPropres, detteFinanciere: retenu.detteFinanciere },
      cours: coursRef, titres: data.instrument.shares, capitalisation: rb.capitalisation,
    })
    : null;

  const ratiosBase = calculateFundamentals({
    coursActuel: data.latestDaily?.cours_jour ?? null,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: latestIncome,
    incomePrev: prevIncome,
    balance: latestBalance,
    cashflow: latestCashflow,
  });

  // Plage 52 semaines : fenêtre de 365 jours calendaires inclusive (source unique de la fiche).
  const plage52 = plage52Semaines(data.serieCours, ratiosBase.cours_actuel);
  const ratios = {
    ...ratiosBase,
    cours_bas_52s: plage52?.bas ?? null, cours_haut_52s: plage52?.haut ?? null,
    // Ratios publics : un seul calcul, sur les comptes retenus (voir ratiosBilan).
    capitalisation: rb.capitalisation, bpa: rb.bpa.valeur, per: rb.per.valeur, pb: rb.pb, ps: rb.ps,
    roe: rb.roe != null ? rb.roe * 100 : null, marge_nette: rb.margeNette != null ? rb.margeNette * 100 : null,
    dette_sur_capitaux_propres: rb.gearing,
  };

  const valuation = computeValuation(
    ratios,
    data.latestDaily?.cours_jour ?? null,
    latestCashflow?.flux_tresorerie_disponible ?? null,
    data.instrument.shares,
  );

  // Dette financière : somme court + long terme du bilan si les deux existent, sinon la
  // valeur extraite dans `fundamentals` pour le MÊME exercice. Fonds propres : idem.
  // Dette financière par exercice pour la vue en flux du bilan (repli sur la dette déclarée de `fundamentals`).
  const detteFonda = new Map(fondaTous.map((r) => [r.year, r.debt]));
  // Dividendes : même requête que la fiche (tri par exercice, lignes sans exercice en dernier).
  const { data: divRowsBrut } = await createClient().from('dividends').select('montant, ex_date, payment_date, exercice')
    .eq('code', code).order('exercice', { ascending: false, nullsFirst: false }).limit(6);
  const gearing = rb.gearing;

  // PER et distribution : une perte s'explique, elle ne devient pas « non disponible ».
  const rnDernier = latestIncome?.resultat_net ?? null;
  const per = perAffichable(ratios.per, ratios.bpa ?? (rnDernier != null && rnDernier <= 0 ? rnDernier : null));
  const distribution = distributionAffichable(ratios.payout, rnDernier);
  const valoCalculable = valorisationSimplifieeCalculable(ratios.bpa ?? (rnDernier != null && rnDernier <= 0 ? rnDernier : null), ratios.per);
  const evolutionRn = evolutionResultat(rnDernier, prevIncome?.resultat_net ?? null);
  const alertePerte = rnDernier != null && rnDernier < 0 && latestIncome
    ? `Exercice ${latestIncome.periode} en perte : résultat net de ${fmtFcfa(rnDernier)}${evolutionRn ? ` (${evolutionRn})` : ''}. PER et taux de distribution sont sans objet.`
    : null;

  // Flux du compte de résultat, un par exercice annuel ; null si un poste manque.
  const fluxParExercice: Record<number, FluxCR | null> = {};
  for (const st of data.incomeStatements) {
    if (st.type_periode !== 'annuel') continue;
    const y = Number(String(st.periode).slice(0, 4));
    if (!Number.isFinite(y)) continue;
    fluxParExercice[y] = fluxCompteResultat({
      chiffreAffaires: st.revenu_total, resultatExploitation: st.resultat_exploitation,
      resultatAvantImpot: st.resultat_avant_impots, resultatNet: st.resultat_net,
    });
  }
  // Flux du bilan : dette = court + long terme si les deux existent, sinon la valeur extraite du même exercice.
  const bilanParExercice: Record<number, FluxBilan | null> = {};
  for (const bs of data.balanceSheets) {
    if (bs.type_periode !== 'annuel') continue;
    const y = Number(String(bs.periode).slice(0, 4));
    if (!Number.isFinite(y)) continue;
    const dette = bs.dette_court_terme != null && bs.dette_long_terme != null
      ? bs.dette_court_terme + bs.dette_long_terme : detteFonda.get(y) ?? null;
    bilanParExercice[y] = fluxBilan({ totalActif: bs.total_actifs, capitauxPropres: bs.total_capitaux_propres, detteFinanciere: dette });
  }
  const exercicesFlux = Array.from(new Set([...Object.keys(fluxParExercice), ...Object.keys(bilanParExercice)].map(Number)));

  // Rendement du dividende : même source que la fiche (dernier dividende versé > 0 et son exercice).
  const exerciceDernier = latestIncome?.periode ? Number(String(latestIncome.periode).slice(0, 4)) : null;
  const divCourant = dividendeCourant(
    ((divRowsBrut ?? []) as { montant: number; exercice: number | null; ex_date: string | null; payment_date: string | null }[]),
    exerciceDernier != null && Number.isFinite(exerciceDernier) ? exerciceDernier : null,
  );
  const coursDiv = data.latestDaily?.cours_jour ?? null;
  const rendementDiv = divCourant && coursDiv != null && coursDiv > 0 ? (divCourant.montant / coursDiv) * 100 : null;

  // Pourquoi la solvabilité manque, s'il manque : ce que disent les documents
  // consultés pour l'exercice du bilan affiché (indicateur_source, lecture publique).
  const obsPrudentielles: ObsIndicateur[] = data.instrument.famille_comptable === 'banque'
    ? ((await createClient().from('indicateur_source')
        .select('indicateur,date_arrete,statut,motif,comparateur,valeur')
        .eq('code', code).in('indicateur', ['solvabilite_total', 'taux_creances_souffrance', 'couverture_creances_souffrance'])).data ?? []) as ObsIndicateur[]
    : [];
  const obsDe = (indicateur: string) => obsPrudentielles.filter((o) => o.indicateur === indicateur);
  // Taux publiés pour l'exercice du bilan affiché — jamais celui d'un exercice voisin.
  const anneeBilan = dateArrete(latestBalance?.periode)?.slice(0, 4) ?? null;
  const tauxPublie = (indicateur: string) =>
    serieRetenue(obsPrudentielles, indicateur).find((p) => p.annee === anneeBilan)?.valeur ?? null;

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
    return {
      kpis,
      score: scoreBanqueUemoa(kpis),
      periode: latestIncome?.periode ?? null,
      absences: { solvabilite: kpis.ratioSolvabilite == null ? libelleAbsence(obsDe('solvabilite_total'), latestBalance?.periode) : null },
      qualite: (() => {
        const taux = tauxPublie('taux_creances_souffrance');
        const couverture = tauxPublie('couverture_creances_souffrance');
        return {
          taux,
          tauxAbsence: taux == null ? libelleAbsence(obsDe('taux_creances_souffrance'), latestBalance?.periode) : null,
          couverture,
          couvertureAbsence: couverture == null ? libelleAbsence(obsDe('couverture_creances_souffrance'), latestBalance?.periode) : null,
        };
      })(),
    };
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

  // Trois cartes de ratios ; chaque ligne porte sa formule.
  type LigneRatio = React.ComponentProps<typeof RatioCard>;
  const ligne = (label: string, formule: string, v: number | null, fmt: (x: number) => string, opts: { positive?: boolean | null; motif?: string | null } = {}): LigneRatio =>
    v == null ? { label, formule, value: '', quality: 'missing', motif: opts.motif ?? null }
      : { label, formule, value: fmt(v), quality: 'ok', positive: opts.positive ?? null };
  const signe = (v: number | null) => (v == null ? null : v >= 0);
  const caLong = revenuLabel === 'CA' ? "chiffre d'affaires" : revenuLabel;
  const croissanceRn = croissanceRnSignee(rnDernier, prevIncome?.resultat_net ?? null, ratios.croissance_rn);
  const ratiosValorisation: LigneRatio[] = [
    ligne('Capitalisation boursière', "cours × nombre d'actions", ratios.capitalisation, formatXOF),
    ligne('BPA', "résultat net ÷ nombre d'actions", ratios.bpa, (x) => `${formatRatio(x)} FCFA`, { positive: signe(ratios.bpa) }),
    ligne('PER', 'cours ÷ BPA', per.valeur, formatRatio, { motif: per.motif }),
    ligne('P / valeur comptable', 'capitalisation ÷ capitaux propres', ratios.pb, formatRatio),
    ligne(`P / ${revenuLabel}`, `capitalisation ÷ ${caLong}`, ratios.ps, formatRatio),
    ligne(divCourant?.exercice != null ? `Rendement dividende · ex. ${divCourant.exercice}` : 'Rendement dividende',
      divCourant?.ancien
        ? "dernier dividende versé ÷ cours (antérieur au dernier exercice publié : pas un point d'appui)"
        : 'dernier dividende versé ÷ cours', rendementDiv, (x) => formatRendementDividende(x, null) ?? ''),
  ];
  const ratiosRentabilite: LigneRatio[] = [
    ligne('ROE', 'résultat net ÷ capitaux propres', ratios.roe, formatPct, { positive: signe(ratios.roe) }),
    ligne('Marge nette', `résultat net ÷ ${caLong}`, ratios.marge_nette, formatPct, { positive: signe(ratios.marge_nette) }),
    ligne('Taux de distribution', 'dividendes versés ÷ résultat net', distribution.valeur, formatPct, { motif: distribution.motif }),
  ];
  const ratiosSolidite: LigneRatio[] = [
    // La dette n'a pas de sens pour une banque ou un assureur : on ne l'affiche que pour les autres.
    ...(data.instrument.famille_comptable === 'general'
      ? [ligne('Dette / fonds propres', 'dette financière ÷ capitaux propres', gearing, formatRatio)]
      : []),
    ligne(`Croissance ${revenuLabel}`, 'exercice N ÷ exercice N−1', ratios.croissance_ca, formatGrowth, { positive: signe(ratios.croissance_ca) }),
    // Pourcentage signé seulement si les deux exercices sont bénéficiaires ; sinon la forme en mots ci-dessous.
    ...(croissanceRn != null
      ? [ligne('Croissance résultat net', '(RN N − RN N−1) ÷ |RN N−1|', croissanceRn, formatGrowth, { positive: signe(croissanceRn) })]
      : []),
    evolutionRn
      ? { label: 'Évolution du résultat net', formule: 'exercice N comparé à N−1', value: evolutionRn, quality: 'ok', positive: null, texte: true }
      : { label: 'Évolution du résultat net', formule: 'exercice N comparé à N−1', value: '', quality: 'missing', motif: null },
  ];

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
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">

        <SousPageNav code={code} courant="États financiers" />

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h1 className="font-display text-2xl text-ivory">{code}</h1>
            {data.instrument.designation && (
              <p className="text-sm text-muted">{data.instrument.designation}</p>
            )}
            {data.instrument.secteur && (
              <p className="text-xs text-faint">{data.instrument.secteur}</p>
            )}
            {data.instrument.famille_comptable !== 'general' && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] bg-info/10 text-accent-ink border border-info/20 font-medium">
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

        {/* Alerte de perte : l'exercice affiché est déficitaire */}
        {alertePerte && (
          <div className="rounded-card border border-down/40 bg-down/5 p-4 text-sm text-down">
            {alertePerte}
          </div>
        )}

        {/* Financial statement tabs */}
        <div id="etats">
          <p className="text-xs text-muted mb-3 px-0.5">États financiers</p>
          <div className="bg-surface border border-border rounded-xl p-5">
            <FinancialTabs
              incomeStatements={data.incomeStatements}
              balanceSheets={data.balanceSheets}
              cashFlowStatements={data.cashFlowStatements}
              incomeInterim={data.incomeInterim}
              balanceInterim={data.balanceInterim}
              famille={data.instrument.famille_comptable}
            />
          </div>
        </div>

        {/* Vue en flux du compte de résultat (calculée sur quatre postes publiés) */}
        {data.incomeStatements.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-3 px-0.5">Vue en flux</p>
            <FluxComptable parExercice={fluxParExercice} exercices={exercicesFlux} bilanParExercice={bilanParExercice} />
          </div>
        )}

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
                <p className="text-xs text-muted mb-3 px-0.5">Analyse bancaire UEMOA</p>
                <BankScorecard kpis={bankAnalysis.kpis} score={bankAnalysis.score} periode={bankAnalysis.periode} absences={bankAnalysis.absences} qualite={bankAnalysis.qualite} />
              </div>
            )}

            {/* Alerte value trap (PER vs trajectoire des bénéfices) */}
            {/* Une perte est déjà signalée par le bandeau du haut : pas de second badge. */}
            {!(alertePerte && trap.verdict === 'perte') && <ValueTrapBadge result={trap} />}

            {/* Ratios fondamentaux : trois cartes, formule en sous-libellé */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <p className="text-xs text-muted">Ratios fondamentaux</p>
                {periodeAffichee && (
                  <PasseportPopover passeport={passeport} titre={`Exercice ${periodeAffichee}`} />
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-card border border-border bg-surface p-4">
                  <h3 className="mb-1 text-xs text-muted">Valorisation</h3>
                  <div className="divide-y divide-border/40">
                    {ratiosValorisation.map((r) => <RatioCard key={r.label} {...r} />)}
                  </div>
                </div>
                <div className="rounded-card border border-border bg-surface p-4">
                  <h3 className="mb-1 text-xs text-muted">Rentabilité</h3>
                  <div className="divide-y divide-border/40">
                    {ratiosRentabilite.map((r) => <RatioCard key={r.label} {...r} />)}
                  </div>
                </div>
                <div className="rounded-card border border-border bg-surface p-4">
                  <h3 className="mb-1 text-xs text-muted">Solidité et croissance</h3>
                  <div className="divide-y divide-border/40">
                    {ratiosSolidite.map((r) => <RatioCard key={r.label} {...r} />)}
                  </div>
                </div>
              </div>
              {mentionJeu && <p className="mt-3 text-xs text-faint">{mentionJeu}</p>}
              {comparatifIfrs && <ComptesIfrs c={comparatifIfrs} />}
            </div>

            {/* Analyse graphique pluriannuelle */}
            {chartPoints.length >= 2 && (
              <div>
                <p className="text-xs text-muted mb-3 px-0.5">Analyse graphique</p>
                <FundamentalsCharts points={chartPoints} revenuLabel={revenuLabel} isBank={isBank} sansCaRn />
              </div>
            )}

            {/* Constructeur de graphique — séries au choix, axes automatiques.
                En-tête de section comme les blocs voisins : sans lui, le bloc se
                fondait dans la page et passait inaperçu. */}
            {data.incomeStatements.length >= 2 && (
              <div>
                <p className="text-xs text-muted mb-3 px-0.5">
                  Graphique personnalisé
                </p>
                <ChartBuilder rows={buildChartRows(data.incomeStatements, data.balanceSheets, data.cashFlowStatements)} />
              </div>
            )}
          </>
        )}

        {/* Panneau valorisation — premium (flag dcf) */}
        {!gateValo.allowed ? (
          <SectionLock required={lockLevel(gateValo.required)} titre="Valorisation (Graham, DCF, score)" pitch="Juste prix, marge de sécurité et score de valorisation." />
        ) : (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-6">
          {!valoCalculable.calculable ? (
            <p className="text-xs text-muted">
              {libelleValorisationSimplifiee()} : <span className="text-ivory">{valoCalculable.motif}</span>
            </p>
          ) : (
          <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{libelleValorisationSimplifiee()}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-border bg-elevated text-ivory">
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
              Score de ce modèle : <span className="tabular text-ivory font-medium">{Math.round(valuation.scoreValorisation)}/100</span>
            </div>
          )}
          {valuation.verdict === 'inconnu' && (
            <p className="text-xs text-faint">BPA, PB ou FCF manquants pour calculer la valorisation.</p>
          )}
          </>
          )}
          <p className="w-full text-xs text-faint">
            Modèle indépendant : ce score ne se confond ni avec le pilier Valorisation de Combined Alpha ni avec la note de qualité.
          </p>
        </div>
        )}

        {/* 52-week range */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <WeekRange52
            bas={ratios.cours_bas_52s}
            haut={ratios.cours_haut_52s}
            actuel={ratios.cours_actuel}
            dateBas={plage52?.dateBas ?? null}
            dateHaut={plage52?.dateHaut ?? null}
          />
        </div>

        {/* Publications disponibles — fallback si données absentes */}
        {data.incomeStatements.length === 0 && data.publications.length > 0 && (
          <div className="bg-surface border border-warn/30 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-warn">Données financières non importées</p>
                <p className="text-xs text-muted mt-1">
                  {data.publications.length} publication{data.publications.length > 1 ? 's' : ''} disponible{data.publications.length > 1 ? 's' : ''} pour {code}.
                  Importez-les via l&apos;IA pour remplir automatiquement les états financiers.
                </p>
              </div>
              <a
                href={`/admin/import-fondamentaux?code=${code}`}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-accent-ink text-bg text-xs font-semibold hover:opacity-90 active:scale-95 transition-colors"
              >
                Importer via IA →
              </a>
            </div>
            <div className="divide-y divide-border/40">
              {data.publications.map((pub) => (
                <div key={pub.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">{pub.libelle ?? pub.type_publication ?? 'Publication'}</p>
                    <p className="text-xs text-muted">{fmtDateCourte(pub.date_publication)}</p>
                  </div>
                  {pub.source_url && (
                    <a
                      href={pub.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-ink hover:underline shrink-0"
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
              className="inline-block px-4 py-2 rounded-lg bg-accent-ink text-bg text-sm font-semibold hover:opacity-90 active:scale-95 transition-colors"
            >
              Importer via IA
            </a>
          </div>
        )}

        {/* Publications d'états financiers + résumé chiffres clés */}
        {data.publications.filter((p) => p.type_publication === 'etats_financiers').length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Publications · états financiers</h2>
            <ul className="space-y-2">
              {data.publications.filter((p) => p.type_publication === 'etats_financiers').map((p) => {
                const an = (p.libelle ?? '').match(/[Ee]xercice\s+(20\d{2})/)?.[1] ?? null;
                const inc = an ? data.incomeStatements.find((s) => s.periode === an) : undefined;
                return (
                  <li key={p.id} className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted">{p.libelle ? titrePublication(p.libelle) : ''}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {inc && <a href="#etats" className="text-xs text-accent-ink hover:underline">Voir les états →</a>}
                        {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-ink hover:underline">PDF</a>}
                      </div>
                    </div>
                    {inc && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-faint tabular">
                        <span>CA&nbsp;: {inc.revenu_total != null ? fmtFcfa(inc.revenu_total) : 'N/D'}</span>
                        <span>RN&nbsp;: {inc.resultat_net != null ? fmtFcfa(inc.resultat_net) : 'N/D'}</span>
                        <span>BPA&nbsp;: {inc.benefice_par_action != null ? fmtNumber(inc.benefice_par_action, 2) : 'N/D'}</span>
                        <span>Div&nbsp;: {inc.dividende_par_action != null ? fmtNumber(inc.dividende_par_action, 2) : 'N/D'}</span>
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
            <p className="text-sm font-semibold text-warn">Diagnostic financier &amp; économique</p>
            <p className="text-xs text-muted mt-0.5">
              Analyse générée automatiquement à partir des états financiers publiés, vérifiée par
              nos garde-fous de plausibilité. Réservée aux membres Premium.
            </p>
          </div>
          <Link
            href={`/premium/diagnostic/${code}`}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-warn/10 border border-warn/30 text-warn text-xs font-semibold hover:bg-warn/20 transition-colors"
          >
            Voir le diagnostic →
          </Link>
        </div>

      </div>
    </div>
  );
}
