import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadOpsSettings } from '@/lib/admin/opsSettings';
import { parseAdminChatIds } from '@/lib/opsAgent/auth';
import { executerControleCloture, genererBriefMatinHtml } from '@/lib/opsAgent/controles';
import { envoyerMessageOps, type InlineKeyboardButton } from '@/lib/opsAgent/telegramApi';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!cronAutorise(req)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }

  const type = new URL(req.url).searchParams.get('type') === 'cloture' ? 'cloture' : 'matin';
  const db = getServiceClient();
  const settings = await loadOpsSettings(db);
  const admins = parseAdminChatIds(
    process.env.TELEGRAM_OPS_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_CHAT_ID,
    settings.adminTelegramChatIds,
  );

  if (admins.size === 0 || !process.env.TELEGRAM_OPS_BOT_TOKEN) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'bot_ops_non_configure' });
  }

  let html: string;
  let boutons: InlineKeyboardButton[][] = [];

  if (type === 'cloture') {
    const res = await executerControleCloture(db);
    html = res.html;
    boutons = res.boutons;
  } else {
    html = await genererBriefMatinHtml(db);
    boutons = [
      [
        { text: '📊 Carte Pulse', callback_data: 'cmd:pulse' },
        { text: '💳 Paiements', callback_data: 'cmd:paiements' },
        { text: '✉️ Contacts', callback_data: 'cmd:contact' },
      ],
    ];
  }

  let sent = 0;
  for (const cid of admins) {
    const r = await envoyerMessageOps(cid, html, {
      replyMarkup: boutons.length ? { inline_keyboard: boutons } : undefined,
    });
    if (r.ok) sent++;
  }

  return NextResponse.json({ ok: true, type, sent });
}
