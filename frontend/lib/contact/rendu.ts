/**
 * Gabarit de la réponse envoyée au visiteur. La signature et l'avertissement
 * sont FIXES et ajoutés ici : ni l'IA ni l'exploitant ne les écrivent, pour
 * qu'aucune signature personnelle (téléphones, adresses) ne reparte jamais.
 */

export const SIGNATURE = "L'équipe WESTBOURSE";
export const SITE = 'https://www.westbourse.com';
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

function prix(o: OffreFormation): string {
  const n = String(Math.round(o.montant)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return o.devise === 'XOF' ? `${n} FCFA` : `${n} ${o.devise}`;
}

/** Bloc commercial FIXE : ni l'IA ni l'exploitant ne l'écrivent. */
function blocOffre(o: OffreFormation): { text: string; html: string } {
  const titre = 'Pour aller plus loin';
  const corps =
    `La formation WESTBOURSE Academy complète : les 4 niveaux, accès à vie, et 1 mois Premium offert ` +
    `(alertes email sur vos valeurs comprises) — ${prix(o)}, paiement en ligne sécurisé. ` +
    `L'achat se fait depuis votre compte gratuit : créez-le, vous arrivez directement sur l'offre.`;
  return {
    text: [titre, corps, LIEN_OFFRE, `Déjà inscrit : ${LIEN_OFFRE_CONNECTE}`].join('\n'),
    html: `
      <div style="margin:22px 0 18px;padding:16px 18px;border:1px solid #cfe9f2;border-radius:10px;background:#f3fafc">
        <p style="margin:0 0 6px;font-weight:bold;color:#1a1a2e">${esc(titre)}</p>
        <p style="margin:0 0 12px">${esc(corps)}</p>
        <p style="margin:0">
          <a href="${LIEN_OFFRE}" style="display:inline-block;background:#2a8aa8;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Créer mon compte et accéder à l'offre</a>
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#5b6470">Déjà inscrit : <a href="${LIEN_OFFRE_CONNECTE}" style="color:#2a8aa8">${LIEN_OFFRE_CONNECTE.replace('https://', '')}</a></p>
      </div>`,
  };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
        .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?»)]/g, (u) => `<a href="${u}" style="color:#2a8aa8">${u}</a>`)
        .replace(/\n/g, '<br>');
      return `<p style="margin:0 0 14px">${html}</p>`;
    })
    .join('\n');
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

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e;line-height:1.55;font-size:15px">
      ${paragraphesHtml(e.reponse)}
      ${offre ? offre.html : ''}
      <p style="margin:18px 0 14px;color:#5b6470;font-size:13px">${esc(AVERTISSEMENT)}</p>
      <p style="margin:0">${esc(SIGNATURE)}<br><a href="${SITE}" style="color:#2a8aa8">www.westbourse.com</a></p>
      <div style="margin-top:28px;padding-left:12px;border-left:3px solid #d5dbe1;color:#5b6470;font-size:13px">
        <p style="margin:0 0 6px">Votre message du ${recu} :</p>
        <p style="margin:0;white-space:pre-wrap">${esc(origine)}</p>
      </div>
    </div>`;

  return { subject: SUJET_REPONSE, html, text };
}
