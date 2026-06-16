'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendBatch } from '@/lib/server/email';
import { campaignHtml, textToHtml, siteUrl } from '@/lib/email/templates';

type R = { ok: boolean; message?: string };

/** Désabonne un abonné (confirmed=false, conserve la ligne). */
export async function unsubscribeSubscriber(id: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();
  const { error } = await db.from('newsletter_subscribers').update({ confirmed: false }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'newsletter.unsubscribe', resourceType: 'newsletter_subscriber', resourceId: id, severity: 'info' });
  revalidatePath('/admin/newsletter');
  return { ok: true };
}

/** Envoie une campagne à tous les abonnés confirmés (footer désabonnement). */
export async function sendCampaign(subject: string, body: string): Promise<R & { sent?: number }> {
  const ctx = await requirePermission('content.publish');
  if (!subject.trim() || !body.trim()) return { ok: false, message: 'Sujet et corps requis.' };
  const db = getServiceClient();
  const { data } = await db
    .from('newsletter_subscribers')
    .select('email, confirm_token')
    .eq('confirmed', true);
  const recipients = (data ?? []) as { email: string; confirm_token: string }[];
  if (recipients.length === 0) return { ok: false, message: 'Aucun abonné confirmé.' };
  const bodyHtml = textToHtml(body);
  const base = siteUrl();
  const messages = recipients.map((r) => ({
    to: r.email,
    subject,
    html: campaignHtml(bodyHtml, `${base}/api/newsletter/unsubscribe?token=${r.confirm_token}`),
  }));
  const res = await sendBatch(messages);
  await recordAudit(ctx, {
    action: 'newsletter.campaign', resourceType: 'newsletter', severity: 'warning',
    metadata: { subject, recipients: recipients.length, sent: res.sent, ok: res.ok, error: res.error ?? null },
  });
  if (!res.ok) {
    const partial = res.sent > 0
      ? `Envoi partiel : ${res.sent}/${recipients.length} envoyés. ${res.error ?? ''}`.trim()
      : (res.error ?? "Échec de l'envoi.");
    return { ok: false, message: partial, sent: res.sent };
  }
  return { ok: true, sent: res.sent };
}
