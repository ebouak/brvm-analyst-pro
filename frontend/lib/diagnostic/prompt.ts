// frontend/lib/diagnostic/prompt.ts
import type { IncomeStatement, BalanceSheet, CashFlowStatement } from '@/lib/financials/types';
import type { DiagnosticMetrics } from './metrics';
import type { RedFlagsResult } from './redFlags';
import type { NewsCategory, NewsSignal } from './newsSignals';
import type { LectureIntermediaire } from '@/lib/financials/interim';
import type { ContexteQuant } from './contexteQuant';
import type { LigneComparaison } from './medianes';
import { extractBankYear, computeBankKpis, scoreBanqueUemoa } from '@/lib/bank/kpis';
import { valoriser, blocValorisation } from './valorisation';

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

/** Fraction (0,13) ou pourcentage (13) → pourcentage. Les extractions varient. */
const enPct = (v: number | null | undefined): number | null =>
  v == null ? null : Math.abs(v) <= 1 ? v * 100 : v;

/** Données de marché du titre : utiles à toute famille comptable. */
function blocMarche(cours: number | null, m: MarcheTitre | null | undefined): string {
  if (!m) return 'Données de marché non disponibles.';
  const cap = cours != null && m.actions != null ? cours * m.actions : null;
  const partFlottant = m.flottant != null && m.actions ? (m.flottant / m.actions) * 100 : null;
  return [
    `Actions en circulation : ${fmt(m.actions)} | Capitalisation au cours du jour : ${fmt(cap)} FCFA`,
    `Flottant : ${fmt(m.flottant)} titres${partFlottant != null ? ` (${partFlottant.toFixed(1)}% du capital)` : ''} | Volume moyen sur 30 séances : ${fmt(m.volMoyen30j)} titres par séance`,
  ].join('\n');
}

/**
 * Données et ratios d'une BANQUE. Le gabarit industriel (marge brute, BFR,
 * Altman, free cash-flow) n'a pas de sens ici : le rapport SGBC du
 * 2026-10-07 présentait ces postes comme des lacunes, et ignorait le PNB,
 * le coefficient d'exploitation, les dépôts et les crédits pourtant en base.
 * Les ratios viennent de lib/bank/kpis.ts — la même définition que l'onglet
 * financier de la fiche action.
 */
function blocBanque(q: {
  inc_n: IncomeStatement | null; inc_n1: IncomeStatement | null;
  bal_n: BalanceSheet | null; bal_n1: BalanceSheet | null;
  cf_n: CashFlowStatement | null;
  periode_n: string; periode_n1: string;
  cours: number | null; actions: number | null;
  m: DiagnosticMetrics;
  interim: LectureIntermediaire | null | undefined;
  cours_bas_52s: number | null; cours_haut_52s: number | null;
  absenceSolvabilite?: string | null;
  qualiteActif?: string | null;
}): string {
  const { inc_n, inc_n1, bal_n, bal_n1, cf_n, periode_n, periode_n1, cours, actions, m } = q;
  const li = inc_n?.lignes_specifiques ?? {};
  const li1 = inc_n1?.lignes_specifiques ?? {};
  const lb = bal_n?.lignes_specifiques ?? {};
  const lb1 = bal_n1?.lignes_specifiques ?? {};
  const pnb = li.pnb ?? inc_n?.revenu_total ?? null;
  const pnb1 = li1.pnb ?? inc_n1?.revenu_total ?? null;
  const cur = extractBankYear(inc_n, bal_n);
  const prev = extractBankYear(inc_n1, bal_n1);
  const curPnb = cur ? { ...cur, pnb: cur.pnb ?? pnb } : null;
  const k = curPnb ? computeBankKpis(curPnb, prev, { cours, shares: actions, dividendeParAction: inc_n?.dividende_par_action ?? null }) : null;
  const score = k ? scoreBanqueUemoa(k) : null;
  // ROE et ROA sur les montants de FIN d'exercice : la définition du modèle
  // quant (quant/run-buildraw.ts), donc celle du tableau des pairs. Le ROE sur
  // capitaux propres moyens de computeBankKpis donnait 21,4 % ici et 20,5 % dans
  // le tableau : deux chiffres pour un même ratio dans un même rapport.
  const rn = inc_n?.resultat_net ?? null;
  const roeFin = rn != null && bal_n?.total_capitaux_propres ? rn / bal_n.total_capitaux_propres : null;
  const roaFin = rn != null && bal_n?.total_actifs ? rn / bal_n.total_actifs : null;
  const coefPublie = enPct(li.coefficient_exploitation);
  const coef = coefPublie ?? (k?.costIncome != null ? k.costIncome * 100 : null);
  const pc100 = (v: number | null | undefined) => pct(v == null ? null : v * 100);
  const croissancePnb = pnb != null && pnb1 ? ((pnb - pnb1) / Math.abs(pnb1)) * 100 : null;
  const per = inc_n?.benefice_par_action && cours ? cours / inc_n.benefice_par_action : null;

  return `---
## DONNÉES FINANCIÈRES — BANQUE (FCFA)
Pour une banque, marge brute, stocks, BFR, investissements industriels (capex), free cash-flow, dette nette et score d'Altman ne s'appliquent pas : ils ne figurent pas ci-dessous et ne sont PAS des données manquantes.

### Compte de résultat
| Indicateur | ${periode_n} | ${periode_n1} | Δ |
|---|---|---|---|
| Produit net bancaire (PNB) | ${fmt(pnb)} | ${fmt(pnb1)} | ${pct(croissancePnb)} |
| Produits d'intérêts | ${fmt(li.produit_interets)} | ${fmt(li1.produit_interets)} | |
| Marge d'intérêts${li.marge_interets == null && cur?.margeInterets != null ? ' (produits − charges d’intérêts)' : ''} | ${fmt(cur?.margeInterets)} | ${fmt(prev?.margeInterets)} | |
| Frais généraux | ${fmt(inc_n?.frais_generaux_admin)} | ${fmt(inc_n1?.frais_generaux_admin)} | |
| Coût du risque | ${fmt(li.cout_du_risque)} | ${fmt(li1.cout_du_risque)} | |
| Résultat d'exploitation | ${fmt(inc_n?.resultat_exploitation)} | ${fmt(inc_n1?.resultat_exploitation)} | |
| Résultat net | ${fmt(inc_n?.resultat_net)} | ${fmt(inc_n1?.resultat_net)} | ${pct(m.cagr_rn)} |

### Bilan
| Indicateur | ${periode_n} | ${periode_n1} |
|---|---|---|
| Total du bilan | ${fmt(bal_n?.total_actifs)} | ${fmt(bal_n1?.total_actifs)} |
| Crédits à la clientèle | ${fmt(lb.credits_clientele)} | ${fmt(lb1.credits_clientele)} |
| Dépôts de la clientèle | ${fmt(lb.depots_clientele)} | ${fmt(lb1.depots_clientele)} |
| Créances douteuses (brutes) | ${fmt(lb.creances_douteuses)} | ${fmt(lb1.creances_douteuses)} |
| Capitaux propres | ${fmt(bal_n?.total_capitaux_propres)} | ${fmt(bal_n1?.total_capitaux_propres)} |
| Trésorerie et équivalents | ${fmt(bal_n?.tresorerie_equivalents)} | ${fmt(bal_n1?.tresorerie_equivalents)} |

### Flux de trésorerie publiés (${periode_n})
Flux d'exploitation ${fmt(cf_n?.flux_exploitation)} | Flux d'investissement ${fmt(cf_n?.flux_investissement)} | Flux de financement ${fmt(cf_n?.flux_financement)} | Dividendes versés ${fmt(cf_n?.dividendes_verses)}

### Comptes intermédiaires (postérieurs à ${periode_n})
${blocIntermediaire(q.interim)}

---
## RATIOS BANCAIRES
Rentabilité : ROE ${pc100(roeFin)} (résultat net / capitaux propres de fin d'exercice — même définition que la comparaison aux pairs) | ROA ${pc100(roaFin)} (résultat net / total du bilan de fin d'exercice) | Coefficient d'exploitation ${pct(coef)} (${coefPublie != null ? 'publié' : 'calculé : frais généraux / PNB'}) | Marge d'intérêts / actifs moyens ${pc100(k?.nim)}
Qualité du portefeuille : Créances douteuses / crédits ${pc100(k?.nplRatio)} | Couverture des créances non performantes (taux publié) ${pct(enPct(lb.taux_couverture_creances))}${q.qualiteActif ? `\nTaux publiés par la banque : ${q.qualiteActif}` : ''}
Structure : Crédits / dépôts ${pc100(k?.transformation)} | Fonds propres / total du bilan ${pc100(k?.leverage)} | Ratio de solvabilité ${lb.ratio_solvabilite != null ? pct(lb.ratio_solvabilite) : q.absenceSolvabilite ?? 'N/D'} (minimum réglementaire UEMOA : 11.5%)
Valorisation (cours ${cours ?? 'N/D'} FCFA) : PER ${x(per)} | Cours / valeur comptable ${x(k?.pb)} | Rendement du dividende ${pc100(k?.rendementDiv)}
Dividende : DPA ${inc_n?.dividende_par_action ?? 'N/D'} FCFA | Taux de distribution ${pct(m.payout_ratio)}
Score bancaire UEMOA : ${score?.total != null ? `${score.total}/100` : 'non évaluable'} (confiance ${score ? Math.round(score.confiance * 100) : 0} % : part des indicateurs effectivement publiés)
Plage 52 semaines : ${q.cours_bas_52s ?? 'N/D'} – ${q.cours_haut_52s ?? 'N/D'} FCFA`;
}

function formatSignals(signals: NewsSignal[] | undefined): string {
  if (!signals || signals.length === 0) return 'non évaluable — aucune source publique trouvée';
  return signals.map((s) => `- ${s.titre} (${s.source}, ${s.date}${s.url ? `, ${s.url}` : ''})`).join('\n');
}

/** Données de marché du titre. */
export interface MarcheTitre {
  actions: number | null;
  flottant: number | null;
  volMoyen30j: number | null;
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
  /** Date de rédaction, en toutes lettres (« 7 octobre 2026 »). */
  dateRapport?: string;
  /** Famille comptable : une banque reçoit des données et des consignes propres. */
  famille?: 'banque' | 'assurance' | 'general' | null;
  /** Actions, flottant, volume moyen. */
  marche?: MarcheTitre | null;
  /** Banque : pourquoi la solvabilité manque (lib/bank/prudentiel), si elle manque. */
  absenceSolvabilite?: string | null;
  /** Banque : taux de créances en souffrance et couverture publiés (lib/bank/prudentiel). */
  qualiteActif?: string | null;
}): string {
  const { code, designation, secteur, cours, cours_bas_52s, cours_haut_52s,
          inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
          periode_n, periode_n1, redFlags, newsSignals, webSignals,
          interim, contexteQuant, dateRapport, famille, marche, absenceSolvabilite, qualiteActif } = params;
  const banque = famille === 'banque';

  const redFlagsTable = redFlags.checks.map((c) => {
    if (!c.dataAvailable) return `| ${c.label} | ${c.evidence.startsWith('Non applicable') ? 'non applicable' : 'non évaluable'} | — | ${c.evidence} |`;
    return `| ${c.label} | ${c.triggered ? 'Déclenché' : 'OK'} | ${c.triggered ? c.severity : 0}/10 | ${c.evidence} |`;
  }).join('\n');

  const donneesGenerales = `---
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

`;

  const enrichmentBlocks = (Object.keys(CATEGORY_LABELS) as NewsCategory[]).map((cat) => {
    const internal = newsSignals[cat] ?? [];
    const source = internal.length > 0 ? internal : webSignals[cat];
    return `**${CATEGORY_LABELS[cat]}**\n${formatSignals(source)}`;
  }).join('\n\n');

  return `Tu es un analyste financier senior spécialisé sur les marchés actions africains (BRVM).
Tu vas produire un **diagnostic financier et économique complet** de ${designation ?? code} (${code}).
Ton analyse suit les standards sell-side CFA Level III et s'appuie exclusivement sur les données ci-dessous.
Rédige en français professionnel, pour un investisseur particulier comme pour un lecteur averti : rigoureux, factuel, nuancé. Longueur cible : 2 000–3 000 mots.
Tout chiffre que tu cites doit figurer dans les données ci-dessous ou en être dérivé par un calcul que tu montres. Une donnée marquée N/D reste N/D : tu ne l'estimes pas. Une donnée décrite par un statut (« sources contradictoires », « borne », « non trouvé dans les documents consultés ») se rapporte tel quel : tu ne choisis pas entre les sources et tu ne la remplaces pas par la valeur d'un autre exercice.
Commence directement par le rapport, sans préambule.${dateRapport ? `\nDate du rapport : ${dateRapport}. Si tu dates le rapport, utilise cette date et aucune autre.` : ''}

${banque
  ? blocBanque({ inc_n, inc_n1, bal_n, bal_n1, cf_n, periode_n, periode_n1, cours, actions: marche?.actions ?? null, m, interim, cours_bas_52s, cours_haut_52s, absenceSolvabilite, qualiteActif }) + '\n\n'
  : donneesGenerales}---
## VALORISATION CALCULÉE (mêmes nombres que le graphique du rapport)
${blocValorisation(valoriser({ famille, cours, actions: marche?.actions ?? null, inc: inc_n, bal: bal_n, medianes: contexteQuant?.medianes?.lignes }))}

---
## DONNÉES DE MARCHÉ DU TITRE
${blocMarche(cours, marche)}

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
${banque
  ? `**3. ANALYSE DE LA RENTABILITÉ** — PNB et sa croissance, marge d'intérêts, coefficient d'exploitation, coût du risque, ROE et ROA. Si des comptes intermédiaires sont fournis, dis ce qu'ils indiquent pour l'exercice en cours, sans les extrapoler à l'année entière.
**4. ANALYSE DU BILAN** — crédits et dépôts (rapport crédits / dépôts), qualité du portefeuille (créances douteuses, couverture), fonds propres et solvabilité réglementaire
**5. LIQUIDITÉ ET FINANCEMENT** — collecte de dépôts face aux crédits, trésorerie ; les flux de trésorerie s'ils sont publiés`
  : `**3. ANALYSE DE LA RENTABILITÉ** — drivers des marges, qualité du résultat net, effet ciseaux si CA↑ RN↓. Si des comptes intermédiaires sont fournis, dis ce qu'ils indiquent pour l'exercice en cours, sans les extrapoler à l'année entière.
**4. ANALYSE DU BILAN** — structure financement, BFR, solvabilité, DuPont
**5. ANALYSE DES FLUX** — qualité du cash, Capex maintenance vs croissance, FCF, trésorerie nette`}
**6. COMPARAISON AUX MÉDIANES DU SECTEUR** — reprends le tableau de comparaison fourni (valeurs et médianes telles quelles, sans en recalculer aucune), puis commente les écarts les plus marqués. Une médiane « non significative » se dit comme telle. Une position face à la médiane décrit un écart, elle ne prouve pas une sous- ou survalorisation.
${banque
  ? `**7. VALORISATION** — pour une banque, le DCF sur free cash-flow ne s'applique pas. Reprends TELLES QUELLES les valeurs du bloc VALORISATION CALCULÉE (valeur justifiée par le P/B, actualisation des dividendes, multiples médians des pairs) : ne les recalcule pas, un graphique du rapport les affiche avec les mêmes nombres. Explique ce que chaque méthode suppose et pourquoi elles divergent`
  : `**7. VALORISATION** — reprends TELLES QUELLES les valeurs du bloc VALORISATION CALCULÉE (actualisation des dividendes, multiples médians des pairs) : ne les recalcule pas, un graphique du rapport les affiche avec les mêmes nombres. Tu peux y ajouter un DCF simplifié (WACC 12–14%, g 3–4%) en montrant ton calcul`}
**8. POLITIQUE DE DIVIDENDE** — durabilité, signal marché
**9. RISQUES & CATALYSEURS** — sectoriels, opérationnels, macro UEMOA
**10. POINTS DE VIGILANCE** — 3 à 6 éléments concrets à surveiller aux prochaines publications (un ratio qui se dégrade, une donnée manquante, un red flag déclenché, une médiane défavorable, un écart entre comptes intermédiaires et annuels). Pour chacun : ce qui est observé aujourd'hui et ce qui changerait la lecture.
**11. CE QUE LES CHIFFRES NE DISENT PAS** — les limites de cette analyse : données N/D ou absentes, ancienneté du dernier exercice, ce que les états financiers publiés ne montrent pas (qualité du management, gouvernance, carnet de commandes, concurrence, exposition réglementaire, liquidité réelle du titre), et la portée limitée d'une comparaison sur un marché d'une cinquantaine de sociétés. N'invente aucun fait pour combler ces trous : nomme-les.${banque ? " Pour une banque, ne cite PAS comme lacunes la marge brute, les stocks, le BFR, le capex, le free cash-flow, la dette nette ni l'Altman Z' : ces notions ne s'appliquent pas à une banque. N'emploie pas non plus « marge EBITDA » : les charges d'une banque se lisent sur le coefficient d'exploitation. Le taux de couverture est publié par la banque sur ses créances non performantes (« en souffrance » en norme UMOA) : ne l'appelle pas « couverture des créances douteuses »." : ''}
**12. CONCLUSION & RECOMMANDATION** — ACHAT/CONSERVER/VENDRE + objectif + horizon + stop suggéré
**13. RED FLAGS** — pour chaque check déclenché ci-dessus, rédige 2–3 phrases de contexte expliquant pourquoi c'est préoccupant. N'invente AUCUN chiffre — utilise uniquement les valeurs fournies dans le tableau. Pour les catégories de veille/recherche : si des signaux sont fournis, cite-les avec leur source et leur date ; sinon écris explicitement « non évaluable — aucune source publique trouvée ». Le score global de gravité (déjà calculé : ${redFlags.overallScore ?? 'non évaluable'}/10) doit être repris tel quel, jamais recalculé ou réinterprété.`;
}
