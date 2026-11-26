import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { verifierSecretOps } from '@/lib/opsAgent/auth';
import { traiterUpdateOps } from '@/lib/opsAgent/orchestrateur';
import type { TelegramOpsUpdate } from '@/lib/opsAgent/telegramApi';

export const dynamic = 'force-dynamic';

const DEDUPE_WINDOW_SECONDS = 15 * 60;

async function dejaTraite(updateId: number): Promise<boolean> {
  const { allowed } = await checkRateLimit({
    route: 'telegram-ops-dedupe',
    ip: `ops_${updateId}`,
    maxHits: 1,
    windowSeconds: DEDUPE_WINDOW_SECONDS,
  });
  return !allowed;
}

export async function POST(request: Request) {
  if (
    !verifierSecretOps(
      request.headers.get('x-telegram-bot-api-secret-token'),
      process.env.TELEGRAM_OPS_WEBHOOK_SECRET,
    )
  ) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let update: TelegramOpsUpdate;
  try {
    update = (await request.json()) as TelegramOpsUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (typeof update.update_id === 'number' && (await dejaTraite(update.update_id))) {
    return NextResponse.json({ ok: true });
  }

  const origin = new URL(request.url).origin;

  waitUntil(
    traiterUpdateOps(update, origin).catch((err) => {
      console.error('telegram/ops/webhook: erreur traitement arrière-plan', {
        message: err instanceof Error ? err.message : String(err),
      });
    }),
  );

  return NextResponse.json({ ok: true });
}
