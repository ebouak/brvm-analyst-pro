// frontend/app/api/telegram/webhook/route.ts
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { timingSafeEqual } from 'node:crypto';
import { handleIncomingMessage } from '@/lib/telegramAgent/handleMessage';
import { redeemPairingCode } from '@/lib/telegramAgent/redeemPairing';
import { sendTelegramReply } from '@/lib/telegramAgent/sendTelegram';
import { isPairingCode, PAIRING_TTL_MINUTES } from '@/lib/pairingCodes';
import { checkRateLimit } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Telegram REJOUE une mise à jour qu'il n'a pas vue acquittée, et le fait
 * agressivement. Un cold start Vercel suffit à déclencher un rejeu : sans
 * garde, un même message serait traité deux fois — deux appels LLM facturés,
 * deux réponses identiques, deux lignes d'historique.
 *
 * `checkRateLimit` avec maxHits=1 EST une déduplication : le premier passage
 * insère et autorise, tout rejeu dans la fenêtre est refusé. Évite une table
 * dédiée et hérite de la purge hors fenêtre. Fail-open si l'infra tombe — on
 * retombe alors sur le comportement d'avant, pas pire.
 *
 * `update_id` est un compteur propre au bot, sans lien avec une personne :
 * contrairement au `wamid` de Meta, il n'a pas à être haché.
 */
const DEDUPE_WINDOW_SECONDS = 15 * 60;

async function dejaTraite(updateId: number): Promise<boolean> {
  const { allowed } = await checkRateLimit({
    route: 'telegram-update-dedupe',
    ip: `u${updateId}`,
    maxHits: 1,
    windowSeconds: DEDUPE_WINDOW_SECONDS,
  });
  return !allowed;
}

/**
 * Telegram n'utilise pas de signature HMAC comme Meta : il renvoie dans un
 * en-tête le jeton secret fourni au moment du `setWebhook`. C'est donc une
 * comparaison de secret partagé — mais elle doit rester à temps constant,
 * sinon la durée de réponse fuit le préfixe correct caractère par caractère.
 */
function secretValide(recu: string | null): boolean {
  const attendu = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!attendu || !recu) return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  // timingSafeEqual exige des longueurs égales et lève sinon : on compare
  // d'abord, ce qui ne fuit que la longueur — sans intérêt pour l'attaquant.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretValide(request.headers.get('x-telegram-bot-api-secret-token'))) {
    // 401 sans détail : ne pas indiquer si c'est le secret reçu ou sa
    // configuration côté serveur qui est en cause.
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let update: {
    update_id?: number;
    message?: { chat?: { id?: number; type?: string }; text?: string };
  };
  try {
    update = await request.json();
  } catch {
    // Corps illisible : on acquitte quand même. Répondre autre chose que 200
    // ferait rejouer Telegram indéfiniment sur une donnée qui ne passera
    // jamais.
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const texte = msg?.text;

  /* PIÈGE À ÉVITER : ce bot publie lui-même la vidéo quotidienne dans le canal
     @westbourse7. Telegram renvoie ces publications sous forme de
     `channel_post`, et les messages de groupe portent un `chat.type` group ou
     supergroup. On ne traite QUE les conversations privées — sans quoi le bot
     prendrait ses propres publications pour des questions, appellerait le LLM
     et répondrait dans le canal, devant tout le monde. */
  if (!chatId || !texte || msg?.chat?.type !== 'private') {
    return NextResponse.json({ ok: true });
  }

  const updateId = update.update_id;
  if (typeof updateId === 'number' && (await dejaTraite(updateId))) {
    return NextResponse.json({ ok: true });
  }

  /* Traitement en arrière-plan : l'appel LLM dépasse largement le délai que
     Telegram accorde avant de rejouer. On acquitte tout de suite. */
  waitUntil(
    (async () => {
      try {
        const t = texte.trim();

        // `/start` est le premier message de toute conversation Telegram :
        // c'est l'occasion d'expliquer, plutôt que de répondre « compte non
        // lié » à quelqu'un qui vient d'arriver.
        if (t === '/start') {
          await sendTelegramReply(
            chatId,
            'Bienvenue sur WESTBOURSE.\n\n' +
              'Pour lier ce Telegram à votre compte, générez un code dans vos ' +
              `paramètres (rubrique Alertes) et envoyez-le-moi ici. Il est valable ${PAIRING_TTL_MINUTES} minutes.\n\n` +
              'Une fois lié, vous recevrez vos alertes et pourrez me poser des questions sur le marché.',
          );
          return;
        }

        if (isPairingCode(t)) {
          await redeemPairingCode(chatId, t);
          return;
        }

        await handleIncomingMessage(chatId, t);
      } catch (err) {
        // Le webhook a déjà répondu 200 : on ne peut plus rien signaler à
        // Telegram, seulement laisser une trace exploitable.
        console.error('telegram/webhook: traitement en arrière-plan échoué', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })(),
  );

  return NextResponse.json({ ok: true });
}
