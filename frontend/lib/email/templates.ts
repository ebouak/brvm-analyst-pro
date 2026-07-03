/** URL absolue du site (pour les liens dans les emails). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
}

/** Échappe le HTML et convertit les sauts de ligne en <br> (corps saisi par l'admin). */
export function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(/\n/g, '<br>');
}

function wrap(inner: string): string {
  return `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e;line-height:1.6">${inner}</div>`;
}

/** Email de campagne newsletter — footer de désabonnement OBLIGATOIRE (RGPD). */
export function campaignHtml(bodyHtml: string, unsubscribeUrl: string): string {
  return wrap(
    `${bodyHtml}` +
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>` +
      `<p style="color:#888;font-size:12px">Vous recevez cet email car vous êtes inscrit à la newsletter WESTBOURSE.` +
      `<a href="${unsubscribeUrl}" style="color:#888">Se désabonner</a>.</p>`,
  );
}

/** Email individuel (transactionnel / support). */
export function individualHtml(bodyHtml: string): string {
  return wrap(
    `${bodyHtml}` +
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>` +
      `<p style="color:#888;font-size:12px">WESTBOURSE</p>`,
  );
}
