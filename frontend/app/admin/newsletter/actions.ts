'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendBatch } from '@/lib/server/email';
import { campaignHtml, textToHtml, siteUrl } from '@/lib/email/templates';
import { validateUploads } from '@/lib/email/uploads';
import { uploadInlineImage } from '@/lib/server/storage';

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

const ATTACH_ALLOWED = ['application/pdf', 'image/png', 'image/jpeg'];
const INLINE_ALLOWED = ['image/png', 'image/jpeg'];
const MAX_TOTAL = 8 * 1024 * 1024;
const MAX_INLINE = 2 * 1024 * 1024;
const MAX_FILES = 5;

/** Envoie une campagne (abonnés confirmés) avec pièces jointes + images inline. */
export async function sendCampaign(formData: FormData): Promise<R & { sent?: number }> {
  const ctx = await requirePermission('content.publish');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!subject || !body) return { ok: false, message: 'Sujet et corps requis.' };

  const attachFiles = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  const inlineFiles = formData.getAll('inlineImages').filter((f): f is File => f instanceof File && f.size > 0);

  const meta = (f: File) => ({ name: f.name, type: f.type, size: f.size });
  const vAll = validateUploads([...attachFiles, ...inlineFiles].map(meta), {
    maxFiles: MAX_FILES, maxTotalBytes: MAX_TOTAL, allowed: ATTACH_ALLOWED,
  });
  if (!vAll.ok) return { ok: false, message: vAll.message };
  const vInline = validateUploads(inlineFiles.map(meta), {
    maxFiles: MAX_FILES, maxTotalBytes: MAX_TOTAL, maxFileBytes: MAX_INLINE, allowed: INLINE_ALLOWED,
  });
  if (!vInline.ok) return { ok: false, message: vInline.message };

  const db = getServiceClient();
  const { data } = await db.from('newsletter_subscribers').select('email, confirm_token').eq('confirmed', true);
  const recipients = (data ?? []) as { email: string; confirm_token: string }[];
  if (recipients.length === 0) return { ok: false, message: 'Aucun abonné confirmé.' };

  // Images inline : upload → URLs → ajout au corps.
  let imagesHtml = '';
  for (const img of inlineFiles) {
    const url = await uploadInlineImage(img);
    imagesHtml += `<img src="${url}" alt="" style="max-width:100%;margin-top:16px" />`;
  }
  const bodyHtml = textToHtml(body) + imagesHtml;

  // Pièces jointes : base64.
  const attachments = await Promise.all(
    attachFiles.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })),
  );

  const base = siteUrl();
  const messages = recipients.map((r) => ({
    to: r.email,
    subject,
    html: campaignHtml(bodyHtml, `${base}/api/newsletter/unsubscribe?token=${r.confirm_token}`),
    ...(attachments.length ? { attachments } : {}),
  }));
  const res = await sendBatch(messages);
  await recordAudit(ctx, {
    action: 'newsletter.campaign', resourceType: 'newsletter', severity: 'warning',
    metadata: {
      subject, recipients: recipients.length, sent: res.sent,
      attachments: attachFiles.map((f) => f.name), inlineImages: inlineFiles.length,
      ok: res.ok, error: res.error ?? null,
    },
  });
  if (!res.ok) {
    const partial = res.sent > 0
      ? `Envoi partiel : ${res.sent}/${recipients.length} envoyés. ${res.error ?? ''}`.trim()
      : (res.error ?? "Échec de l'envoi.");
    return { ok: false, message: partial, sent: res.sent };
  }
  return { ok: true, sent: res.sent };
}
