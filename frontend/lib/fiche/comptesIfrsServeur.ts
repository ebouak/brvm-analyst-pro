import { normaliserLigneIfrs, type LigneComptesIfrs } from './comptesIfrs';

type Sb = { from: (t: string) => any };

/**
 * Lit la ligne `comptes_ifrs` d'un exercice (lecture publique, RLS). Panneau
 * d'appoint : une lecture en erreur est JOURNALISÉE et rend null, sans faire
 * tomber la fiche ; les ratios principaux (SYSCOHADA) n'en dépendent pas.
 */
export async function chargerComptesIfrs(sb: Sb, code: string, exercice: number | null): Promise<LigneComptesIfrs | null> {
  if (exercice == null) return null;
  const { data, error } = await sb.from('comptes_ifrs').select('*').eq('code', code).eq('exercice', exercice).maybeSingle();
  if (error) {
    console.error(`[comptes_ifrs] lecture ${code} ${exercice} : ${error.message}`);
    return null;
  }
  return normaliserLigneIfrs(data as Record<string, unknown> | null);
}
