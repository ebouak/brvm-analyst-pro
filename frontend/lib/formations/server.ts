import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createPublicClient } from '@/lib/supabase/public';
import type { StatutSession } from './regles';

export interface FormationCard {
  id: string;
  titre: string;
  description: string | null;
  type: 'cours' | 'conference' | 'webinaire';
  niveau: string | null;
  date_evenement: string | null;
  duree_min: number | null;
  cover_url: string | null;
}
export interface FormationFull extends FormationCard {
  replay_url: string | null;
  support_url: string | null;
}

const CARD_COLS = 'id, titre, description, type, niveau, date_evenement, duree_min, cover_url';

/** Catalogue public : métadonnées des formations publiées (sans replay/support). */
export async function listFormations(): Promise<FormationCard[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('formations').select(CARD_COLS).eq('published', true)
    .order('date_evenement', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data ?? []) as FormationCard[];
}

/** Métadonnées publiques d'une formation (pour la page d'upsell/teaser). */
export async function getFormationCard(id: string): Promise<FormationCard | null> {
  const sb = getServiceClient();
  const { data } = await sb.from('formations').select(CARD_COLS).eq('id', id).eq('published', true).maybeSingle();
  return (data as FormationCard | null) ?? null;
}

/** Contenu COMPLET (replay/support) — à n'appeler qu'après vérification is_premium. */
export async function getFormationFull(id: string): Promise<FormationFull | null> {
  const sb = getServiceClient();
  const { data } = await sb.from('formations').select('*').eq('id', id).eq('published', true).maybeSingle();
  return (data as FormationFull | null) ?? null;
}

// --- Formations live (sessions animées en direct) ---
// Ajouté par le plan `docs/superpowers/plans/2026-09-23-formations-live.md`
// (tâche 3). Cohabite avec les formations « replay » ci-dessus : deux
// catalogues distincts partageant le même chemin de module.

/**
 * Lecture des séances. La liste publique passe par la VUE, qui ne porte pas
 * `lien_visio` : impossible de le divulguer par inadvertance depuis une page.
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

const SESSION_COLONNES = 'id, niveau, titre, description, debut_at, duree_min, modalite, lieu, places, places_prises, prix, prix_abonne, statut';

export async function listerSessionsAVenir(): Promise<SessionPublique[]> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('formation_sessions_publiques')
    .select(SESSION_COLONNES)
    .gte('debut_at', new Date().toISOString())
    .order('debut_at', { ascending: true });
  return (data ?? []) as SessionPublique[];
}

export async function lireSessionPublique(id: string): Promise<SessionPublique | null> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('formation_sessions_publiques')
    .select(SESSION_COLONNES)
    .eq('id', id)
    .maybeSingle();
  return (data as SessionPublique | null) ?? null;
}
