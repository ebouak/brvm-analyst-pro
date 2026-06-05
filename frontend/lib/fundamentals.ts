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

export type Quality = 'ok' | 'suspect' | 'missing';

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
      return value < 0 || value > 1000 ? 'suspect' : 'ok';
    case 'pb':
    case 'ps':
      return value < 0 || value > 100 ? 'suspect' : 'ok';
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
