import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ObligationDaily } from '@/lib/types';
import { extremesSecteurs, type ExtremesSecteurs, type LigneSecteur } from './marcheDuJour';
import { syntheseObligations, versLigneObligation } from './obligations';

export interface RendementObligataire {
  dateMarche: string;
  ytmMoyen: number;
  nbAvecYtm: number;
  nbActives: number;
}

export interface DonneesMarcheDuJour {
  /** `null` = lecture en erreur ou moins de deux secteurs classables. */
  secteurs: ExtremesSecteurs | null;
  /** `null` = lecture en erreur, aucune séance obligataire, ou aucun YTM calculable. */
  obligations: RendementObligataire | null;
}

/**
 * Lectures du bloc « Le marché aujourd'hui ». Les cours de la séance sont
 * déjà chargés par le tableau de bord (`lignes`) : seuls le référentiel des
 * secteurs et la dernière séance obligataire sont lus ici. Une erreur de
 * lecture rend l'entrée indisponible, jamais un chiffre faux ; elle est
 * journalisée pour ne pas passer inaperçue.
 */
export async function chargerMarcheDuJour(
  sb: SupabaseClient,
  { dateMarche, lignes }: { dateMarche: string; lignes: LigneSecteur[] },
): Promise<DonneesMarcheDuJour> {
  const [secteurs, obligations] = await Promise.all([
    chargerSecteurs(sb, dateMarche, lignes),
    chargerObligations(sb),
  ]);
  return { secteurs, obligations };
}

async function chargerSecteurs(sb: SupabaseClient, dateMarche: string, lignes: LigneSecteur[]): Promise<ExtremesSecteurs | null> {
  const { data, error } = await sb.from('brvm_instruments').select('code, secteur');
  if (error) {
    console.error('[dashboard] marché du jour — référentiel des secteurs illisible :', error.message);
    return null;
  }
  const parCode = new Map<string, string | null>();
  for (const i of (data ?? []) as { code: string; secteur: string | null }[]) parCode.set(i.code, i.secteur);
  return extremesSecteurs(lignes, parCode, dateMarche);
}

async function chargerObligations(sb: SupabaseClient): Promise<RendementObligataire | null> {
  const { data: derniere, error: e1 } = await sb
    .from('brvm_obligations_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  if (e1) {
    console.error('[dashboard] marché du jour — séance obligataire illisible :', e1.message);
    return null;
  }
  const dateMarche = (derniere?.[0]?.date_marche as string | undefined) ?? null;
  if (!dateMarche) return null;

  // Toutes les lignes de la séance, comme /obligations (pas de plafond à 80 :
  // une moyenne sur un échantillon tronqué serait fausse sans le dire).
  const { data, error } = await sb.from('brvm_obligations_daily').select('*').eq('date_marche', dateMarche);
  if (error) {
    console.error('[dashboard] marché du jour — obligations illisibles :', error.message);
    return null;
  }
  const s = syntheseObligations(((data ?? []) as ObligationDaily[]).map((o) => versLigneObligation(o)));
  if (s.ytmMoyen == null) return null;
  return { dateMarche, ytmMoyen: s.ytmMoyen, nbAvecYtm: s.nbAvecYtm, nbActives: s.actives.length };
}
