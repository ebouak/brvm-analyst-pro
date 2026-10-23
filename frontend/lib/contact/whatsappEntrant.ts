import 'server-only';
import { createHmac } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { accuseReceptionWhatsapp, ACCUSE_FENETRE_SECONDES } from './accuse';

/**
 * Message WhatsApp d'un visiteur → la même console que le formulaire de contact
 * (spec docs/superpowers/specs/2026-10-23-whatsapp-passerelle-design.md §7).
 *
 *  - une conversation déjà EN ATTENTE reçoit les nouveaux messages à la suite
 *    (horodatés) : une personne qui écrit en trois fois = une seule fiche ;
 *  - sinon une fiche est créée, l'exploitant est notifié par email (lien
 *    console) et un accusé FIXE repart sur WhatsApp — en réponse, jamais à
 *    froid, au plus une fois par conversation et par 24 h.
 * Aucun contenu de message dans les journaux.
 */

export interface MessageEntrant {
  de: string;
  texte: string;
  media: boolean;
  prenom: string | null;
}

const MESSAGE_MAX = 8000;

function heureUtc(): string {
  return new Date().toISOString().slice(11, 16);
}

/** Affichage lisible d'un identifiant de conversation (jamais l'identifiant @lid brut). */
export function libelleWhatsapp(chatId: string): string {
  const m = /^(\d+)@(c\.us|s\.whatsapp\.net)$/.exec(chatId);
  return m ? `+${m[1]}` : 'WhatsApp (numéro masqué)';
}

async function notifierExploitant(id: string, prenom: string | null, chatId: string, texte: string): Promise<void> {
  const to = process.env.CONTACT_EMAIL_TO ?? 'ebouak@gmail.com';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  await sendEmail({
    to,
    subject: `💬 WhatsApp WESTBOURSE — ${prenom || libelleWhatsapp(chatId)}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e">
        <h2 style="color:#2a8aa8">Nouveau message WhatsApp</h2>
        <p><a href="https://www.westbourse.com/admin/contact/${id}" style="color:#2a8aa8;font-weight:bold">Répondre depuis la console →</a></p>
        <p><strong>Prénom affiché :</strong> ${esc(prenom ?? '—')}</p>
        <p><strong>WhatsApp :</strong> ${esc(libelleWhatsapp(chatId))}</p>
        <p><strong>Message :</strong></p>
        <p style="white-space:pre-wrap;border-left:3px solid #56d7fd;padding-left:12px">${esc(texte)}</p>
      </div>`,
  });
}

async function accuserReception(chatId: string): Promise<void> {
  const cle = createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`accuse:${chatId}`).digest('hex');
  const { allowed } = await checkRateLimit({ route: 'whatsapp-accuse', ip: cle, maxHits: 1, windowSeconds: ACCUSE_FENETRE_SECONDES });
  if (!allowed) return;
  const r = await passerelleWhatsapp().envoyerTexte(chatId, accuseReceptionWhatsapp());
  if (!r.ok) console.warn('[whatsapp] accusé non envoyé :', r.erreur);
}

export async function recevoirMessageWhatsapp(m: MessageEntrant): Promise<{ id: string; nouveau: boolean } | null> {
  const texte = m.texte.trim() || (m.media ? '[pièce jointe — à consulter dans WhatsApp]' : '');
  if (!texte) return null;
  const db = getServiceClient();
  const maintenant = new Date().toISOString();

  const { data: enCours } = await db
    .from('contact_messages')
    .select('id, message')
    .eq('canal', 'whatsapp')
    .eq('whatsapp_chat_id', m.de)
    .in('statut', ['nouveau', 'envoi'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enCours) {
    const suite = `${enCours.message}\n\n[${heureUtc()} UTC] ${texte}`.slice(0, MESSAGE_MAX);
    const { error } = await db
      .from('contact_messages')
      .update({ message: suite, derniere_activite_at: maintenant })
      .eq('id', enCours.id);
    if (error) throw new Error(`ajout au fil impossible : ${error.code ?? error.message}`);
    return { id: enCours.id as string, nouveau: false };
  }

  const { data, error } = await db
    .from('contact_messages')
    .insert({
      canal: 'whatsapp',
      whatsapp_chat_id: m.de,
      email: null,
      prenom: m.prenom,
      page: 'WhatsApp',
      message: texte.slice(0, MESSAGE_MAX),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`enregistrement impossible : ${error?.code ?? error?.message ?? 'inconnu'}`);
  const id = (data as { id: string }).id;

  // Notification et accusé : un échec n'annule pas l'enregistrement.
  await Promise.allSettled([notifierExploitant(id, m.prenom, m.de, texte), accuserReception(m.de)]);
  return { id, nouveau: true };
}
