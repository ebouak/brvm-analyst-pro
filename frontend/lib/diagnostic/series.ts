/**
 * Séries annuelles des graphiques du diagnostic — module pur.
 *
 * Mêmes sources que le prompt (income_statements, balance_sheets,
 * cash_flow_statements) : un graphique ne montre rien que le texte n'ait pu
 * lire. Un point manquant reste null ; le graphique le laisse en blanc, il ne
 * l'interpole pas.
 */

import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';

export interface PointAnnuel {
  annee: string;
  /** PNB pour une banque, chiffre d'affaires sinon. */
  revenu: number | null;
  resultatNet: number | null;
  resultatExploitation: number | null;
  /** En %. */
  margeNette: number | null;
  margeExploitation: number | null;
  coefExploitation: number | null;
  roe: number | null;
  roa: number | null;
  totalActifs: number | null;
  capitauxPropres: number | null;
  dettesFinancieres: number | null;
  /** Capitaux propres / total du bilan, en %. */
  fondsPropresSurBilan: number | null;
  credits: number | null;
  depots: number | null;
  /** Crédits / dépôts, en %. */
  transformation: number | null;
  tresorerie: number | null;
  fluxExploitation: number | null;
  fluxInvestissement: number | null;
  fluxFinancement: number | null;
  dpa: number | null;
  bpa: number | null;
  /** DPA / BPA, en %. */
  distribution: number | null;
}

/** « 2025 » ou « 2025-12-31 » → « 2025 » ; toute autre période → null (BICB « 2024-01-01 »). */
export function anneeDe(periode: string | null | undefined): string | null {
  if (!periode) return null;
  if (/^\d{4}$/.test(periode)) return periode;
  if (/^\d{4}-12-31$/.test(periode)) return periode.slice(0, 4);
  return null;
}

const ratio = (a: number | null | undefined, b: number | null | undefined, facteur = 100): number | null =>
  a != null && b != null && b !== 0 ? (a / b) * facteur : null;

function parAnnee<T extends { periode: string }>(lignes: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const l of lignes) {
    const a = anneeDe(String(l.periode));
    if (a && !m.has(a)) m.set(a, l);
  }
  return m;
}

export function seriesAnnuelles(e: {
  famille: 'banque' | 'assurance' | 'general' | null | undefined;
  income: IncomeStatement[];
  balance: BalanceSheet[];
  cashflow: CashFlowStatement[];
  /** Nombre d'exercices au plus (les plus récents). */
  max?: number;
}): PointAnnuel[] {
  const inc = parAnnee(e.income);
  const bal = parAnnee(e.balance);
  const cf = parAnnee(e.cashflow);
  const annees = [...new Set([...inc.keys(), ...bal.keys()])].sort().slice(-(e.max ?? 6));
  const banque = e.famille === 'banque';

  return annees.map((annee) => {
    const i = inc.get(annee) ?? null;
    const b = bal.get(annee) ?? null;
    const c = cf.get(annee) ?? null;
    const li = (i?.lignes_specifiques ?? {}) as Record<string, number | null>;
    const lb = (b?.lignes_specifiques ?? {}) as Record<string, number | null>;
    const revenu = (banque ? li.pnb : null) ?? i?.revenu_total ?? null;
    const rn = i?.resultat_net ?? null;
    const fg = i?.depenses_exploitation ?? i?.frais_generaux_admin ?? null;
    const credits = lb.credits_clientele ?? null;
    const depots = lb.depots_clientele ?? null;
    const dettes = b?.dette_court_terme != null || b?.dette_long_terme != null
      ? (b?.dette_court_terme ?? 0) + (b?.dette_long_terme ?? 0) : null;
    const bpa = i?.benefice_par_action ?? null;
    const dpa = i?.dividende_par_action != null && i.dividende_par_action > 0 ? i.dividende_par_action : null;
    return {
      annee,
      revenu,
      resultatNet: rn,
      resultatExploitation: i?.resultat_exploitation ?? null,
      margeNette: ratio(rn, revenu),
      margeExploitation: ratio(i?.resultat_exploitation, revenu),
      coefExploitation: banque && fg != null ? ratio(Math.abs(fg), revenu) : null,
      roe: ratio(rn, b?.total_capitaux_propres),
      roa: ratio(rn, b?.total_actifs),
      totalActifs: b?.total_actifs ?? null,
      capitauxPropres: b?.total_capitaux_propres ?? null,
      dettesFinancieres: banque ? null : dettes,
      fondsPropresSurBilan: ratio(b?.total_capitaux_propres, b?.total_actifs),
      credits,
      depots,
      transformation: ratio(credits, depots),
      tresorerie: b?.tresorerie_equivalents ?? null,
      fluxExploitation: c?.flux_exploitation ?? null,
      fluxInvestissement: c?.flux_investissement ?? null,
      fluxFinancement: c?.flux_financement ?? null,
      dpa,
      bpa,
      distribution: dpa != null && bpa != null && bpa > 0 ? (dpa / bpa) * 100 : null,
    };
  });
}

/** Vrai si la série porte au moins `min` valeurs non nulles pour cette clé. */
export function assez(points: PointAnnuel[], cle: keyof PointAnnuel, min = 2): boolean {
  return points.filter((p) => p[cle] != null).length >= min;
}
