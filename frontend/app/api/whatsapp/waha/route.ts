import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { estConversationPrivee, lireEvenementWaha, verifierSignatureWaha } from '@/lib/whatsapp/waha';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { statutsRemplacables } from '@/lib/contact/livraison';
import { recevoirMessageWhatsapp } from '@/lib/contact/whatsappEntrant';
import { lireCommande } from '@/lib/whatsapp/commandes';
import { repondreCommande } from '@/lib/whatsapp/repondreCommande';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhooks de la passerelle WhatsApp non officielle (WAHA, serveur westbourse-wa).
 * Spec : docs/superpowers/specs/2026-10-23-whatsapp-passerelle-design.md §5.
 *
 *   1. corps BRUT lu avant tout parsing ; HMAC-SHA512 vérifié à temps constant
 *      (en-tête X-Webhook-Hmac, clé WAHA_WEBHOOK_HMAC_KEY) → 401 sinon ;
 *   2. session.status hors WORKING → alerte Telegram immédiate : une passerelle
 *      non officielle peut se déconnecter ou être bannie sans autre signal ;
 *   3. message → seules les conversations privées d'un tiers ; déduplication par
 *      identifiant (WAHA réessaie sans accusé), puis enregistrement dans la
 *      console de contact (P1, lib/contact/whatsappEntrant.ts) ;
 *   4. message.ack → livraison des réponses envoyées depuis la console.
 *
 * Journaux : jamais le corps, ni le texte, ni l'expéditeur.
 */

const FENETRE_DEDUP_S = 60 * 60;
/** États normaux d'une session qui démarre ou fonctionne : pas d'alerte. */
const ETATS_SAINS = new Set(['WORKING', 'STARTING']);

async function dejaTraite(idMessage: string): Promise<boolean> {
  // L'identifiant WAHA contient le numéro de l'expéditeur : on n'en garde qu'une empreinte.
  const secret = process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha';
  const cle = createHmac('sha256', secret).update(idMessage).digest('hex');
  const { allowed } = await checkRateLimit({ route: 'waha-msg-dedupe', ip: cle, maxHits: 1, windowSeconds: FENETRE_DEDUP_S });
  return !allowed;
}

export async function POST(req: Request) {
  const corpsBrut = await req.text();
  if (!verifierSignatureWaha(corpsBrut, req.headers.get('x-webhook-hmac'), process.env.WAHA_WEBHOOK_HMAC_KEY)) {
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = JSON.parse(corpsBrut);
  } catch {
    return NextResponse.json({ error: 'Corps illisible.' }, { status: 400 });
  }

  const ev = lireEvenementWaha(corps);
  if (!ev) return NextResponse.json({ ok: true, ignore: true });

  if (ev.type === 'session.status') {
    if (!ETATS_SAINS.has(ev.statut)) {
      await alerterExploitant(
        `session « ${ev.session ?? '?'} » au statut ${ev.statut}. Déconnexion ou bannissement possible : ` +
          `vérifier https://wa.westbourse.com (et relancer l'association si besoin).`,
        '📵 WhatsApp',
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (ev.type === 'message.ack') {
    // Accusé de remise d'une RÉPONSE envoyée depuis la console (resend_id = id
    // WhatsApp du message). Statut monotone : un accusé en retard ne recule rien.
    const remplacables = statutsRemplacables(ev.livraison);
    const filtre = remplacables.length ? `livraison.is.null,livraison.in.(${remplacables.join(',')})` : 'livraison.is.null';
    await getServiceClient()
      .from('contact_messages')
      .update({ livraison: ev.livraison, livraison_at: new Date().toISOString() })
      .eq('canal', 'whatsapp')
      .eq('resend_id', ev.id)
      .or(filtre);
    return NextResponse.json({ ok: true });
  }

  // Message : ni nos propres envois, ni groupes, statuts ou Chaînes.
  if (ev.deMoi || !estConversationPrivee(ev.de)) return NextResponse.json({ ok: true, ignore: true });
  if (await dejaTraite(ev.id)) return NextResponse.json({ ok: true, doublon: true });

  // Commande rapide (COURS, DIV, PALMARES, AIDE) : réponse automatique sans IA ;
  // toute autre phrase va à la console, chez un humain (lot A §1).
  const commande = lireCommande(ev.texte);
  if (commande) {
    await repondreCommande(ev.de, commande);
    return NextResponse.json({ ok: true, commande: commande.type });
  }

  try {
    const r = await recevoirMessageWhatsapp({ de: ev.de, texte: ev.texte, media: ev.media, prenom: ev.prenom });
    return NextResponse.json({ ok: true, recu: true, ...(r ? { nouveau: r.nouveau } : { vide: true }) });
  } catch (e) {
    // L'identifiant est déjà marqué traité : un rejeu serait écarté. On alerte donc
    // l'exploitant — le message reste lisible dans WhatsApp, sur le téléphone.
    console.error('[waha] message non enregistré :', (e as Error).message);
    await alerterExploitant(
      'un message WhatsApp n’a pas pu être enregistré dans la console. Le lire directement dans WhatsApp sur le téléphone WESTBOURSE.',
      '📵 WhatsApp',
    );
    return NextResponse.json({ ok: false, erreur: 'enregistrement impossible' });
  }
}
