import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadOpsSettings } from '@/lib/admin/opsSettings';
import { parseAdminChatIds } from '@/lib/opsAgent/auth';
import { resoudreWorkflow } from '@/lib/opsAgent/githubDispatch';
import { echapperHtml, envoyerMessageOps, type InlineKeyboardButton } from '@/lib/opsAgent/telegramApi';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/callback — Retour fermé de fin d'exécution GitHub Actions.
 * Protégé par OPS_CALLBACK_SECRET (`Authorization: Bearer`, >= 32 car.).
 */
export async function POST(req: Request) {
  if (!cronAutorise(req, process.env.OPS_CALLBACK_SECRET)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }

  let corps: {
    workflow?: string;
    conclusion?: string;
    runUrl?: string;
    durationSec?: number;
    summary?: string;
    correlationId?: string;
  };
  try {
    corps = (await req.json()) as typeof corps;
  } catch {
    return NextResponse.json({ error: 'corps illisible' }, { status: 400 });
  }

  const workflow = String(corps.workflow ?? '').trim();
  const conclusion = String(corps.conclusion ?? 'unknown').trim().toLowerCase();
  if (!workflow) {
    return NextResponse.json({ error: 'workflow requis' }, { status: 400 });
  }

  const db = getServiceClient();
  const estSucces = conclusion === 'success';
  const nowIso = new Date().toISOString();

  // Mettre à jour le run correspondant si ouvert (via correlationId ou dernier run en_cours du workflow)
  let runMatch: { id: string; chat_id: number } | null = null;
  if (corps.correlationId) {
    const { data } = await db
      .from('ops_command_runs')
      .update({
        statut: estSucces ? 'succes' : 'echec',
        resultat: { conclusion, runUrl: corps.runUrl ?? null, summary: corps.summary ?? null },
        erreur: estSucces ? null : `Conclusion GitHub : ${conclusion}`,
        maj_le: nowIso,
      })
      .eq('correlation_id', corps.correlationId)
      .select('id, chat_id')
      .maybeSingle();
    runMatch = (data as { id: string; chat_id: number } | null) ?? null;
  } else {
    const { data: latest } = await db
      .from('ops_command_runs')
      .select('id, chat_id')
      .eq('workflow_fichier', workflow)
      .eq('statut', 'en_cours')
      .order('cree_le', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      await db
        .from('ops_command_runs')
        .update({
          statut: estSucces ? 'succes' : 'echec',
          resultat: { conclusion, runUrl: corps.runUrl ?? null, summary: corps.summary ?? null },
          erreur: estSucces ? null : `Conclusion GitHub : ${conclusion}`,
          maj_le: nowIso,
        })
        .eq('id', latest.id);
      runMatch = latest as { id: string; chat_id: number };
    }
  }

  const wf = resoudreWorkflow(workflow);
  const settings = await loadOpsSettings(db);
  const admins = parseAdminChatIds(
    process.env.TELEGRAM_OPS_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_CHAT_ID,
    settings.adminTelegramChatIds,
  );
  if (runMatch?.chat_id && runMatch.chat_id > 0) admins.add(runMatch.chat_id);

  // Envoyer une notification Telegram si le job vient d'un dispatch ou s'il a échoué.
  if ((runMatch || !estSucces) && admins.size > 0 && process.env.TELEGRAM_OPS_BOT_TOKEN) {
    const icon = estSucces ? '✅' : '🔴';
    const duree =
      typeof corps.durationSec === 'number' && corps.durationSec > 0
        ? ` (${Math.round(corps.durationSec)} s)`
        : '';
    const lignes = [
      `${icon} <b>Workflow terminé : ${echapperHtml(wf?.libelle ?? workflow)}</b>${duree}`,
      `Statut : <b>${echapperHtml(conclusion)}</b>`,
      ...(corps.summary ? [echapperHtml(corps.summary.slice(0, 300))] : []),
    ];

    const boutons: InlineKeyboardButton[][] = [];
    const row: InlineKeyboardButton[] = [];
    if (corps.runUrl && corps.runUrl.startsWith('https://github.com/')) {
      row.push({ text: '📄 Journal GitHub ↗', url: corps.runUrl });
    }
    if (estSucces && wf?.workflowSuivant) {
      row.push({ text: `⚡ Enchaîner ${wf.workflowSuivant}`, callback_data: `wf:${wf.workflowSuivant}` });
    }
    if (!estSucces) {
      row.push({ text: '🩺 Diagnostic IA', callback_data: `diag:${wf?.alias ?? workflow}` });
      if (wf) row.push({ text: `🔁 Relancer`, callback_data: `wf:${wf.alias}` });
    }
    if (row.length > 0) boutons.push(row);

    for (const cid of admins) {
      await envoyerMessageOps(cid, lignes.join('\n'), {
        replyMarkup: boutons.length ? { inline_keyboard: boutons } : undefined,
      });
    }
  }

  return NextResponse.json({ ok: true, matched: Boolean(runMatch) });
}
