export interface EmailAttachment {
  filename: string;
  /** Contenu encodé en base64. */
  content: string;
}
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}
export interface EmailResult { ok: boolean; sent: number; error?: string }

function fromAddress(): string {
  return process.env.ALERTS_EMAIL_FROM ?? 'noreply@brvm.resend.dev';
}

/** Envoie un email unique via Resend. Échec explicite si la clé manque. */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, sent: 0, error: 'RESEND_API_KEY non configurée' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        ...(msg.attachments && msg.attachments.length ? { attachments: msg.attachments } : {}),
      }),
    });
    if (!res.ok) return { ok: false, sent: 0, error: `Resend HTTP ${res.status}` };
    return { ok: true, sent: 1 };
  } catch (e) {
    return { ok: false, sent: 0, error: (e as Error).message };
  }
}

/** Envoie une liste de messages par lots de 50 (endpoint batch Resend). Tolérant. */
export async function sendBatch(messages: EmailMessage[]): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, sent: 0, error: 'RESEND_API_KEY non configurée' };
  if (messages.length === 0) return { ok: true, sent: 0 };
  const from = fromAddress();
  let sent = 0;
  let firstErr: string | undefined;
  for (let i = 0; i < messages.length; i += 50) {
    const chunk = messages.slice(i, i + 50).map((m) => ({
      from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      ...(m.attachments && m.attachments.length ? { attachments: m.attachments } : {}),
    }));
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
      else if (!firstErr) firstErr = `Resend batch HTTP ${res.status}`;
    } catch (e) {
      if (!firstErr) firstErr = (e as Error).message;
    }
  }
  // ok = livraison COMPLÈTE uniquement : un envoi partiel ne doit jamais être
  // rapporté comme un succès (l'appelant ne verrait pas les destinataires manqués).
  return { ok: sent === messages.length, sent, error: sent < messages.length ? firstErr : undefined };
}
