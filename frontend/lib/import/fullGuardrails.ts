import type { YearStatement } from './fullStatement';

export interface GuardResult { ok: boolean; reasons: string[]; }

const MIN_PLAUSIBLE_FCFA = 1_000_000_000; // 1 Md FCFA
// Tolérance sur RN vs RAI±impôts : en SYSCOHADA des lignes intermédiaires (participation
// des travailleurs, etc.) s'intercalent entre le résultat avant impôts et le résultat net.
// 10% accepte ces écarts normaux tout en rejetant les grosses erreurs d'extraction.
const RESULT_TOLERANCE = 0.10;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1);

/** Vérifie un exercice extrait. `estBanque` relâche les contrôles spécifiques industriels. */
export function checkStatement(s: YearStatement, estBanque: boolean): GuardResult {
  const reasons: string[] = [];

  // 1. Magnitude : CA et total actifs doivent dépasser ~1 Md FCFA (sinon erreur d'unité)
  if (s.revenu_total != null && Math.abs(s.revenu_total) < MIN_PLAUSIBLE_FCFA) reasons.push('magnitude revenu_total < 1 Md FCFA');
  if (s.total_actifs != null && Math.abs(s.total_actifs) < MIN_PLAUSIBLE_FCFA) reasons.push('magnitude total_actifs < 1 Md FCFA');

  // 2. Équilibre du bilan : total_actifs == total_passif (tolérance 1%)
  if (s.total_actifs != null && s.total_passif != null && rel(s.total_actifs, s.total_passif) > 0.01) {
    reasons.push('bilan déséquilibré (actif != passif)');
  }

  // 2bis. Réconciliation des sous-totaux du passif : capitaux propres + passif non courant
  // + passif courant doivent reconstituer le total passif (tolérance 2% pour l'écart de
  // conversion SYSCOHADA). Un manque significatif trahit l'oubli de la « Trésorerie passif »
  // (banques, établissements financiers et crédits de trésorerie / découverts) dans passif_courant —
  // le défaut classique : total_passif lu sur la ligne « TOTAL GÉNÉRAL » reste juste, mais
  // les composantes ne somment pas. C'est précisément ce que le contrôle 2 ne détecte pas.
  if (s.total_passif != null && s.total_capitaux_propres != null
      && s.passif_courant != null && s.passif_non_courant != null) {
    const somme = s.total_capitaux_propres + s.passif_non_courant + s.passif_courant;
    if (rel(somme, s.total_passif) > 0.02) {
      reasons.push('sous-totaux du passif ne réconcilient pas le total (découverts/trésorerie passif manquants dans passif_courant ?)');
    }
  }

  // 3. Cohérence résultat : resultat_net ≈ resultat_avant_impots + impots (impots signé négatif = charge)
  // Agnostique au signe des impôts : certains PDF présentent l'impôt en charge
  // négative (RN = RAI + impôts), d'autres en valeur positive (RN = RAI − impôts).
  // On accepte si l'une des deux conventions est cohérente.
  if (s.resultat_net != null && s.resultat_avant_impots != null && s.impots != null) {
    const attPlus = s.resultat_avant_impots + s.impots;
    const attMoins = s.resultat_avant_impots - s.impots;
    if (rel(s.resultat_net, attPlus) > RESULT_TOLERANCE && rel(s.resultat_net, attMoins) > RESULT_TOLERANCE) {
      reasons.push('résultat net incohérent (RAI ± impôts)');
    }
  }

  // 4. Cohérence BPA : benefice_par_action ≈ resultat_net / actions_en_circulation (tolérance 5%)
  if (s.benefice_par_action != null && s.resultat_net != null && s.actions_en_circulation) {
    const attendu = s.resultat_net / s.actions_en_circulation;
    if (Math.abs(attendu) > 1 && rel(s.benefice_par_action, attendu) > 0.05) reasons.push('BPA incohérent avec résultat/actions');
  }

  // 5. Industriels seulement : marge_brute ≈ revenu_total - cout_ventes
  if (!estBanque && s.marge_brute != null && s.revenu_total != null && s.cout_ventes != null) {
    const attendu = s.revenu_total - s.cout_ventes;
    if (rel(s.marge_brute, attendu) > 0.02) reasons.push('marge brute incohérente');
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Cohérence du nombre d'actions implicite entre les exercices d'une MÊME
 * extraction : `resultat_net / benefice_par_action` doit rester stable d'une
 * année à l'autre (le capital d'une société cotée ne varie qu'à la marge).
 *
 * C'est le seul contrôle qui attrape l'**interversion des colonnes N / N-1**,
 * l'erreur la plus fréquente du LLM sur les états comparatifs : les montants
 * sont justes, seule leur affectation à l'année est fausse — donc magnitude,
 * équilibre du bilan et cohérence RAI±impôts passent tous.
 *
 * Constaté sur NSBC : une ré-extraction a inversé les résultats nets 2024/2025
 * en gardant les BPA dans le bon ordre, faisant sauter le nombre d'actions
 * implicite de 24,7 M à 23,2 M puis 26,4 M.
 *
 * Tolérance 5 % : couvre les augmentations de capital ordinaires.
 */
export function checkActionsImplicites(
  exercices: { periode: string; resultat_net?: number | null; benefice_par_action?: number | null }[],
): GuardResult {
  const implicites = exercices
    .map((e) => ({
      periode: e.periode,
      actions: e.resultat_net != null && e.benefice_par_action ? e.resultat_net / e.benefice_par_action : null,
    }))
    .filter((x): x is { periode: string; actions: number } => x.actions != null && Number.isFinite(x.actions) && x.actions > 0);

  if (implicites.length < 2) return { ok: true, reasons: [] };

  const reference = implicites[0]!;
  for (const x of implicites.slice(1)) {
    if (rel(x.actions, reference.actions) > 0.05) {
      return {
        ok: false,
        reasons: [
          `nombre d'actions implicite instable entre ${reference.periode} et ${x.periode} ` +
          `(${Math.round(reference.actions).toLocaleString('fr-FR')} vs ${Math.round(x.actions).toLocaleString('fr-FR')}) ` +
          `— colonnes N/N-1 probablement interverties`,
        ],
      };
    }
  }
  return { ok: true, reasons: [] };
}

/** Devises acceptées en base : tout est stocké en FCFA bruts. */
export function checkDeviseFcfa(devise: string | null | undefined): GuardResult {
  // `undefined` = extraction antérieure à l'ajout du champ : on ne bloque pas
  // rétroactivement, le contrôle de magnitude reste le filet de sécurité.
  if (devise == null) return { ok: true, reasons: [] };
  if (devise === 'fcfa') return { ok: true, reasons: [] };
  return { ok: false, reasons: [`devise ${devise} : la base ne stocke que des FCFA (aucune conversion n'est inventée)`] };
}

/**
 * Cohérence entre les tables issues d'un MÊME document : `income_statements` et
 * `cash_flow_statements` portent tous deux le résultat net de l'exercice, écrit
 * depuis le même champ extrait — ils ne peuvent pas diverger.
 *
 * Une divergence trahit soit deux devises mélangées dans le document (ETIT 2022-2025 :
 * compte de résultat en FCFA, flux en USD, rapport ≈ 580-620 = le taux USD/XOF de
 * l'année), soit une table corrigée par une passe ultérieure sans que l'autre suive.
 * Dans les deux cas les chiffres ne doivent pas être servis ensemble.
 *
 * Tolérance 2 % : le tableau de flux part parfois du résultat avant intérêts
 * minoritaires, ce qui crée un écart légitime de quelques pour cent.
 */
export function checkResultatNetCoherence(
  resultatNetIncome: number | null,
  resultatNetCashflow: number | null,
): GuardResult {
  if (resultatNetIncome == null || resultatNetCashflow == null) return { ok: true, reasons: [] };
  if (resultatNetCashflow === 0) return { ok: true, reasons: [] };
  const ecart = rel(resultatNetCashflow, resultatNetIncome);
  if (ecart <= 0.02) return { ok: true, reasons: [] };
  const ratio = resultatNetIncome / resultatNetCashflow;
  return {
    ok: false,
    reasons: [
      `résultat net divergent entre compte de résultat et flux de trésorerie ` +
      `(rapport ${ratio.toFixed(1)}) — devises mélangées ou table périmée`,
    ],
  };
}

/**
 * Contrôle léger spécifique banque : crédits clientèle + trésorerie ne doivent pas
 * dépasser le total actif de plus de 5% (sinon erreur d'extraction).
 */
export function checkBankSpecific(x: {
  credits_clientele: number | null;
  tresorerie: number | null;
  total_actifs: number | null;
}): GuardResult {
  const reasons: string[] = [];
  if (x.credits_clientele != null && x.tresorerie != null && x.total_actifs != null) {
    if (x.credits_clientele + x.tresorerie > x.total_actifs * 1.05) {
      reasons.push('banque : crédits + trésorerie > total actif');
    }
  }
  return { ok: reasons.length === 0, reasons };
}
