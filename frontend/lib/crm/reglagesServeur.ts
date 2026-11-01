import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { normaliserReglages, REGLAGES_PAR_DEFAUT, type Reglages } from './reglages';

export type LectureReglages = { ok: true; reglages: Reglages } | { ok: false; raison: string };

/**
 * Lecture STRICTE : dit si les réglages sont illisibles au lieu de retomber
 * silencieusement sur les défauts. Les séquences automatiques s'en servent pour
 * ne pas s'arrêter (ou se croire arrêtées) sans que personne le sache.
 * La raison ne porte jamais de donnée personnelle (code d'erreur, nom d'exception).
 */
export async function lireReglages(): Promise<LectureReglages> {
  try {
    const { data, error } = await getServiceClient().from('crm_reglages').select('*').eq('id', 1).maybeSingle();
    if (error) return { ok: false, raison: error.code ?? 'erreur' };
    if (!data) return { ok: false, raison: 'ligne absente' };
    return { ok: true, reglages: normaliserReglages(data) };
  } catch (e) {
    return { ok: false, raison: (e as Error).name };
  }
}

/**
 * Pour l'interface et la voie manuelle : échec de lecture => défauts, séquences
 * éteintes (on dégrade vers le plus prudent). Journal sans donnée personnelle.
 */
export async function chargerReglages(): Promise<Reglages> {
  const l = await lireReglages();
  if (l.ok) return l.reglages;
  console.error('[crm] réglages illisibles, défauts appliqués :', l.raison);
  return REGLAGES_PAR_DEFAUT;
}
