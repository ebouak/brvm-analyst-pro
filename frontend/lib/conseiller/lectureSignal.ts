import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { signalPerime, signalValide, type Signal } from './signal';

/**
 * États du signal « tendance longue » à afficher : ceux de la dernière révision
 * mensuelle (première séance du mois). Tant qu'aucune révision n'a été écrite,
 * ceux de la première séance enregistrée.
 *
 * Table SANS lecture publique (donnée Premium) : lecture au service_role, côté
 * serveur uniquement, et seulement après `canAccess('conseiller_signal')`.
 * LÈVE si la lecture échoue. Renvoie `null` si la table est vide ou si le
 * dernier signal est périmé par rapport à `dateSeance`.
 */
export async function lireSignaux(dateSeance: string): Promise<{ date: string; parCode: Map<string, Signal> } | null> {
  const sb = getServiceClient();
  const derniere = async (revision: boolean) => {
    let q = sb.from('conseiller_signaux').select('date_marche').lte('date_marche', dateSeance);
    if (revision) q = q.eq('revision', true);
    const { data, error } = await q.order('date_marche', { ascending: !revision }).limit(1);
    if (error) throw new Error(`conseiller_signaux illisible : ${error.message}`);
    return data?.[0]?.date_marche as string | undefined;
  };
  const date = (await derniere(true)) ?? (await derniere(false));
  if (!date || signalPerime(date, dateSeance)) return null;
  const { data, error } = await sb.from('conseiller_signaux').select('code, date_marche, etat').eq('date_marche', date).order('code');
  if (error) throw new Error(`conseiller_signaux illisible : ${error.message}`);
  const parCode = new Map<string, Signal>();
  for (const l of (data ?? []) as unknown[]) if (signalValide(l as Record<string, unknown>)) parCode.set((l as Signal).code, l as Signal);
  return parCode.size ? { date, parCode } : null;
}
