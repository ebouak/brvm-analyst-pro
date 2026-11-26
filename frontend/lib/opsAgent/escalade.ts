import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadOpsSettings } from '@/lib/admin/opsSettings';
import { cleFenetre, type TypeAlerte } from '@/lib/voix/fenetre';
import { declencherAlerteVocale, type IssueAlerte } from '@/lib/voix/appel';
import { parseAdminChatIds } from './auth';
import { echapperHtml, envoyerMessageOps } from './telegramApi';

export type ResultatEscaladeCritique =
  | { mode: 'ignore'; raison: string }
  | { mode: 'differe'; delaiMin: number; incidentId: string }
  | { mode: 'immediat'; issue: IssueAlerte; detail: string };

/**
 * Enregistre un incident critique et tente d'abord une notification Telegram
 * Ops interactive avec délai de grâce avant l'appel vocal Bland.
 * Si le bot Ops n'est pas configuré ou si le délai vaut 0, déclenche
 * immédiatement `declencherAlerteVocale`.
 */
export async function enregistrerEtNotifierIncidentCritique(
  type: TypeAlerte,
  resume: string,
  maintenant = new Date(),
): Promise<ResultatEscaladeCritique> {
  const db = getServiceClient();
  const cle = cleFenetre(type, maintenant);

  const { data: existant } = await db
    .from('ops_incidents')
    .select('id, statut, silencie_jusqua')
    .eq('type_alerte', type)
    .eq('cle_fenetre', cle)
    .maybeSingle();

  if (existant) {
    if (existant.statut === 'pris_en_charge' || existant.statut === 'resolu') {
      return { mode: 'ignore', raison: `incident déjà ${existant.statut} dans cette fenêtre` };
    }
    if (
      existant.statut === 'silencie' &&
      existant.silencie_jusqua &&
      String(existant.silencie_jusqua) > maintenant.toISOString()
    ) {
      return { mode: 'ignore', raison: 'incident silencié' };
    }
  }

  const settings = await loadOpsSettings(db);
  const delaiMin = settings.escaladeVocaleDelaiMin;
  const adminChats = parseAdminChatIds(
    process.env.TELEGRAM_OPS_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_CHAT_ID,
    settings.adminTelegramChatIds,
  );
  const opsBotActif = Boolean(process.env.TELEGRAM_OPS_BOT_TOKEN) && adminChats.size > 0;

  if (opsBotActif && delaiMin > 0) {
    const escaladeAt = new Date(maintenant.getTime() + delaiMin * 60_000).toISOString();
    const { data: upserted } = await db
      .from('ops_incidents')
      .upsert(
        {
          type_alerte: type,
          cle_fenetre: cle,
          gravite: 'critique',
          titre: `Alerte critique : ${type}`,
          detail: resume.slice(0, 900),
          statut: 'ouvert',
          escalade_vocale_at: escaladeAt,
          escalade_annulee: false,
        },
        { onConflict: 'type_alerte,cle_fenetre' },
      )
      .select('id')
      .maybeSingle();

    const incidentId = (upserted?.id as string | undefined) ?? existant?.id ?? '';
    const html = [
      `🚨 <b>Incident critique · ${echapperHtml(type)}</b>`,
      '',
      echapperHtml(resume.slice(0, 700)),
      '',
      `⏱️ <i>Appel vocal automatique prévu dans ${delaiMin} min si aucune prise en charge.</i>`,
    ].join('\n');

    const boutons = incidentId
      ? {
          inline_keyboard: [
            [
              { text: '👀 Prendre en charge (annuler appel)', callback_data: `inc_ack:${incidentId}` },
            ],
            [
              { text: '🔇 Silencier 6h', callback_data: `inc_sil:${incidentId}` },
              { text: '🩺 Diagnostic IA', callback_data: `diag:${type}` },
            ],
          ],
        }
      : undefined;

    for (const cid of adminChats) {
      const sent = await envoyerMessageOps(cid, html, { replyMarkup: boutons });
      if (sent.ok && sent.messageId && incidentId) {
        await db
          .from('ops_incidents')
          .update({ telegram_chat_id: cid, telegram_message_id: sent.messageId })
          .eq('id', incidentId);
      }
    }

    return { mode: 'differe', delaiMin, incidentId };
  }

  const r = await declencherAlerteVocale(type, resume, maintenant);
  return { mode: 'immediat', issue: r.issue, detail: r.detail };
}

export async function traiterEscaladesDues(
  db: SupabaseClient,
  maintenant = new Date(),
): Promise<{ traitees: number; appelees: number }> {
  const { data } = await db
    .from('ops_incidents')
    .select('id, type_alerte, detail')
    .eq('statut', 'ouvert')
    .eq('escalade_annulee', false)
    .is('escalade_declenchee_at', null)
    .lte('escalade_vocale_at', maintenant.toISOString())
    .limit(10);

  const incidents = (data ?? []) as Array<{ id: string; type_alerte: TypeAlerte; detail: string | null }>;
  let appelees = 0;

  for (const inc of incidents) {
    const r = await declencherAlerteVocale(inc.type_alerte, inc.detail ?? inc.type_alerte, maintenant);
    await db
      .from('ops_incidents')
      .update({ escalade_declenchee_at: maintenant.toISOString() })
      .eq('id', inc.id);

    if (r.issue === 'appele') appelees++;

    const settings = await loadOpsSettings(db);
    const adminChats = parseAdminChatIds(
      process.env.TELEGRAM_OPS_ADMIN_CHAT_IDS,
      process.env.TELEGRAM_CHAT_ID,
      settings.adminTelegramChatIds,
    );
    for (const cid of adminChats) {
      await envoyerMessageOps(
        cid,
        `📞 <b>Escalade vocale (${echapperHtml(inc.type_alerte)})</b> : ${echapperHtml(r.issue)} — ${echapperHtml(r.detail)}`,
      );
    }
  }

  return { traitees: incidents.length, appelees };
}

export async function prendreEnChargeIncident(
  db: SupabaseClient,
  incidentId: string,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const { data } = await db
    .from('ops_incidents')
    .update({
      statut: 'pris_en_charge',
      escalade_annulee: true,
      telegram_chat_id: chatId,
    })
    .eq('id', incidentId)
    .in('statut', ['ouvert', 'silencie'])
    .select('type_alerte')
    .maybeSingle();

  if (!data) return { ok: false, html: 'ℹ️ Incident introuvable ou déjà clos.' };
  return {
    ok: true,
    html: `👀 Incident <b>${echapperHtml(String(data.type_alerte))}</b> pris en charge — escalade vocale annulée.`,
  };
}

export async function silencierIncident(
  db: SupabaseClient,
  incidentId: string,
  heures: number,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const jusqua = new Date(Date.now() + heures * 3600_000).toISOString();
  const { data } = await db
    .from('ops_incidents')
    .update({
      statut: 'silencie',
      escalade_annulee: true,
      silencie_jusqua: jusqua,
      telegram_chat_id: chatId,
    })
    .eq('id', incidentId)
    .select('type_alerte')
    .maybeSingle();

  if (!data) return { ok: false, html: 'ℹ️ Incident introuvable.' };
  return {
    ok: true,
    html: `🔇 Incident <b>${echapperHtml(String(data.type_alerte))}</b> silencié pour ${heures} h.`,
  };
}

export async function resoudreIncident(
  db: SupabaseClient,
  incidentId: string,
  note: string | null,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const { data } = await db
    .from('ops_incidents')
    .update({
      statut: 'resolu',
      escalade_annulee: true,
      resolu_le: new Date().toISOString(),
      correctif: note,
      telegram_chat_id: chatId,
    })
    .eq('id', incidentId)
    .select('type_alerte')
    .maybeSingle();

  if (!data) return { ok: false, html: 'ℹ️ Incident introuvable.' };
  return {
    ok: true,
    html: `✅ Incident <b>${echapperHtml(String(data.type_alerte))}</b> marqué résolu.`,
  };
}
