/**
 * Moteur de dérivation du portefeuille — SOURCE UNIQUE DE VÉRITÉ.
 *
 * À partir des positions réelles (code, quantité, PRU, date d'entrée) et de
 * l'historique de cours, dérive de façon cohérente : valorisation courante,
 * P&L latent, capital investi, courbe d'équité historique, rendement, drawdown,
 * contribution par position et répartition sectorielle.
 *
 * Tout est calculé — rien n'est saisi manuellement ni inventé. Une seule vérité
 * alimente toutes les vues (Dashboard, Positions, Performance).
 *
 * Limite assumée : sans registre de ventes partielles, on suppose la détention
 * continue depuis `date_entree` (cohérent avec les données disponibles).
 *
 * Fonctions pures et testables.
 */

export interface RawPosition {
  code: string;
  quantite: number;
  prix_entree: number;       // PRU
  date_entree: string | null; // ISO ; null => présente depuis le début de l'historique
  secteur?: string | null;
  is_liquidites?: boolean;
}

export interface PricePoint {
  date: string; // ISO
  cours: number;
}

export interface EnrichedPosition {
  code: string;
  quantite: number;
  pru: number;
  cours: number;
  valeur: number;
  investi: number;
  pnl: number;
  pnlPct: number | null;
  poids: number;          // part de la valeur totale [0,1]
  secteur: string;
  isLiquidites: boolean;
}

export interface EquityPoint {
  date: string;
  value: number;     // valorisation au cours du marché
  invested: number;  // capital investi cumulé (PRU × quantité des positions entrées)
}

export interface SectorSlice {
  secteur: string;
  valeur: number;
  poids: number;
}

export interface PortfolioState {
  currentValue: number;
  investedCapital: number;
  latentPnl: number;
  latentPnlPct: number | null;
  totalReturn: number;        // (value/invested) - 1
  annualizedReturn: number | null;
  maxDrawdown: number;        // fraction positive
  equityCurve: EquityPoint[];
  positions: EnrichedPosition[];
  sectors: SectorSlice[];
  firstDate: string | null;
  lastDate: string | null;
}

/** Dernier cours connu à la date d (forward-fill) à partir d'une série triée croissante. */
function priceAsOf(series: PricePoint[], date: string): number | null {
  let val: number | null = null;
  for (const p of series) {
    if (p.date <= date) val = p.cours;
    else break;
  }
  return val;
}

export function derivePortfolio(
  positions: RawPosition[],
  priceHistory: Map<string, PricePoint[]>,
  today: string,
): PortfolioState {
  const empty: PortfolioState = {
    currentValue: 0, investedCapital: 0, latentPnl: 0, latentPnlPct: null,
    totalReturn: 0, annualizedReturn: null, maxDrawdown: 0,
    equityCurve: [], positions: [], sectors: [], firstDate: null, lastDate: null,
  };
  if (positions.length === 0) return empty;

  // Cours courant par code (dernier point de la série).
  const lastCours = (code: string): number => {
    const s = priceHistory.get(code);
    return s && s.length ? s[s.length - 1]!.cours : 0;
  };

  // 1) Positions enrichies (valorisation courante).
  const enriched: EnrichedPosition[] = positions.map((p) => {
    const isLiq = p.is_liquidites === true;
    // Liquidités : la valeur est portée par prix_entree (quantité = 1 par convention).
    const cours = isLiq ? p.prix_entree : lastCours(p.code);
    const valeur = isLiq ? p.prix_entree : p.quantite * cours;
    const investi = isLiq ? p.prix_entree : p.quantite * p.prix_entree;
    const pnl = valeur - investi;
    return {
      code: p.code,
      quantite: p.quantite,
      pru: p.prix_entree,
      cours,
      valeur,
      investi,
      pnl,
      pnlPct: investi > 0 ? pnl / investi : null,
      poids: 0, // rempli après le total
      secteur: p.secteur ?? 'Autre',
      isLiquidites: isLiq,
    };
  });

  const currentValue = enriched.reduce((s, p) => s + p.valeur, 0);
  const investedCapital = enriched.reduce((s, p) => s + p.investi, 0);
  for (const p of enriched) p.poids = currentValue > 0 ? p.valeur / currentValue : 0;

  const latentPnl = currentValue - investedCapital;
  const latentPnlPct = investedCapital > 0 ? latentPnl / investedCapital : null;

  // 2) Répartition sectorielle.
  const secMap = new Map<string, number>();
  for (const p of enriched) secMap.set(p.secteur, (secMap.get(p.secteur) ?? 0) + p.valeur);
  const sectors: SectorSlice[] = [...secMap.entries()]
    .map(([secteur, valeur]) => ({ secteur, valeur, poids: currentValue > 0 ? valeur / currentValue : 0 }))
    .sort((a, b) => b.valeur - a.valeur);

  // 3) Courbe d'équité historique (auto-dérivée).
  // Axe des dates = union des dates de cours des titres détenus, depuis la
  // plus ancienne date d'entrée. Les liquidités sont constantes dans le temps.
  const nonLiq = positions.filter((p) => p.is_liquidites !== true);
  const entryDates = nonLiq.map((p) => p.date_entree).filter((d): d is string => !!d);
  const firstEntry = entryDates.length ? entryDates.sort()[0]! : null;

  const dateSet = new Set<string>();
  for (const p of nonLiq) {
    const s = priceHistory.get(p.code);
    if (!s) continue;
    for (const pt of s) {
      if (!firstEntry || pt.date >= firstEntry) dateSet.add(pt.date);
    }
  }
  const axis = [...dateSet].filter((d) => d <= today).sort();

  const liqValue = enriched.filter((p) => p.isLiquidites).reduce((s, p) => s + p.valeur, 0);

  const equityCurve: EquityPoint[] = axis.map((d) => {
    let value = liqValue;
    let invested = liqValue;
    for (const p of nonLiq) {
      if (p.date_entree && p.date_entree > d) continue; // pas encore entrée
      const px = priceAsOf(priceHistory.get(p.code) ?? [], d);
      if (px == null) continue;
      value += p.quantite * px;
      invested += p.quantite * p.prix_entree;
    }
    return { date: d, value: +value.toFixed(2), invested: +invested.toFixed(2) };
  });

  // 4) Rendement & drawdown sur la courbe value/invested (performance du capital).
  const totalReturn = investedCapital > 0 ? latentPnl / investedCapital : 0;

  let annualizedReturn: number | null = null;
  if (firstEntry && totalReturn > -1) {
    const days = (Date.parse(today) - Date.parse(firstEntry)) / 86_400_000;
    const years = days / 365.25;
    annualizedReturn = years > 0.05 ? Math.pow(1 + totalReturn, 1 / years) - 1 : null;
  }

  // Max drawdown sur le ratio value/invested (performance hors apports).
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const pt of equityCurve) {
    const ratio = pt.invested > 0 ? pt.value / pt.invested : 1;
    if (ratio > peak) peak = ratio;
    if (peak > 0) {
      const dd = (peak - ratio) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  return {
    currentValue,
    investedCapital,
    latentPnl,
    latentPnlPct,
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    equityCurve,
    positions: enriched.sort((a, b) => b.valeur - a.valeur),
    sectors,
    firstDate: axis.length ? axis[0]! : null,
    lastDate: axis.length ? axis[axis.length - 1]! : null,
  };
}
