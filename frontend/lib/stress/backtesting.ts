// COPIE de scraper/src/stress/pure/backtesting.ts — NE PAS DIVERGER (vérifié par scraper/tests/stressCopie.test.ts).
/**
 * Moteur pur du Historical Backtesting Engine (Phase 3 — WESTBOURSE Stress Monitor).
 * Zéro dépendance I/O, zéro look-ahead bias, bootstrap déterministe.
 *
 * Copié vers `frontend/lib/stress/backtesting.ts`
 * (parité vérifiée par `scraper/tests/stressCopie.test.ts`).
 */
import { calculerDrawdowns } from './drawdowns';
import type { PointDrawdown, PointIndice } from './types';
import {
  HORIZONS_MOIS,
  JOURS_PAR_HORIZON,
  SEUILS_BACKTEST,
  type HorizonMois,
  type LimitesMethodologiquesBacktest,
  type MetriquesPeriodeStrategie,
  type ObservationFranchissement,
  type PointCourbeStrategie,
  type PortefeuilleResilientActionInput,
  type ResultatStrategie,
  type StatHorizonBacktest,
  type StatSeuilBacktest,
  type StatsDistribution,
  type StatutStatistique,
  type StrategieId,
  type SyntheseBacktest,
} from './backtestingTypes';

const MS_JOUR = 86_400_000;
const CAPITAL_INITIAL = 10_000_000;
const MIN_BOOTSTRAP = 5;
const MIN_SEANCES_PERIODE = 40;
const JOURS_CONFIRMATION_SOMMET = 5;

const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

function ajouterJours(iso: string, jours: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + jours * MS_JOUR).toISOString().slice(0, 10);
}

function diffJours(d1: string, d2: string): number {
  return Math.max(0, Math.round((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / MS_JOUR));
}

/** PRNG mulberry32 pour garantir un bootstrap 100 % reproductible. */
function mulberry32(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Intervalle de confiance bootstrap à 95 % sur la moyenne.
 * Garde-fou anti-extrapolation : renvoie `null` si `xs.length < 5`.
 */
export function intervalleBootstrapDeterministe(
  xs: readonly number[],
  tirages = 2000,
  graine = 42,
): [number, number] | null {
  if (xs.length < MIN_BOOTSTRAP) return null;
  const alea = mulberry32(graine);
  const moyennes: number[] = [];
  for (let k = 0; k < tirages; k++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) {
      s += xs[Math.floor(alea() * xs.length)]!;
    }
    moyennes.push(s / xs.length);
  }
  moyennes.sort((a, b) => a - b);
  const bas = moyennes[Math.floor(0.025 * tirages)]!;
  const haut = moyennes[Math.ceil(0.975 * tirages) - 1]!;
  return [round2(bas), round2(haut)];
}

function quantile(triee: readonly number[], p: number): number | null {
  if (triee.length === 0) return null;
  if (triee.length === 1) return round2(triee[0]!);
  const idx = (triee.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return round2(triee[lo]!);
  return round2(triee[lo]! + (triee[hi]! - triee[lo]!) * (idx - lo));
}

function statutDeN(n: number): StatutStatistique {
  if (n < 5) return 'insuffisant';
  if (n < 15) return 'indicatif';
  return 'robuste';
}

function synthetiserDistribution(
  observations: readonly ObservationFranchissement[],
  graine: number,
): StatsDistribution {
  const n = observations.length;
  const statut = statutDeN(n);
  const echantillonFaible = n < MIN_BOOTSTRAP;

  if (n === 0) {
    return {
      n: 0,
      moyenne_pct: null,
      mediane_pct: null,
      ecart_type_pct: null,
      min_pct: null,
      p10_pct: null,
      p25_pct: null,
      p75_pct: null,
      p90_pct: null,
      max_pct: null,
      proba_positif_pct: null,
      perte_sup_moyenne_pct: null,
      perte_sup_pire_pct: null,
      delai_retour_sommet_median_jours: null,
      ic95_moyenne: null,
      echantillon_faible: true,
      statut_statistique: 'insuffisant',
      observations: [],
    };
  }

  const rs = observations.map((o) => o.rendement_pct).sort((a, b) => a - b);
  const mean = rs.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? rs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const pertesSup = observations.map((o) => o.perte_sup_max_pct);
  const delais = observations
    .map((o) => o.delai_retour_sommet_jours)
    .filter((d): d is number => d != null)
    .sort((a, b) => a - b);

  return {
    n,
    moyenne_pct: round2(mean),
    mediane_pct: quantile(rs, 0.5),
    ecart_type_pct: n > 1 ? round2(Math.sqrt(variance)) : 0,
    min_pct: round2(rs[0]!),
    p10_pct: quantile(rs, 0.1),
    p25_pct: quantile(rs, 0.25),
    p75_pct: quantile(rs, 0.75),
    p90_pct: quantile(rs, 0.9),
    max_pct: round2(rs[n - 1]!),
    proba_positif_pct: round2((100 * rs.filter((r) => r > 0).length) / n),
    perte_sup_moyenne_pct: round2(pertesSup.reduce((s, x) => s + x, 0) / n),
    perte_sup_pire_pct: round2(Math.min(...pertesSup)),
    delai_retour_sommet_median_jours: delais.length > 0 ? Math.round(quantile(delais, 0.5)!) : null,
    ic95_moyenne: intervalleBootstrapDeterministe(rs, 2000, graine),
    echantillon_faible: echantillonFaible,
    statut_statistique: statut,
    observations: [...observations],
  };
}

function trouverIndiceHorizon(
  ddSerie: readonly PointDrawdown[],
  idxEntree: number,
  joursHorizon: number,
): number | null {
  const dateEntree = ddSerie[idxEntree]!.date_marche;
  const cible = ajouterJours(dateEntree, joursHorizon);
  const limite = ajouterJours(cible, 15);
  for (let j = idxEntree + 1; j < ddSerie.length; j++) {
    const d = ddSerie[j]!.date_marche;
    if (d >= cible) {
      return d <= limite ? j : null;
    }
  }
  return null;
}

function trouverDelaiRetourSommet(
  ddSerie: readonly PointDrawdown[],
  idxEntree: number,
  sommetPrecedent: number,
): number | null {
  const dateEntree = ddSerie[idxEntree]!.date_marche;
  for (let j = idxEntree + 1; j < ddSerie.length; j++) {
    if (ddSerie[j]!.valeur >= sommetPrecedent) {
      return diffJours(dateEntree, ddSerie[j]!.date_marche);
    }
  }
  return null;
}

/**
 * Calcule les statistiques de rendement post-correction (1/3/6/12/24 mois) pour
 * chaque seuil de drawdown.
 * Distingue systématiquement les observations indépendantes (zéro chevauchement)
 * de l'ensemble des franchissements bruts.
 */
export function calculerStatsSeuils(
  serieIndice: readonly PointIndice[],
  opts: { seuils?: readonly number[]; clusteringJours?: number; graine?: number } = {},
): StatSeuilBacktest[] {
  const ddSerie = calculerDrawdowns(serieIndice);
  const seuils = opts.seuils ?? SEUILS_BACKTEST;
  const clusteringJours = Math.max(15, opts.clusteringJours ?? 90);
  const graineBase = opts.graine ?? 42;

  return seuils.map((seuil, sIdx) => {
    // 1. Repérer tous les franchissements baissiers du seuil
    const indicesFranchissement: number[] = [];
    for (let t = 0; t < ddSerie.length; t++) {
      const dd = ddSerie[t]!.drawdown_pct;
      const prevDd = t > 0 ? ddSerie[t - 1]!.drawdown_pct : 0;
      if (dd <= seuil && (t === 0 || prevDd > seuil)) {
        indicesFranchissement.push(t);
      }
    }

    // Comptage d'épisodes indépendants de base (fenêtre de clustering seule)
    let dernierBase: string | null = null;
    let nbIndependantsBase = 0;
    for (const t of indicesFranchissement) {
      const d = ddSerie[t]!.date_marche;
      if (!dernierBase || diffJours(dernierBase, d) >= clusteringJours) {
        nbIndependantsBase++;
        dernierBase = d;
      }
    }

    const horizons: StatHorizonBacktest[] = HORIZONS_MOIS.map((hMois: HorizonMois, hIdx) => {
      const hJours = JOURS_PAR_HORIZON[hMois];
      const obsTous: ObservationFranchissement[] = [];

      for (const t of indicesFranchissement) {
        const ptEntree = ddSerie[t]!;
        const idxFin = trouverIndiceHorizon(ddSerie, t, hJours);
        if (idxFin == null) continue;
        const ptFin = ddSerie[idxFin]!;
        let minVal = ptEntree.valeur;
        for (let k = t + 1; k <= idxFin; k++) {
          if (ddSerie[k]!.valeur < minVal) minVal = ddSerie[k]!.valeur;
        }
        const perteSupMax = round2(((minVal / ptEntree.valeur) - 1) * 100);
        const rendement = round2(((ptFin.valeur / ptEntree.valeur) - 1) * 100);

        obsTous.push({
          date_entree: ptEntree.date_marche,
          valeur_entree: ptEntree.valeur,
          drawdown_entree_pct: ptEntree.drawdown_pct,
          sommet_precedent: ptEntree.sommet_precedent,
          rendement_pct: rendement,
          perte_sup_max_pct: Math.min(0, perteSupMax),
          delai_retour_sommet_jours: trouverDelaiRetourSommet(ddSerie, t, ptEntree.sommet_precedent),
        });
      }

      // Dé-chevauchement strict : au moins max(clusteringJours, hJours) jours entre deux entrées
      const espacementMin = Math.max(clusteringJours, hJours);
      const obsIndep: ObservationFranchissement[] = [];
      let derniereEntree: string | null = null;
      for (const o of obsTous) {
        if (!derniereEntree || diffJours(derniereEntree, o.date_entree) >= espacementMin) {
          obsIndep.push(o);
          derniereEntree = o.date_entree;
        }
      }

      const graine = graineBase + sIdx * 31 + hIdx * 7;
      return {
        horizon_mois: hMois,
        independant: synthetiserDistribution(obsIndep, graine),
        tous_franchissements: synthetiserDistribution(obsTous, graine + 1),
      };
    });

    return {
      seuil_pct: seuil,
      nb_franchissements_total: indicesFranchissement.length,
      nb_independants_base: nbIndependantsBase,
      horizons,
    };
  });
}

interface EtatQuotidienSimu {
  date: string;
  valeur: number;
  exposition: number;
  entreeJour: boolean;
  fraisJour: number;
}

function sousEchantillonnerCourbe(pts: readonly PointCourbeStrategie[], maxPts = 180): PointCourbeStrategie[] {
  if (pts.length <= maxPts) return [...pts];
  let idxPireDd = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i]!.drawdown_pct < pts[idxPireDd]!.drawdown_pct) idxPireDd = i;
  }
  const indices = new Set<number>([0, pts.length - 1, idxPireDd]);
  const pas = (pts.length - 1) / (maxPts - 1);
  for (let k = 0; k < maxPts; k++) indices.add(Math.round(k * pas));
  return [...indices].sort((a, b) => a - b).map((i) => pts[i]!);
}

function calculerMetriquesSegment(
  etats: readonly EtatQuotidienSimu[],
  capitalBase?: number,
): MetriquesPeriodeStrategie | null {
  if (etats.length < MIN_SEANCES_PERIODE) return null;
  const vDeb = capitalBase != null && capitalBase > 0 ? capitalBase : etats[0]!.valeur;
  const vFin = etats[etats.length - 1]!.valeur;
  if (!(vDeb > 0) || !(vFin > 0)) return null;

  const debut = etats[0]!.date;
  const fin = etats[etats.length - 1]!.date;
  const jours = diffJours(debut, fin);
  const annees = jours / 365.25;

  const rendementTotal = ((vFin / vDeb) - 1) * 100;
  const cagr = annees >= 0.5 ? (Math.pow(vFin / vDeb, 1 / annees) - 1) * 100 : null;

  let pic = vDeb;
  let ddMax = 0;
  const rJours: number[] = [];
  let sumExp = 0;
  let nbEntrees = 0;
  let fraisCum = 0;

  for (let i = 0; i < etats.length; i++) {
    const e = etats[i]!;
    if (e.valeur > pic) pic = e.valeur;
    const dd = pic > 0 ? ((e.valeur / pic) - 1) * 100 : 0;
    if (dd < ddMax) ddMax = dd;
    if (i > 0 && etats[i - 1]!.valeur > 0) {
      rJours.push(e.valeur / etats[i - 1]!.valeur - 1);
    }
    sumExp += e.exposition;
    if (e.entreeJour) nbEntrees++;
    fraisCum += e.fraisJour;
  }

  let volAnn: number | null = null;
  if (rJours.length >= 20) {
    const moy = rJours.reduce((s, x) => s + x, 0) / rJours.length;
    const v = rJours.reduce((s, x) => s + (x - moy) ** 2, 0) / (rJours.length - 1);
    volAnn = round2(Math.sqrt(v * 252) * 100);
  }

  const ratioCalmar = cagr != null && ddMax < -0.1 ? round2(cagr / Math.abs(ddMax)) : null;

  return {
    debut,
    fin,
    nb_seances: etats.length,
    rendement_total_pct: round2(rendementTotal),
    cagr_pct: cagr != null ? round2(cagr) : null,
    drawdown_max_pct: round2(ddMax),
    volatilite_ann_pct: volAnn,
    ratio_calmar: ratioCalmar,
    nb_entrees: nbEntrees,
    exposition_moyenne_pct: round2((sumExp / etats.length) * 100),
    cout_frais_pct: round2((fraisCum / vDeb) * 100),
  };
}

function construireCourbeBase100(etats: readonly EtatQuotidienSimu[]): PointCourbeStrategie[] {
  if (etats.length === 0) return [];
  const base = CAPITAL_INITIAL;
  let pic = base;
  const pts: PointCourbeStrategie[] = etats.map((e) => {
    if (e.valeur > pic) pic = e.valeur;
    return {
      date: e.date,
      base100: round2((e.valeur / base) * 100),
      drawdown_pct: round2(pic > 0 ? ((e.valeur / pic) - 1) * 100 : 0),
      exposition_pct: round2(e.exposition * 100),
    };
  });
  return sousEchantillonnerCourbe(pts, 180);
}

function finaliserStrategie(
  id: StrategieId,
  libelle: string,
  description: string,
  fraisAllerRetourPct: number,
  etats: readonly EtatQuotidienSimu[],
  splitWalkForwardDate: string,
  avertissements: string[],
): ResultatStrategie {
  const isEtats = etats.filter((e) => e.date < splitWalkForwardDate);
  const oosEtats = etats.filter((e) => e.date >= splitWalkForwardDate);

  const inSample = calculerMetriquesSegment(isEtats, CAPITAL_INITIAL);
  const outOfSample = calculerMetriquesSegment(oosEtats);
  if (!inSample) {
    avertissements.push(
      `Historique antérieur à ${splitWalkForwardDate} insuffisant (${isEtats.length} séances) : pas de segment In-Sample.`,
    );
  }

  return {
    id,
    libelle,
    description,
    disponible: etats.length >= MIN_SEANCES_PERIODE,
    raison_indisponibilite:
      etats.length < MIN_SEANCES_PERIODE
        ? `Historique insuffisant (${etats.length} séances, minimum ${MIN_SEANCES_PERIODE}).`
        : null,
    frais_aller_retour_pct: fraisAllerRetourPct,
    globale: calculerMetriquesSegment(etats, CAPITAL_INITIAL),
    in_sample: inSample,
    out_of_sample: outOfSample,
    courbe_base100: construireCourbeBase100(etats),
    avertissements,
  };
}

/**
 * Simule 3 stratégies indicielles disciplinées + benchmark Buy & Hold,
 * sans aucun look-ahead, avec frais aller-retour configurables et walk-forward.
 */
export function simulerStrategiesIndice(
  serieIndice: readonly PointIndice[],
  opts: { fraisAllerRetourPct?: number; splitWalkForwardDate?: string } = {},
): ResultatStrategie[] {
  const ddSerie = calculerDrawdowns(serieIndice);
  const fraisAR = Math.max(0, opts.fraisAllerRetourPct ?? 1.5);
  const fraisCote = fraisAR / 2 / 100;
  const splitDate = opts.splitWalkForwardDate ?? '2018-01-01';

  const avertsCommuns = [
    `Frais de courtage et taxes appliqués : ${fraisAR.toFixed(2)} % aller-retour (${(fraisCote * 100).toFixed(2)} % par mouvement).`,
    'Cash en attente rémunéré à 0 % ; exécution modélisée à la clôture du signal sur indice prix (hors dividendes).',
  ];

  if (ddSerie.length < MIN_SEANCES_PERIODE) {
    return [
      {
        id: 'buy_and_hold',
        libelle: 'Buy & Hold (Benchmark indice)',
        description: "Exposition permanente à 100 % sur l'indice depuis le début de la série.",
        disponible: false,
        raison_indisponibilite: 'Série trop courte.',
        frais_aller_retour_pct: fraisAR,
        globale: null,
        in_sample: null,
        out_of_sample: null,
        courbe_base100: [],
        avertissements: avertsCommuns,
      },
    ];
  }

  // Pré-calculs strictement causaux [0..t] pour confirmation (SMA20, vol20)
  const sma20: Array<number | null> = [];
  const vol20: Array<number | null> = [];
  for (let t = 0; t < ddSerie.length; t++) {
    if (t >= 19) {
      let s = 0;
      for (let k = t - 19; k <= t; k++) s += ddSerie[k]!.valeur;
      sma20.push(s / 20);
    } else {
      sma20.push(null);
    }
    if (t >= 20) {
      const r: number[] = [];
      for (let k = t - 19; k <= t; k++) {
        r.push(ddSerie[k]!.valeur / ddSerie[k - 1]!.valeur - 1);
      }
      const moy = r.reduce((a, b) => a + b, 0) / r.length;
      const v = r.reduce((a, b) => a + (b - moy) ** 2, 0) / (r.length - 1);
      vol20.push(Math.sqrt(v * 252) * 100);
    } else {
      vol20.push(null);
    }
  }

  // --- Stratégie 0 : Buy & Hold ---
  const etatsBH: EtatQuotidienSimu[] = [];
  {
    const p0 = ddSerie[0]!.valeur;
    const fraisInit = CAPITAL_INITIAL * fraisCote;
    const parts = (CAPITAL_INITIAL - fraisInit) / p0;
    for (let t = 0; t < ddSerie.length; t++) {
      const pt = ddSerie[t]!;
      etatsBH.push({
        date: pt.date_marche,
        valeur: parts * pt.valeur,
        exposition: 1,
        entreeJour: t === 0,
        fraisJour: t === 0 ? fraisInit : 0,
      });
    }
  }

  // --- Stratégie 1 : Achat sur seuil unique (-15 %) -> sortie retour au sommet ---
  const etatsSeuil: EtatQuotidienSimu[] = [];
  {
    let cash = CAPITAL_INITIAL;
    let parts = 0;
    let joursSommet = 0;
    for (let t = 0; t < ddSerie.length; t++) {
      const pt = ddSerie[t]!;
      let entreeJour = false;
      let fraisJour = 0;
      if (pt.drawdown_pct >= 0) joursSommet++;
      else joursSommet = 0;

      if (parts === 0 && pt.drawdown_pct <= -15) {
        const montant = cash;
        fraisJour = montant * fraisCote;
        parts = (montant - fraisJour) / pt.valeur;
        cash = 0;
        entreeJour = true;
      } else if (parts > 0 && joursSommet >= JOURS_CONFIRMATION_SOMMET) {
        const brut = parts * pt.valeur;
        fraisJour = brut * fraisCote;
        cash = brut - fraisJour;
        parts = 0;
      }
      const total = cash + parts * pt.valeur;
      etatsSeuil.push({
        date: pt.date_marche,
        valeur: total,
        exposition: total > 0 ? (parts * pt.valeur) / total : 0,
        entreeJour,
        fraisJour,
      });
    }
  }

  // --- Stratégie 2 : Achat progressif par paliers (-10 / -15 / -20 / -30 %) ---
  const etatsPaliers: EtatQuotidienSimu[] = [];
  {
    const paliers = [-10, -15, -20, -30] as const;
    let cash = CAPITAL_INITIAL;
    let parts = 0;
    let paliersDeclenches = [false, false, false, false];
    let joursSommet = 0;

    for (let t = 0; t < ddSerie.length; t++) {
      const pt = ddSerie[t]!;
      let entreeJour = false;
      let fraisJour = 0;
      if (pt.drawdown_pct >= 0) joursSommet++;
      else joursSommet = 0;

      // Déploiement des tranches restantes si le drawdown franchit un palier
      const tranchesRestantes = paliersDeclenches.filter((x) => !x).length;
      let aDeployer = 0;
      let nbNouveaux = 0;
      for (let idx = 0; idx < paliers.length; idx++) {
        if (!paliersDeclenches[idx] && pt.drawdown_pct <= paliers[idx]!) {
          paliersDeclenches[idx] = true;
          nbNouveaux++;
        }
      }
      if (nbNouveaux > 0 && tranchesRestantes > 0 && cash > 0) {
        aDeployer = cash * (nbNouveaux / tranchesRestantes);
        const f = aDeployer * fraisCote;
        parts += (aDeployer - f) / pt.valeur;
        cash -= aDeployer;
        fraisJour += f;
        entreeJour = true;
      } else if (parts > 0 && joursSommet >= JOURS_CONFIRMATION_SOMMET) {
        const brut = parts * pt.valeur;
        const f = brut * fraisCote;
        cash += brut - f;
        parts = 0;
        fraisJour += f;
        paliersDeclenches = [false, false, false, false];
      } else if (parts === 0 && joursSommet >= JOURS_CONFIRMATION_SOMMET) {
        paliersDeclenches = [false, false, false, false];
      }

      const total = cash + parts * pt.valeur;
      etatsPaliers.push({
        date: pt.date_marche,
        valeur: total,
        exposition: total > 0 ? (parts * pt.valeur) / total : 0,
        entreeJour,
        fraisJour,
      });
    }
  }

  // --- Stratégie 3 : Achat après confirmation de stabilisation (zéro look-ahead) ---
  const etatsConfirm: EtatQuotidienSimu[] = [];
  {
    let cash = CAPITAL_INITIAL;
    let parts = 0;
    let sommetPostEntree = 0;
    let joursSommet = 0;

    for (let t = 0; t < ddSerie.length; t++) {
      const pt = ddSerie[t]!;
      let entreeJour = false;
      let fraisJour = 0;
      if (pt.drawdown_pct >= 0) joursSommet++;
      else joursSommet = 0;

      if (parts > 0 && pt.valeur > sommetPostEntree) {
        sommetPostEntree = pt.valeur;
      }

      if (parts === 0 && t >= 60) {
        // Condition 1 : correction <= -10 % observée dans les 60 dernières séances
        let correctionRecente = false;
        for (let k = t - 60; k <= t; k++) {
          if (ddSerie[k]!.drawdown_pct <= -10) {
            correctionRecente = true;
            break;
          }
        }
        // Condition 2 & 3 : reprise au-dessus de SMA20 et momentum 20j positif
        const s20 = sma20[t];
        const v20Act = vol20[t];
        const p20Avant = ddSerie[t - 20]!.valeur;
        let volMaxRecente = 0;
        for (let k = Math.max(20, t - 40); k < t; k++) {
          const vk = vol20[k] ?? 0;
          if (vk > volMaxRecente) volMaxRecente = vk;
        }
        const detenteVol = v20Act != null && volMaxRecente > 0 && v20Act < volMaxRecente * 0.92;

        if (correctionRecente && s20 != null && pt.valeur > s20 && pt.valeur > p20Avant && detenteVol) {
          const montant = cash;
          fraisJour = montant * fraisCote;
          parts = (montant - fraisJour) / pt.valeur;
          cash = 0;
          sommetPostEntree = pt.valeur;
          entreeJour = true;
        }
      } else if (parts > 0) {
        const stopSuiveur = sommetPostEntree > 0 && pt.valeur <= sommetPostEntree * 0.88;
        if (joursSommet >= JOURS_CONFIRMATION_SOMMET || stopSuiveur) {
          const brut = parts * pt.valeur;
          fraisJour = brut * fraisCote;
          cash = brut - fraisJour;
          parts = 0;
          sommetPostEntree = 0;
        }
      }

      const total = cash + parts * pt.valeur;
      etatsConfirm.push({
        date: pt.date_marche,
        valeur: total,
        exposition: total > 0 ? (parts * pt.valeur) / total : 0,
        entreeJour,
        fraisJour,
      });
    }
  }

  return [
    finaliserStrategie(
      'buy_and_hold',
      'Buy & Hold (Benchmark indice)',
      "Exposition permanente à 100 % sur l'indice depuis la première séance disponible.",
      fraisAR,
      etatsBH,
      splitDate,
      [...avertsCommuns],
    ),
    finaliserStrategie(
      'seuil_unique',
      'Stratégie 1 — Achat sur seuil unique (−15 %)',
      "Entre à 100 % lorsque l'indice atteint −15 % de drawdown, puis revient en cash après 5 séances au-dessus du sommet précédent.",
      fraisAR,
      etatsSeuil,
      splitDate,
      [...avertsCommuns],
    ),
    finaliserStrategie(
      'achat_paliers',
      'Stratégie 2 — Achat progressif par paliers (−10/−15/−20/−30 %)',
      'Déploie 4 tranches égales de 25 % aux franchissements de −10 %, −15 %, −20 % et −30 %, et déboucle après retour confirmé au sommet.',
      fraisAR,
      etatsPaliers,
      splitDate,
      [...avertsCommuns],
    ),
    finaliserStrategie(
      'confirmation_stabilisation',
      'Stratégie 3 — Achat sur confirmation de stabilisation',
      'Attend un repli préalable ≤ −10 % suivi d’un franchissement au-dessus de la MM20, d’un momentum 20 séances positif et d’une détente de volatilité ; stop suiveur −12 %.',
      fraisAR,
      etatsConfirm,
      splitDate,
      [
        ...avertsCommuns,
        'Verdict du banc d’évaluation (2007–2026) : excès de rendement vs marché non prouvé (IC 95 % incluant zéro à 20 et 60 séances).',
      ],
    ),
  ];
}

function exerciceVisibleA(exercice: number, datePublication: string | null | undefined, dateMarche: string): boolean {
  if (datePublication && /^\d{4}-\d{2}-\d{2}/.test(datePublication)) {
    return datePublication.slice(0, 10) <= dateMarche;
  }
  // Règle stricte anti-look-ahead : comptes annuels Y réputés publics au 1er juillet Y+1
  return `${exercice + 1}-07-01` <= dateMarche;
}

/**
 * Stratégie 4 : Sélection trimestrielle des valeurs les plus résilientes sur
 * fondamentaux connus à la date de rebalancement (lag strict de publication).
 */
export function simulerPortefeuilleResilient(
  actions: readonly PortefeuilleResilientActionInput[],
  opts: { debut?: string; fraisAllerRetourPct?: number; maxTitres?: number } = {},
): ResultatStrategie {
  const debut = opts.debut ?? '2022-01-01';
  const fraisAR = Math.max(0, opts.fraisAllerRetourPct ?? 1.5);
  const fraisCote = fraisAR / 2 / 100;
  const maxTitres = Math.max(3, opts.maxTitres ?? 10);

  const averts = [
    'Fenêtre restreinte (2022–présent) en raison de la couverture historique des états financiers.',
    'Lag de publication appliqué : exercice Y visible uniquement à sa date de publication ou à défaut au 01/07/(Y+1).',
    'Biais de survie résiduel possible si d’anciens titres radiés ne disposent pas d’historiques complets.',
  ];

  // Collecter le calendrier des dates >= debut
  const datesSet = new Set<string>();
  const seriesParCode = new Map<string, { coursMap: Map<string, number>; dates: string[] }>();
  for (const a of actions) {
    const m = new Map<string, number>();
    const ds: string[] = [];
    const sorted = [...a.cours]
      .filter((c) => c.cours_ajuste > 0)
      .sort((x, y) => x.date_marche.localeCompare(y.date_marche));
    for (const c of sorted) {
      const d = c.date_marche.slice(0, 10);
      if (!m.has(d)) {
        m.set(d, c.cours_ajuste);
        ds.push(d);
      }
      if (d >= debut) datesSet.add(d);
    }
    if (ds.length > 0) seriesParCode.set(a.code, { coursMap: m, dates: ds });
  }

  const dates = [...datesSet].sort((a, b) => a.localeCompare(b));
  if (dates.length < MIN_SEANCES_PERIODE || actions.length < 3) {
    return {
      id: 'portefeuille_resilient',
      libelle: 'Stratégie 4 — Portefeuille valeurs résilientes (2022+)',
      description: 'Sélection trimestrielle équipondérée sur ROE connu positif, liquidité et tenue relative 12 mois.',
      disponible: false,
      raison_indisponibilite: 'Données actions ou historiques fondamentaux insuffisants sur la fenêtre 2022+.',
      frais_aller_retour_pct: fraisAR,
      globale: null,
      in_sample: null,
      out_of_sample: null,
      courbe_base100: [],
      avertissements: averts,
    };
  }

  const etats: EtatQuotidienSimu[] = [];
  let cash = CAPITAL_INITIAL;
  let positions = new Map<string, { parts: number; dernierCours: number }>();
  let dernierTrimestre = '';

  for (let t = 0; t < dates.length; t++) {
    const d = dates[t]!;
    // Mettre à jour la valorisation aux derniers cours connus <= d (report du dernier cours coté en cas de jour sans cotation)
    let valActions = 0;
    for (const [code, pos] of positions.entries()) {
      const s = seriesParCode.get(code);
      const coursJour = s?.coursMap.get(d);
      if (coursJour != null && coursJour > 0) pos.dernierCours = coursJour;
      valActions += pos.parts * pos.dernierCours;
    }
    let total = cash + valActions;
    let entreeJour = false;
    let fraisJour = 0;

    const trimestre = `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
    if (trimestre !== dernierTrimestre) {
      dernierTrimestre = trimestre;
      const d60 = ajouterJours(d, -90);
      const d365 = ajouterJours(d, -365);

      const eligibles: Array<{ code: string; cours: number; score: number }> = [];
      for (const a of actions) {
        const s = seriesParCode.get(a.code);
        const cJour = s?.coursMap.get(d);
        if (!s || cJour == null || !(cJour > 0)) continue;

        // Liquidité causale : au moins 25 séances cotées sur les ~90 derniers jours calendaires avant d
        const nb60 = s.dates.filter((dt) => dt >= d60 && dt <= d).length;
        if (nb60 < 25) continue;

        // Dernier exercice fondamental strictement visible à d
        const fondVis = [...a.fondamentaux]
          .filter((f) => exerciceVisibleA(f.exercice, f.date_publication, d))
          .sort((x, y) => y.exercice - x.exercice)[0];
        if (!fondVis || fondVis.resultat_net == null || fondVis.capitaux_propres == null) continue;
        if (fondVis.resultat_net <= 0 || fondVis.capitaux_propres <= 0) continue;
        const roe = (fondVis.resultat_net / fondVis.capitaux_propres) * 100;

        // Drawdown 12M strictement causal <= d
        let pic1a = cJour;
        for (const dt of s.dates) {
          if (dt >= d365 && dt <= d) {
            const p = s.coursMap.get(dt)!;
            if (p > pic1a) pic1a = p;
          }
        }
        const dd1a = ((cJour / pic1a) - 1) * 100;

        // Dividende connu à d
        const divVis = [...a.dividendes]
          .filter((dv) => exerciceVisibleA(dv.exercice, dv.ex_date, d) && dv.montant_net != null && dv.montant_net > 0)
          .sort((x, y) => y.exercice - x.exercice)[0];
        const rdtDiv = divVis?.montant_net ? (divVis.montant_net / cJour) * 100 : 0;

        const score = Math.min(30, roe) * 1.5 + Math.max(-40, dd1a) + Math.min(12, rdtDiv) * 2;
        eligibles.push({ code: a.code, cours: cJour, score });
      }

      if (eligibles.length >= 3) {
        eligibles.sort((x, y) => y.score - x.score);
        const selection = eligibles.slice(0, maxTitres);
        const poids = 1 / selection.length;
        const cibles = new Map<string, { valeurCible: number; cours: number }>();
        for (const s of selection) cibles.set(s.code, { valeurCible: total * poids, cours: s.cours });

        // Calcul du turnover pour appliquer les frais sur les ventes et achats réels
        let coutTotal = 0;
        const nouvelles = new Map<string, { parts: number; dernierCours: number }>();
        for (const [code, pos] of positions.entries()) {
          const valAct = pos.parts * pos.dernierCours;
          const cible = cibles.get(code)?.valeurCible ?? 0;
          if (valAct > cible) coutTotal += (valAct - cible) * fraisCote;
        }
        for (const [code, c] of cibles.entries()) {
          const valAct = (positions.get(code)?.parts ?? 0) * c.cours;
          if (c.valeurCible > valAct) coutTotal += (c.valeurCible - valAct) * fraisCote;
        }

        const totalNet = Math.max(0, total - coutTotal);
        for (const [code, c] of cibles.entries()) {
          const valAllouee = totalNet * poids;
          nouvelles.set(code, { parts: valAllouee / c.cours, dernierCours: c.cours });
        }
        positions = nouvelles;
        cash = 0;
        fraisJour = coutTotal;
        entreeJour = true;
        total = totalNet;
      }
    }

    etats.push({
      date: d,
      valeur: total,
      exposition: positions.size > 0 && total > 0 ? 1 : 0,
      entreeJour,
      fraisJour,
    });
  }

  const globale = calculerMetriquesSegment(etats, CAPITAL_INITIAL);
  return {
    id: 'portefeuille_resilient',
    libelle: 'Stratégie 4 — Portefeuille valeurs résilientes (2022+)',
    description:
      'Sélection trimestrielle équipondérée (jusqu’à 10 titres liquides) sur ROE connu positif, tenue relative 12M et dividende publié.',
    disponible: globale != null,
    raison_indisponibilite: globale == null ? 'Série résultante trop courte.' : null,
    frais_aller_retour_pct: fraisAR,
    globale,
    in_sample: null,
    out_of_sample: globale,
    courbe_base100: construireCourbeBase100(etats),
    avertissements: averts,
  };
}

export function limitesMethodologiquesDefaut(clusteringJours = 90): LimitesMethodologiquesBacktest {
  return {
    biais_survie:
      'Les séries d’indices historiques agrégées reflètent les valeurs cotées de chaque époque ; pour le portefeuille individuel (2022+), les sociétés radiées sans historique complet créent un biais de survie résiduel.',
    indice_prix_vs_total_return:
      'BRVMC, BRVM30 et BRVMPRES sont des indices de prix (hors réinvestissement des dividendes), ce qui sous-estime le rendement total réel perçu par un investisseur long terme.',
    hypothese_cash:
      'Les liquidités non investies dans les simulations de stratégies sont supposées rémunérées à 0 % et les ordres exécutés au cours de clôture avec frais de courtage aller-retour explicites.',
    regle_independance: `Mode « Observations indépendantes » : deux franchissements d’un même seuil doivent être espacés d’au moins max(${clusteringJours} jours, durée de l’horizon) pour éviter tout chevauchement statistique.`,
    fenetre_walk_forward:
      'Validation hors échantillon (Out-of-Sample) fixée chronologiquement à partir du 2018-01-01 sur BRVMC ; les séries démarrant en 2023 n’ont pas de segment In-Sample.',
    lag_publication_strategie4:
      'Dans la Stratégie 4, un exercice annuel Y n’est utilisable qu’à sa date de publication observée ou, à défaut, à compter du 1er juillet de l’année Y+1 (zéro anticipation).',
  };
}

/** Orchestrateur pur complet du Historical Backtesting Engine. */
export function construireSyntheseBacktest(
  serieIndice: readonly PointIndice[],
  opts: {
    indiceCode: string;
    fraisAllerRetourPct?: number;
    clusteringJours?: number;
    actionsStrategie4?: readonly PortefeuilleResilientActionInput[];
    sourceMode?: 'table_precalculee' | 'calcul_live';
    raisonIndisponibiliteStrat4?: string;
    graine?: number;
  },
): SyntheseBacktest {
  const ddSerie = calculerDrawdowns(serieIndice);
  const fraisAR = Math.max(0, opts.fraisAllerRetourPct ?? 1.5);
  const clustering = Math.max(15, opts.clusteringJours ?? 90);

  const stats_seuils = calculerStatsSeuils(serieIndice, {
    clusteringJours: clustering,
    graine: opts.graine,
  });

  const strategiesIndice = simulerStrategiesIndice(serieIndice, {
    fraisAllerRetourPct: fraisAR,
  });

  let strat4: ResultatStrategie;
  if (opts.actionsStrategie4 && opts.actionsStrategie4.length > 0) {
    strat4 = simulerPortefeuilleResilient(opts.actionsStrategie4, {
      fraisAllerRetourPct: fraisAR,
    });
  } else {
    strat4 = {
      id: 'portefeuille_resilient',
      libelle: 'Stratégie 4 — Portefeuille valeurs résilientes (2022+)',
      description:
        'Sélection trimestrielle équipondérée (jusqu’à 10 titres liquides) sur ROE connu positif, tenue relative 12M et dividende publié.',
      disponible: false,
      raison_indisponibilite:
        opts.raisonIndisponibiliteStrat4 ??
        (opts.indiceCode !== 'BRVMC'
          ? 'Portefeuille multi-valeurs calculé uniquement pour le référentiel BRVMC.'
          : 'Exécutez le pré-calcul CLI `stress:backtest` pour simuler la stratégie multi-actions.'),
      frais_aller_retour_pct: fraisAR,
      globale: null,
      in_sample: null,
      out_of_sample: null,
      courbe_base100: [],
      avertissements: [limitesMethodologiquesDefaut(clustering).lag_publication_strategie4],
    };
  }

  return {
    date_calcul: ddSerie.at(-1)?.date_marche ?? new Date().toISOString().slice(0, 10),
    indice_code: opts.indiceCode,
    source_mode: opts.sourceMode ?? 'calcul_live',
    debut_serie: ddSerie[0]?.date_marche ?? null,
    fin_serie: ddSerie.at(-1)?.date_marche ?? null,
    nb_seances: ddSerie.length,
    drawdown_actuel_pct: ddSerie.at(-1)?.drawdown_pct ?? null,
    frais_aller_retour_pct: fraisAR,
    mode_clustering_jours: clustering,
    stats_seuils,
    strategies: [...strategiesIndice, strat4],
    limites_methodologiques: limitesMethodologiquesDefaut(clustering),
  };
}
