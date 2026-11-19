import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hacherNumero } from './numero';

/**
 * Droits RGPD sur les rappels vocaux (migration 0250). La clé de
 * rattachement est l'adresse e-mail CONFIRMÉE du compte, comme pour
 * contact_messages : sans confirmation, un compte créé avec l'adresse d'un
 * tiers lirait ou effacerait les données de cette personne.
 */
export type ExportRappelsVocaux =
  | {
      demandes: { message_id: string; telephone: string | null; consentement_le: string | null }[];
      appels: { message_id: string; statut: string; duree_min: number | null; fin_par: string | null; transcription: string | null; cree_le: string }[];
      opposition: boolean | null;
    }
  | { indisponible: string };

export async function exporterRappelsVocaux(db: SupabaseClient, emailConfirme: string | null): Promise<ExportRappelsVocaux> {
  if (!emailConfirme) return { demandes: [], appels: [], opposition: null };
  const { data: msgs, error } = await db
    .from('contact_messages')
    .select('id, telephone, rappel_vocal_consent_at')
    .eq('email', emailConfirme)
    .not('telephone', 'is', null);
  if (error) return { indisponible: `lecture impossible (${error.code ?? 'erreur'})` };
  const demandes = (msgs ?? []).map((m) => ({
    message_id: m.id as string,
    telephone: (m.telephone as string | null) ?? null,
    consentement_le: (m.rappel_vocal_consent_at as string | null) ?? null,
  }));
  if (demandes.length === 0) return { demandes, appels: [], opposition: null };

  const { data: appels, error: ea } = await db
    .from('appels_vocaux')
    .select('source_id, statut, duree_min, fin_par, transcription, cree_le')
    .eq('motif', 'rappel_contact')
    .in('source_id', demandes.map((d) => d.message_id));
  if (ea) return { indisponible: `journal des appels illisible (${ea.code ?? 'erreur'})` };

  let opposition: boolean | null = null;
  try {
    const hashes = Array.from(new Set(demandes.flatMap((d) => (d.telephone ? [hacherNumero(d.telephone, process.env.BLAND_HASH_SECRET)] : []))));
    const { data: opp, error: eo } = await db.from('oppositions_vocales').select('numero_hash').in('numero_hash', hashes);
    if (!eo) opposition = (opp ?? []).length > 0;
  } catch {
    opposition = null; // secret d'empreinte absent : non vérifiable, dit tel quel
  }

  return {
    demandes,
    appels: (appels ?? []).map((a) => ({
      message_id: a.source_id as string,
      statut: a.statut as string,
      duree_min: (a.duree_min as number | null) ?? null,
      fin_par: (a.fin_par as string | null) ?? null,
      transcription: (a.transcription as string | null) ?? null,
      cree_le: a.cree_le as string,
    })),
    opposition,
  };
}

/**
 * Suppression du compte : retire le numéro et le consentement des messages de
 * l'adresse confirmée, et efface les appels rattachés (transcriptions
 * comprises). La liste d'opposition (empreinte seule) est VOLONTAIREMENT
 * conservée, comme crm_oppositions : c'est elle qui garantit qu'on ne
 * rappellera plus ce numéro. Ne lève pas ; renvoie l'erreur éventuelle.
 */
export async function effacerRappelsVocaux(db: SupabaseClient, emailConfirme: string): Promise<string | null> {
  const { data: msgs, error } = await db.from('contact_messages').select('id').eq('email', emailConfirme);
  if (error) return error.code === '42703' || error.code === '42P01' ? null : `contact_messages : ${error.code ?? 'erreur'}`;
  const ids = (msgs ?? []).map((m) => m.id as string);
  if (ids.length === 0) return null;
  const { error: ea } = await db.from('appels_vocaux').delete().eq('motif', 'rappel_contact').in('source_id', ids);
  if (ea && ea.code !== '42P01') return `appels_vocaux : ${ea.code ?? 'erreur'}`;
  const { error: em } = await db.from('contact_messages').update({ telephone: null, rappel_vocal_consent_at: null }).in('id', ids);
  if (em && em.code !== '42703') return `contact_messages : ${em.code ?? 'erreur'}`;
  return null;
}
