import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { estAutoTest, estConversationPrivee, lireEvenementWaha, verifierSignatureWaha } from '@/lib/whatsapp/waha';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { statutsRemplacables } from '@/lib/contact/livraison';
import { recevoirMessageWhatsapp } from '@/lib/contact/whatsappEntrant';
import { estDemandeHumain, estDemandeRecap, lireCommande } from '@/lib/whatsapp/commandes';
import { traiterDemandeRecap } from '@/lib/recap/demande';
import { repondreCommande } from '@/lib/whatsapp/repondreCommande';
import { appairerWhatsapp } from '@/lib/whatsapp/appairage';
import { abonneAvecAgent, repondreAgent } from '@/lib/whatsapp/agent';
import { isPairingCode } from '@/lib/pairingCodes';
import { estStop } from '@/lib/crm/whatsappRelance';
import { traiterStop } from '@/lib/whatsapp/stop';
import { aiguillerParJev } from '@/lib/whatsapp/aiguillage/aiguiller';
import { appliquerDecision, depsAiguillageWhatsapp } from '@/lib/server/whatsappAiguillage';
import { chatbotActif, effacerConversation, memoriserEchange, repondreChatbotWhatsapp, traiterVocal } from '@/lib/server/whatsappChatbot';
import { estDemandeEffacer } from '@/lib/whatsapp/chatbot/textes';

export const runtime = 'nodejs';
// Transcription d'une note vocale + réponse de l'assistant (outils, réécriture éventuelle).
export const maxDuration = 60;
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

  // Message : ni nos propres envois, ni groupes, statuts ou Chaînes — SAUF le
  // test de l'exploitant, tapé à la main dans la conversation « Vous » du
  // numéro WESTBOURSE (estAutoTest : jamais nos réponses, source « api »).
  const autoTest = estAutoTest(ev);
  if ((ev.deMoi && !autoTest) || !estConversationPrivee(ev.de)) return NextResponse.json({ ok: true, ignore: true });
  if (await dejaTraite(ev.id)) return NextResponse.json({ ok: true, doublon: true });

  // Assistant ouvert à tous (drapeau whatsapp_chatbot, spec 2026-11-04). Coupé,
  // le parcours ci-dessous est exactement celui d'avant.
  const chatbot = !autoTest && (await chatbotActif());
  let texte = ev.texte;
  let quotaPris = false;
  let vocal = false;
  if (chatbot && !texte.trim() && ev.fichier?.mimetype.startsWith('audio/')) {
    const v = await traiterVocal(ev.de, ev.fichier);
    if (v.etat !== 'texte') return NextResponse.json({ ok: true, vocal: v.etat });
    texte = v.texte;
    quotaPris = true;
    vocal = true;
  }

  // Aiguillage (lots A et D) : code d'appairage → liaison du compte ;
  // commande rapide → réponse sans IA ; le reste → Jev, assistant, ou console.
  if (isPairingCode(texte)) {
    await appairerWhatsapp(ev.de, texte);
    return NextResponse.json({ ok: true, appairage: true });
  }
  // STOP : opposition au recontact commercial (RGPD art. 21). Jamais pour le
  // test de l'exploitant, jamais vers l'agent.
  const stop = !autoTest && estStop(texte);
  if (stop) {
    const enregistre = await traiterStop(ev.de).catch(() => false);
    if (enregistre) return NextResponse.json({ ok: true, stop: true });
    // Non rattaché : le message suit le chemin normal jusqu'à la console.
  }
  if (chatbot && estDemandeEffacer(texte)) {
    await effacerConversation(ev.de);
    return NextResponse.json({ ok: true, efface: true });
  }
  // RECAP : image du portefeuille de l'abonné lié (Premium) — avant les
  // commandes anonymes, car elle est personnelle.
  if (estDemandeRecap(texte)) {
    await traiterDemandeRecap('whatsapp', ev.de, new URL(req.url).origin);
    return NextResponse.json({ ok: true, recap: true });
  }
  const commande = lireCommande(texte);
  if (commande) {
    const envoye = await repondreCommande(ev.de, commande);
    if (chatbot && envoye) await memoriserEchange(ev.de, texte, envoye);
    return NextResponse.json({ ok: true, commande: commande.type });
  }
  if (texte.trim() && !estDemandeHumain(texte) && !estStop(texte)) {
    // Jev (si activé) : réponse exacte, refus de conseil, salutation. Avec l'assistant,
    // le doute, la clarification et l'analyse vont à l'assistant plutôt qu'à la console.
    const decision = autoTest ? ({ type: 'aiguillage_actuel' } as const) : await aiguillerParJev(texte, ev.de, depsAiguillageWhatsapp());
    const versAssistant = chatbot && (decision.type === 'aiguillage_actuel' || decision.type === 'clarification' || decision.type === 'agent');
    if (!versAssistant) {
      const envoye = await appliquerDecision(ev.de, decision);
      if (envoye) {
        if (chatbot) await memoriserEchange(ev.de, texte, envoye);
        return NextResponse.json({ ok: true, aiguillage: decision.type });
      }
    }
    if (chatbot && decision.type !== 'console') {
      const issue = await repondreChatbotWhatsapp(ev.de, texte, { quotaDejaPris: quotaPris });
      if (issue !== 'console') return NextResponse.json({ ok: true, assistant: issue });
    } else if (decision.type !== 'console') {
      const abonne = await abonneAvecAgent(ev.de);
      if (abonne) {
        await repondreAgent(ev.de, abonne, texte);
        return NextResponse.json({ ok: true, agent: true });
      }
    }
  }

  // Une note que l'exploitant s'écrit à lui-même n'ouvre pas de fiche de contact.
  if (autoTest) return NextResponse.json({ ok: true, ignore: 'auto-test' });

  try {
    const r = await recevoirMessageWhatsapp({ de: ev.de, texte: vocal ? `🎤 ${texte}` : ev.texte, media: ev.media, prenom: ev.prenom });
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
