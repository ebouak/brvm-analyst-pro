import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import type { StatutSession } from './regles';

/**
 * Lecture des SÉANCES de formation en direct (billetterie).
 *
 * Fichier distinct de `server.ts`, qui sert le catalogue des replays : deux
 * responsabilités sans rapport n'ont pas à cohabiter, et celle-ci touche à
 * l'exposition publique.
 *
 * La liste publique passe par la VUE `formation_sessions_publiques`, qui ne
 * porte pas `lien_visio` : impossible de divulguer le lien par inadvertance
 * depuis une page, même en écrivant `select('*')`.
 */

export interface SessionPublique {
  id: string;
  niveau: 'debutant' | 'intermediaire' | 'avance';
  titre: string;
  description: string | null;
  debut_at: string;
  duree_min: number;
  modalite: 'presentiel' | 'visio';
  lieu: string | null;
  places: number;
  places_prises: number;
  prix: number;
  prix_abonne: number | null;
  statut: StatutSession;
}

const COLONNES = 'id, niveau, titre, description, debut_at, duree_min, modalite, lieu, places, places_prises, prix, prix_abonne, statut';

export async function listerSessionsAVenir(): Promise<SessionPublique[]> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('formation_sessions_publiques')
    .select(COLONNES)
    .gte('debut_at', new Date().toISOString())
    .order('debut_at', { ascending: true });
  return (data ?? []) as SessionPublique[];
}

export async function lireSessionPublique(id: string): Promise<SessionPublique | null> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('formation_sessions_publiques')
    .select(COLONNES)
    .eq('id', id)
    .maybeSingle();
  return (data as SessionPublique | null) ?? null;
}
