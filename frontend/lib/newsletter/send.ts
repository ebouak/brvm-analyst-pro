/**
 * newsletter/send.ts — Module d'envoi newsletter hebdomadaire WESTBOURSE.
 * Pur et testable : pas d'effets de bord implicites, chaque fonction fait
 * une seule chose. Utilisé par la route POST /api/admin/newsletter/send.
 *
 * Envoi via Resend (batch 50) si RESEND_API_KEY présent, sinon console.log.
 * Log systématique dans newsletter_sends (journal d'audit).
 */

import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendBatch } from '@/lib/server/email';
import { siteUrl } from '@/lib/email/templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NewsletterTopic =
  | 'weekly_commodity'
  | 'daily_market'
  | 'signals_digest'
  | 'events_digest';

export interface NewsletterPayload {
  subject: string;
  previewText: string;
  htmlBody: string;
  articleId: string;
  newsletterType: NewsletterTopic;
}

// ---------------------------------------------------------------------------
// getRecipients — union dédupliquée abonnés confirmés + préférences thème
// ---------------------------------------------------------------------------

/**
 * Récupère les emails des destinataires pour un topic donné :
 * - newsletter_subscribers WHERE confirmed = true
 * - newsletter_topic_preferences WHERE {topic} = true → user_id → profiles.email
 *
 * Retourne une liste dédupliquée (Set).
 */
export async function getRecipients(topic: NewsletterTopic): Promise<string[]> {
  const db = getServiceClient();
  const emails = new Set<string>();

  // Source 1 : abonnés confirmés (liste publique directe)
  const { data: subs } = await db
    .from('newsletter_subscribers')
    .select('email')
    .eq('confirmed', true);
  for (const row of subs ?? []) {
    if (row.email && typeof row.email === 'string') {
      emails.add(row.email.toLowerCase().trim());
    }
  }

  // Source 2 : préférences par thème → user_ids → emails via profiles
  const { data: prefs } = await db
    .from('newsletter_topic_preferences')
    .select('user_id')
    .eq(topic, true);
  const userIds = (prefs ?? []).map((r) => r.user_id).filter(Boolean);

  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      if (p.email && typeof p.email === 'string') {
        emails.add(p.email.toLowerCase().trim());
      }
    }
  }

  return [...emails];
}

// ---------------------------------------------------------------------------
// buildWeeklyHtml — template email inline-styles (compatible clients email)
// ---------------------------------------------------------------------------

export function buildWeeklyHtml(params: {
  titre: string;
  resume: string | null;
  slug: string;
  tickerCodes: string[] | null;
  unsubscribeUrl: string;
}): string {
  const { titre, resume, slug, tickerCodes, unsubscribeUrl } = params;
  const base = siteUrl();
  const articleUrl = `${base}/weekly/${slug}`;

  const tickerBadges =
    tickerCodes && tickerCodes.length > 0
      ? tickerCodes
          .map(
            (t) =>
              `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:4px;` +
              `background:#0a1417;border:1px solid #1e3a42;color:#56D7FD;font-size:11px;font-family:monospace">${t}</span>`,
          )
          .join('')
      : '';

  const resumeBlock = resume
    ? `<p style="color:#94a3b8;font-style:italic;font-size:14px;line-height:1.6;margin:16px 0">${resume}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#030303;font-family:sans-serif">

  <div style="max-width:560px;margin:0 auto;background-color:#030303;padding:24px 16px">

    <!-- Header WESTBOURSE -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
      <tr>
        <td style="padding:16px 20px;background:#0a1417;border:1px solid #1a2a30;border-radius:8px">
          <span style="font-size:18px;font-weight:700;color:#56D7FD;letter-spacing:0.05em">WESTBOURSE</span>
          <span style="margin-left:12px;font-size:11px;color:#6b8a9a;text-transform:uppercase;letter-spacing:0.08em">Analyse hebdomadaire</span>
        </td>
      </tr>
    </table>

    <!-- Article card -->
    <div style="background:#0a1417;border:1px solid #1a2a30;border-radius:8px;padding:24px;margin-bottom:20px">

      <!-- Titre -->
      <h1 style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:#FCFCFC;line-height:1.3">
        ${titre}
      </h1>

      <!-- Résumé -->
      ${resumeBlock}

      <!-- Tickers BRVM -->
      ${tickerBadges ? `<div style="margin:16px 0 20px">${tickerBadges}</div>` : ''}

      <!-- CTA -->
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-top:8px">
            <a href="${articleUrl}"
               style="display:inline-block;padding:10px 20px;background:#56D7FD;color:#030303;
                      font-weight:700;font-size:13px;border-radius:6px;text-decoration:none">
              Lire l'analyse complète →
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:0 4px">
      <p style="margin:0 0 6px;font-size:11px;color:#3a5a6a;line-height:1.5">
        Vous recevez cet email car vous êtes abonné aux analyses hebdomadaires WESTBOURSE.
      </p>
      <p style="margin:0;font-size:11px;color:#3a5a6a">
        <a href="${unsubscribeUrl}" style="color:#56D7FD;text-decoration:none">Se désabonner</a>
        &nbsp;·&nbsp;
        <a href="${base}" style="color:#3a5a6a;text-decoration:none">WESTBOURSE</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// sendNewsletter — envoi via Resend (batch 50) ou fallback console
// ---------------------------------------------------------------------------

/**
 * Envoie le payload à la liste de destinataires.
 * Si RESEND_API_KEY est absent → log console (ne plante pas).
 * Retourne le nombre de destinataires envoyés.
 */
export async function sendNewsletter(
  payload: NewsletterPayload,
  recipients: string[],
): Promise<number> {
  if (recipients.length === 0) return 0;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(
      `[newsletter:send] RESEND_API_KEY absent — simulation. Sujet: "${payload.subject}"`,
      `Destinataires (${recipients.length}):`,
      recipients,
    );
    return recipients.length;
  }

  const messages = recipients.map((email) => ({
    to: email,
    subject: payload.subject,
    html: payload.htmlBody,
  }));

  const result = await sendBatch(messages);
  if (!result.ok && result.sent < recipients.length) {
    console.error(
      `[newsletter:send] Envoi partiel ${result.sent}/${recipients.length}. Erreur: ${result.error ?? 'inconnue'}`,
    );
  }
  return result.sent;
}

// ---------------------------------------------------------------------------
// logNewsletterSend — journal d'audit dans newsletter_sends
// ---------------------------------------------------------------------------

export async function logNewsletterSend(params: {
  newsletterType: string;
  articleId: string;
  recipientsCount: number;
  sentBy: string;
}): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from('newsletter_sends').insert({
    newsletter_type: params.newsletterType,
    article_id: params.articleId,
    recipients_count: params.recipientsCount,
    sent_by: params.sentBy,
    sent_at: new Date().toISOString(),
  });
  if (error) {
    // Pas de throw : le log ne doit pas annuler un envoi réussi.
    console.error('[newsletter:log] Erreur insertion newsletter_sends:', error.message);
  }
}
