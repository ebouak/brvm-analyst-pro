/**
 * Gabarit de la réponse envoyée au visiteur. La signature, l'avertissement et
 * le bloc d'offre sont FIXES et ajoutés ici : ni l'IA ni l'exploitant ne les
 * écrivent, pour qu'aucune signature personnelle (téléphones, adresses) ni
 * aucun prix inventé ne reparte jamais.
 *
 * Mise en page email : tableaux + styles en ligne (seule forme rendue de façon
 * fiable par Gmail et Outlook), largeur 600 px. Le logo est le PNG servi par
 * westbourse.com (Gmail n'affiche pas le SVG) ; le nom WESTBOURSE est écrit en
 * TEXTE à côté, pour rester lisible quand la messagerie bloque les images.
 * Couleurs de la marque (public/icon.svg) : marine #0c1d2e, turquoise #16b6a4 ;
 * sur fond blanc, liens et bouton en turquoise foncé #0e7c71 (contraste ≥ 4,5:1
 * avec le blanc).
 */

export const SIGNATURE = "L'équipe WESTBOURSE";
export const SITE = 'https://www.westbourse.com';
export const LOGO = `${SITE}/icon-192.png`;
export const AVERTISSEMENT =
  "WESTBOURSE est un outil d'information et de formation : nous ne donnons pas de conseil d'investissement personnalisé.";
export const SUJET_REPONSE = 'Re : votre message à WESTBOURSE';

/**
 * L'achat se fait depuis un compte : il rattache le paiement Chariow à
 * l'acheteur (sans compte, la vente ne pourrait être accordée à personne).
 * L'inscription renvoie directement sur l'offre (`next`).
 */
export const LIEN_OFFRE = `${SITE}/signup?next=%2Fformations%2Facademy`;
export const LIEN_OFFRE_CONNECTE = `${SITE}/formations/academy`;

const C = {
  marine: '#0c1d2e',
  turquoise: '#16b6a4',
  turquoiseFonce: '#0e7c71',
  encre: '#1a2433',
  gris: '#5b6470',
  fond: '#eef2f5',
  filet: '#e3e8ee',
  offreFond: '#f0faf8',
  offreBord: '#bfe7e1',
};
const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface OffreFormation {
  montant: number;
  devise: string;
}

export interface EntreeRendu {
  reponse: string;
  messageOrigine: string;
  recuLe: string | Date;
  /**
   * Offre « formation complète », lue au catalogue Chariow AU MOMENT DE
   * L'ENVOI. Absente ou inactive → aucun bloc commercial : on ne vend jamais
   * une offre ni un prix que le catalogue ne confirme pas.
   */
  offre?: OffreFormation | null;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function prix(o: OffreFormation): string {
  const n = String(Math.round(o.montant)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return o.devise === 'XOF' ? `${n} FCFA` : `${n} ${o.devise}`;
}

function dateFr(d: string | Date): string {
  const x = new Date(d);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(x.getUTCDate())}/${z(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
}

/** Échappe, puis rend cliquables les liens (déjà limités aux domaines autorisés par validerBrouillon). */
function paragraphesHtml(texte: string): string {
  return texte
    .trim()
    .split(/\n{2,}/)
    .map((bloc) => {
      const html = esc(bloc)
        .replace(
          /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?»)]/g,
          (u) => `<a href="${u}" style="color:${C.turquoiseFonce};text-decoration:underline">${u.replace(/^https:\/\//, '')}</a>`,
        )
        .replace(/\n/g, '<br>');
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.encre}">${html}</p>`;
    })
    .join('\n');
}

const POINTS_OFFRE = [
  'Les 4 niveaux de la WESTBOURSE Academy, accès à vie',
  '1 mois Premium offert, alertes email sur vos valeurs comprises',
  'Paiement en ligne sécurisé, depuis votre compte gratuit',
];

/** Bloc commercial FIXE : ni l'IA ni l'exploitant ne l'écrivent. */
function blocOffre(o: OffreFormation): { text: string; html: string } {
  const titre = 'Pour aller plus loin';
  const corps =
    `La formation WESTBOURSE Academy complète : les 4 niveaux, accès à vie, et 1 mois Premium offert ` +
    `(alertes email sur vos valeurs comprises) — ${prix(o)}, paiement en ligne sécurisé. ` +
    `L'achat se fait depuis votre compte gratuit : créez-le, vous arrivez directement sur l'offre.`;

  const points = POINTS_OFFRE.map(
    (p) => `
          <tr>
            <td width="24" valign="top" style="padding:4px 0;font-size:15px;line-height:1.5;color:${C.turquoiseFonce};font-weight:bold">&#10003;</td>
            <td style="padding:4px 0;font-size:15px;line-height:1.5;color:${C.encre}">${esc(p)}</td>
          </tr>`,
  ).join('');

  return {
    text: [titre, corps, LIEN_OFFRE, `Déjà inscrit : ${LIEN_OFFRE_CONNECTE}`].join('\n'),
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:${C.offreFond};border:1px solid ${C.offreBord};border-radius:12px">
        <tr><td style="padding:22px 24px">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${C.turquoiseFonce}">${esc(titre)}</p>
          <p style="margin:0 0 14px;font-size:19px;line-height:1.35;font-weight:bold;color:${C.marine}">WESTBOURSE Academy — la formation complète</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">${points}
          </table>
          <p style="margin:0 0 4px;font-size:26px;font-weight:bold;color:${C.marine}">${esc(prix(o))}</p>
          <p style="margin:0 0 18px;font-size:13px;color:${C.gris}">Paiement unique · formation à vie · le mois Premium démarre à l'achat</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="border-radius:8px;background:${C.turquoiseFonce}">
              <a href="${LIEN_OFFRE}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">Créer mon compte et accéder à l'offre</a>
            </td>
          </tr></table>
          <p style="margin:14px 0 0;font-size:13px;color:${C.gris}">Déjà inscrit ? <a href="${LIEN_OFFRE_CONNECTE}" style="color:${C.turquoiseFonce}">Accéder directement à l'offre</a></p>
        </td></tr>
      </table>`,
  };
}

export function renduReponse(e: EntreeRendu): { subject: string; html: string; text: string } {
  const recu = dateFr(e.recuLe);
  const origine = e.messageOrigine.trim();
  const offre = e.offre && e.offre.montant > 0 ? blocOffre(e.offre) : null;

  const text = [
    e.reponse.trim(),
    '',
    ...(offre ? [offre.text, ''] : []),
    AVERTISSEMENT,
    '',
    SIGNATURE,
    SITE,
    '',
    '---',
    `Votre message du ${recu} :`,
    `« ${origine} »`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(SUJET_REPONSE)}</title></head>
<body style="margin:0;padding:0;background:${C.fond}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.fond}">
    <tr><td align="center" style="padding:28px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${POLICE}">

        <!-- En-tête : logo + nom de la marque -->
        <tr><td style="background:${C.marine};border-radius:14px 14px 0 0;padding:22px 28px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:12px">
              <a href="${SITE}"><img src="${LOGO}" width="40" height="40" alt="W" style="display:block;border:0;border-radius:9px"></a>
            </td>
            <td valign="middle">
              <a href="${SITE}" style="text-decoration:none;font-size:17px;font-weight:bold;letter-spacing:6px;color:#f4f6f8">WESTBOURSE</a>
              <div style="margin-top:3px;font-size:12px;color:#9fb3c4">Analyse et formation · Bourse régionale BRVM</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="height:4px;background:${C.turquoise};font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- Corps -->
        <tr><td style="background:#ffffff;padding:32px 28px 8px">
          ${paragraphesHtml(e.reponse)}
          ${offre ? offre.html : ''}
          <p style="margin:0 0 4px;font-size:16px;color:${C.encre}">Bien cordialement,</p>
          <p style="margin:0 0 24px;font-size:16px;font-weight:bold;color:${C.marine}">${esc(SIGNATURE)}</p>
          <p style="margin:0 0 24px;padding-top:16px;border-top:1px solid ${C.filet};font-size:12px;line-height:1.5;color:${C.gris}">${esc(AVERTISSEMENT)}</p>
        </td></tr>

        <!-- Message d'origine -->
        <tr><td style="background:#ffffff;padding:0 28px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fa;border-left:3px solid ${C.filet};border-radius:6px">
            <tr><td style="padding:14px 16px;font-size:13px;line-height:1.5;color:${C.gris}">
              <p style="margin:0 0 6px;font-weight:bold">Votre message du ${recu} :</p>
              <p style="margin:0;white-space:pre-wrap">${esc(origine)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Pied de page -->
        <tr><td style="background:${C.marine};border-radius:0 0 14px 14px;padding:18px 28px;font-size:12px;line-height:1.6;color:#9fb3c4">
          <a href="${SITE}" style="color:#f4f6f8;text-decoration:none;font-weight:bold">westbourse.com</a> · support@westbourse.com<br>
          Vous recevez cet email en réponse au message que vous nous avez envoyé depuis westbourse.com.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: SUJET_REPONSE, html, text };
}

/**
 * Réponse sur WhatsApp : texte simple (WhatsApp n'affiche pas le HTML), offre
 * courte, avertissement et signature FIXES. Pas de citation du message : la
 * conversation l'affiche déjà au-dessus. Borné à 4096 caractères (limite WhatsApp).
 */
export function renduReponseWhatsapp(e: { reponse: string; offre?: OffreFormation | null }): string {
  // Mise en forme NATIVE de WhatsApp (*gras*, _italique_, émojis) : le pendant de
  // la carte d'offre de l'email. Le lien est seul sur sa ligne pour que WhatsApp
  // en affiche l'aperçu illustré (image de partage du site).
  const FILET = '━━━━━━━━━━━━━━━━';
  const parties = [e.reponse.trim()];
  if (e.offre && e.offre.montant > 0) {
    parties.push(
      [
        FILET,
        '🎓 *Pour aller plus loin*',
        '*WESTBOURSE Academy — la formation complète*',
        '',
        '✅ Les 4 niveaux, accès à vie',
        '✅ 1 mois Premium offert, alertes email sur vos valeurs comprises',
        '✅ Paiement en ligne sécurisé, depuis votre compte gratuit',
        '',
        `💰 *${prix(e.offre)}* · paiement unique`,
        '',
        '👉 Créez votre compte et accédez directement à l’offre :',
        LIEN_OFFRE,
        FILET,
      ].join('\n'),
    );
  }
  parties.push(`_${AVERTISSEMENT}_`, `*${SIGNATURE}*\nwww.westbourse.com`);
  return parties.join('\n\n').slice(0, 4096);
}
