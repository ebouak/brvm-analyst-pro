/**
 * Lecture des sources du CRM — SERVEUR uniquement (service_role). Toute liste
 * passe par lireTout : PostgREST tronque à 1000 lignes en silence.
 */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { lireTout } from './lecture';
import { assemblerDossiers, type Sources } from './identite';
import type { Dossier } from './types';

async function comptes(sb: ReturnType<typeof getServiceClient>): Promise<Sources['comptes']> {
  const tous: Sources['comptes'] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`CRM : lecture des comptes impossible (${error.message})`);
    tous.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null, last_sign_in_at: u.last_sign_in_at ?? null })));
    if (data.users.length < 1000) break;
  }
  return tous;
}

export async function chargerSources(): Promise<Sources> {
  const sb = getServiceClient();
  const depuis = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);
  const [c, profils, admins, paiements, signaux, positions, messages, prospects, newsletter, academy, actions, oppositions, prefs, liaisons] = await Promise.all([
    comptes(sb),
    lireTout<Sources['profils'][number]>((a, b) => sb.from('profiles').select('id, display_name, is_premium, pays_code').order('id').range(a, b), 'profils'),
    lireTout<Sources['admins'][number]>((a, b) => sb.from('admin_user_roles').select('user_id').order('user_id').order('role_id').range(a, b), 'rôles admin'),
    lireTout<Sources['paiements'][number]>((a, b) => sb.from('billing_transactions').select('id, provider, user_id, amount, currency, status, created_at, paid_at').in('status', ['pending', 'paid', 'failed']).order('created_at').order('id').range(a, b), 'paiements'),
    lireTout<Sources['signaux'][number]>((a, b) => sb.from('crm_signaux').select('user_id, page, jour, type').gte('jour', depuis(30)).order('id').range(a, b), 'signaux'),
    lireTout<Sources['positions'][number]>((a, b) => sb.from('portfolios_positions').select('user_id').order('id').range(a, b), 'positions de portefeuille'),
    lireTout<Sources['messages'][number]>((a, b) => sb.from('contact_messages').select('email, created_at').order('created_at').order('id').range(a, b), 'messages de contact'),
    lireTout<Sources['prospects'][number]>((a, b) => sb.from('leads_brvm').select('email, nom, created_at, consent').order('created_at').order('id').range(a, b), 'prospects'),
    lireTout<Sources['newsletter'][number]>((a, b) => sb.from('newsletter_subscribers').select('email, confirmed').order('id').range(a, b), 'newsletter'),
    lireTout<Sources['academy'][number]>((a, b) => sb.from('academy_progress').select('user_id, completed').eq('completed', true).order('user_id').order('course_id').order('lesson_idx').range(a, b), 'progression Academy'),
    lireTout<Sources['actions'][number]>((a, b) => sb.from('crm_actions').select('email_norm, created_at, type, statut, canal, sujet, contenu, bonus_code, bonus_at, decision, motif, echeance, responsable, livraison, sequence_cle').order('created_at').order('id').range(a, b), 'actions CRM'),
    lireTout<Sources['oppositions'][number]>((a, b) => sb.from('crm_oppositions').select('email_norm').order('email_norm').range(a, b), 'oppositions'),
    lireTout<Sources['prefs'][number]>((a, b) => sb.from('notification_prefs').select('user_id, whatsapp_phone, whatsapp_chat_id, telephone_declare, recontact_optin_at').order('user_id').range(a, b), 'préférences'),
    lireTout<Sources['liaisons'][number]>((a, b) => sb.from('whatsapp_liaisons').select('user_id, chat_id, telephone').order('id').range(a, b), 'liaisons WhatsApp'),
  ]);
  // Fenêtres distinctes : la formation se lit sur 30 jours, l'offre sur 14 — les séquences
  // automatiques s'appuient sur cette borne, l'élargir déclencherait des relances plus anciennes.
  const limiteOffre = depuis(14);
  const signauxUtiles = signaux.filter((x) => x.type === 'formation_vue' || x.jour >= limiteOffre);
  return { comptes: c, profils, admins, paiements, signaux: signauxUtiles, positions, messages, prospects, newsletter, academy, actions, oppositions, prefs, liaisons };
}

export async function chargerDossiers(): Promise<Dossier[]> {
  return assemblerDossiers(await chargerSources());
}

/** À l'échelle actuelle (≈ 200 personnes), recharger tout reste instantané. */
export async function chargerDossier(cle: string): Promise<Dossier | null> {
  return (await chargerDossiers()).find((d) => d.cle === cle) ?? null;
}

export interface PaiementOrphelin { id: string; montant: number; devise: string; date: string; provider: string }

/** Intentions de paiement en attente SANS compte rattaché : à vérifier à la main dans /admin/payments. */
export async function chargerPaiementsOrphelins(): Promise<PaiementOrphelin[]> {
  const sb = getServiceClient();
  const l = await lireTout<{ id: string; amount: number | string; currency: string | null; created_at: string; provider: string }>(
    (a, b) => sb.from('billing_transactions').select('id, amount, currency, created_at, provider').is('user_id', null).eq('status', 'pending').order('created_at').order('id').range(a, b),
    'paiements orphelins',
  );
  return l.map((p) => ({ id: p.id, montant: Number(p.amount), devise: p.currency ?? 'XOF', date: p.created_at, provider: p.provider }));
}
