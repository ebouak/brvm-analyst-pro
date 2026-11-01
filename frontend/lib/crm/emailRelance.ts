/**
 * E-mail de relance habillé — PUR. Mise en page en tableaux et styles en ligne
 * (les clients e-mail ignorent <style> et le flex), aucun script, polices
 * système. Le corps est celui que l'exploitant a relu dans la fiche CRM :
 * échappé, jamais réécrit. Aucun chiffre ajouté par le gabarit.
 * Le lien d'opposition (art. 21) est TOUJOURS le dernier élément.
 */
const SITE = 'https://www.westbourse.com';
const LOGO = `${SITE}/icon-192.png`;
const TELEGRAM = 'https://t.me/westbourse7';
const C = { fond: '#030303', surface: '#0a1417', accent: '#56D7FD', encre: '#03141a', clair: '#FCFCFC', attenue: '#b5b5b5', carte: '#ffffff', texte: '#1a1f24', bordure: '#1b2a30' };
const POLICE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface OptionsEmail {
  corps: string;
  lienOpposition: string;
  lienOffre: string | null;
  whatsappNumero: string | null;
  chaineWhatsappUrl: string | null;
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Liens https cliquables ; la ponctuation finale reste du texte (comme gabarits.versHtml). */
function corpsHtml(texte: string): string {
  return echapper(texte)
    .replace(/https:\/\/(?:(?!&(?:quot|lt|gt);)[^\s<])+/g, (url) => {
      const fin = /[.,;:!?)]+$/.exec(url)?.[0] ?? '';
      const href = fin ? url.slice(0, -fin.length) : url;
      return `<a href="${href}" style="color:#0b6b6f">${href}</a>${fin}`;
    })
    .replace(/\n/g, '<br>');
}

export function lienWhatsappEntrant(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, je vous écris suite à votre e-mail WESTBOURSE.')}`;
}

/** Seules des URL https passent dans un href ; échappées quand même (défense en profondeur). */
const httpsOuNull = (u: string | null): string | null => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

const bouton = (href: string, libelle: string, fond: string, encre: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${fond};color:${encre};font-weight:700;font-size:15px;text-decoration:none;font-family:${POLICE}">${libelle}</a>`;

export function construireEmailRelance(o: OptionsEmail): { html: string; texte: string } {
  // Échec fermé : jamais d'e-mail commercial sans lien d'opposition valide.
  const lienOpposition = httpsOuNull(o.lienOpposition);
  if (!lienOpposition) throw new Error("Lien d'opposition invalide : envoi refusé.");
  const lienOffre = httpsOuNull(o.lienOffre);
  const chaine = httpsOuNull(o.chaineWhatsappUrl);
  const wa = o.whatsappNumero ? lienWhatsappEntrant(o.whatsappNumero) : null;

  const offre = lienOffre
    ? `<tr><td style="padding:0 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.bordure};border-radius:16px"><tr><td style="padding:22px 24px;font-family:${POLICE}">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.accent}">Offert</p>
<p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${C.clair}">Votre dossier valeur, au choix</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${C.attenue}">Choisissez une société cotée à la BRVM : vous recevez son dossier complet en PDF, tel que nous le produisons chaque semaine.</p>
${bouton(echapper(lienOffre), 'Choisir mon dossier', C.accent, C.encre)}
</td></tr></table></td></tr>`
    : '';

  const whatsapp = wa
    ? `<tr><td align="center" style="padding:16px 32px 4px;font-family:${POLICE}"><p style="margin:0 0 10px;font-size:14px;color:${C.texte}">Une question ? Écrivez-nous directement.</p>${bouton(wa, 'Écrire sur WhatsApp', '#25D366', '#06210f')}</td></tr>`
    : '';

  const liens = [
    `<a href="${SITE}" style="color:${C.attenue}">westbourse.com</a>`,
    `<a href="${TELEGRAM}" style="color:${C.attenue}">Telegram</a>`,
    ...(chaine ? [`<a href="${echapper(chaine)}" style="color:${C.attenue}">Chaîne WhatsApp</a>`] : []),
  ].join(' &nbsp;·&nbsp; ');

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${C.fond}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fond}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:8px 8px 20px;font-family:${POLICE}"><img src="${LOGO}" width="36" height="36" alt="" style="vertical-align:middle;border-radius:8px"> <span style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:.04em;color:${C.clair}">WESTBOURSE</span></td></tr>
<tr><td style="background:${C.carte};border-radius:20px;overflow:hidden"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:4px;background:${C.accent};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 20px;font-family:${POLICE};font-size:15px;line-height:1.65;color:${C.texte}">${corpsHtml(o.corps)}</td></tr>
${offre}
${whatsapp}
<tr><td style="padding:20px">&nbsp;</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:22px 16px 6px;font-family:${POLICE};font-size:12px;line-height:1.7;color:${C.attenue}">${liens}<br>Données de marché de la BRVM, pas un conseil en investissement.</td></tr>
<tr><td align="center" style="padding:6px 16px 24px;font-family:${POLICE};font-size:11px;color:#7d8a90">Vous ne souhaitez plus recevoir ce type de message ? <a href="${echapper(lienOpposition)}" style="color:#7d8a90">${echapper(lienOpposition)}</a></td></tr>
</table></td></tr></table></body></html>`;

  const texte = [
    o.corps,
    ...(lienOffre ? ['', 'OFFERT — votre dossier valeur, au choix :', lienOffre] : []),
    ...(wa ? ['', 'Une question ? Écrivez-nous sur WhatsApp :', wa] : []),
    '',
    '—',
    'Données de marché de la BRVM, pas un conseil en investissement.',
    `Vous ne souhaitez plus recevoir ce type de message ? ${lienOpposition}`,
  ].join('\n');

  return { html, texte };
}
