import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { agregerParSource, type LigneCompteur, type LigneSource } from './suivi';

export const JOURS_ACQUISITION = 30;

export type LectureAcquisition =
  | { ok: true; depuis: string; sources: LigneSource[] }
  | { ok: false; raison: string };

/**
 * Compteurs des 30 derniers jours (jours UTC), en service_role : la table n'a
 * aucune policy. Une lecture impossible (migration 0251 non appliquée, clé
 * absente) est RENDUE comme telle, jamais comme « aucune visite ».
 */
export async function lireAcquisition(maintenant = new Date()): Promise<LectureAcquisition> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return { ok: false, raison: 'clé service_role absente' };
  const depuis = new Date(maintenant.getTime() - (JOURS_ACQUISITION - 1) * 86_400_000).toISOString().slice(0, 10);
  const db = createClient(url, cle, { auth: { persistSession: false } });
  const lignes: LigneCompteur[] = [];
  // Pagination : PostgREST tronque à 1000 lignes en silence.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db
      .from('acquisition_compteurs')
      .select('src, jour, evenement, n')
      .gte('jour', depuis)
      .order('jour', { ascending: true })
      .order('src', { ascending: true })
      .order('evenement', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) return { ok: false, raison: error.message };
    lignes.push(...((data ?? []) as LigneCompteur[]));
    if (!data || data.length < 1000) break;
  }
  return { ok: true, depuis, sources: agregerParSource(lignes) };
}
