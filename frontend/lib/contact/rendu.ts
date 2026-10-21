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

export interface EntreeRendu {
  reponse: string;
  messageOrigine: string;
  recuLe: string | Date;
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

  const text = [
    e.reponse.trim(),
    '',
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
      <p style="margin:18px 0 14px;color:#5b6470;font-size:13px">${esc(AVERTISSEMENT)}</p>
      <p style="margin:0">${esc(SIGNATURE)}<br><a href="${SITE}" style="color:#2a8aa8">www.westbourse.com</a></p>
      <div style="margin-top:28px;padding-left:12px;border-left:3px solid #d5dbe1;color:#5b6470;font-size:13px">
        <p style="margin:0 0 6px">Votre message du ${recu} :</p>
        <p style="margin:0;white-space:pre-wrap">${esc(origine)}</p>
      </div>
    </div>`;

  return { subject: SUJET_REPONSE, html, text };
}
