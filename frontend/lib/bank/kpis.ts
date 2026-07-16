/**
 * Analyse bancaire UEMOA — extraction des postes pertinents des états
 * financiers (prêts, dépôts, marge d'intérêts, PNB…) + KPIs + score /100.
 *
 * ── Sources des barèmes ──
 * Les seuils suivent les indicateurs mis en avant par la Commission Bancaire
 * UMOA et les FSI du FMI : ROE ~15 %, ROA ~1,5 %, coefficient d'exploitation
 * 50-80 %, NPL 5-15 %, ratio de solvabilité réglementaire UEMOA ≥ 11,5 %,
 * transformation crédits/dépôts 50-100 %, NIM ~4 %.
 *
 * ── Honnêteté des données ──
 * Les banques BRVM ne publient PAS toutes leurs créances douteuses ni leur
 * ratio de solvabilité dans les états déposés. Un sous-indicateur absent est
 * NEUTRALISÉ : il sort du dénominateur (pas un zéro déguisé), et la CONFIANCE
 * du score (points disponibles / 100) est affichée. Même philosophie que le
 * scoring §9 des signaux.
 *
 * Fonctions PURES, testées dans kpis.test.mjs.
 */

export interface BankYearInputs {
  periode: string;
  /** Produit net bancaire (le « CA » d'une banque). */
  pnb: number | null;
  /** Marge d'intérêts (base du NIM). */
  margeInterets: number | null;
  /** Frais généraux d'exploitation. */
  fraisGeneraux: number | null;
  resultatNet: number | null;
  totalActifs: number | null;
  capitauxPropres: number | null;
  /** Dépôts de la clientèle (ressources). */
  depotsClientele: number | null;
  /** Crédits à la clientèle (les prêts). */
  creditsClientele: number | null;
  /** Créances douteuses brutes — rarement publié. */
  creancesDouteuses: number | null;
  /** Ratio de solvabilité réglementaire (fraction, ex 0.13) — rarement publié. */
  ratioSolvabilite: number | null;
}

export interface BankMarketInputs {
  cours: number | null;
  shares: number | null;
  dividendeParAction: number | null;
}

export interface BankKpis {
  roe: number | null;              // RN / CP moyens
  roa: number | null;              // RN / actifs moyens
  nim: number | null;              // marge d'intérêts / actifs moyens
  costIncome: number | null;       // frais généraux / PNB
  transformation: number | null;   // crédits clientèle / dépôts clientèle
  nplRatio: number | null;         // créances douteuses / crédits bruts
  leverage: number | null;         // CP / total actifs
  ratioSolvabilite: number | null;
  pb: number | null;               // capitalisation / CP
  rendementDiv: number | null;     // DPA / cours
  depotsClientele: number | null;
  creditsClientele: number | null;
  totalActifs: number | null;
  capitauxPropres: number | null;
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

/** Moyenne de deux valeurs si les deux existent, sinon celle qui existe. */
function avg(cur: number | null, prev: number | null): number | null {
  if (cur == null) return prev;
  if (prev == null) return cur;
  return (cur + prev) / 2;
}

/**
 * Extrait les postes bancaires d'une paire (income, balance) telle que stockée :
 * colonnes standard + lignes_specifiques jsonb (pipeline familles comptables).
 */
export function extractBankYear(
  income: {
    periode: string;
    resultat_net: number | null;
    depenses_exploitation?: number | null;
    frais_generaux_admin?: number | null;
    lignes_specifiques?: Record<string, number | null> | null;
  } | null,
  balance: {
    total_actifs: number | null;
    total_capitaux_propres: number | null;
    lignes_specifiques?: Record<string, number | null> | null;
  } | null,
): BankYearInputs | null {
  if (!income && !balance) return null;
  const li = income?.lignes_specifiques ?? {};
  const lb = balance?.lignes_specifiques ?? {};
  return {
    periode: income?.periode ?? '',
    pnb: li.pnb ?? null,
    margeInterets: li.marge_interets ?? null,
    fraisGeneraux: income?.depenses_exploitation ?? income?.frais_generaux_admin ?? null,
    resultatNet: income?.resultat_net ?? null,
    totalActifs: balance?.total_actifs ?? null,
    capitauxPropres: balance?.total_capitaux_propres ?? null,
    depotsClientele: lb.depots_clientele ?? null,
    creditsClientele: lb.credits_clientele ?? null,
    creancesDouteuses: lb.creances_douteuses ?? null,
    ratioSolvabilite: lb.ratio_solvabilite ?? null,
  };
}

/** KPIs bancaires. `prev` (exercice précédent) affine ROE/ROA/NIM en moyennes. */
export function computeBankKpis(
  cur: BankYearInputs,
  prev: BankYearInputs | null,
  market: BankMarketInputs,
): BankKpis {
  const actifsMoyens = avg(cur.totalActifs, prev?.totalActifs ?? null);
  const cpMoyens = avg(cur.capitauxPropres, prev?.capitauxPropres ?? null);
  const capitalisation =
    market.cours != null && market.shares != null ? market.cours * market.shares : null;

  return {
    roe: div(cur.resultatNet, cpMoyens),
    roa: div(cur.resultatNet, actifsMoyens),
    nim: div(cur.margeInterets, actifsMoyens),
    costIncome: div(cur.fraisGeneraux, cur.pnb),
    transformation: div(cur.creditsClientele, cur.depotsClientele),
    nplRatio: div(cur.creancesDouteuses, cur.creditsClientele),
    leverage: div(cur.capitauxPropres, cur.totalActifs),
    ratioSolvabilite: cur.ratioSolvabilite,
    pb: div(capitalisation, cur.capitauxPropres),
    rendementDiv: div(market.dividendeParAction, market.cours),
    depotsClientele: cur.depotsClientele,
    creditsClientele: cur.creditsClientele,
    totalActifs: cur.totalActifs,
    capitauxPropres: cur.capitauxPropres,
  };
}

// ─────────────────────────── Score UEMOA /100 ───────────────────────────

export interface SousScore {
  id: string;
  label: string;
  /** Valeur brute du KPI (fraction pour les %) — null si non publié. */
  valeur: number | null;
  /** 'pct' | 'ratio' pour l'affichage. */
  format: 'pct' | 'ratio';
  points: number | null; // null = non disponible (neutralisé)
  max: number;
}

export interface AxeScore {
  id: string;
  label: string;
  sousScores: SousScore[];
  /** Points obtenus sur les sous-indicateurs DISPONIBLES. */
  obtenus: number;
  /** Total des max disponibles (≤ 25). */
  disponibles: number;
}

export interface BankScore {
  /** Score /100, renormalisé sur les indicateurs disponibles. */
  total: number | null;
  /** Part des 100 points effectivement mesurable (0-1). */
  confiance: number;
  axes: AxeScore[];
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** Interpolation linéaire de `worst` (0 pt) à `best` (max pts). */
function lin(v: number, worst: number, best: number, max: number): number {
  if (worst === best) return max;
  return clamp(((v - worst) / (best - worst)) * max, 0, max);
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function scoreBanqueUemoa(k: BankKpis): BankScore {
  // — Rentabilité (25) : ROE 10 (0→15 %), ROA 5 (0→1,5 %), coef. exploitation 10 (80→50 %)
  const rentabilite: SousScore[] = [
    { id: 'roe', label: 'ROE', valeur: k.roe, format: 'pct', max: 10,
      points: k.roe == null ? null : r1(lin(k.roe, 0, 0.15, 10)) },
    { id: 'roa', label: 'ROA', valeur: k.roa, format: 'pct', max: 5,
      points: k.roa == null ? null : r1(lin(k.roa, 0, 0.015, 5)) },
    { id: 'ce', label: "Coefficient d'exploitation", valeur: k.costIncome, format: 'pct', max: 10,
      points: k.costIncome == null ? null : r1(lin(k.costIncome, 0.80, 0.50, 10)) },
  ];

  // — Qualité du portefeuille (25) : NPL 10 (15→5 %), couverture 10 (non stockée),
  //   dégradation brute 5 (repli = NPL, comme le préconise la BCEAO à défaut)
  const qualite: SousScore[] = [
    { id: 'npl', label: 'Créances douteuses / crédits', valeur: k.nplRatio, format: 'pct', max: 10,
      points: k.nplRatio == null ? null : r1(lin(k.nplRatio, 0.15, 0.05, 10)) },
    { id: 'couverture', label: 'Couverture des douteuses', valeur: null, format: 'pct', max: 10,
      points: null }, // provisions non publiées dans les états déposés
    { id: 'degradation', label: 'Taux brut de dégradation', valeur: k.nplRatio, format: 'pct', max: 5,
      points: k.nplRatio == null ? null : r1(lin(k.nplRatio, 0.15, 0.05, 5)) },
  ];

  // — Solidité (25) : ratio de solvabilité 20 (11,5 % réglementaire → 18 %),
  //   levier CP/actifs 5 (2→4 %)
  const solidite: SousScore[] = [
    { id: 'solva', label: 'Ratio de solvabilité (min 11,5 %)', valeur: k.ratioSolvabilite, format: 'pct', max: 20,
      points: k.ratioSolvabilite == null ? null : r1(lin(k.ratioSolvabilite, 0.115, 0.18, 20)) },
    { id: 'levier', label: 'Capitaux propres / actifs', valeur: k.leverage, format: 'pct', max: 5,
      points: k.leverage == null ? null : r1(lin(k.leverage, 0.02, 0.04, 5)) },
  ];

  // — Intermédiation & marché (25) : NIM 10 (0→4 %), transformation 10 (50→100 %),
  //   marché 5 (P/B 0,8-1,5 : 2,5 pts ; rendement 3-8 % : 2,5 pts)
  let marchePts: number | null = null;
  if (k.pb != null || k.rendementDiv != null) {
    marchePts = 0;
    if (k.pb != null && k.pb >= 0.8 && k.pb <= 1.5) marchePts += 2.5;
    if (k.rendementDiv != null && k.rendementDiv >= 0.03 && k.rendementDiv <= 0.08) marchePts += 2.5;
  }
  const intermediation: SousScore[] = [
    { id: 'nim', label: "Marge nette d'intérêts (NIM)", valeur: k.nim, format: 'pct', max: 10,
      points: k.nim == null ? null : r1(lin(k.nim, 0, 0.04, 10)) },
    { id: 'transformation', label: 'Transformation (crédits / dépôts)', valeur: k.transformation, format: 'pct', max: 10,
      points: k.transformation == null ? null : r1(lin(k.transformation, 0.5, 1.0, 10)) },
    { id: 'marche', label: 'Marché (P/B + rendement)', valeur: null, format: 'ratio', max: 5,
      points: marchePts == null ? null : r1(marchePts) },
  ];

  const axes: AxeScore[] = [
    { id: 'rentabilite', label: 'Rentabilité', sousScores: rentabilite, obtenus: 0, disponibles: 0 },
    { id: 'qualite', label: 'Qualité du portefeuille', sousScores: qualite, obtenus: 0, disponibles: 0 },
    { id: 'solidite', label: 'Solidité', sousScores: solidite, obtenus: 0, disponibles: 0 },
    { id: 'intermediation', label: 'Intermédiation & marché', sousScores: intermediation, obtenus: 0, disponibles: 0 },
  ];

  let obtenus = 0;
  let disponibles = 0;
  for (const axe of axes) {
    for (const s of axe.sousScores) {
      if (s.points != null) {
        axe.obtenus += s.points;
        axe.disponibles += s.max;
      }
    }
    axe.obtenus = r1(axe.obtenus);
    obtenus += axe.obtenus;
    disponibles += axe.disponibles;
  }

  return {
    // En-dessous de 40 points mesurables, un score /100 serait de la fausse
    // précision — on ne l'affiche pas.
    total: disponibles >= 40 ? Math.round((obtenus / disponibles) * 100) : null,
    confiance: Math.round((disponibles / 100) * 100) / 100,
    axes,
  };
}
