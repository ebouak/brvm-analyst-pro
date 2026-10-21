import { getServiceClient } from '@/lib/billing/serviceClient';
import { enRetard, joursOuvresEcoules } from '@/lib/contact/delai';
import type { Livraison } from '@/lib/contact/livraison';

/** Messages du formulaire de contact (migration 0158, service_role seul). */
export type StatutContact = 'nouveau' | 'envoi' | 'repondu' | 'clos' | 'spam';

export const STATUT_CONTACT_LABEL: Record<StatutContact, string> = {
  nouveau: 'À répondre',
  envoi: 'Envoi en cours',
  repondu: 'Répondu',
  clos: 'Clos sans réponse',
  spam: 'Spam',
};

export interface MessageContactRow {
  id: string;
  created_at: string;
  prenom: string | null;
  email: string;
  page: string | null;
  message: string;
  statut: StatutContact;
  brouillon: string | null;
  brouillon_at: string | null;
  reponse: string | null;
  repondu_at: string | null;
  /** Statut Resend de la réponse (migration 0159) ; null tant que rien n'est parti. */
  livraison: Livraison | null;
  livraison_at: string | null;
  livraison_detail: string | null;
  /** Calculés : ancienneté en jours ouvrés, et dépassement du seuil d'alerte. */
  joursOuvres: number;
  enRetard: boolean;
}

const COLS =
  'id, created_at, prenom, email, page, message, statut, brouillon, brouillon_at, reponse, repondu_at, livraison, livraison_at, livraison_detail';

function enrichir(r: Omit<MessageContactRow, 'joursOuvres' | 'enRetard'>, maintenant: Date): MessageContactRow {
  const attend = r.statut === 'nouveau' || r.statut === 'envoi';
  const depuis = new Date(r.created_at);
  return {
    ...r,
    joursOuvres: attend ? joursOuvresEcoules(depuis, maintenant) : 0,
    enRetard: attend && enRetard(depuis, maintenant),
  };
}

/** Liste : messages en attente d'abord (les plus anciens en tête), puis le reste par date. */
export async function loadMessagesContact(): Promise<{ rows: MessageContactRow[]; erreur: string | null }> {
  const { data, error } = await getServiceClient()
    .from('contact_messages')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return { rows: [], erreur: error.message };
  const maintenant = new Date();
  const rows = (data ?? []).map((r) => enrichir(r as MessageContactRow, maintenant));
  const attente = rows.filter((r) => r.statut === 'nouveau' || r.statut === 'envoi').reverse();
  const reste = rows.filter((r) => r.statut !== 'nouveau' && r.statut !== 'envoi');
  return { rows: [...attente, ...reste], erreur: null };
}

export async function loadMessageContact(id: string): Promise<MessageContactRow | null> {
  const { data } = await getServiceClient().from('contact_messages').select(COLS).eq('id', id).maybeSingle();
  return data ? enrichir(data as MessageContactRow, new Date()) : null;
}
