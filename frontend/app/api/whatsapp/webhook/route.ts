// frontend/app/api/whatsapp/webhook/route.ts
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { verifyMetaSignature } from '@/lib/whatsappAgent/verifySignature';
import { handleIncomingMessage } from '@/lib/whatsappAgent/handleMessage';
import { isPairingCode } from '@/lib/whatsappAgent/pairing';
import { redeemPairingCode } from '@/lib/whatsappAgent/redeemPairing';

export const dynamic = 'force-dynamic';

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
