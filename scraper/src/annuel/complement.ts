/**
 * Complément des comptes ANNUELS — remplit les champs VIDES du dernier
 * exercice à partir du PDF des états financiers, lu en entier par Gemini
 * (scans et annexes compris). PUR, testé (tests/annuelComplement.test.ts).
 *
 * Pourquoi (2026-10-05) : le pilier « Solidité financière » du Combined Alpha
 * restait vide faute de données — charges financières 13/34, dettes 17-18/34,
 * flux disponible 1/34, et pour les banques ratio de solvabilité 1/15,
 * créances douteuses 1/15. L'extraction historique (texte pdfjs + DeepSeek)
 * manquait les tableaux en image, les scans et les annexes prudentielles.
 *
 * RÈGLES
 *   - Ne remplit QUE des champs vides : jamais d'écrasement d'une valeur
 *     existante (l'existant a pu être vérifié ou corrigé à la main).
 *   - ANCRAGE : les chiffres déjà en base (chiffre d'affaires, résultat net,
 *     total du bilan) doivent être relus à ±2 % dans le même PDF. Sinon : erreur
 *     d'unité ou d'exercice probable → rejet de TOUT le complément.
 *   - Au moins une ancre comparable, sinon rien n'est écrit (on ne peut pas
 *     prouver que la lecture porte sur le bon exercice).
 */
import { z } from 'zod';

export type Famille = 'banque' | 'assurance' | 'general';
export type Table = 'income_statements' | 'balance_sheets' | 'cash_flow_statements';

/** Colonnes visées, par famille. Les clés bancaires vivent dans balance_sheets.lignes_specifiques. */
export const CIBLES: Record<'general' | 'banque', { table: Table; champ: string; ls?: boolean }[]> = {
  general: [
    { table: 'income_statements', champ: 'resultat_exploitation' },
    { table: 'income_statements', champ: 'charges_financieres_nettes' },
    { table: 'income_statements', champ: 'resultat_avant_impots' },
    { table: 'income_statements', champ: 'impots' },
    { table: 'income_statements', champ: 'benefice_par_action' },
    { table: 'balance_sheets', champ: 'total_actifs' },
    { table: 'balance_sheets', champ: 'dette_court_terme' },
    { table: 'balance_sheets', champ: 'dette_long_terme' },
    { table: 'balance_sheets', champ: 'tresorerie_equivalents' },
    { table: 'balance_sheets', champ: 'total_actif_circulant' },
    { table: 'balance_sheets', champ: 'passif_courant' },
    { table: 'balance_sheets', champ: 'total_capitaux_propres' },
    { table: 'cash_flow_statements', champ: 'flux_exploitation' },
    { table: 'cash_flow_statements', champ: 'depreciation_amortissement' },
    { table: 'cash_flow_statements', champ: 'depenses_capital' },
    { table: 'cash_flow_statements', champ: 'investissements_ppe' },
  ],
  banque: [
    { table: 'income_statements', champ: 'resultat_avant_impots' },
    { table: 'income_statements', champ: 'impots' },
    { table: 'income_statements', champ: 'benefice_par_action' },
    { table: 'income_statements', champ: 'coefficient_exploitation', ls: true },
    { table: 'balance_sheets', champ: 'total_capitaux_propres' },
    { table: 'balance_sheets', champ: 'ratio_solvabilite', ls: true },
    { table: 'balance_sheets', champ: 'creances_douteuses', ls: true },
    { table: 'balance_sheets', champ: 'taux_couverture_creances', ls: true },
    { table: 'balance_sheets', champ: 'ratio_liquidite', ls: true },
    { table: 'balance_sheets', champ: 'credits_clientele', ls: true },
    { table: 'balance_sheets', champ: 'depots_clientele', ls: true },
  ],
};

const n = z.number().finite().nullable().optional().transform((v) => v ?? null);

export const schemaComplement = z.object({
  devise_source: z.string().nullable().optional(),
  exercice: z.number().int(),
  // Ancres (contrôle seulement, jamais écrites si déjà présentes) :
  revenu_total: n,
  resultat_net: n,
  total_actifs: n,
  // Général :
  resultat_exploitation: n,
  charges_financieres_nettes: n,
  resultat_avant_impots: n,
  impots: n,
  benefice_par_action: n,
  investissements_ppe: n,
  coefficient_exploitation: n,
  dette_court_terme: n,
  dette_long_terme: n,
  tresorerie_equivalents: n,
  total_actif_circulant: n,
  passif_courant: n,
  total_capitaux_propres: n,
  flux_exploitation: n,
  depreciation_amortissement: n,
  depenses_capital: n,
  // Banque :
  ratio_solvabilite: n,
  creances_douteuses: n,
  taux_couverture_creances: n,
  ratio_liquidite: n,
  credits_clientele: n,
  depots_clientele: n,
});
export type Complement = z.infer<typeof schemaComplement>;

export function promptComplement(famille: Famille, exercice: number): string {
  const banque = famille === 'banque';
  return [
    `Tu relis les ÉTATS FINANCIERS ANNUELS d'une société cotée à la BRVM et tu relèves des chiffres de l'exercice ${exercice} (colonne ${exercice}, PAS l'exercice précédent).`,
    'Réponds UNIQUEMENT par un objet JSON avec ces clés (nombre ou null) :',
    `devise_source, exercice (= ${exercice}), revenu_total, resultat_net, total_actifs,`,
    banque
      ? 'resultat_avant_impots, impots, benefice_par_action, coefficient_exploitation, total_capitaux_propres, ratio_solvabilite, creances_douteuses, taux_couverture_creances, ratio_liquidite, credits_clientele, depots_clientele.'
      : 'resultat_exploitation, charges_financieres_nettes, resultat_avant_impots, impots, benefice_par_action, dette_court_terme, dette_long_terme, tresorerie_equivalents, total_actif_circulant, passif_courant, total_capitaux_propres, flux_exploitation, depreciation_amortissement, depenses_capital, investissements_ppe.',
    '',
    'RÈGLES IMPÉRATIVES :',
    "1. N'INVENTE RIEN et ne CALCULE RIEN : un montant qui ne figure pas tel quel dans le document → null.",
    "2. Montants convertis en FCFA BRUTS d'après l'en-tête du tableau (milliers ×1 000 ; millions ×1 000 000).",
    banque
      ? "3. revenu_total = Produit Net Bancaire. benefice_par_action en FCFA PAR ACTION (jamais converti). coefficient_exploitation en %. ratio_solvabilite, taux_couverture_creances et ratio_liquidite en POURCENTAGE (ex. 12,5 → 12.5), tels que publiés dans le tableau des normes prudentielles ou le rapport de gestion. creances_douteuses = encours BRUT des créances douteuses / en souffrance ; credits_clientele et depots_clientele = encours de fin d'exercice."
      : "3. revenu_total = chiffre d'affaires. benefice_par_action en FCFA PAR ACTION (jamais converti). impots = impôt sur le résultat (positif). investissements_ppe = acquisitions d'immobilisations corporelles du tableau des flux (valeur positive). charges_financieres_nettes = frais financiers (positif s'il s'agit d'une charge). dette_court_terme / dette_long_terme = dettes FINANCIÈRES (emprunts, découverts), pas les fournisseurs. depenses_capital = acquisitions d'immobilisations du tableau des flux (valeur positive).",
    "4. Si le document contient des tableaux consolidés ET sociaux, prends ceux qui correspondent au chiffre d'affaires publié en tête du rapport ; ne mélange pas les deux.",
    '5. Tableaux en devises étrangères : ne les utilise pas ; devise_source = la devise réellement lue.',
  ].join('\n');
}

export interface Existant {
  revenu_total: number | null;
  resultat_net: number | null;
  total_actifs: number | null;
}

export interface Verdict {
  ok: boolean;
  motifs: string[];
  ancres: number;
}

const ECART_MAX = 0.02;

export function verifierComplement(c: Complement, exercice: number, existant: Existant): Verdict {
  const motifs: string[] = [];
  const devise = (c.devise_source ?? '').toLowerCase();
  if (devise && devise !== 'fcfa' && devise !== 'xof') motifs.push(`devise ${devise}`);
  if (c.exercice !== exercice) motifs.push(`exercice lu ${c.exercice} ≠ ${exercice}`);

  let ancres = 0;
  for (const k of ['revenu_total', 'resultat_net', 'total_actifs'] as const) {
    const x = existant[k];
    const e = c[k];
    if (x == null || e == null || x === 0) continue;
    ancres++;
    if (Math.abs(e - x) / Math.abs(x) > ECART_MAX) motifs.push(`${k} relu ${e} ≠ base ${x}`);
  }
  if (ancres === 0) motifs.push('aucune ancre comparable (exercice non prouvé)');

  // Cohérences élémentaires.
  const positifs = [
    'dette_court_terme', 'dette_long_terme', 'tresorerie_equivalents', 'total_actif_circulant',
    'passif_courant', 'creances_douteuses', 'credits_clientele', 'depots_clientele',
  ] as const;
  for (const k of positifs) {
    const v = c[k];
    if (v != null && v < 0) motifs.push(`${k} négatif`);
  }
  const ta = c.total_actifs ?? existant.total_actifs;
  if (ta != null && c.total_capitaux_propres != null && c.total_capitaux_propres > ta) motifs.push('capitaux propres > total du bilan');
  if (c.coefficient_exploitation != null && (c.coefficient_exploitation <= 0 || c.coefficient_exploitation > 200)) motifs.push("coefficient d'exploitation hors bornes");
  if (c.ratio_solvabilite != null && (c.ratio_solvabilite <= 0 || c.ratio_solvabilite > 100)) motifs.push('ratio de solvabilité hors ]0 ; 100] %');
  if (c.taux_couverture_creances != null && (c.taux_couverture_creances < 0 || c.taux_couverture_creances > 200)) motifs.push('taux de couverture hors [0 ; 200] %');
  if (c.ratio_liquidite != null && (c.ratio_liquidite <= 0 || c.ratio_liquidite > 1000)) motifs.push('ratio de liquidité hors bornes');
  if (c.creances_douteuses != null && c.credits_clientele != null && c.creances_douteuses > c.credits_clientele) motifs.push('créances douteuses > crédits');

  return { ok: motifs.length === 0, motifs, ancres };
}

export type Cible = (typeof CIBLES)['general'][number];

export interface Patch {
  table: Table;
  colonnes: Record<string, number>;
  /** Clés ajoutées à lignes_specifiques (fusion, jamais d'écrasement). */
  ls: Record<string, number>;
}

/** Champs vides visés pour cette famille, d'après les lignes annuelles existantes. */
export function champsManquants(famille: Famille, existant: Record<Table, Record<string, unknown> | null>): Cible[] {
  const cibles = CIBLES[famille === 'banque' ? 'banque' : 'general'];
  return cibles.filter((c) => {
    const row = existant[c.table];
    // Ligne absente (ex. aucun bilan pour l'exercice) : tous ses champs sont à
    // fournir ; la ligne sera CRÉÉE — création, jamais écrasement.
    if (!row) return true;
    const v = c.ls ? ((row.lignes_specifiques as Record<string, unknown> | null) ?? {})[c.champ] : row[c.champ];
    return v == null;
  });
}

/** Ce qui sera écrit : seulement les champs manquants que le PDF fournit. */
export function construirePatches(manquants: Cible[], c: Complement): Patch[] {
  const parTable = new Map<Table, Patch>();
  for (const m of manquants) {
    const v = (c as unknown as Record<string, number | null>)[m.champ];
    if (v == null) continue;
    const p = parTable.get(m.table) ?? { table: m.table, colonnes: {}, ls: {} };
    if (m.ls) p.ls[m.champ] = v;
    else p.colonnes[m.champ] = m.champ === 'benefice_par_action' ? v : Math.round(v); // bigint, sauf BPA (numeric)
    parTable.set(m.table, p);
  }
  return [...parTable.values()].filter((p) => Object.keys(p.colonnes).length + Object.keys(p.ls).length > 0);
}
