import type { SupabaseClient } from '@supabase/supabase-js';
import { doitPromouvoir } from './passport';

export interface Correction {
  tableCible: 'income_statements' | 'balance_sheets' | 'cash_flow_statements';
  code: string;
  periode: string;
  champ: string;
  valeurAvant: number | null;
  valeurApres: number | null;
  motif: string;
  /** Source externe ayant permis de trancher. `null` = correction technique. */
  sourceExterne: string | null;
  corrigePar: string;
}

/**
 * Journalise une correction et applique la règle de promotion : une correction
 * adossée à une source externe fait passer l'exercice à `confiance = 'verifie'`.
 * Une correction technique interne ne promeut rien — réparer une erreur ne
 * vérifie rien.
 *
 * La règle vit ici, en TypeScript, plutôt que dans un déclencheur SQL : un
 * déclencheur serait invisible à la relecture et impossible à tester sans base.
 *
 * `admin` doit être un client service_role : `correction_champ` n'est lisible ni
 * écrivable par anon/authenticated.
 */
export async function enregistrerCorrection(
  admin: SupabaseClient,
  c: Correction,
): Promise<void> {
  const { error } = await admin.from('correction_champ').insert({
    table_cible: c.tableCible, code: c.code, periode: c.periode, champ: c.champ,
    valeur_avant: c.valeurAvant, valeur_apres: c.valeurApres,
    motif: c.motif, source_externe: c.sourceExterne, corrige_par: c.corrigePar,
  });
  if (error) throw new Error(`correction_champ : ${error.message}`);

  if (!doitPromouvoir(c.sourceExterne)) return;

  const { error: errPromo } = await admin
    .from('provenance_exercice')
    .update({ confiance: 'verifie' })
    .eq('code', c.code).eq('periode', c.periode).eq('table_cible', c.tableCible);
  if (errPromo) throw new Error(`promotion provenance : ${errPromo.message}`);
}
