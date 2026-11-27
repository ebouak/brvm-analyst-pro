/**
 * Moteur quantitatif pur du Stock Resilience Scanner (Phase 2 — WESTBOURSE).
 * Zéro I/O. Toutes les fonctions travaillent sur des structures en mémoire.
 */
import type { AjustementApplique, CoursAjusteAction } from './adjustments.js';
import type { PointIndice } from './types.js';
import {
  POIDS_OPPORTUNITE_DEFAUT,
  type ActionResilienceRow,
  type CategorieOpportunite,
  type DividendesAnalyse,
  type ExplicationDecrochage,
  type FacteurDecrochageType,
  type FamilleComptable,
  type FondamentauxAnalyse,
  type LiquiditeAnalyse,
  type PoidsScoreOpportunite,
  type SecteurStressRow,
  type SousScoresOpportunite,
} from './resilienceTypes.js';

export interface InstrumentInput {
  code: string;
  designation: string;
  secteur: string;
  pays: string | null;
  famille_comptable: FamilleComptable;
  actif: boolean;
  shares: number | null;
  isin: string | null;
  date_introduction: string | null;
}

export interface IncomeInput {
  code: string;
  periode: string;
  revenu_total: number | null;
  resultat_exploitation: number | null;
  resultat_net: number | null;
  charges_financieres_nettes?: number | null;
  lignes_specifiques?: Record<string, unknown> | null;
}

export interface BalanceInput {
  code: string;
  periode: string;
  total_actifs: number | null;
  tresorerie_equivalents: number | null;
  dette_court_terme: number | null;
  dette_long_terme: number | null;
  total_capitaux_propres: number | null;
  lignes_specifiques?: Record<string, unknown> | null;
}

export interface CashFlowInput {
  code: string;
  periode: string;
  flux_tresorerie_disponible: number | null;
}

export interface IndicateurBancaireInput {
  code: string;
  indicateur: string;
  date_arrete: string;
  valeur: number | null;
  statut: string;
}

export interface DividendInput {
  code: string;
  exercice: number | null;
  ex_date: string | null;
  montant: number;
  montant_brut: number | null;
  base_fiscale: string | null;
}

export interface LiquidityInput {
  code: string;
  date_marche: string;
  score: number | null;
  classe: string | null;
  presence_pct: number | null;
  valeur_moyenne_30j: number | null;
  amihud: number | null;
  spread_pct: number | null;
  flux_net_pct: number | null;
}

export interface EventInput {
  event_date: string;
  instrument_code: string | null;
  event_type: string | null;
  title: string;
}

export interface ResilienceInputAction {
  instrument: InstrumentInput;
  cours: readonly CoursAjusteAction[];
  ajustements: readonly AjustementApplique[];
  anomaliesCours: readonly string[];
  income: readonly IncomeInput[];
  balance: readonly BalanceInput[];
  cashFlow: readonly CashFlowInput[];
  indicateursBancaires: readonly IndicateurBancaireInput[];
  dividendes: readonly DividendInput[];
  liquidite: LiquidityInput | null;
  events: readonly EventInput[];
}

const MS_JOUR = 86_400_000;
const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;
const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const div = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null;

function shiftDays(iso: string, deltaDays: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + deltaDays * MS_JOUR).toISOString().slice(0, 10);
}

function median(values: readonly number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid]! : (valid[mid - 1]! + valid[mid]!) / 2;
}

/** Cherche la dernière séance cotée <= cibleIso dans une fenêtre de `maxEcartJours`. */
function coursAuPlusPres(
  serie: readonly CoursAjusteAction[],
  cibleIso: string,
  maxEcartJours = 20,
): CoursAjusteAction | null {
  const limiteMin = shiftDays(cibleIso, -maxEcartJours);
  for (let i = serie.length - 1; i >= 0; i--) {
    const p = serie[i]!;
    if (p.date_marche <= cibleIso) {
      return p.date_marche >= limiteMin ? p : null;
    }
  }
  return null;
}

function perfEntre(debut: CoursAjusteAction | null, fin: CoursAjusteAction | null): number | null {
  if (!debut || !fin || debut.cours_ajuste <= 0 || fin.date_marche <= debut.date_marche) return null;
  return round4(((fin.cours_ajuste / debut.cours_ajuste) - 1) * 100);
}

function numFromSpec(spec: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!spec) return null;
  for (const k of keys) {
    const v = spec[k];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function construireFondamentaux(
  input: ResilienceInputAction,
  dateRef: string,
  coursJour: number | null,
  capitalisation: number | null,
): FondamentauxAnalyse {
  const anneeRef = Number(dateRef.slice(0, 4));
  const fam = input.instrument.famille_comptable;
  const shares = input.instrument.shares;

  // Exercices annuels (4 chiffres) triés décroissants
  const incAnnuels = [...input.income]
    .filter((r) => /^\d{4}$/.test(r.periode))
    .sort((a, b) => b.periode.localeCompare(a.periode));
  const balAnnuels = [...input.balance]
    .map((r) => ({ ...r, an: r.periode.slice(0, 4) }))
    .filter((r) => /^\d{4}$/.test(r.an))
    .sort((a, b) => b.an.localeCompare(a.an));
  const cfAnnuels = [...input.cashFlow]
    .filter((r) => /^\d{4}$/.test(r.periode))
    .sort((a, b) => b.periode.localeCompare(a.periode));

  const inc0 = incAnnuels[0] ?? null;
  const inc1 = incAnnuels.find((r) => inc0 && Number(r.periode) === Number(inc0.periode) - 1) ?? null;
  const bal0 = (inc0 ? balAnnuels.find((b) => b.an === inc0.periode) : null) ?? balAnnuels[0] ?? null;
  const cf0 = (inc0 ? cfAnnuels.find((c) => c.periode === inc0.periode) : null) ?? cfAnnuels[0] ?? null;

  const exercice = inc0?.periode ?? bal0?.an ?? null;
  const age_annees = exercice ? Math.max(0, anneeRef - Number(exercice)) : null;

  const ca = inc0?.revenu_total ?? null;
  const rexp = inc0?.resultat_exploitation ?? null;
  const rn = inc0?.resultat_net ?? null;
  const equity = bal0?.total_capitaux_propres ?? null;
  const debt =
    bal0 && (bal0.dette_court_terme != null || bal0.dette_long_terme != null)
      ? (bal0.dette_court_terme ?? 0) + (bal0.dette_long_terme ?? 0)
      : null;
  const cash = bal0?.tresorerie_equivalents ?? null;
  const totalActifs = bal0?.total_actifs ?? null;
  const fcf = cf0?.flux_tresorerie_disponible ?? null;

  // Agrégats bancaires depuis lignes_specifiques + indicateur_source
  const specInc = inc0?.lignes_specifiques;
  const specBal = bal0?.lignes_specifiques;
  const indVal = (noms: string[]): number | null => {
    const matches = input.indicateursBancaires
      .filter((x) => x.statut === 'publie' && x.valeur != null && noms.includes(x.indicateur))
      .sort((a, b) => b.date_arrete.localeCompare(a.date_arrete));
    return matches[0]?.valeur ?? null;
  };

  const pnb = fam === 'banque' ? numFromSpec(specInc, ['pnb']) ?? indVal(['pnb']) ?? ca : null;
  const coeffExp =
    fam === 'banque'
      ? numFromSpec(specInc, ['coefficient_exploitation']) ?? indVal(['coefficient_exploitation'])
      : null;
  const coutRisque =
    fam === 'banque' ? numFromSpec(specInc, ['cout_du_risque']) ?? indVal(['cout_du_risque']) : null;
  const nplPct =
    fam === 'banque'
      ? numFromSpec(specBal, ['taux_creances_souffrance']) ?? indVal(['taux_creances_souffrance'])
      : null;
  const solvabilite =
    fam === 'banque'
      ? numFromSpec(specBal, ['ratio_solvabilite', 'ratio_tier1']) ?? indVal(['solvabilite_total', 'ratio_tier1'])
      : null;

  const bpa = div(rn, shares);
  const per = bpa != null && bpa > 0 && coursJour != null ? round2(coursJour / bpa) : null;
  const bvps = div(equity, shares);
  const pbr = bvps != null && bvps > 0 && coursJour != null ? round2(coursJour / bvps) : null;

  // Jamais de P/S, EV/EBITDA ou gearing industriel sur une banque
  const price_to_sales =
    fam !== 'banque' && ca != null && ca > 0 && capitalisation != null ? round2(capitalisation / ca) : null;
  const ev =
    fam !== 'banque' && capitalisation != null && debt != null && cash != null
      ? capitalisation + debt - cash
      : null;
  const ev_ebitda =
    fam !== 'banque' && ev != null && rexp != null && rexp > 0 ? round2(ev / rexp) : null;
  const gearing_pct =
    fam !== 'banque' && debt != null && equity != null && equity > 0 ? round2((debt / equity) * 100) : null;
  const chFin = inc0?.charges_financieres_nettes ?? null;
  const couverture_interets =
    fam !== 'banque' && rexp != null && chFin != null && Math.abs(chFin) > 0
      ? round2(rexp / Math.abs(chFin))
      : null;

  const roe_pct = equity != null && equity > 0 && rn != null ? round2((rn / equity) * 100) : null;
  const roa_pct = totalActifs != null && totalActifs > 0 && rn != null ? round2((rn / totalActifs) * 100) : null;
  const denominateurMarge = fam === 'banque' ? pnb : ca;
  const marge_nette_pct =
    denominateurMarge != null && denominateurMarge > 0 && rn != null
      ? round2((rn / denominateurMarge) * 100)
      : null;

  const croissance_rn_pct =
    rn != null && inc1?.resultat_net != null && inc1.resultat_net > 0
      ? round2(((rn - inc1.resultat_net) / inc1.resultat_net) * 100)
      : null;

  return {
    exercice,
    age_annees,
    famille_comptable: fam,
    chiffre_affaires: ca,
    resultat_exploitation: rexp,
    resultat_net: rn,
    capitaux_propres: equity,
    dette_totale: debt,
    tresorerie: cash,
    flux_tresorerie_libre: fcf,
    roe_pct,
    roa_pct,
    marge_nette_pct,
    per,
    pbr,
    price_to_sales,
    ev_ebitda,
    gearing_pct,
    couverture_interets,
    pnb,
    coefficient_exploitation_pct: coeffExp,
    cout_du_risque: coutRisque,
    taux_creances_souffrance_pct: nplPct,
    ratio_solvabilite_pct: solvabilite,
    per_median_secteur: null,
    pbr_median_secteur: null,
    croissance_rn_pct,
  };
}

function construireDividendes(
  divs: readonly DividendInput[],
  dateRef: string,
  coursJour: number | null,
  shares: number | null,
  resultatNet: number | null,
): DividendesAnalyse {
  const anneeRef = Number(dateRef.slice(0, 4));
  const tries = [...divs]
    .filter((d) => d.montant > 0)
    .sort((a, b) => (b.exercice ?? 0) - (a.exercice ?? 0) || (b.ex_date ?? '').localeCompare(a.ex_date ?? ''));

  const d0 = tries[0] ?? null;
  const d1 =
    d0?.exercice != null
      ? tries.find((d) => d.exercice === d0.exercice! - 1) ?? null
      : tries[1] ?? null;

  const exercices5a = new Set(
    tries
      .map((d) => d.exercice)
      .filter((y): y is number => y != null && y >= anneeRef - 5 && y <= anneeRef),
  );

  const base: DividendesAnalyse['base_fiscale'] =
    d0?.base_fiscale === 'net' ? 'net' : d0?.base_fiscale === 'brut' ? 'brut' : 'inconnu';
  const montantRef = d0?.montant ?? null;
  const rendement_pct =
    montantRef != null && coursJour != null && coursJour > 0 ? round2((montantRef / coursJour) * 100) : null;
  const taux_distribution_pct =
    montantRef != null && shares != null && shares > 0 && resultatNet != null && resultatNet > 0
      ? round2(((montantRef * shares) / resultatNet) * 100)
      : null;
  const croissance_div_pct =
    d0 && d1 && d1.montant > 0 ? round2(((d0.montant - d1.montant) / d1.montant) * 100) : null;

  return {
    dernier_exercice: d0?.exercice ?? null,
    montant_net: base === 'net' || base === 'inconnu' ? montantRef : null,
    montant_brut: d0?.montant_brut ?? (base === 'brut' ? montantRef : null),
    base_fiscale: base,
    rendement_pct,
    taux_distribution_pct,
    annees_consecutives_5a: exercices5a.size,
    derniere_ex_date: d0?.ex_date ?? null,
    croissance_div_pct,
  };
}

function construireSousScores(
  f: FondamentauxAnalyse,
  d: DividendesAnalyse,
  liq: LiquiditeAnalyse,
  drawdownPct: number | null,
  resistanceJoursBaisse: number | null,
  freqPos: number | null,
  perf1m: number | null,
  perf5j: number | null,
): { sousScores: SousScoresOpportunite; confiance: number; categorie: CategorieOpportunite; scoreGlobal: number | null } {
  // 1. Qualité financière (0-100)
  const qParts: number[] = [];
  if (f.roe_pct != null) qParts.push(clamp((f.roe_pct / 22) * 100));
  if (f.marge_nette_pct != null) qParts.push(clamp((f.marge_nette_pct / 25) * 100));
  if (f.famille_comptable === 'banque') {
    if (f.ratio_solvabilite_pct != null) qParts.push(clamp(((f.ratio_solvabilite_pct - 8) / 10) * 100));
    if (f.coefficient_exploitation_pct != null) qParts.push(clamp(((80 - f.coefficient_exploitation_pct) / 40) * 100));
    if (f.taux_creances_souffrance_pct != null) qParts.push(clamp(((18 - f.taux_creances_souffrance_pct) / 15) * 100));
  } else {
    if (f.gearing_pct != null) qParts.push(clamp(((150 - f.gearing_pct) / 150) * 100));
    if (f.flux_tresorerie_libre != null) qParts.push(f.flux_tresorerie_libre > 0 ? 80 : 25);
  }
  if (f.croissance_rn_pct != null) qParts.push(clamp(50 + f.croissance_rn_pct));
  const qualiteFinanciere = qParts.length > 0 ? round2(qParts.reduce((a, b) => a + b, 0) / qParts.length) : null;

  // 2. Valorisation (0-100) — plus bas PER/PBR = meilleur score
  const vParts: number[] = [];
  if (f.per != null && f.per > 0 && f.per < 80) {
    vParts.push(clamp(((22 - f.per) / 17) * 100));
  }
  if (f.pbr != null && f.pbr > 0 && f.pbr < 20) {
    vParts.push(clamp(((4 - f.pbr) / 3.2) * 100));
  }
  const valorisation = vParts.length > 0 ? round2(vParts.reduce((a, b) => a + b, 0) / vParts.length) : null;

  // 3. Dividendes (0-100)
  const dParts: number[] = [];
  if (d.rendement_pct != null) dParts.push(clamp((d.rendement_pct / 10) * 100));
  if (d.annees_consecutives_5a > 0) dParts.push(clamp((d.annees_consecutives_5a / 5) * 100));
  if (d.taux_distribution_pct != null && d.taux_distribution_pct <= 95) {
    dParts.push(d.taux_distribution_pct >= 25 && d.taux_distribution_pct <= 80 ? 85 : 55);
  }
  const dividendes = dParts.length > 0 ? round2(dParts.reduce((a, b) => a + b, 0) / dParts.length) : null;

  // 4. Résilience historique (0-100)
  const rParts: number[] = [];
  if (drawdownPct != null) rParts.push(clamp(100 + drawdownPct * 2)); // -50% -> 0, 0% -> 100
  if (resistanceJoursBaisse != null) rParts.push(clamp(65 + resistanceJoursBaisse * 20));
  if (freqPos != null) rParts.push(clamp(freqPos * 1.4));
  const resilienceHistorique = rParts.length > 0 ? round2(rParts.reduce((a, b) => a + b, 0) / rParts.length) : null;

  // 5. Liquidité (0-100)
  const liquidite =
    liq.score_v2 != null
      ? round2(clamp(liq.score_v2))
      : liq.presence_pct != null
        ? round2(clamp(liq.presence_pct))
        : null;

  // 6. Momentum et stabilisation (0-100)
  const mParts: number[] = [];
  if (perf5j != null) mParts.push(clamp(50 + perf5j * 4));
  if (perf1m != null) mParts.push(clamp(50 + perf1m * 2));
  const momentumStabilisation = mParts.length > 0 ? round2(mParts.reduce((a, b) => a + b, 0) / mParts.length) : null;

  // Score de confiance dans les données (0-100)
  let confiance = 0;
  const aDesComptesRecents = f.age_annees != null && f.age_annees <= 2 && f.resultat_net != null;
  if (aDesComptesRecents) confiance += 40;
  else if (f.resultat_net != null) confiance += 15;
  if (f.capitaux_propres != null) confiance += 15;
  if (liq.score_v2 != null || liq.seances_cotees_60j >= 20) confiance += 20;
  if (d.montant_net != null || d.montant_brut != null) confiance += 15;
  if (f.famille_comptable !== 'banque' ? f.chiffre_affaires != null : f.pnb != null) confiance += 10;
  confiance = clamp(confiance);

  return {
    sousScores: {
      qualiteFinanciere,
      valorisation,
      dividendes,
      resilienceHistorique,
      liquidite,
      momentumStabilisation,
      plafonne_par_confiance: !aDesComptesRecents || confiance < 45,
    },
    confiance,
    categorie: 'vigilance', // calculée après calcul pondéré
    scoreGlobal: null,
  };
}

export function calculerScoreOpportunite(
  sous: SousScoresOpportunite,
  confiance: number,
  aDesComptesRecents: boolean,
  poids: PoidsScoreOpportunite = POIDS_OPPORTUNITE_DEFAUT,
  flagsRisque: { capitauxNegatifs: boolean; perteNette: boolean } = { capitauxNegatifs: false, perteNette: false },
): { score: number | null; categorie: CategorieOpportunite; plafonne: boolean } {
  const entries: Array<[keyof PoidsScoreOpportunite, number | null]> = [
    ['qualiteFinanciere', sous.qualiteFinanciere],
    ['valorisation', sous.valorisation],
    ['dividendes', sous.dividendes],
    ['resilienceHistorique', sous.resilienceHistorique],
    ['liquidite', sous.liquidite],
    ['momentumStabilisation', sous.momentumStabilisation],
  ];
  const dispos = entries.filter(([, v]) => v !== null) as Array<[keyof PoidsScoreOpportunite, number]>;
  if (dispos.length < 2) {
    return { score: null, categorie: 'risque_eleve', plafonne: true };
  }

  const sommeW = dispos.reduce((s, [k]) => s + Math.max(0, poids[k]), 0);
  if (sommeW <= 0) return { score: null, categorie: 'risque_eleve', plafonne: true };

  let raw = 0;
  for (const [k, v] of dispos) {
    raw += v * (Math.max(0, poids[k]) / sommeW);
  }

  const plafonne = !aDesComptesRecents || confiance < 45;
  const score = round2(clamp(plafonne ? Math.min(raw, 59) : raw));

  let categorie: CategorieOpportunite;
  if (flagsRisque.capitauxNegatifs || (flagsRisque.perteNette && score < 55)) {
    categorie = 'risque_eleve';
  } else if (score >= 72 && confiance >= 65 && !plafonne) {
    categorie = 'qualite_elevee';
  } else if (score >= 55 && confiance >= 45 && !plafonne) {
    categorie = 'potentiel_a_etudier';
  } else if (score >= 40) {
    categorie = 'vigilance';
  } else {
    categorie = 'risque_eleve';
  }

  return { score, categorie, plafonne };
}

export function calculerResilienceUnivers(
  inputs: readonly ResilienceInputAction[],
  indiceRef: readonly PointIndice[],
  opts: {
    dateMarche?: string;
    poids?: PoidsScoreOpportunite;
  } = {},
): ActionResilienceRow[] {
  const indiceTrie = [...indiceRef]
    .filter((p) => Number.isFinite(p.valeur) && p.valeur > 0)
    .sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  const dateRef =
    opts.dateMarche ??
    indiceTrie.at(-1)?.date_marche ??
    inputs
      .map((i) => i.cours.at(-1)?.date_marche)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);

  if (!dateRef) return [];

  // Index des rendements quotidiens du Composite et jours de forte baisse (<= -0.75 %)
  const idxMap = new Map<string, { valeur: number; ret: number | null }>();
  for (let i = 0; i < indiceTrie.length; i++) {
    const cur = indiceTrie[i]!;
    const prev = i > 0 ? indiceTrie[i - 1]! : null;
    const ret = prev && prev.valeur > 0 ? ((cur.valeur / prev.valeur) - 1) * 100 : (cur.variation_pct ?? null);
    idxMap.set(cur.date_marche, { valeur: cur.valeur, ret });
  }

  const perfIndiceEntre = (dDeb: string, dFin: string): number | null => {
    const pFin = [...indiceTrie].reverse().find((x) => x.date_marche <= dFin);
    const pDeb = [...indiceTrie].reverse().find((x) => x.date_marche <= dDeb);
    if (!pFin || !pDeb || pDeb.valeur <= 0 || pFin.date_marche <= pDeb.date_marche) return null;
    return round4(((pFin.valeur / pDeb.valeur) - 1) * 100);
  };

  const d1m = shiftDays(dateRef, -30);
  const d3m = shiftDays(dateRef, -91);
  const d6m = shiftDays(dateRef, -182);
  const d1a = shiftDays(dateRef, -365);
  const dYtd = `${Number(dateRef.slice(0, 4)) - 1}-12-31`;
  const perf3mIndice = perfIndiceEntre(d3m, dateRef);

  const rows: ActionResilienceRow[] = [];

  for (const item of inputs) {
    if (!item.instrument.actif) continue;
    const serie = item.cours.filter((c) => c.date_marche <= dateRef);
    const dernier = serie.at(-1) ?? null;
    const coursJour = dernier?.cours_ajuste ?? null;
    const shares = item.instrument.shares;
    const capitalisation =
      coursJour != null && shares != null && shares > 0 ? Math.round(coursJour * shares) : null;

    // Performances prix
    const prec = serie.length >= 2 ? serie[serie.length - 2]! : null;
    const p5 = serie.length >= 6 ? serie[serie.length - 6]! : coursAuPlusPres(serie, shiftDays(dateRef, -7), 10);
    const p1m = coursAuPlusPres(serie, d1m);
    const p3m = coursAuPlusPres(serie, d3m);
    const p6m = coursAuPlusPres(serie, d6m);
    const pYtd = coursAuPlusPres(serie, dYtd, 30);
    const p1a = coursAuPlusPres(serie, d1a);

    const perf_1j_pct = dernier?.variation_pct ?? perfEntre(prec, dernier);
    const perf_5j_pct = perfEntre(p5, dernier);
    const perf_1m_pct = perfEntre(p1m, dernier);
    const perf_3m_pct = perfEntre(p3m, dernier);
    const perf_6m_pct = perfEntre(p6m, dernier);
    const perf_ytd_pct = perfEntre(pYtd, dernier);
    const perf_1a_pct = perfEntre(p1a, dernier);

    // Performance totale (dividendes ajoutés sur la fenêtre)
    const sumDivSince = (depuisIso: string) =>
      item.dividendes
        .filter((dv) => dv.ex_date && dv.ex_date > depuisIso && dv.ex_date <= dateRef && dv.montant > 0)
        .reduce((s, dv) => s + dv.montant, 0);

    const perf_totale_1a_pct =
      p1a && dernier && p1a.cours_ajuste > 0
        ? (() => {
            const divs = sumDivSince(p1a.date_marche);
            return divs > 0 ? round4(((dernier.cours_ajuste + divs - p1a.cours_ajuste) / p1a.cours_ajuste) * 100) : perf_1a_pct;
          })()
        : null;
    const perf_totale_ytd_pct =
      pYtd && dernier && pYtd.cours_ajuste > 0
        ? (() => {
            const divs = sumDivSince(pYtd.date_marche);
            return divs > 0 ? round4(((dernier.cours_ajuste + divs - pYtd.cours_ajuste) / pYtd.cours_ajuste) * 100) : perf_ytd_pct;
          })()
        : null;

    // Drawdown 250 dernières séances
    const fen250 = serie.slice(-250);
    let sommetVal = -Infinity;
    let dateSommet: string | null = null;
    for (const p of fen250) {
      if (p.cours_ajuste > sommetVal) {
        sommetVal = p.cours_ajuste;
        dateSommet = p.date_marche;
      }
    }
    const drawdown_pct =
      coursJour != null && sommetVal > 0 ? round4(((coursJour / sommetVal) - 1) * 100) : null;

    // Volatilité annualisée & Beta vs BRVMC (sur 120 dernières séances cotées)
    const fenVol = serie.slice(-120);
    const logRets: number[] = [];
    const pairedTitre: number[] = [];
    const pairedIdx: number[] = [];
    const varsJoursBaisseMarche: number[] = [];

    for (let k = 1; k < fenVol.length; k++) {
      const a = fenVol[k - 1]!;
      const b = fenVol[k]!;
      if (a.cours_ajuste > 0 && b.cours_ajuste > 0) {
        const lr = Math.log(b.cours_ajuste / a.cours_ajuste);
        // Écarter éventuelles erreurs non expliquées > 15 %
        if (Math.abs(lr) <= 0.15) {
          logRets.push(lr);
          const m = idxMap.get(b.date_marche);
          if (m && m.ret != null) {
            const rPct = ((b.cours_ajuste / a.cours_ajuste) - 1) * 100;
            pairedTitre.push(rPct);
            pairedIdx.push(m.ret);
            if (m.ret <= -0.75) varsJoursBaisseMarche.push(rPct);
          }
        }
      }
    }

    let volatilite_ann_pct: number | null = null;
    if (logRets.length >= 15) {
      const moy = logRets.reduce((s, x) => s + x, 0) / logRets.length;
      const variance = logRets.reduce((s, x) => s + (x - moy) ** 2, 0) / logRets.length;
      volatilite_ann_pct = round2(Math.sqrt(variance * 250) * 100);
    }

    let beta: number | null = null;
    if (pairedTitre.length >= 20) {
      const mt = pairedTitre.reduce((s, x) => s + x, 0) / pairedTitre.length;
      const mi = pairedIdx.reduce((s, x) => s + x, 0) / pairedIdx.length;
      let cov = 0;
      let varI = 0;
      for (let k = 0; k < pairedTitre.length; k++) {
        cov += (pairedTitre[k]! - mt) * (pairedIdx[k]! - mi);
        varI += (pairedIdx[k]! - mi) ** 2;
      }
      if (varI > 1e-6) beta = round2(cov / varI);
    }

    const resistance_jours_baisse_pct =
      varsJoursBaisseMarche.length >= 3
        ? round2(varsJoursBaisseMarche.reduce((s, x) => s + x, 0) / varsJoursBaisseMarche.length)
        : null;

    // Fréquence séances positives & stabilité volumes sur 60j calendaires
    const d60cal = shiftDays(dateRef, -90);
    const fen60 = serie.filter((p) => p.date_marche >= d60cal);
    const seancesPos = fen60.filter((p) => (p.variation_pct ?? 0) > 0).length;
    const freq_seances_positives_pct = fen60.length > 0 ? round2((100 * seancesPos) / fen60.length) : null;

    const vols60 = fen60.map((p) => p.volume_ajuste).filter((v): v is number => v != null && v >= 0);
    const vols20 = serie.slice(-20).map((p) => p.volume_ajuste).filter((v): v is number => v != null && v >= 0);
    const avg60 = vols60.length > 0 ? vols60.reduce((a, b) => a + b, 0) / vols60.length : 0;
    const avg20 = vols20.length > 0 ? vols20.reduce((a, b) => a + b, 0) / vols20.length : 0;
    const stabilite_volumes = avg60 > 0 ? round2(avg20 / avg60) : null;

    // Liquidité
    const liq: LiquiditeAnalyse = {
      score_v2: item.liquidite?.score ?? null,
      classe: item.liquidite?.classe ?? null,
      presence_pct: item.liquidite?.presence_pct ?? null,
      valeur_moyenne_30j: item.liquidite?.valeur_moyenne_30j ?? null,
      amihud: item.liquidite?.amihud ?? null,
      spread_pct: item.liquidite?.spread_pct ?? null,
      flux_net_pct: item.liquidite?.flux_net_pct ?? null,
      seances_cotees_60j: fen60.length,
    };
    const illiquide_flag =
      (liq.presence_pct != null && liq.presence_pct < 35) ||
      (liq.score_v2 != null && liq.score_v2 < 25) ||
      liq.seances_cotees_60j < 12;

    const force_relative_pct =
      perf_3m_pct != null && perf3mIndice != null ? round2(perf_3m_pct - perf3mIndice) : null;

    // Fondamentaux & Dividendes
    const fondamentaux = construireFondamentaux(item, dateRef, coursJour, capitalisation);
    const dividendes = construireDividendes(
      item.dividendes,
      dateRef,
      coursJour,
      shares,
      fondamentaux.resultat_net,
    );

    // Décrochage anormal (sur fenêtre 3M / correction)
    const decrochage_relatif_pct = force_relative_pct;
    const betaEff = beta != null && beta > 0 ? Math.min(2.5, Math.max(0.3, beta)) : 1;
    const alpha_anormal_pct =
      perf_3m_pct != null && perf3mIndice != null
        ? round2(perf_3m_pct - betaEff * perf3mIndice)
        : null;
    const decrochage_anormal =
      (decrochage_relatif_pct != null && decrochage_relatif_pct <= -8) ||
      (alpha_anormal_pct != null && alpha_anormal_pct <= -8);

    const facteurs_observes: ExplicationDecrochage['facteurs_observes'] = [];
    const exDansFenetre = item.dividendes.filter((dv) => dv.ex_date && dv.ex_date >= d3m && dv.ex_date <= dateRef);
    if (exDansFenetre.length > 0) {
      facteurs_observes.push({
        type: 'detachement_dividende',
        detail: `Détachement de dividende relevé le ${exDansFenetre[0]!.ex_date} (${exDansFenetre[0]!.montant} FCFA)`,
      });
    }
    const ostDansFenetre = item.ajustements.filter((a) => a.date_effet >= d3m && a.date_effet <= dateRef);
    if (ostDansFenetre.length > 0) {
      facteurs_observes.push({
        type: 'operation_sur_titres',
        detail: ostDansFenetre[0]!.raison,
      });
    }
    if (fondamentaux.croissance_rn_pct != null && fondamentaux.croissance_rn_pct <= -10) {
      facteurs_observes.push({
        type: 'baisse_resultats',
        detail: `Résultat net en recul de ${fondamentaux.croissance_rn_pct.toFixed(1)} % sur le dernier exercice (${fondamentaux.exercice})`,
      });
    }
    if (dividendes.croissance_div_pct != null && dividendes.croissance_div_pct <= -10) {
      facteurs_observes.push({
        type: 'baisse_dividende',
        detail: `Dividende en baisse de ${dividendes.croissance_div_pct.toFixed(1)} %`,
      });
    }
    const evFenetre = item.events.filter((e) => e.event_date >= d3m && e.event_date <= dateRef);
    if (evFenetre.length > 0) {
      facteurs_observes.push({
        type: 'evenement_publie',
        detail: `${evFenetre.length} publication(s)/événement(s) sur la période (dernier : ${evFenetre[0]!.title.slice(0, 80)})`,
      });
    }
    if (decrochage_anormal && facteurs_observes.length === 0) {
      facteurs_observes.push({
        type: 'pression_vendeuse_sans_catalyseur',
        detail: 'Aucun détachement, OST ou publication défavorable identifié en base ; pression vendeuse / ajustement de marché.',
      });
    }

    const explication_decrochage: ExplicationDecrochage = {
      fenetre_debut: d3m,
      fenetre_fin: dateRef,
      perf_titre_pct: perf_3m_pct,
      perf_composite_pct: perf3mIndice,
      ecart_secteur_pct: null, // rempli après calcul des médianes sectorielles
      facteurs_observes,
    };

    const { sousScores, confiance } = construireSousScores(
      fondamentaux,
      dividendes,
      liq,
      drawdown_pct,
      resistance_jours_baisse_pct,
      freq_seances_positives_pct,
      perf_1m_pct,
      perf_5j_pct,
    );

    const aDesComptesRecents = fondamentaux.age_annees != null && fondamentaux.age_annees <= 2 && fondamentaux.resultat_net != null;
    const scoreRes = calculerScoreOpportunite(
      sousScores,
      confiance,
      aDesComptesRecents,
      opts.poids ?? POIDS_OPPORTUNITE_DEFAUT,
      {
        capitauxNegatifs: fondamentaux.capitaux_propres != null && fondamentaux.capitaux_propres <= 0,
        perteNette: fondamentaux.resultat_net != null && fondamentaux.resultat_net < 0,
      },
    );
    sousScores.plafonne_par_confiance = scoreRes.plafonne;

    const anomalies: string[] = [...item.anomaliesCours];
    if (!aDesComptesRecents) anomalies.push('États financiers récents (≤ 2 ans) absents ou incomplets');
    if (illiquide_flag) anomalies.push('Liquidité faible — faible variation potentiellement liée au manque de transactions');

    rows.push({
      code: item.instrument.code,
      date_marche: dateRef,
      designation: item.instrument.designation,
      secteur: item.instrument.secteur,
      pays: item.instrument.pays,
      famille_comptable: item.instrument.famille_comptable,
      isin: item.instrument.isin,
      date_introduction: item.instrument.date_introduction,
      capitalisation,
      cours_jour: coursJour,
      perf_1j_pct,
      perf_5j_pct,
      perf_1m_pct,
      perf_3m_pct,
      perf_6m_pct,
      perf_ytd_pct,
      perf_1a_pct,
      perf_totale_1a_pct,
      perf_totale_ytd_pct,
      drawdown_pct,
      date_sommet: dateSommet,
      valeur_sommet: Number.isFinite(sommetVal) ? sommetVal : null,
      volatilite_ann_pct,
      beta,
      force_relative_pct,
      resistance_jours_baisse_pct,
      freq_seances_positives_pct,
      stabilite_volumes,
      decrochage_relatif_pct,
      alpha_anormal_pct,
      decrochage_anormal,
      explication_decrochage,
      fondamentaux,
      dividendes,
      liquidite: liq,
      score_opportunite: scoreRes.score,
      score_confiance: confiance,
      sous_scores: sousScores,
      categorie: scoreRes.categorie,
      classement_a_rang: null,
      classement_b_rang: null,
      classement_c_rang: null,
      illiquide_flag,
      anomalies_donnees: anomalies,
    });
  }

  // Enrichissement des médianes sectorielles (PER, PBR, perf 3M secteur)
  const parSecteur = new Map<string, ActionResilienceRow[]>();
  for (const r of rows) {
    const arr = parSecteur.get(r.secteur) ?? [];
    arr.push(r);
    parSecteur.set(r.secteur, arr);
  }
  for (const group of parSecteur.values()) {
    const medPer = median(group.map((g) => g.fondamentaux.per).filter((v): v is number => v != null && v > 0));
    const medPbr = median(group.map((g) => g.fondamentaux.pbr).filter((v): v is number => v != null && v > 0));
    const medPerf3m = median(group.map((g) => g.perf_3m_pct).filter((v): v is number => v != null));
    for (const r of group) {
      r.fondamentaux.per_median_secteur = medPer != null ? round2(medPer) : null;
      r.fondamentaux.pbr_median_secteur = medPbr != null ? round2(medPbr) : null;
      if (r.perf_3m_pct != null && medPerf3m != null) {
        r.explication_decrochage.ecart_secteur_pct = round2(r.perf_3m_pct - medPerf3m);
      }
    }
  }

  // Classement A : Résistantes (exclut les titres illiquides pour éviter le biais de non-cotation)
  const eligiblesA = rows
    .filter((r) => !r.illiquide_flag && r.drawdown_pct != null)
    .sort((a, b) => {
      const sa = (a.force_relative_pct ?? 0) + (a.drawdown_pct ?? -100) + (a.resistance_jours_baisse_pct ?? 0) * 5;
      const sb = (b.force_relative_pct ?? 0) + (b.drawdown_pct ?? -100) + (b.resistance_jours_baisse_pct ?? 0) * 5;
      return sb - sa;
    });
  eligiblesA.forEach((r, idx) => { r.classement_a_rang = idx + 1; });

  // Classement B : Décotées solides (drawdown <= -10 %, qualité >= 55, confiance >= 50)
  const eligiblesB = rows
    .filter(
      (r) =>
        r.drawdown_pct != null &&
        r.drawdown_pct <= -10 &&
        (r.sous_scores.qualiteFinanciere ?? 0) >= 55 &&
        r.score_confiance >= 50,
    )
    .sort((a, b) => (b.score_opportunite ?? 0) - (a.score_opportunite ?? 0));
  eligiblesB.forEach((r, idx) => { r.classement_b_rang = idx + 1; });

  // Classement C : Fragiles (forte baisse + volatilité / fragilité fondamentale / faible score)
  const eligiblesC = rows
    .filter((r) => r.drawdown_pct != null)
    .sort((a, b) => {
      const fa = (a.drawdown_pct ?? 0) - (a.volatilite_ann_pct ?? 0) * 0.5 + (a.score_opportunite ?? 50) * 0.4;
      const fb = (b.drawdown_pct ?? 0) - (b.volatilite_ann_pct ?? 0) * 0.5 + (b.score_opportunite ?? 50) * 0.4;
      return fa - fb;
    });
  eligiblesC.forEach((r, idx) => { r.classement_c_rang = idx + 1; });

  return rows;
}

/**
 * Agrégation sectorielle avec distinction stricte entre performance du secteur
 * et contribution pondérée en points de % au mouvement du marché.
 */
export function agregerSecteursStress(
  actions: readonly ActionResilienceRow[],
  volumesJourByCode: ReadonlyMap<string, { volume: number; valeur: number }> = new Map(),
): SecteurStressRow[] {
  const capMarcheTotal = actions.reduce((s, a) => s + (a.capitalisation ?? 0), 0);
  const parSecteur = new Map<string, ActionResilienceRow[]>();

  for (const a of actions) {
    const arr = parSecteur.get(a.secteur) ?? [];
    arr.push(a);
    parSecteur.set(a.secteur, arr);
  }

  const weightedAvg = (items: readonly ActionResilienceRow[], pick: (a: ActionResilienceRow) => number | null): number | null => {
    let num = 0;
    let den = 0;
    for (const a of items) {
      const v = pick(a);
      if (v == null || !Number.isFinite(v)) continue;
      const w = a.capitalisation && a.capitalisation > 0 ? a.capitalisation : 1;
      num += v * w;
      den += w;
    }
    return den > 0 ? round2(num / den) : null;
  };

  const out: SecteurStressRow[] = [];
  for (const [secteur, items] of parSecteur.entries()) {
    const capSec = items.reduce((s, a) => s + (a.capitalisation ?? 0), 0);
    const poids = capMarcheTotal > 0 ? round2((100 * capSec) / capMarcheTotal) : 0;
    const perf1j = weightedAvg(items, (a) => a.perf_1j_pct);
    const perf1s = weightedAvg(items, (a) => a.perf_5j_pct);
    const perf1m = weightedAvg(items, (a) => a.perf_1m_pct);
    const perfYtd = weightedAvg(items, (a) => a.perf_ytd_pct);

    const nbHausses = items.filter((a) => (a.perf_1j_pct ?? 0) > 0).length;
    const nbBaisses = items.filter((a) => (a.perf_1j_pct ?? 0) < 0).length;
    const nbInchanges = items.length - nbHausses - nbBaisses;

    let volJour = 0;
    let valJour = 0;
    for (const a of items) {
      const vj = volumesJourByCode.get(a.code);
      if (vj) {
        volJour += vj.volume;
        valJour += vj.valeur;
      }
    }

    out.push({
      secteur,
      nb_valeurs: items.length,
      nb_hausses: nbHausses,
      nb_baisses: nbBaisses,
      nb_inchanges: nbInchanges,
      capitalisation_totale: capSec,
      poids_marche_pct: poids,
      perf_1j_pct: perf1j,
      perf_1s_pct: perf1s,
      perf_1m_pct: perf1m,
      perf_ytd_pct: perfYtd,
      contribution_1j_pts: perf1j != null && capMarcheTotal > 0 ? round4((poids / 100) * perf1j) : null,
      contribution_1m_pts: perf1m != null && capMarcheTotal > 0 ? round4((poids / 100) * perf1m) : null,
      volume_jour: volJour,
      valeur_echangee_jour: valJour,
    });
  }

  return out.sort((a, b) => (a.contribution_1m_pts ?? 0) - (b.contribution_1m_pts ?? 0));
}
