import type { SupabaseClient } from '@supabase/supabase-js';
import type { YearStatement } from './fullStatement';
import { BALANCE_KEYS } from '@/lib/financials/sectors';

const n = (v: number | null | undefined) => (v == null ? null : v);

export interface MappedRows {
  income: Record<string, unknown>;
  balance: Record<string, unknown>;
  cashflow: Record<string, unknown>;
  fundamentals: Record<string, unknown>;
}

/** Transforme un exercice extrait en lignes prêtes à upsert dans les 4 tables. */
export function toRows(code: string, s: YearStatement, sourceFile: string): MappedRows {
  const year = Number(s.periode);
  const bfr =
    s.total_actif_circulant != null && s.passif_courant != null
      ? s.total_actif_circulant - s.passif_courant
      : null;

  // Répartit les lignes spécifiques : clés "bilan" -> balance, le reste -> income.
  const ls = s.lignes_specifiques ?? null;
  let lsIncome: Record<string, number | null> | null = null;
  let lsBalance: Record<string, number | null> | null = null;
  if (ls) {
    for (const [k, v] of Object.entries(ls)) {
      if (BALANCE_KEYS.has(k)) (lsBalance ??= {})[k] = v;
      else (lsIncome ??= {})[k] = v;
    }
  }

  return {
    income: {
      code, periode: s.periode, type_periode: 'annuel',
      lignes_specifiques: lsIncome,
      revenu_total: n(s.revenu_total), cout_ventes: n(s.cout_ventes), marge_brute: n(s.marge_brute),
      frais_generaux_admin: n(s.frais_generaux_admin), depenses_rd: n(s.depenses_rd), autres_depenses: n(s.autres_depenses),
      resultat_exploitation: n(s.resultat_exploitation), charges_financieres_nettes: n(s.charges_financieres_nettes),
      resultat_avant_impots: n(s.resultat_avant_impots), impots: n(s.impots), resultat_net: n(s.resultat_net),
      benefice_par_action: n(s.benefice_par_action), benefice_par_action_dilue: n(s.benefice_par_action_dilue),
      dividende_par_action: n(s.dividende_par_action), actions_en_circulation: n(s.actions_en_circulation),
    },
    balance: {
      code, periode: s.periode, type_periode: 'annuel',
      lignes_specifiques: lsBalance,
      total_actifs: n(s.total_actifs), total_actif_circulant: n(s.total_actif_circulant),
      tresorerie_equivalents: n(s.tresorerie_equivalents), investissements_court_terme: n(s.investissements_court_terme),
      creances_clients: n(s.creances_clients), stocks: n(s.stocks), autres_actifs_courants: n(s.autres_actifs_courants),
      total_actif_non_courant: n(s.total_actif_non_courant), immobilisations_nettes: n(s.immobilisations_nettes),
      goodwill: n(s.goodwill), actifs_incorporels: n(s.actifs_incorporels), investissements_long_terme: n(s.investissements_long_terme),
      total_passif: n(s.total_passif), passif_courant: n(s.passif_courant), fournisseurs: n(s.fournisseurs),
      dette_court_terme: n(s.dette_court_terme), autres_passifs_courants: n(s.autres_passifs_courants),
      passif_non_courant: n(s.passif_non_courant), dette_long_terme: n(s.dette_long_terme),
      total_capitaux_propres: n(s.total_capitaux_propres), capital_social: n(s.capital_social),
      reserves_benefices_non_repartis: n(s.reserves_benefices_non_repartis),
    },
    cashflow: {
      code, periode: s.periode, type_periode: 'annuel',
      flux_exploitation: n(s.flux_exploitation), resultat_net: n(s.resultat_net),
      depreciation_amortissement: n(s.depreciation_amortissement), variation_bfr: n(s.variation_bfr),
      flux_investissement: n(s.flux_investissement), investissements_ppe: n(s.investissements_ppe),
      acquisitions: n(s.acquisitions), flux_financement: n(s.flux_financement),
      dividendes_verses: n(s.dividendes_verses), remboursement_dette: n(s.remboursement_dette),
      emissions_actions: n(s.emissions_actions), variation_tresorerie: n(s.variation_tresorerie),
      tresorerie_debut_periode: n(s.tresorerie_debut_periode), tresorerie_fin_periode: n(s.tresorerie_fin_periode),
      depenses_capital: n(s.depenses_capital), flux_tresorerie_disponible: n(s.flux_tresorerie_disponible),
    },
    fundamentals: {
      code, year, revenue: n(s.revenu_total), net_income: n(s.resultat_net),
      equity: n(s.total_capitaux_propres), cash: n(s.tresorerie_equivalents), debt: n(s.dette_long_terme),
      bfr, source: 'llm-extracted', source_file: sourceFile,
    },
  };
}

/** Origine d'une passe d'extraction, écrite dans provenance_exercice. */
export interface OriginePasse {
  /** Publication source. `null` si inconnue (l'exercice restera non tracé). */
  publicationId: string | null;
  /** 'deepseek-chat' | 'mistral-large-latest' | 'ocr-mistral' | 'manuel' */
  extracteur: string;
}

const TABLES_TRACEES = ['income_statements', 'balance_sheets', 'cash_flow_statements'] as const;

/**
 * Upsert les 4 lignes, en SAUTANT toute année déjà marquée 'pdf-verified' dans fundamentals
 * (protection des données vérifiées à la main comme PALC).
 *
 * Écrit également la provenance des trois tables d'états. C'est le POINT DE
 * PASSAGE UNIQUE : toute donnée fondamentale entrant en base passe ici, donc la
 * traçabilité ne peut pas être oubliée ailleurs. `origine` est obligatoire pour
 * que l'oubli soit une erreur de compilation, pas un trou silencieux.
 */
export async function persistRows(
  admin: SupabaseClient,
  code: string,
  rows: MappedRows,
  origine: OriginePasse,
): Promise<'written' | 'skipped-verified'> {
  const year = rows.fundamentals.year as number;
  const { data: existing } = await admin
    .from('fundamentals').select('source').eq('code', code).eq('year', year).maybeSingle();
  if (existing?.source === 'pdf-verified') return 'skipped-verified';

  await admin.from('income_statements').upsert(rows.income, { onConflict: 'code,periode,type_periode' });
  await admin.from('balance_sheets').upsert(rows.balance, { onConflict: 'code,periode,type_periode' });
  await admin.from('cash_flow_statements').upsert(rows.cashflow, { onConflict: 'code,periode,type_periode' });
  await admin.from('fundamentals').upsert(rows.fundamentals, { onConflict: 'code,year' });

  // Provenance : une ligne par table tracée. Confiance 'extrait' — seule une
  // correction adossée à une source externe peut promouvoir à 'verifie'.
  const periode = rows.income.periode as string;
  await admin.from('provenance_exercice').upsert(
    TABLES_TRACEES.map((table_cible) => ({
      code, periode, table_cible,
      publication_id: origine.publicationId,
      extrait_le: new Date().toISOString(),
      extracteur: origine.extracteur,
      confiance: 'extrait',
    })),
    { onConflict: 'code,periode,table_cible' },
  );

  return 'written';
}
