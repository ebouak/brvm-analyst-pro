/**
 * Calculs d'analyse fondamentale (purs, testables) + garde-fous qualité.
 * Toutes les valeurs monétaires sont en FCFA. Les fonctions retournent
 * `number | null` (null = donnée insuffisante).
 */

export interface FundamentalInputs {
  cours: number | null;       // dernier cours
  shares: number | null;      // nombre d'actions
  revenue: number | null;     // chiffre d'affaires
  net_income: number | null;  // résultat net
  equity: number | null;      // capitaux propres
  debt: number | null;        // dette financière
  dividende: number | null;   // dividende par action (dernier)
}

export interface Ratios {
  bpa: number | null;          // RN / shares
  per: number | null;          // cours / bpa
  pb: number | null;           // cours / (equity / shares)
  ps: number | null;           // (cours*shares) / revenue
  capitalisation: number | null; // cours * shares
  roe: number | null;          // RN / equity
  roa: number | null;          // RN / (equity + debt)  (proxy actif)
  margeNette: number | null;   // RN / revenue
  gearing: number | null;      // debt / equity
  rendementDiv: number | null; // dividende / cours
  payout: number | null;       // (dividende * shares) / RN
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

export function computeRatios(i: FundamentalInputs): Ratios {
  const bpa = div(i.net_income, i.shares);
  const capitalisation = i.cours != null && i.shares != null ? i.cours * i.shares : null;
  return {
    bpa,
    per: div(i.cours, bpa),
    pb: div(i.cours, div(i.equity, i.shares)),
    ps: div(capitalisation, i.revenue),
    capitalisation,
    roe: div(i.net_income, i.equity),
    roa: div(i.net_income, i.equity != null && i.debt != null ? i.equity + i.debt : null),
    margeNette: div(i.net_income, i.revenue),
    gearing: div(i.debt, i.equity),
    rendementDiv: div(i.dividende, i.cours),
    payout: i.dividende != null && i.shares != null ? div(i.dividende * i.shares, i.net_income) : null,
  };
}

export interface FundamentalRow {
  year: number | null;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt?: number | null;
  cash?: number | null;
  bfr?: number | null;
  is_manual?: boolean | null;
  source_file?: string | null;
}

/**
 * Sélectionne la « meilleure » ligne de fondamentaux à afficher.
 * Règle (best practice — fraîcheur + fiabilité) :
 *  1. On préfère l'exercice le PLUS RÉCENT dont les données sont plausibles
 *     (CA, RN, capitaux propres non aberrants — cf. assessQuality).
 *  2. À plausibilité et année égales, une ligne corrigée manuellement l'emporte.
 *  3. Si aucune ligne plausible, on retombe sur la plus récente disponible.
 */
export function pickBestFundamental<T extends FundamentalRow>(rows: T[]): T | null {
  if (!rows.length) return null;

  const isPlausible = (r: FundamentalRow): boolean =>
    assessQuality('revenue', r.revenue) === 'ok' &&
    assessQuality('net_income', r.net_income) === 'ok' &&
    (r.equity == null || assessQuality('equity', r.equity) === 'ok');

  const score = (r: T): [number, number, number] => [
    isPlausible(r) ? 1 : 0,        // plausible d'abord
    r.year ?? 0,                    // puis année récente
    r.is_manual ? 1 : 0,            // puis manuel
  ];

  return [...rows].sort((a, b) => {
    const sa = score(a), sb = score(b);
    return sb[0] - sa[0] || sb[1] - sa[1] || sb[2] - sa[2];
  })[0]!;
}

/**
 * `ns` = non significatif : le calcul est juste mais le ratio n'a pas de sens
 * financier. Un PER negatif ne trahit AUCUNE erreur d'extraction — il dit que la
 * societe perd de l'argent (SCRC : -10,3 Md FCFA en 2023, chiffre verifie). Le
 * confondre avec `suspect` envoyait l'utilisateur verifier des etats financiers
 * parfaitement corrects, et surtout laissait ces valeurs etre CLASSEES : au tri
 * par PER croissant, les plus grosses pertes remontaient en tete, presentees
 * comme les titres les moins chers.
 */
export type Quality = 'ok' | 'suspect' | 'ns' | 'missing';

/**
 * Évalue la plausibilité d'une métrique. Best practice : ne jamais afficher un
 * chiffre faux comme vrai. Les plages sont volontairement larges.
 */
export function assessQuality(metric: string, value: number | null): Quality {
  if (value == null || Number.isNaN(value)) return 'missing';
  switch (metric) {
    case 'revenue':
    case 'net_income':
    case 'equity':
    case 'capitalisation':
      // Une société cotée BRVM a un CA/RN/equity/capi > 1M FCFA (sinon extraction ratée).
      return Math.abs(value) < 1_000_000 ? 'suspect' : 'ok';
    case 'per':
      // Benefice negatif -> PER non significatif (convention financiere), pas
      // une donnee douteuse. Au-dela de 1000 en revanche, l'extraction est en cause.
      if (value < 0) return 'ns';
      return value > 1000 ? 'suspect' : 'ok';
    case 'pb':
    case 'ps':
      // Capitaux propres negatifs -> multiple non significatif.
      if (value < 0) return 'ns';
      return value > 100 ? 'suspect' : 'ok';
    case 'margeNette':
      return Math.abs(value) > 1 ? 'suspect' : 'ok';   // |marge| > 100%
    case 'roe':
    case 'roa':
      return Math.abs(value) > 2 ? 'suspect' : 'ok';   // |ROE| > 200%
    case 'gearing':
      return value < 0 || value > 20 ? 'suspect' : 'ok';
    case 'rendementDiv':
      return value < 0 || value > 0.5 ? 'suspect' : 'ok'; // rdt > 50%
    case 'payout':
      return value < 0 || value > 3 ? 'suspect' : 'ok';
    default:
      return 'ok';
  }
}
