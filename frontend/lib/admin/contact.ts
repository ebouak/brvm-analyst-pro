import { getServiceClient } from '@/lib/billing/serviceClient';
import { enRetard, joursOuvresEcoules } from '@/lib/contact/delai';
import type { Livraison } from '@/lib/contact/livraison';
import { libelleWhatsapp } from '@/lib/contact/whatsappEntrant';
import { statsWhatsapp, type StatsWhatsapp } from '@/lib/whatsapp/commandes';

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
  email: string | null;
  /** email (formulaire) ou whatsapp (passerelle WAHA, migration 0160). */
  canal: 'email' | 'whatsapp';
  whatsapp_chat_id: string | null;
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
  /** Calculés : destinataire lisible, ancienneté en jours ouvrés, dépassement du seuil d'alerte. */
  destinataire: string;
  joursOuvres: number;
  enRetard: boolean;
}

const COLS =
  'id, created_at, prenom, email, canal, whatsapp_chat_id, page, message, statut, brouillon, brouillon_at, reponse, repondu_at, livraison, livraison_at, livraison_detail';

function enrichir(r: Omit<MessageContactRow, 'joursOuvres' | 'enRetard' | 'destinataire'>, maintenant: Date): MessageContactRow {
  const attend = r.statut === 'nouveau' || r.statut === 'envoi';
  const depuis = new Date(r.created_at);
  return {
    ...r,
    destinataire:
      r.canal === 'whatsapp' && r.whatsapp_chat_id ? libelleWhatsapp(r.whatsapp_chat_id) : (r.email ?? '—'),
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

/**
 * Suivi WhatsApp (lot A §5) : messages reçus et délai de réponse sur 30 jours,
 * commandes rapides servies. Les commandes sont COMPTÉES côté base (en-tête
 * count) : lire les lignes buterait sur le plafond silencieux de 1 000 lignes
 * de PostgREST et donnerait un total faux et plausible.
 */
export async function loadSuiviWhatsapp(): Promise<{ stats: StatsWhatsapp; commandes7: number | null; commandes30: number | null }> {
  const db = getServiceClient();
  const maintenant = new Date();
  const depuis = (j: number) => new Date(maintenant.getTime() - j * 86400000).toISOString();
  const [{ data: msgs }, c7, c30] = await Promise.all([
    db.from('contact_messages').select('canal, created_at, repondu_at').eq('canal', 'whatsapp').gte('created_at', depuis(30)).limit(1000),
    db.from('whatsapp_commandes').select('id', { count: 'exact', head: true }).eq('resultat', 'ok').gte('created_at', depuis(7)),
    db.from('whatsapp_commandes').select('id', { count: 'exact', head: true }).eq('resultat', 'ok').gte('created_at', depuis(30)),
  ]);
  return {
    stats: statsWhatsapp((msgs ?? []) as { canal: string; created_at: string; repondu_at: string | null }[], maintenant),
    // null = table absente (migration 0161 non appliquée) : affiché « — », jamais 0.
    commandes7: c7.error ? null : (c7.count ?? 0),
    commandes30: c30.error ? null : (c30.count ?? 0),
  };
}
