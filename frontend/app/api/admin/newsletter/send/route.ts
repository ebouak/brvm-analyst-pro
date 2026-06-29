import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getWeeklyReport } from '@/lib/admin/weekly';
import {
  buildWeeklyHtml,
  getRecipients,
  logNewsletterSend,
  sendNewsletter,
  type NewsletterTopic,
} from '@/lib/newsletter/send';
import { siteUrl } from '@/lib/email/templates';

const VALID_TOPICS: NewsletterTopic[] = [
  'weekly_commodity',
  'daily_market',
  'signals_digest',
  'events_digest',
];

export async function POST(req: Request) {
  // Garde RBAC — exige content.publish
  let ctx: Awaited<ReturnType<typeof requirePermission>>;
  try {
    ctx = await requirePermission('content.publish');
  } catch {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Validation du corps
  const body = (await req.json().catch(() => null)) as {
    articleId?: string;
    topic?: string;
  } | null;

  if (!body || typeof body.articleId !== 'string' || !body.articleId) {
    return NextResponse.json({ error: 'articleId requis' }, { status: 400 });
  }
  if (!body.topic || !VALID_TOPICS.includes(body.topic as NewsletterTopic)) {
    return NextResponse.json(
      { error: `topic invalide. Valeurs acceptées : ${VALID_TOPICS.join(', ')}` },
      { status: 400 },
    );
  }

  const articleId = body.articleId;
  const topic = body.topic as NewsletterTopic;

  // Récupérer le rapport
  const report = await getWeeklyReport(articleId);
  if (!report) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }
  if (report.status !== 'published') {
    return NextResponse.json(
      { error: 'Seuls les rapports publiés peuvent être envoyés en newsletter' },
      { status: 422 },
    );
  }

  // Construire le lien de désinscription (token = placeholder, table sans token ici)
  const base = siteUrl();
  const unsubscribeUrl = `${base}/unsubscribe`;

  // Construire le HTML email
  const htmlBody = buildWeeklyHtml({
    titre: report.titre,
    resume: report.resume,
    slug: report.slug,
    tickerCodes: report.ticker_codes,
    unsubscribeUrl,
  });

  const subject = `[WESTBOURSE] ${report.titre}`;
  const previewText = report.resume ?? report.titre;

  // Récupérer les destinataires
  let recipients: string[];
  try {
    recipients = await getRecipients(topic);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur récupération destinataires';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Envoyer
  let sent: number;
  try {
    sent = await sendNewsletter(
      { subject, previewText, htmlBody, articleId, newsletterType: topic },
      recipients,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur envoi';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Logger dans newsletter_sends (tolérant : pas de throw)
  await logNewsletterSend({
    newsletterType: topic,
    articleId,
    recipientsCount: sent,
    sentBy: ctx.userId,
  });

  return NextResponse.json({ ok: true, sent });
}
