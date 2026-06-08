// frontend/lib/diagnostic/prompt.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';

function fmt(n: number | null, decimals = 0): string {
  if (n == null) return 'N/D';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
}
function pct(n: number | null): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}%`;
}
function x(n: number | null): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}x`;
}

export function buildDiagnosticPrompt(params: {
  code: string;
  designation: string | null;
  secteur: string | null;
  cours: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  inc_n: IncomeStatement | null;
  inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null;
  bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  cf_n1: CashFlowStatement | null;
  m: DiagnosticMetrics;
  periode_n: string;
  periode_n1: string;
}): string {
  const { code, designation, secteur, cours, cours_bas_52s, cours_haut_52s,
          inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
          periode_n, periode_n1 } = params;

  return `Tu es un analyste financier senior spécialisé sur les marchés actions africains (BRVM).
Tu vas produire un **diagnostic financier et économique complet** de ${designation ?? code} (${code}).
Ton analyse suit les standards sell-side CFA Level III et s'appuie exclusivement sur les données ci-dessous.
Rédige en français professionnel. Sois rigoureux, nuancé, actionnable. Longueur cible : 1 500–2 500 mots.
Commence directement par le rapport, sans préambule.

---
## DONNÉES FINANCIÈRES (FCFA)

### Compte de résultat
| Indicateur | ${periode_n} | ${periode_n1} | Δ |
|---|---|---|---|
| Revenus totaux | ${fmt(inc_n?.revenu_total)} | ${fmt(inc_n1?.revenu_total)} | ${pct(m.cagr_ca)} |
| Marge brute | ${fmt(inc_n?.marge_brute)} | ${fmt(inc_n1?.marge_brute)} | ${pct(m.marge_brute_n)} vs ${pct(m.marge_brute_n1)} |
| EBITDA | ${fmt(m.ebitda_n)} | ${fmt(m.ebitda_n1)} | ${pct(m.cagr_ebitda)} |
| EBIT | ${fmt(inc_n?.resultat_exploitation)} | ${fmt(inc_n1?.resultat_exploitation)} | |
| Résultat financier | ${fmt(inc_n?.charges_financieres_nettes)} | ${fmt(inc_n1?.charges_financieres_nettes)} | |
| Résultat net | ${fmt(inc_n?.resultat_net)} | ${fmt(inc_n1?.resultat_net)} | ${pct(m.cagr_rn)} |

### Bilan
| Indicateur | ${periode_n} | ${periode_n1} |
|---|---|---|
| Total actif | ${fmt(bal_n?.total_actifs)} | ${fmt(bal_n1?.total_actifs)} |
| Trésorerie | ${fmt(bal_n?.tresorerie_equivalents)} | ${fmt(bal_n1?.tresorerie_equivalents)} |
| Créances clients | ${fmt(bal_n?.creances_clients)} | ${fmt(bal_n1?.creances_clients)} |
| Stocks | ${fmt(bal_n?.stocks)} | ${fmt(bal_n1?.stocks)} |
| Capitaux propres | ${fmt(bal_n?.total_capitaux_propres)} | ${fmt(bal_n1?.total_capitaux_propres)} |
| Dette LT | ${fmt(bal_n?.dette_long_terme)} | ${fmt(bal_n1?.dette_long_terme)} |
| BFR | ${fmt(m.bfr_n)} | ${fmt(m.bfr_n1)} |

### Flux de trésorerie
| Indicateur | ${periode_n} | ${periode_n1} |
|---|---|---|
| Flux opérationnels | ${fmt(cf_n?.flux_exploitation)} | ${fmt(cf_n1?.flux_exploitation)} |
| Capex | ${fmt(m.capex_n)} | |
| Free Cash-Flow | ${fmt(m.fcf_n)} | ${fmt(m.fcf_n1)} |
| Dividendes versés | ${fmt(cf_n?.dividendes_verses)} | ${fmt(cf_n1?.dividendes_verses)} |

---
## RATIOS CALCULÉS

Rentabilité : Marge brute ${pct(m.marge_brute_n)} | Marge EBITDA ${pct(m.marge_ebitda_n)} | Marge EBIT ${pct(m.marge_ebit_n)} | Marge nette ${pct(m.marge_nette_n)} | ROCE ${pct(m.roce)}
DuPont ROE : Marge ${pct(m.dupont_marge)} × Rotation actifs ${x(m.dupont_rotation)} × Levier ${x(m.dupont_levier)} = ROE ${pct(m.roe_dupont)}
Liquidité : Current ratio ${x(m.current_ratio)} | Quick ratio ${x(m.quick_ratio)} | Cash ratio ${x(m.cash_ratio)}
BFR : ${fmt(m.bfr_n)} FCFA (${m.bfr_jours?.toFixed(0) ?? 'N/D'} jours de CA)
Dette : Dette nette ${fmt(m.net_debt_n)} | Couverture intérêts ${x(m.interest_cover)} | Dette nette/EBITDA ${x(m.debt_ebitda)}
Cash-flow : FCF Yield ${pct(m.fcf_yield)} | Conversion cash ${x(m.cf_conversion)} | Capex/CA ${pct(m.capex_ca)}
Valorisation (cours ${cours ?? 'N/D'} FCFA) : PER ${x(inc_n?.benefice_par_action && cours ? cours / inc_n.benefice_par_action : null)} | EV/EBITDA ${x(m.ev_ebitda)} | EV/EBIT ${x(m.ev_ebit)} | EV/CA ${m.ev_ca?.toFixed(2) ?? 'N/D'}x
Dividende : DPA ${inc_n?.dividende_par_action ?? 'N/D'} FCFA | Payout ${pct(m.payout_ratio)} | Couverture FCF ${x(m.fcf_div_cover)}
Altman Z' : ${m.altman_z?.toFixed(2) ?? 'N/D'} [>2.6 sain | 1.1–2.6 gris | <1.1 détresse]
Plage 52s : ${cours_bas_52s ?? 'N/D'} – ${cours_haut_52s ?? 'N/D'} FCFA

---
## CONTEXTE
Secteur : ${secteur ?? 'N/D'} | Marché : BRVM/UEMOA | Référentiel : SYSCOA/OHADA | Monnaie : FCFA (1 EUR ≈ 655 FCFA)

---
## STRUCTURE OBLIGATOIRE DU RAPPORT

**1. SYNTHÈSE EXÉCUTIVE** — verdict (ACHAT/CONSERVER/VENDRE) + 4–5 points-clés + objectif de cours 12 mois
**2. ANALYSE DE LA RENTABILITÉ** — drivers des marges, qualité du résultat net, effet ciseaux si CA↑ RN↓
**3. ANALYSE DU BILAN** — structure financement, BFR, solvabilité, DuPont
**4. ANALYSE DES FLUX** — qualité du cash, Capex maintenance vs croissance, FCF, trésorerie nette
**5. VALORISATION** — DCF simplifié (WACC 12–14%, g 3–4%) + multiples relatifs + pairs BRVM
**6. POLITIQUE DE DIVIDENDE** — durabilité, signal marché
**7. RISQUES & CATALYSEURS** — sectoriels, opérationnels, macro UEMOA
**8. CONCLUSION & RECOMMANDATION** — ACHAT/CONSERVER/VENDRE + objectif + horizon + stop suggéré`;
}
