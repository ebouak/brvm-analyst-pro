import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';

export interface RedFlagCheck {
  id: string;
  label: string;
  triggered: boolean;
  severity: number; // 0-10
  evidence: string;
  dataAvailable: boolean;
}

export interface RedFlagsResult {
  checks: RedFlagCheck[];
  overallScore: number | null; // null si aucun check n'a de données
}

const WEIGHTS: Record<string, number> = {
  effet_ciseaux: 1,
  compression_marges: 1,
  divergence_cash: 2,
  dette_cachee: 2,
  dividende_non_couvert: 1,
  tension_liquidite: 1,
  detresse_altman: 1.5,
  dilution: 0.5,
};

/** Contrôles conçus pour une entreprise industrielle, et pourquoi ils ne valent pas pour une banque. */
export const NON_APPLICABLES_BANQUE: Record<string, string> = {
  divergence_cash: "les flux d'une banque reflètent ses dépôts et ses prêts, pas la conversion du résultat en trésorerie",
  dette_cachee: "une banque n'a pas de BFR ; son passif, ce sont les dépôts de ses clients",
  dividende_non_couvert: 'la couverture du dividende se lit sur le résultat et la solvabilité, pas sur un free cash-flow',
  tension_liquidite: "la liquidité d'une banque se lit sur ses dépôts et ses crédits, pas sur le ratio de liquidité générale",
  detresse_altman: "le score d'Altman est calibré sur des entreprises industrielles",
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number | null | undefined, decimals = 1): string {
  return n == null ? 'N/D' : n.toFixed(decimals);
}

/** Frais généraux / PNB, en %. null si l'un manque. */
function coefficient(inc: IncomeStatement | null): number | null {
  const ls = (inc?.lignes_specifiques ?? {}) as Record<string, number | null>;
  const pnb = ls.pnb ?? inc?.revenu_total ?? null;
  const fg = inc?.depenses_exploitation ?? inc?.frais_generaux_admin ?? null;
  return pnb != null && pnb > 0 && fg != null ? (Math.abs(fg) / pnb) * 100 : null;
}

/** Variante bancaire de « compression des marges » : le coefficient d'exploitation se dégrade. */
function coefficientBanque(inc_n: IncomeStatement | null, inc_n1: IncomeStatement | null): RedFlagCheck {
  const n = coefficient(inc_n);
  const n1 = coefficient(inc_n1);
  const dataAvailable = n != null && n1 != null;
  const hausse = dataAvailable ? n! - n1! : 0;
  const triggered = dataAvailable && hausse > 0;
  return {
    id: 'compression_marges',
    label: "Dégradation du coefficient d'exploitation",
    triggered,
    severity: triggered ? clamp(Math.round(hausse), 1, 10) : 0,
    evidence: dataAvailable
      ? `Coefficient d'exploitation ${fmt(n)} % (vs ${fmt(n1)} %) — frais généraux / PNB`
      : "Coefficient d'exploitation non calculable sur les 2 exercices",
    dataAvailable,
  };
}

export function computeRedFlags(params: {
  inc_n: IncomeStatement | null;
  inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null;
  bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  cf_n1: CashFlowStatement | null;
  m: DiagnosticMetrics;
  /** Famille comptable : pour une banque, certains contrôles n'ont pas de sens. */
  famille?: 'banque' | 'assurance' | 'general' | null;
}): RedFlagsResult {
  const { inc_n, inc_n1, bal_n, cf_n, m } = params;
  const checks: RedFlagCheck[] = [];

  // 1. Effet ciseaux : CA en hausse mais RN en baisse.
  {
    const dataAvailable = m.cagr_ca != null && m.cagr_rn != null;
    const triggered = dataAvailable && m.cagr_ca! > 0 && m.cagr_rn! < 0;
    const severity = triggered ? clamp(Math.round(Math.abs(m.cagr_rn!) / 3), 0, 10) : 0;
    checks.push({
      id: 'effet_ciseaux',
      label: 'Effet ciseaux (CA en hausse, RN en baisse)',
      triggered,
      severity,
      evidence: dataAvailable
        ? `CA ${m.cagr_ca! >= 0 ? '+' : ''}${fmt(m.cagr_ca)} %, RN ${m.cagr_rn! >= 0 ? '+' : ''}${fmt(m.cagr_rn)} %`
        : 'Données de croissance CA/RN insuffisantes',
      dataAvailable,
    });
  }

  // 2. Compression des marges : marge brute et/ou EBITDA en recul.
  {
    const dataAvailable = (m.marge_brute_n != null && m.marge_brute_n1 != null)
      || (m.marge_ebitda_n != null && m.marge_ebitda_n1 != null);
    const dropBrute = (m.marge_brute_n != null && m.marge_brute_n1 != null)
      ? m.marge_brute_n1 - m.marge_brute_n : null;
    const dropEbitda = (m.marge_ebitda_n != null && m.marge_ebitda_n1 != null)
      ? m.marge_ebitda_n1 - m.marge_ebitda_n : null;
    const maxDrop = Math.max(dropBrute ?? -Infinity, dropEbitda ?? -Infinity);
    const triggered = dataAvailable && maxDrop > 0;
    const severity = triggered ? clamp(Math.round(maxDrop), 0, 10) : 0;
    checks.push({
      id: 'compression_marges',
      label: 'Compression des marges',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Marge brute ${fmt(m.marge_brute_n)} % (vs ${fmt(m.marge_brute_n1)} %), marge EBITDA ${fmt(m.marge_ebitda_n)} % (vs ${fmt(m.marge_ebitda_n1)} %)`
        : 'Marges non calculables sur les 2 périodes',
      dataAvailable,
    });
  }

  // 3. Divergence RN ↔ cash réel (précédent réel : BNBC 2025).
  {
    const rn = inc_n?.resultat_net ?? null;
    const fluxExploit = cf_n?.flux_exploitation ?? null;
    const dataAvailable = rn != null && (m.fcf_n != null || fluxExploit != null);
    const triggered = dataAvailable && rn! > 0
      && ((fluxExploit != null && fluxExploit < 0) || (m.fcf_n != null && m.fcf_n < 0));
    const severity = triggered ? (fluxExploit != null && fluxExploit < 0 ? 9 : 6) : 0;
    checks.push({
      id: 'divergence_cash',
      label: 'Divergence résultat net ↔ cash réel',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Résultat net ${fmt(rn, 0)}, flux d'exploitation ${fmt(fluxExploit, 0)}, FCF ${fmt(m.fcf_n, 0)}`
        : 'Flux de trésorerie non disponibles',
      dataAvailable,
    });
  }

  // 4. Dette sous-évaluée : BFR élevé (jours de CA) alors que la dette LT affichée est faible
  //    (précédent réel : ONTBF — BFR financé par découverts non visibles en dette LT).
  {
    const dataAvailable = m.bfr_jours != null && bal_n?.dette_long_terme != null && m.bfr_n != null;
    const triggered = dataAvailable && m.bfr_jours! > 90 && bal_n!.dette_long_terme! < m.bfr_n! * 0.5;
    const severity = triggered ? clamp(Math.round(m.bfr_jours! / 15), 0, 10) : 0;
    checks.push({
      id: 'dette_cachee',
      label: 'Dette sous-évaluée (BFR financé hors dette LT affichée)',
      triggered,
      severity,
      evidence: dataAvailable
        ? `BFR ${fmt(m.bfr_jours, 0)} jours de CA, dette LT affichée ${fmt(bal_n?.dette_long_terme, 0)}`
        : 'BFR ou dette long terme non disponibles',
      dataAvailable,
    });
  }

  // 5. Dividende non couvert par le cash.
  {
    const dataAvailable = m.payout_ratio != null && m.fcf_div_cover != null;
    const triggered = dataAvailable && m.payout_ratio! > 60 && m.fcf_div_cover! < 1;
    const severity = triggered ? clamp(Math.round((1 - m.fcf_div_cover!) * 5), 0, 10) : 0;
    checks.push({
      id: 'dividende_non_couvert',
      label: 'Dividende non couvert par le cash',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Payout ${fmt(m.payout_ratio)} %, couverture FCF ${fmt(m.fcf_div_cover)}x`
        : 'Payout ou couverture FCF non calculables',
      dataAvailable,
    });
  }

  // 6. Tension de liquidité : quick ratio < 1.
  {
    const dataAvailable = m.quick_ratio != null;
    const triggered = dataAvailable && m.quick_ratio! < 1;
    const severity = triggered ? clamp(Math.round((1 - m.quick_ratio!) * 20), 0, 10) : 0;
    checks.push({
      id: 'tension_liquidite',
      label: 'Tension de liquidité',
      triggered,
      severity,
      evidence: dataAvailable ? `Quick ratio ${fmt(m.quick_ratio, 2)}x` : 'Quick ratio non calculable',
      dataAvailable,
    });
  }

  // 7. Détresse financière (Altman Z') : >2.6 sain, 1.1-2.6 gris, <1.1 détresse.
  {
    const dataAvailable = m.altman_z != null;
    const triggered = dataAvailable && m.altman_z! < 2.6;
    let severity = 0;
    if (triggered) {
      severity = m.altman_z! < 1.1
        ? 10
        : clamp(Math.round(8 - ((m.altman_z! - 1.1) / 1.5) * 4), 0, 10);
    }
    checks.push({
      id: 'detresse_altman',
      label: "Détresse financière (Altman Z')",
      triggered,
      severity,
      evidence: dataAvailable ? `Altman Z' = ${fmt(m.altman_z, 2)}` : "Altman Z' non calculable",
      dataAvailable,
    });
  }

  // 8. Dilution actionnariale : actions_en_circulation n vs n1 (champ nullable).
  {
    const shN = inc_n?.actions_en_circulation ?? null;
    const shN1 = inc_n1?.actions_en_circulation ?? null;
    const dataAvailable = shN != null && shN1 != null && shN1 !== 0;
    const pctChange = dataAvailable ? ((shN! - shN1!) / shN1!) * 100 : null;
    const triggered = dataAvailable && pctChange! > 2;
    const severity = triggered ? clamp(Math.round(pctChange!), 0, 10) : 0;
    checks.push({
      id: 'dilution',
      label: 'Dilution actionnariale',
      triggered,
      severity,
      evidence: dataAvailable
        ? `Actions en circulation ${fmt(shN, 0)} (vs ${fmt(shN1, 0)}), ${pctChange! >= 0 ? '+' : ''}${fmt(pctChange)} %`
        : "Nombre d'actions en circulation non disponible sur les 2 périodes",
      dataAvailable,
    });
  }

  // Banque : la compression des marges se lit sur le coefficient
  // d'exploitation (frais généraux / PNB). Une « marge EBITDA » de banque n'a
  // pas de sens — le rapport SGBC du 2026-10-07 en parlait cinq fois.
  if (params.famille === 'banque') {
    const i = checks.findIndex((c) => c.id === 'compression_marges');
    if (i !== -1) checks[i] = coefficientBanque(inc_n, inc_n1);
  }

  // Banque : ces contrôles supposent une entreprise industrielle. Ils sortent
  // du score (comme une donnée absente) et sont dits « non applicables » —
  // le rapport SGBC du 2026-10-07 les présentait comme des lacunes.
  if (params.famille === 'banque') {
    for (const c of checks) {
      const raison = NON_APPLICABLES_BANQUE[c.id];
      if (raison) Object.assign(c, { triggered: false, severity: 0, dataAvailable: false, evidence: `Non applicable à une banque : ${raison}` });
    }
  }

  const available = checks.filter((c) => c.dataAvailable);
  const weightSum = available.reduce((sum, c) => sum + (WEIGHTS[c.id] ?? 1), 0);
  const overallScore = weightSum > 0
    ? Math.round(available.reduce((sum, c) => sum + c.severity * (WEIGHTS[c.id] ?? 1), 0) / weightSum)
    : null;

  return { checks, overallScore };
}
