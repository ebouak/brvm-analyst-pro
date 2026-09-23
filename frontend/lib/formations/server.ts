import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

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
