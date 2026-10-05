// frontend/lib/diagnostic/prompt.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';
import type { RedFlagsResult } from './redFlags';
import type { NewsCategory, NewsSignal } from './newsSignals';
import type { LectureIntermediaire } from '@/lib/financials/interim';
import type { ContexteQuant } from './contexteQuant';
import type { LigneComparaison } from './medianes';

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return 'N/D';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
}
function pct(n: number | null | undefined): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}%`;
}
function x(n: number | null | undefined): string {
  if (n == null) return 'N/D';
  return `${n.toFixed(1)}x`;
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  litiges: 'Litiges',
  insiders: 'Mouvements dirigeants/actionnaires',
  concentration_client: 'Concentration client',
};

function valeurComparee(n: number | null, unite: LigneComparaison['unite']): string {
  if (n == null) return 'N/D';
  return unite === '%' ? `${n.toFixed(1)}%` : `${n.toFixed(1)}x`;
}

const POSITION: Record<NonNullable<LigneComparaison['position']>, string> = {
  'au-dessus': 'au-dessus',
  'en-dessous': 'en dessous',
  proche: 'proche',
};
const LECTURE: Record<NonNullable<LigneComparaison['lecture']>, string> = {
  favorable: 'favorable',
  defavorable: 'défavorable',
  neutre: 'neutre',
};

/** Bloc « comptes intermédiaires » : publiés APRÈS le dernier exercice annuel. */
function blocIntermediaire(i: LectureIntermediaire | null | undefined): string {
  if (!i) return 'Aucun compte intermédiaire publié postérieur au dernier exercice annuel.';
  const lignes = [
    `Période : ${i.libelle} (${i.mois} mois, cumul depuis le début de l'exercice)`,
    `| Indicateur | ${i.libelle} | ${i.libellePrecedent} |`,
    '|---|---|---|',
    `| Revenus | ${fmt(i.revenu)} | ${fmt(i.revenuPrecedent)} |`,
    `| Résultat net | ${fmt(i.resultatNet)} | ${fmt(i.resultatNetPrecedent)} |`,
  ];
  if (i.glissant) {
    lignes.push(
      '',
      `Douze mois glissants (${i.glissant.libelle}) — exercice précédent − cumul précédent + cumul courant :`,
      `Revenus ${fmt(i.glissant.revenu)} | Résultat net ${fmt(i.glissant.resultatNet)}`,
    );
  }
  return lignes.join('\n');
}

/** Bloc « comparaison aux médianes » : valeurs ET médianes déjà calculées. */
function blocMedianes(q: ContexteQuant | null | undefined): string {
  const c = q?.medianes;
  if (!c) return 'Comparaison non disponible : aucun calcul de pairs publié.';
  const lignes = c.lignes.map((l) => {
    if (l.mediane == null) {
      return `| ${l.libelle} | ${valeurComparee(l.valeur, l.unite)} | non significative (${l.nbPairs} ${l.nbPairs > 1 ? 'pairs renseignés' : 'pair renseigné'}) | — | — |`;
    }
    return `| ${l.libelle} | ${valeurComparee(l.valeur, l.unite)} | ${valeurComparee(l.mediane, l.unite)} (${l.nbPairs} pairs) | ${l.position ? POSITION[l.position] : 'N/D'} | ${l.lecture ? LECTURE[l.lecture] : 'N/D'} |`;
  });
  return [
    `Groupe de pairs : ${c.groupe} — ${c.nbSocietes} sociétés, la société elle-même exclue de la médiane.`,
    '| Ratio | Société | Médiane des pairs | Position | Lecture |',
    '|---|---|---|---|---|',
    ...lignes,
  ].join('\n');
}

/** Bloc « notes des piliers » du modèle Combined Alpha. */
function blocPiliers(q: ContexteQuant | null | undefined): string {
  const p = q?.piliers;
  if (!p) return 'Aucune note de modèle publiée pour cette valeur.';
  const n = (v: number | null) => (v == null ? 'N/D' : `${v}/100`);
  return [
    `Calcul du ${p.dateCalcul} — classification « ${p.classification} », confiance ${p.confiance}${p.rangSecteur ? `, rang ${p.rangSecteur} dans son secteur` : ''}.`,
    `Note combinée ${n(p.combine)} | Valorisation ${n(p.valorisation)} | Qualité des résultats ${n(p.qualiteResultats)} | Solidité financière ${n(p.solidite)} | Dividende ${n(p.dividende)} | Momentum de cours ${n(p.momentum)} | Liquidité ${n(p.liquidite)}`,
  ].join('\n');
}

function formatSignals(signals: NewsSignal[] | undefined): string {
  if (!signals || signals.length === 0) return 'non évaluable — aucune source publique trouvée';
  return signals.map((s) => `- ${s.titre} (${s.source}, ${s.date}${s.url ? `, ${s.url}` : ''})`).join('\n');
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
  redFlags: RedFlagsResult;
  newsSignals: Record<NewsCategory, NewsSignal[]>;
  webSignals: Partial<Record<NewsCategory, NewsSignal[]>>;
  /** Comptes intermédiaires postérieurs au dernier annuel (facultatif). */
  interim?: LectureIntermediaire | null;
  /** Médianes des pairs et notes des piliers (facultatif). */
  contexteQuant?: ContexteQuant | null;
}): string {
  const { code, designation, secteur, cours, cours_bas_52s, cours_haut_52s,
          inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
          periode_n, periode_n1, redFlags, newsSignals, webSignals,
          interim, contexteQuant } = params;

  const redFlagsTable = redFlags.checks.map((c) => {
    if (!c.dataAvailable) return `| ${c.label} | non évaluable | — | ${c.evidence} |`;
    return `| ${c.label} | ${c.triggered ? 'Déclenché' : 'OK'} | ${c.triggered ? c.severity : 0}/10 | ${c.evidence} |`;
  }).join('\n');

  const enrichmentBlocks = (Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((cat) => {
    const internal = newsSignals[cat] ?? [];
    const source = internal.length > 0 ? internal : webSignals[cat];
    return `**${CATEGORY_LABELS[cat]}**\n${formatSignals(source)}`;
  }).join('\n\n');

  return `Tu es un analyste financier senior spécialisé sur les marchés actions africains (BRVM).
Tu vas produire un **diagnostic financier et économique complet** de ${designation ?? code} (${code}).
Ton analyse suit les standards sell-side CFA Level III et s'appuie exclusivement sur les données ci-dessous.
Rédige en français professionnel. Sois rigoureux, nuancé, actionnable. Longueur cible : 2 000–3 000 mots.
Tout chiffre que tu cites doit figurer dans les données ci-dessous ou en être dérivé par un calcul que tu montres. Une donnée marquée N/D reste N/D : tu ne l'estimes pas.
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

### Comptes intermédiaires (postérieurs à ${periode_n})
${blocIntermediaire(interim)}

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
## COMPARAISON AUX MÉDIANES DES PAIRS (calculée, à reprendre telle quelle)
${blocMedianes(contexteQuant)}

---
## NOTES DU MODÈLE MULTIFACTEURS WESTBOURSE (0–100)
${blocPiliers(contexteQuant)}

---
## RED FLAGS (score de gravité déjà calculé : ${redFlags.overallScore ?? 'non évaluable'}/10)

| Check | État | Sévérité | Preuve |
|---|---|---|---|
${redFlagsTable}

### Signaux de veille/recherche (par catégorie non couverte par les 8 checks ci-dessus)

${enrichmentBlocks}

---
## CONTEXTE
Secteur : ${secteur ?? 'N/D'} | Marché : BRVM/UEMOA | Référentiel : SYSCOA/OHADA | Monnaie : FCFA (1 EUR ≈ 655 FCFA)

---
## STRUCTURE OBLIGATOIRE DU RAPPORT

**1. SYNTHÈSE EXÉCUTIVE** — verdict (ACHAT/CONSERVER/VENDRE) + 4–5 points-clés + objectif de cours 12 mois
**2. FORCES ET FAIBLESSES** — deux listes de 3 à 5 points chacune. Chaque point s'appuie sur un chiffre fourni ci-dessus (ratio, tendance, position face à la médiane, note de pilier) et le cite.
**3. ANALYSE DE LA RENTABILITÉ** — drivers des marges, qualité du résultat net, effet ciseaux si CA↑ RN↓. Si des comptes intermédiaires sont fournis, dis ce qu'ils indiquent pour l'exercice en cours, sans les extrapoler à l'année entière.
**4. ANALYSE DU BILAN** — structure financement, BFR, solvabilité, DuPont
**5. ANALYSE DES FLUX** — qualité du cash, Capex maintenance vs croissance, FCF, trésorerie nette
**6. COMPARAISON AUX MÉDIANES DU SECTEUR** — reprends le tableau de comparaison fourni (valeurs et médianes telles quelles, sans en recalculer aucune), puis commente les écarts les plus marqués. Une médiane « non significative » se dit comme telle. Une position face à la médiane décrit un écart, elle ne prouve pas une sous- ou survalorisation.
**7. VALORISATION** — DCF simplifié (WACC 12–14%, g 3–4%) + multiples relatifs + pairs BRVM (appuie-toi sur les médianes de la section 6)
**8. POLITIQUE DE DIVIDENDE** — durabilité, signal marché
**9. RISQUES & CATALYSEURS** — sectoriels, opérationnels, macro UEMOA
**10. POINTS DE VIGILANCE** — 3 à 6 éléments concrets à surveiller aux prochaines publications (un ratio qui se dégrade, une donnée manquante, un red flag déclenché, une médiane défavorable, un écart entre comptes intermédiaires et annuels). Pour chacun : ce qui est observé aujourd'hui et ce qui changerait la lecture.
**11. CE QUE LES CHIFFRES NE DISENT PAS** — les limites de cette analyse : données N/D ou absentes, ancienneté du dernier exercice, ce que les états financiers publiés ne montrent pas (qualité du management, gouvernance, carnet de commandes, concurrence, exposition réglementaire, liquidité réelle du titre), et la portée limitée d'une comparaison sur un marché d'une cinquantaine de sociétés. N'invente aucun fait pour combler ces trous : nomme-les.
**12. CONCLUSION & RECOMMANDATION** — ACHAT/CONSERVER/VENDRE + objectif + horizon + stop suggéré
**13. RED FLAGS** — pour chaque check déclenché ci-dessus, rédige 2–3 phrases de contexte expliquant pourquoi c'est préoccupant. N'invente AUCUN chiffre — utilise uniquement les valeurs fournies dans le tableau. Pour les catégories de veille/recherche : si des signaux sont fournis, cite-les avec leur source et leur date ; sinon écris explicitement « non évaluable — aucune source publique trouvée ». Le score global de gravité (déjà calculé : ${redFlags.overallScore ?? 'non évaluable'}/10) doit être repris tel quel, jamais recalculé ou réinterprété.`;
}
