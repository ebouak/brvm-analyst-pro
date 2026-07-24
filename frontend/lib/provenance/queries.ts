import { createPublicClient } from '@/lib/supabase/public';
import type { ProvenanceRow } from './passport';

/**
 * Charge toutes les lignes de provenance d'une société, indexées par
 * `${periode}|${table_cible}` pour un accès direct au rendu.
 *
 * Client PUBLIC (clé anon) : la provenance est en lecture publique — c'est
 * l'argument de confiance, il ne doit pas dépendre d'une session.
 */
export async function loadProvenance(code: string): Promise<Map<string, ProvenanceRow>> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('provenance_exercice')
    .select('code, periode, table_cible, publication_id, extrait_le, extracteur, confiance')
    .eq('code', code);

  const index = new Map<string, ProvenanceRow>();
  for (const r of (data ?? []) as ProvenanceRow[]) {
    index.set(`${r.periode}|${r.table_cible}`, r);
  }
  return index;
}
