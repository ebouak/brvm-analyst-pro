/**
 * Métriques fondamentales d'une société BRVM.
 *
 * Garde-fous stricts : les états financiers extraits par LLM contiennent parfois
 * des magnitudes aberrantes (ex. net_income=13). On ne calcule un ratio que si
 * les entrées sont plausibles, sinon `reliable=false` et le ratio reste null.
 *
 * Fonctions pures et testables.
 */

export interface Fundamentals {
  year: number | null;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  cash: number | null;
  debt: number | null;
}

export interface ValuationInputs {
  current: Fundamentals;
  previous?: Fundamentals | null;
  price: number | null;       // cours actuel (FCFA)
  shares: number | null;      // nombre d'actions
  dividendPerShare: number | null; // dernier dividende /action (FCFA)
}

export interface ValuationMetrics {
  reliable: boolean;
  // par action (nécessite shares)
  eps: number | null;
  bvps: number | null;
  per: number | null;
  pbr: number | null;
  psr: number | null;
  marketCap: number | null;
  // sans shares
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
  dividendYield: number | null;
}

const EMPTY: ValuationMetrics = {
  reliable: false, eps: null, bvps: null, per: null, pbr: null, psr: null,
  marketCap: null, roe: null, netMargin: null, debtToEquity: null,
  revenueGrowth: null, netIncomeGrowth: null, dividendYield: null,
};

/**
 * Plausibilité des états financiers : on rejette les magnitudes incohérentes.
 * Le résultat net doit rester en valeur absolue inférieur au chiffre d'affaires,
 * et les fonds propres / CA strictement positifs et non dérisoires.
 */
export function isReliable(f: Fundamentals): boolean {
  if (f.year == null) return false;
  if (f.revenue == null || f.revenue <= 1_000_000) return false; // < 1 M FCFA = magnitude suspecte
  if (f.equity == null || f.equity <= 0) return false;
  if (f.net_income == null) return false;
  if (Math.abs(f.net_income) > f.revenue) return false; // résultat > CA = aberrant
  return true;
}

function growth(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}

export function computeMetrics(inp: ValuationInputs): ValuationMetrics {
  const f = inp.current;
  if (!isReliable(f)) return { ...EMPTY };

  const m: ValuationMetrics = { ...EMPTY, reliable: true };

  // Sans shares
  m.roe = f.equity! > 0 ? f.net_income! / f.equity! : null;
  m.netMargin = f.revenue! > 0 ? f.net_income! / f.revenue! : null;
  m.debtToEquity = f.debt != null && f.equity! > 0 ? f.debt / f.equity! : null;
  if (inp.previous && isReliable(inp.previous)) {
    m.revenueGrowth = growth(f.revenue, inp.previous.revenue);
    m.netIncomeGrowth = growth(f.net_income, inp.previous.net_income);
  }

  // Rendement dividende (n'a pas besoin de shares)
  if (inp.dividendPerShare != null && inp.price != null && inp.price > 0 && inp.dividendPerShare > 0) {
    m.dividendYield = inp.dividendPerShare / inp.price;
  }

  // Par action (nécessite shares plausibles)
  if (inp.shares != null && inp.shares > 0) {
    m.eps = f.net_income! / inp.shares;
    m.bvps = f.equity! / inp.shares;
    if (inp.price != null && inp.price > 0) {
      m.marketCap = inp.price * inp.shares;
      m.per = m.eps > 0 ? inp.price / m.eps : null; // P/E non significatif si pertes
      m.pbr = m.bvps > 0 ? inp.price / m.bvps : null;
      m.psr = f.revenue! > 0 ? m.marketCap / f.revenue! : null;
    }
  }

  return m;
}
