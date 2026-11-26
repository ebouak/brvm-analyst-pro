import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadOpsSettings } from '@/lib/admin/opsSettings';
import { chargerTour } from '@/lib/controle/tour';
import { controleBoc } from '@/lib/boc/charger';
import { loadCoherenceDashboard } from '@/lib/admin/coherence';
import {
  estAdminTelegram,
  parseAdminChatIds,
  parserCallbackOps,
  parserCommandeOps,
  type CommandParsed,
} from './auth';
import {
  WORKFLOWS_AUTORISES,
  declencherWorkflowGithub,
  resoudreWorkflow,
} from './githubDispatch';
import {
  auditerValeurFlash,
  executerControleCloture,
  formaterBocHtml,
  formaterCoherenceHtml,
  formaterSanteHtml,
  formaterTourHtml,
  genererBriefMatinHtml,
  sonderSanteCanaux,
} from './controles';
import {
  ajouterFerieOps,
  annulerConfirmationOps,
  creerConfirmationOps,
  deciderAgregatOps,
  ecarterPostOps,
  envoyerReponseContactOps,
  executerConfirmationOps,
  listerAgregatsAttente,
  listerContactsAttente,
  listerCrmTop,
  listerPaiementsAttente,
  listerPostsAValider,
  regenererBrouillonContactOps,
} from './actionsMetier';
import { prendreEnChargeIncident, resoudreIncident, silencierIncident } from './escalade';
import { repondreAgentOps } from './agentOps';
import { transcrireAudioOps } from './voixEntrante';
import { telechargerPulsePng } from './pulseTelecharger';
import {
  echapperHtml,
  editerMessageOps,
  envoyerMessageOps,
  envoyerPhotoOps,
  repondreCallbackOps,
  telechargerFichierTelegramOps,
  type InlineKeyboardButton,
  type TelegramOpsUpdate,
} from './telegramApi';

const MENU_AIDE = [
  '🤖 <b>WESTBOURSE Ops Agent</b>',
  '',
  '<b>Contrôles &amp; Diagnostics</b>',
  '/tour — État complet de la Tour de contrôle',
  '/cloture — Chaîne post-séance + maillons manquants',
  '/matin — Briefing fondateur (KPIs 24h)',
  '/boc — Écarts PER / Rendement vs Bulletin officiel',
  '/coherence — Anomalies de cohérence ouvertes',
  '/audit CODE — Audit flash d’une valeur (ex. <code>/audit SNTS</code>)',
  '/pulse — Carte exécutive PNG (KPIs + heatmap workflows)',
  '/llm — Sonde live DeepSeek, Gemini, Grok, WhatsApp, Resend, Bland',
  '/incidents — Incidents critiques ouverts',
  '',
  '<b>Actions &amp; Remédiation</b>',
  '/relancer nom — Déclenche un workflow GitHub (ex. <code>/relancer daily-brvm</code>)',
  '/paiements — Valider un paiement en attente',
  '/agregats — Relire les agrégats bancaires',
  '/contact — Répondre aux messages support (brouillon IA)',
  '/crm — Top 5 prospects proches du Premium',
  '/posts — Publications sociales à valider / écarter',
  '/ferie AAAA-MM-JJ Motif — Déclarer un jour férié BRVM',
  '/kill flag · /revive flag — Coupe-circuit feature flag',
  '',
  '💡 Vous pouvez aussi envoyer un <b>message libre</b> ou une <b>note vocale</b>.',
].join('\n');

export async function verifierAccesAdminOps(chatId: number | undefined): Promise<boolean> {
  if (!chatId) return false;
  const db = getServiceClient();
  const settings = await loadOpsSettings(db);
  const allowed = parseAdminChatIds(
    process.env.TELEGRAM_OPS_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_CHAT_ID,
    settings.adminTelegramChatIds,
  );
  return estAdminTelegram(chatId, allowed);
}

async function executerCommande(
  chatId: number,
  cmd: CommandParsed,
  origine: string,
  editMessageId?: number,
): Promise<void> {
  const db = getServiceClient();

  const repondre = async (html: string, boutons?: InlineKeyboardButton[][]) => {
    const replyMarkup = boutons && boutons.length > 0 ? { inline_keyboard: boutons } : undefined;
    if (editMessageId) {
      const ok = await editerMessageOps(chatId, editMessageId, html, { replyMarkup });
      if (ok) return;
    }
    await envoyerMessageOps(chatId, html, { replyMarkup });
  };

  switch (cmd.type) {
    case 'start':
    case 'help':
      await repondre(MENU_AIDE, [
        [
          { text: '🛰️ Tour de contrôle', callback_data: 'cmd:tour' },
          { text: '🌆 Clôture', callback_data: 'cmd:cloture' },
          { text: '📊 Pulse PNG', callback_data: 'cmd:pulse' },
        ],
        [
          { text: '💳 Paiements', callback_data: 'cmd:paiements' },
          { text: '🩺 Santé canaux', callback_data: 'cmd:llm' },
        ],
      ]);
      return;

    case 'tour': {
      const tour = await chargerTour();
      await repondre(formaterTourHtml(tour.signaux, tour.observeA), [
        [
          { text: '🔄 Recollecter workflows', callback_data: 'wf:ops-controle' },
          { text: '🌆 Clôture', callback_data: 'cmd:cloture' },
        ],
        [
          { text: '📊 Carte Pulse', callback_data: 'cmd:pulse' },
          { text: '🩺 Diagnostic IA', callback_data: 'diag:tour' },
        ],
      ]);
      return;
    }

    case 'cloture': {
      const sent = editMessageId
        ? { ok: true, messageId: editMessageId }
        : await envoyerMessageOps(chatId, '⏳ <b>Contrôle post-séance</b>\nInitialisation…');
      const res = await executerControleCloture(db, async (html) => {
        if (sent.messageId) await editerMessageOps(chatId, sent.messageId, html);
      });
      if (sent.messageId) {
        await editerMessageOps(chatId, sent.messageId, res.html, {
          replyMarkup: { inline_keyboard: res.boutons },
        });
      } else {
        await envoyerMessageOps(chatId, res.html, { replyMarkup: { inline_keyboard: res.boutons } });
      }
      return;
    }

    case 'matin': {
      const html = await genererBriefMatinHtml(db);
      await repondre(html, [
        [
          { text: '📊 Carte Pulse', callback_data: 'cmd:pulse' },
          { text: '💳 Paiements', callback_data: 'cmd:paiements' },
          { text: '✉️ Contacts', callback_data: 'cmd:contact' },
        ],
      ]);
      return;
    }

    case 'boc': {
      const controles = await controleBoc(db).catch(() => []);
      await repondre(formaterBocHtml(controles), [
        [
          { text: '⚡ Relancer controle-boc', callback_data: 'wf:controle-boc' },
          { text: '🛰️ Tour', callback_data: 'cmd:tour' },
        ],
      ]);
      return;
    }

    case 'coherence': {
      const tab = await loadCoherenceDashboard();
      await repondre(formaterCoherenceHtml(tab), [
        [
          { text: '⚡ Relancer coherence', callback_data: 'wf:coherence' },
          { text: '🛰️ Tour', callback_data: 'cmd:tour' },
        ],
      ]);
      return;
    }

    case 'llm': {
      const sondes = await sonderSanteCanaux(db);
      await repondre(formaterSanteHtml(sondes), [
        [{ text: '🔄 Re-sonder', callback_data: 'cmd:llm' }],
      ]);
      return;
    }

    case 'pulse': {
      const png = await telechargerPulsePng(origine);
      if (!png) {
        await repondre(
          '⚠️ Impossible de générer la carte Pulse PNG (vérifiez <code>OPS_PULSE_SECRET</code> ou <code>RECAP_SECRET</code>).',
        );
        return;
      }
      await envoyerPhotoOps(chatId, png, '📊 <b>WESTBOURSE Pulse Exécutif</b>', {
        inline_keyboard: [
          [
            { text: '🛰️ Tour', callback_data: 'cmd:tour' },
            { text: '🌆 Clôture', callback_data: 'cmd:cloture' },
          ],
        ],
      });
      return;
    }

    case 'audit': {
      if (!cmd.code) {
        await repondre('ℹ️ Précisez une valeur : <code>/audit SNTS</code> ou <code>/audit Sonatel</code>');
        return;
      }
      const audit = await auditerValeurFlash(db, cmd.code);
      await repondre(audit.html);
      return;
    }

    case 'relancer': {
      if (!cmd.cible) {
        const list = WORKFLOWS_AUTORISES.map((w) => `• <code>${w.alias}</code> — ${echapperHtml(w.libelle)}`).join('\n');
        await repondre(`🚀 <b>Workflows disponibles</b>\nUtilisez <code>/relancer alias</code> :\n\n${list}`, [
          [
            { text: '🔄 ops-controle', callback_data: 'wf:ops-controle' },
            { text: '📈 daily-brvm', callback_data: 'wf:daily-brvm' },
            { text: '🧮 score', callback_data: 'wf:score' },
          ],
          [
            { text: '🔔 alerts', callback_data: 'wf:alerts' },
            { text: '📊 controle-boc', callback_data: 'wf:controle-boc' },
            { text: '🎬 video-seance', callback_data: 'wf:video-seance' },
          ],
        ]);
        return;
      }
      const wf = resoudreWorkflow(cmd.cible);
      if (!wf) {
        await repondre(`⚠️ Workflow « ${echapperHtml(cmd.cible)} » non reconnu.`);
        return;
      }
      const res = await declencherWorkflowGithub(db, {
        aliasOuFichier: wf.alias,
        chatId,
        source: 'telegram',
      });
      if (res.ok) {
        await repondre(
          `🚀 <b>${echapperHtml(wf.libelle)}</b> (<code>${wf.fichier}</code>) déclenché sur GitHub Actions.\nVous recevrez un retour automatique dès la fin du job.`,
        );
      } else {
        await repondre(`⚠️ ${echapperHtml(res.erreur ?? 'Échec du déclenchement')}`);
      }
      return;
    }

    case 'paiements': {
      const p = await listerPaiementsAttente(db);
      await repondre(p.html, p.boutons);
      return;
    }

    case 'agregats': {
      const a = await listerAgregatsAttente();
      await repondre(a.html, a.boutons);
      return;
    }

    case 'contact': {
      const c = await listerContactsAttente(db);
      await repondre(c.html, c.boutons);
      return;
    }

    case 'crm': {
      await repondre(await listerCrmTop());
      return;
    }

    case 'posts': {
      const p = await listerPostsAValider(db);
      await repondre(p.html, p.boutons);
      return;
    }

    case 'ferie': {
      if (!cmd.date) {
        await repondre('ℹ️ Format : <code>/ferie 2026-12-07 Fête nationale</code>');
        return;
      }
      const r = await ajouterFerieOps(db, cmd.date, cmd.motif ?? 'Jour férié BRVM', chatId);
      await repondre(r.html);
      return;
    }

    case 'kill':
    case 'revive': {
      const flag = cmd.flag;
      if (!flag) {
        await repondre(`ℹ️ Précisez le code du flag : <code>/${cmd.type} whatsapp_agent</code>`);
        return;
      }
      const runId = await creerConfirmationOps(
        db,
        chatId,
        'feature_flag',
        { code: flag, mode: cmd.type },
        2,
      );
      if (!runId) {
        await repondre('❌ Impossible de préparer la confirmation.');
        return;
      }
      await repondre(
        `⚠️ <b>Confirmation critique requise</b>\nAction : <b>${cmd.type === 'kill' ? 'DÉSACTIVER' : 'RÉACTIVER'}</b> la fonctionnalité <code>${echapperHtml(flag)}</code> en production.`,
        [
          [
            { text: '✅ Confirmer', callback_data: `cfm:${runId}` },
            { text: '❌ Annuler', callback_data: `cnl:${runId}` },
          ],
        ],
      );
      return;
    }

    case 'incidents': {
      const { data } = await db
        .from('ops_incidents')
        .select('id, type_alerte, gravite, titre, statut, cree_le')
        .in('statut', ['ouvert', 'pris_en_charge', 'silencie'])
        .order('cree_le', { ascending: false })
        .limit(6);

      const rows = (data ?? []) as Array<{
        id: string;
        type_alerte: string;
        gravite: string;
        titre: string;
        statut: string;
      }>;
      if (rows.length === 0) {
        await repondre('🚨 <b>Incidents Ops</b>\n✅ Aucun incident actif.');
        return;
      }
      const lines = [`🚨 <b>Incidents Ops actifs (${rows.length})</b>`, ''];
      const boutons: InlineKeyboardButton[][] = [];
      for (const r of rows) {
        lines.push(`• [${echapperHtml(r.statut)}] <b>${echapperHtml(r.titre)}</b> (${echapperHtml(r.gravite)})`);
        boutons.push([
          { text: `👀 Prendre ${r.type_alerte}`, callback_data: `inc_ack:${r.id}` },
          { text: `✅ Résoudre`, callback_data: `inc_res:${r.id}` },
        ]);
      }
      await repondre(lines.join('\n'), boutons);
      return;
    }

    case 'libre': {
      const res = await repondreAgentOps(db, chatId, cmd.texte);
      await repondre(res.html, res.boutons);
      return;
    }
  }
}

async function traiterCallback(
  chatId: number,
  messageId: number | undefined,
  callbackId: string,
  data: string,
  origine: string,
): Promise<void> {
  const db = getServiceClient();
  const parsed = parserCallbackOps(data);

  const editOrSend = async (html: string, boutons?: InlineKeyboardButton[][]) => {
    const replyMarkup = boutons && boutons.length > 0 ? { inline_keyboard: boutons } : undefined;
    if (messageId) {
      await editerMessageOps(chatId, messageId, html, { replyMarkup });
    } else {
      await envoyerMessageOps(chatId, html, { replyMarkup });
    }
  };

  switch (parsed.kind) {
    case 'cmd': {
      await repondreCallbackOps(callbackId, 'Chargement…');
      await executerCommande(chatId, parserCommandeOps(`/${parsed.nom}`), origine, messageId);
      return;
    }

    case 'wf': {
      await repondreCallbackOps(callbackId, `Lancement ${parsed.alias}…`);
      const res = await declencherWorkflowGithub(db, {
        aliasOuFichier: parsed.alias,
        chatId,
        source: 'telegram',
        messageId,
      });
      await envoyerMessageOps(
        chatId,
        res.ok
          ? `🚀 Workflow <code>${echapperHtml(res.workflow?.fichier ?? parsed.alias)}</code> déclenché. Retour automatique en fin d’exécution.`
          : `⚠️ ${echapperHtml(res.erreur ?? 'Échec lancement')}`,
      );
      return;
    }

    case 'pay_ask': {
      await repondreCallbackOps(callbackId);
      const runId = await creerConfirmationOps(
        db,
        chatId,
        'confirm_payment',
        { transactionId: parsed.id },
        2,
      );
      if (!runId) {
        await envoyerMessageOps(chatId, '❌ Création confirmation impossible.');
        return;
      }
      await envoyerMessageOps(
        chatId,
        `💳 <b>Confirmer ce paiement ?</b>\nRéf. : <code>${echapperHtml(parsed.id)}</code>\n<i>Expiration dans 2 minutes.</i>`,
        {
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Confirmer & activer', callback_data: `cfm:${runId}` },
                { text: '❌ Annuler', callback_data: `cnl:${runId}` },
              ],
            ],
          },
        },
      );
      return;
    }

    case 'cfm': {
      await repondreCallbackOps(callbackId, 'Exécution…');
      const r = await executerConfirmationOps(db, chatId, parsed.runId);
      await editOrSend(r.html);
      return;
    }

    case 'cnl': {
      await repondreCallbackOps(callbackId, 'Annulé');
      await annulerConfirmationOps(db, chatId, parsed.runId);
      await editOrSend('🚫 Action annulée.');
      return;
    }

    case 'inc_ack': {
      const r = await prendreEnChargeIncident(db, parsed.id, chatId);
      await repondreCallbackOps(callbackId, r.ok ? 'Pris en charge' : 'Déjà clos');
      await envoyerMessageOps(chatId, r.html);
      return;
    }

    case 'inc_sil': {
      const r = await silencierIncident(db, parsed.id, 6, chatId);
      await repondreCallbackOps(callbackId, 'Silencié 6h');
      await envoyerMessageOps(chatId, r.html);
      return;
    }

    case 'inc_res': {
      const r = await resoudreIncident(db, parsed.id, 'Résolu via Telegram Ops', chatId);
      await repondreCallbackOps(callbackId, 'Résolu');
      await envoyerMessageOps(chatId, r.html);
      return;
    }

    case 'agr_ok':
    case 'agr_ko': {
      const action = parsed.kind === 'agr_ok' ? 'valider' : 'rejeter';
      await repondreCallbackOps(callbackId, action === 'valider' ? 'Validation…' : 'Rejet…');
      const r = await deciderAgregatOps(db, parsed.id, action, chatId);
      await envoyerMessageOps(chatId, r.html);
      return;
    }

    case 'ctc_send': {
      await repondreCallbackOps(callbackId, 'Envoi…');
      const r = await envoyerReponseContactOps(db, parsed.id, chatId);
      await envoyerMessageOps(chatId, r.html);
      return;
    }

    case 'ctc_regen': {
      await repondreCallbackOps(callbackId, 'Régénération…');
      const r = await regenererBrouillonContactOps(db, parsed.id);
      await envoyerMessageOps(chatId, r.html, {
        replyMarkup: r.boutons ? { inline_keyboard: r.boutons } : undefined,
      });
      return;
    }

    case 'post_ko': {
      await repondreCallbackOps(callbackId, 'Écarté');
      const r = await ecarterPostOps(db, parsed.target, chatId);
      await envoyerMessageOps(chatId, r.html);
      return;
    }

    case 'diag_ia': {
      await repondreCallbackOps(callbackId, 'Diagnostic IA…');
      const res = await repondreAgentOps(
        db,
        chatId,
        `Analyse l'état actuel concernant « ${parsed.cible} », identifie la cause probable des alertes ou échecs récents et propose l'action adaptée.`,
      );
      await envoyerMessageOps(chatId, res.html, {
        replyMarkup: res.boutons.length ? { inline_keyboard: res.boutons } : undefined,
      });
      return;
    }

    default:
      await repondreCallbackOps(callbackId, 'Action inconnue');
  }
}

export async function traiterUpdateOps(update: TelegramOpsUpdate, origine: string): Promise<void> {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    if (!chatId || cq.message?.chat?.type !== 'private') return;
    if (!(await verifierAccesAdminOps(chatId))) {
      await repondreCallbackOps(cq.id, 'Accès refusé', true);
      return;
    }
    await traiterCallback(chatId, cq.message?.message_id, cq.id, cq.data ?? '', origine);
    return;
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (!chatId || msg?.chat?.type !== 'private') return;

  if (!(await verifierAccesAdminOps(chatId))) {
    console.warn('telegram/ops: accès refusé pour chat_id non autorisé', { chatId });
    return;
  }

  const media = msg.voice ?? msg.audio;
  if (media?.file_id) {
    const wait = await envoyerMessageOps(chatId, '🎙️ <i>Transcription de votre note vocale…</i>');
    const dl = await telechargerFichierTelegramOps(media.file_id);
    if (!dl.ok) {
      if (wait.messageId) {
        await editerMessageOps(chatId, wait.messageId, `⚠️ ${echapperHtml(dl.raison)}`);
      } else {
        await envoyerMessageOps(chatId, `⚠️ ${echapperHtml(dl.raison)}`);
      }
      return;
    }

    const tr = await transcrireAudioOps(dl.buffer, media.mime_type || dl.mimeType, dl.fileName);
    if (!tr.ok) {
      if (wait.messageId) {
        await editerMessageOps(chatId, wait.messageId, `⚠️ ${echapperHtml(tr.raison)}`);
      } else {
        await envoyerMessageOps(chatId, `⚠️ ${echapperHtml(tr.raison)}`);
      }
      return;
    }

    if (wait.messageId) {
      await editerMessageOps(
        chatId,
        wait.messageId,
        `🎙️ <i>« ${echapperHtml(tr.texte)} »</i>\n⏳ Traitement…`,
      );
    }
    await executerCommande(chatId, parserCommandeOps(tr.texte), origine);
    return;
  }

  if (msg.text) {
    await executerCommande(chatId, parserCommandeOps(msg.text), origine);
  }
}
