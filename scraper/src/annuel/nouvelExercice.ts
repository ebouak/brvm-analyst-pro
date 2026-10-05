/**
 * Import d'un NOUVEL exercice annuel (absent de la base) depuis le PDF des
 * états financiers, lu par Gemini. PUR, testé (tests/annuelNouveau.test.ts).
 *
 * Cas d'origine (2026-10-05) : SDSC et SICC avaient publié leurs états
 * financiers 2025 (août et juin 2026) sans qu'aucun exercice 2025 n'entre en
 * base — l'extraction historique avait échoué en silence.
 *
 * PREUVE PAR LA COLONNE N−1 : les états de l'exercice N portent aussi la
 * colonne N−1, déjà en base. Gemini relit les DEUX colonnes ; si la colonne
 * N−1 relue retrouve la base à ±2 % (chiffre d'affaires, résultat net, total
 * du bilan — au moins deux ancres), l'unité, la devise et la structure sont
 * prouvées et la colonne N peut être écrite. Sinon, rien.
 */
import { z } from 'zod';

const n = z.number().finite().nullable().optional().transform((v) => v ?? null);

export const schemaColonne = z.object({
  annee: z.number().int(),
  // Compte de résultat
  revenu_total: n,
  resultat_exploitation: n,
  charges_financieres_nettes: n,
  resultat_avant_impots: n,
  impots: n,
  resultat_net: n,
  benefice_par_action: n,
  dividende_par_action: n,
  // Bilan
  total_actifs: n,
  total_actif_circulant: n,
  tresorerie_equivalents: n,
  creances_clients: n,
  stocks: n,
  total_passif: n,
  passif_courant: n,
  dette_court_terme: n,
  dette_long_terme: n,
  total_capitaux_propres: n,
  capital_social: n,
  // Flux
  flux_exploitation: n,
  depreciation_amortissement: n,
  flux_investissement: n,
  investissements_ppe: n,
  flux_financement: n,
  dividendes_verses: n,
  variation_tresorerie: n,
});
export type Colonne = z.infer<typeof schemaColonne>;

export const schemaNouvelExercice = z.object({
  devise_source: z.string().nullable().optional(),
  colonnes: z.array(schemaColonne).min(1).max(3),
});
export type NouvelExercice = z.infer<typeof schemaNouvelExercice>;

const CHAMPS = Object.keys(schemaColonne.shape).filter((k) => k !== 'annee');

export function promptNouvelExercice(exercice: number): string {
  return [
    `Tu relis les ÉTATS FINANCIERS ANNUELS de l'exercice ${exercice} d'une société cotée à la BRVM.`,
    `Relève la colonne ${exercice} ET la colonne comparative ${exercice - 1}.`,
    'Réponds UNIQUEMENT en JSON : { "devise_source": "fcfa"|…, "colonnes": [ { "annee": …, ' + CHAMPS.map((c) => `"${c}"`).join(', ') + ' } ] } (nombre ou null).',
    '',
    'RÈGLES IMPÉRATIVES :',
    "1. N'INVENTE RIEN, ne CALCULE RIEN : un montant absent ou dont le libellé est illisible → null.",
    "2. Montants convertis en FCFA BRUTS d'après l'en-tête (milliers ×1 000 ; millions ×1 000 000). EXCEPTIONS jamais converties : benefice_par_action et dividende_par_action (FCFA par action).",
    "3. revenu_total = chiffre d'affaires. charges_financieres_nettes, impots, investissements_ppe, dividendes_verses : valeurs positives. dette_court_terme / dette_long_terme = dettes FINANCIÈRES (pas les fournisseurs).",
    "4. États consolidés et sociaux présents : prends le même jeu pour les deux colonnes, celui dont le chiffre d'affaires est mis en avant dans le rapport.",
    '5. Tableaux en devises étrangères : ne les utilise pas.',
  ].join('\n');
}

export interface AncresN1 {
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

export function verifierNouvelExercice(e: NouvelExercice, exercice: number, base: AncresN1): Verdict {
  const motifs: string[] = [];
  const devise = (e.devise_source ?? '').toLowerCase().replace(/[^a-z]/g, ''); // « F CFA », « F.CFA » → « fcfa »
  if (devise && devise !== 'fcfa' && devise !== 'xof') motifs.push(`devise ${devise}`);

  const n0 = e.colonnes.find((c) => c.annee === exercice);
  const n1 = e.colonnes.find((c) => c.annee === exercice - 1);
  if (!n0) motifs.push(`colonne ${exercice} absente`);
  if (!n1) motifs.push(`colonne ${exercice - 1} absente : rien ne prouve l'unité`);

  let ancres = 0;
  if (n1) {
    for (const k of ['revenu_total', 'resultat_net', 'total_actifs'] as const) {
      const x = base[k];
      const v = n1[k];
      if (x == null || v == null || x === 0) continue;
      ancres++;
      if (Math.abs(v - x) / Math.abs(x) > ECART_MAX) motifs.push(`${exercice - 1} : ${k} relu ${v} ≠ base ${x}`);
    }
    if (ancres < 2) motifs.push(`${ancres} ancre(s) comparable(s) sur la colonne ${exercice - 1} (2 exigées)`);
  }

  if (n0) {
    if (n0.revenu_total == null || n0.resultat_net == null) motifs.push(`${exercice} : chiffre d'affaires ou résultat net absent`);
    if (n0.revenu_total != null && n0.revenu_total <= 0) motifs.push(`${exercice} : chiffre d'affaires non positif`);
    if (n0.revenu_total != null && n0.resultat_net != null && Math.abs(n0.resultat_net) > Math.abs(n0.revenu_total) * 1.5) {
      motifs.push(`${exercice} : résultat net > 1,5 × chiffre d'affaires`);
    }
    if (n0.total_actifs != null && n0.total_passif != null && Math.abs(n0.total_actifs - n0.total_passif) / n0.total_actifs > 0.01) {
      motifs.push(`${exercice} : bilan déséquilibré (actif ${n0.total_actifs} ≠ passif ${n0.total_passif})`);
    }
    if (n0.total_actifs != null && n0.total_capitaux_propres != null && n0.total_capitaux_propres > n0.total_actifs) {
      motifs.push(`${exercice} : capitaux propres > total du bilan`);
    }
    // Ordre de grandeur face à N−1 relu (déjà ancré) : attrape une colonne N
    // lue dans une autre unité que la colonne N−1.
    if (n1?.revenu_total && n0.revenu_total) {
      const r = n0.revenu_total / n1.revenu_total;
      if (r < 0.2 || r > 5) motifs.push(`${exercice} : chiffre d'affaires ×${r.toFixed(2)} face à ${exercice - 1}`);
    }
  }
  return { ok: motifs.length === 0, motifs, ancres };
}

const ent = (v: number | null) => (v == null ? null : Math.round(v));

/** Lignes à CRÉER pour l'exercice N (jamais d'upsert sur une ligne existante). */
export function lignesExercice(code: string, c: Colonne, sourceFile: string) {
  const periode = String(c.annee);
  const base = { code, periode, type_periode: 'annuel' };
  const bfr = c.total_actif_circulant != null && c.passif_courant != null ? c.total_actif_circulant - c.passif_courant : null;
  return {
    income: {
      ...base,
      revenu_total: ent(c.revenu_total), resultat_exploitation: ent(c.resultat_exploitation),
      charges_financieres_nettes: ent(c.charges_financieres_nettes), resultat_avant_impots: ent(c.resultat_avant_impots),
      impots: ent(c.impots), resultat_net: ent(c.resultat_net),
      benefice_par_action: c.benefice_par_action, dividende_par_action: c.dividende_par_action,
    },
    balance: {
      ...base,
      total_actifs: ent(c.total_actifs), total_actif_circulant: ent(c.total_actif_circulant),
      tresorerie_equivalents: ent(c.tresorerie_equivalents), creances_clients: ent(c.creances_clients), stocks: ent(c.stocks),
      total_passif: ent(c.total_passif), passif_courant: ent(c.passif_courant),
      dette_court_terme: ent(c.dette_court_terme), dette_long_terme: ent(c.dette_long_terme),
      total_capitaux_propres: ent(c.total_capitaux_propres), capital_social: ent(c.capital_social),
    },
    cashflow: {
      ...base,
      flux_exploitation: ent(c.flux_exploitation), resultat_net: ent(c.resultat_net),
      depreciation_amortissement: ent(c.depreciation_amortissement), flux_investissement: ent(c.flux_investissement),
      investissements_ppe: ent(c.investissements_ppe), flux_financement: ent(c.flux_financement),
      dividendes_verses: ent(c.dividendes_verses), variation_tresorerie: ent(c.variation_tresorerie),
    },
    // Même projection que l'import historique (frontend/lib/import/fullPersist.ts).
    fundamentals: {
      code, year: c.annee, revenue: ent(c.revenu_total), net_income: ent(c.resultat_net),
      equity: ent(c.total_capitaux_propres), cash: ent(c.tresorerie_equivalents), debt: ent(c.dette_long_terme),
      bfr: ent(bfr), source: 'llm-extracted', source_file: sourceFile,
    },
  };
}
