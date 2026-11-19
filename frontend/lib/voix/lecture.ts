import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compterAppelsDuJour, estEnOpposition } from './appel';
import { hacherNumero } from './numero';
import { eligibiliteRappel, plafondJour, type Eligibilite, type StatutAppel } from './statut';

export interface AppelAffiche {
  id: string;
  statut: StatutAppel;
  duree_min: number | null;
  prix: number | null;
  fin_par: string | null;
  transcription: string | null;
  transcription_purgee_le: string | null;
  erreur: string | null;
  bland_call_id: string | null;
  cree_le: string;
}

export interface RappelVocal {
  /** false = colonnes ou tables absentes (migration 0250 non appliquée) ou illisibles. */
  disponible: boolean;
  raisonIndisponible?: string;
  aNumero: boolean;
  consentAt: string | null;
  opposition: boolean | null;
  appels: AppelAffiche[];
  eligibilite: Eligibilite;
}

const INDISPONIBLE = (raison: string): RappelVocal => ({
  disponible: false,
  raisonIndisponible: raison,
  aNumero: false,
  consentAt: null,
  opposition: null,
  appels: [],
  eligibilite: { ok: false, raison },
});

/**
 * État « rappel vocal » d'un message de contact, lu À PART du message : si la
 * migration 0250 n'est pas appliquée, la fiche du message reste lisible et
 * cette section le dit. Le numéro n'est PAS renvoyé à l'interface : seul le
 * fait qu'il existe l'est (il ne sert qu'à l'appel, côté serveur).
 */
export async function chargerRappelVocal(db: SupabaseClient, messageId: string, maintenant = new Date()): Promise<RappelVocal> {
  const { data: m, error } = await db
    .from('contact_messages')
    .select('telephone, rappel_vocal_consent_at')
    .eq('id', messageId)
    .maybeSingle();
  if (error) return INDISPONIBLE(`lecture impossible (${error.code ?? 'erreur'}) — migration 0250 appliquée ?`);
  if (!m) return INDISPONIBLE('message introuvable');

  const { data: appels, error: ea } = await db
    .from('appels_vocaux')
    .select('id, statut, duree_min, prix, fin_par, transcription, transcription_purgee_le, erreur, bland_call_id, cree_le')
    .eq('motif', 'rappel_contact')
    .eq('source_id', messageId)
    .order('cree_le', { ascending: false })
    .limit(20);
  if (ea) return INDISPONIBLE(`journal des appels illisible (${ea.code ?? 'erreur'})`);

  const telephone = (m.telephone as string | null) ?? null;
  const consentAt = (m.rappel_vocal_consent_at as string | null) ?? null;
  let opposition: boolean | null = null;
  let appelsDuJour = 0;
  try {
    if (telephone) opposition = await estEnOpposition(db, hacherNumero(telephone, process.env.BLAND_HASH_SECRET));
    appelsDuJour = await compterAppelsDuJour(db, maintenant);
  } catch (e) {
    const liste = (appels ?? []) as AppelAffiche[];
    return { ...INDISPONIBLE((e as Error).message), disponible: true, aNumero: !!telephone, consentAt, appels: liste };
  }

  const liste = (appels ?? []) as AppelAffiche[];
  return {
    disponible: true,
    aNumero: !!telephone,
    consentAt,
    opposition,
    appels: liste,
    eligibilite: eligibiliteRappel(
      {
        telephone,
        consentAt,
        opposition: !!opposition,
        dernier: liste[0] ? { statut: liste[0].statut, cree_le: liste[0].cree_le } : null,
        appelsDuJour,
        maxJour: plafondJour(process.env.VOIX_MAX_JOUR),
      },
      maintenant,
    ),
  };
}
