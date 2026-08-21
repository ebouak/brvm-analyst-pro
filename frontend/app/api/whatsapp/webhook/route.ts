// frontend/app/api/whatsapp/webhook/route.ts
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createHmac } from 'node:crypto';
import { verifyMetaSignature } from '@/lib/whatsappAgent/verifySignature';
import { handleIncomingMessage } from '@/lib/whatsappAgent/handleMessage';
import { isPairingCode } from '@/lib/whatsappAgent/pairing';
import { redeemPairingCode } from '@/lib/whatsappAgent/redeemPairing';
import { checkRateLimit } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Meta REJOUE un webhook qu'il n'a pas vu acquitté. On répond 200 en quelques
 * millisecondes, mais un cold start Vercel peut dépasser son délai d'attente —
 * le rejeu est donc plausible en pratique, pas théorique. Sans garde, un même
 * message serait traité deux fois : deux appels LLM facturés, deux réponses
 * identiques envoyées à l'utilisateur, deux lignes dans l'historique.
 *
 * `checkRateLimit` avec maxHits=1 EST une déduplication : le premier passage
 * insère la ligne et autorise, tout rejeu dans la fenêtre est refusé. Ça évite
 * une table dédiée (donc une migration de plus) et hérite de la purge
 * automatique hors fenêtre. Fail-open si l'infra tombe — on retombe alors sur
 * le comportement d'avant, pas pire.
 *
 * L'identifiant Meta (`wamid...`) désigne indirectement une personne : on le
 * HMAC comme le numéro plutôt que de l'écrire en clair dans une table non
 * déclarée comme portant des données personnelles.
 */
const DEDUPE_WINDOW_SECONDS = 15 * 60;

async function dejaTraite(messageId: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'westbourse-dedupe';
  const key = createHmac('sha256', secret).update(messageId).digest('hex');
  const { allowed } = await checkRateLimit({
    route: 'whatsapp-msg-dedupe',
    ip: key,
    maxHits: 1,
    windowSeconds: DEDUPE_WINDOW_SECONDS,
  });
  return !allowed;
}

// Handshake de configuration du webhook (une seule fois, dans le dashboard Meta).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// Réception d'un message WhatsApp.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
    console.error('whatsapp/webhook: signature invalide ou WHATSAPP_APP_SECRET manquant');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Meta répond mal (voire redésabonne le webhook) si on met trop de temps à
  // répondre 200 — on traite en tâche de fond et on répond tout de suite.
  // waitUntil() (pas un simple `void ...`) : sur Vercel/serverless, la
  // fonction peut être arrêtée dès la réponse HTTP envoyée — la cascade LLM
  // de callAgentLlm.ts pouvant atteindre ~60 s (DeepSeek puis Mistral,
  // 30 s chacun), un `void` sans garantie d'exécution risquerait une
  // troncature silencieuse du traitement (signalé par la review qualité de
  // la Task 7).
  waitUntil(
    processPayload(payload).catch((err) => {
      console.error('whatsapp/webhook: échec traitement en tâche de fond', err instanceof Error ? err.message : String(err));
    }),
  );

  return NextResponse.json({ status: 'received' }, { status: 200 });
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
}

async function processPayload(payload: unknown): Promise<void> {
  const p = payload as MetaWebhookPayload;
  const messages = p.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
  for (const msg of messages) {
    if (msg.type !== 'text' || !msg.from || !msg.text?.body) continue;

    // Rejeu Meta : ne rien traiter deux fois (voir dejaTraite ci-dessus).
    if (msg.id && (await dejaTraite(msg.id))) {
      console.warn('whatsapp/webhook: message déjà traité, rejeu Meta ignoré');
      continue;
    }

    // Meta envoie `from` sans le '+' initial (ex. "2250700000000").
    const fromE164 = `+${msg.from}`;
    const body = msg.text.body;

    // Appairage AVANT le traitement conversationnel : à ce stade le numéro
    // n'est justement pas encore lié à un compte, donc handleIncomingMessage
    // le rejetterait ("aucun compte"). Voir Task 8bis.
    if (isPairingCode(body)) {
      await redeemPairingCode(fromE164, body);
      continue;
    }

    await handleIncomingMessage(fromE164, body);
  }
}
