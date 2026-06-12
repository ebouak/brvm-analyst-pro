import { logger } from '../logger.js';

const log = logger.child({ module: 'emailService' });

/**
 * Service pour envoyer des emails via Resend API.
 * Fallback sur console.log si RESEND_API_KEY non configuré.
 */
export class EmailService {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.ALERTS_EMAIL_FROM || 'noreply@brvm.app';
  }

  /**
   * Envoyer un email via Resend API.
   * Si pas de clé API, log seulement (mode test/dev).
   */
  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Mode test (pas de clé API)
    if (!this.apiKey) {
      log.warn(
        { to: params.to, subject: params.subject },
        'RESEND_API_KEY not configured — email not sent (test mode)'
      );
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as { id: string };

      log.info(
        { to: params.to, subject: params.subject, messageId: data.id },
        '✅ Email sent via Resend'
      );

      return { success: true, messageId: data.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(
        { to: params.to, subject: params.subject, error: msg },
        '❌ Failed to send email'
      );
      return { success: false, error: msg };
    }
  }

  /**
   * Template pour email de rapport mensuel.
   */
  buildMonthlyReportEmail(params: {
    userName: string;
    month: string;
    pdfUrl: string;
    pnlPct: number;
  }): { html: string; text: string } {
    const monthName = new Date(`${params.month}-01`).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    const pnlColor = params.pnlPct >= 0 ? '3fe18b' : 'ff6b6b';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #030303; color: #fcfcfc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #0a1417; border-radius: 8px; }
    .header { border-bottom: 1px solid #232733; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 28px; }
    .metric { display: inline-block; margin: 10px 10px 10px 0; padding: 10px 15px; background: #161922; border-radius: 4px; border-left: 3px solid #${pnlColor}; }
    .metric-label { font-size: 12px; color: #8b93a7; text-transform: uppercase; }
    .metric-value { font-size: 20px; font-weight: bold; color: #${pnlColor}; margin-top: 4px; }
    .button { display: inline-block; background: #56d7fd; color: #030303; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 10px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #232733; font-size: 12px; color: #8b93a7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Rapport BRVM Analyst Pro</h1>
      <p style="margin: 10px 0 0 0; color: #8b93a7;">${monthName}</p>
    </div>

    <p>Bonjour ${params.userName},</p>

    <p>Votre rapport de synthèse pour <strong>${monthName}</strong> est maintenant disponible !</p>

    <div style="margin: 20px 0;">
      <div class="metric">
        <div class="metric-label">Performance</div>
        <div class="metric-value">${params.pnlPct >= 0 ? '+' : ''}${params.pnlPct.toFixed(2)}%</div>
      </div>
    </div>

    <p style="margin: 30px 0;">
      <a href="${params.pdfUrl}" class="button">📥 Télécharger le rapport PDF</a>
    </p>

    <p>Ou <a href="https://brvm.app/premium/reports/${params.month}" style="color: #56d7fd;">consulter en ligne</a></p>

    <div class="footer">
      <p style="margin: 0;">BRVM Analyst Pro — Plateforme d'analyse boursière</p>
      <p style="margin: 5px 0 0 0;">© 2026 Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `Bonjour ${params.userName},

Votre rapport de synthèse pour ${monthName} est prêt.

Performance: ${params.pnlPct >= 0 ? '+' : ''}${params.pnlPct.toFixed(2)}%

Télécharger: ${params.pdfUrl}
Consulter en ligne: https://brvm.app/premium/reports/${params.month}

Cordialement,
BRVM Analyst Pro`;

    return { html, text };
  }
}
