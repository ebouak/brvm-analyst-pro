/**
 * Gabarit de la campagne « WESTBOURSE sur WhatsApp » — envoi UNIQUE aux
 * comptes existants (2026-10-24).
 *
 * ── CE QUI GOUVERNE CE TEXTE ──
 *
 * 1. LA PROMESSE DE SEPTEMBRE EST DITE, PAS CACHÉE. La campagne
 *    `landing-2026-09` écrivait : « Vous ne recevrez plus rien de notre part
 *    sans l'avoir demandé. » Cet envoi la contredit, par décision explicite de
 *    l'exploitant. Le texte le reconnaît dans sa première ligne visible et
 *    offre une sortie simple (répondre STOP → `desinscription`, voir
 *    campagne-landing.mjs). Taire la contradiction serait pire que l'envoi.
 *
 * 2. AUCUNE PROMESSE SANS CONTREPARTIE EXISTANTE. Chaque proposition existe en
 *    production le jour de l'envoi : Chaîne WhatsApp (lot B), commandes rapides
 *    au +33 (lot A), appairage + assistant (lot D), point du soir / alertes /
 *    dossiers (lot E), canal Telegram public.
 *
 * 3. AUCUN TRACEUR, AUCUN CHIFFRE DE MARCHÉ (mêmes raisons que
 *    campagne-landing.email.mjs).
 */

export const CAMPAGNE = 'canaux-whatsapp-2026-10';

const SITE = 'https://www.westbourse.com';
export const URL_PREFERENCES = `${SITE}/parametres/alertes`;
const URL_CHAINE = 'https://whatsapp.com/channel/0029VbDkKjK5K3zL18MshI0d';
const NUMERO_AFFICHE = '+33 7 43 65 72 71';
const URL_AIDE = 'https://wa.me/33743657271?text=AIDE';
const URL_TELEGRAM = 'https://t.me/westbourse7';

export function sujet() {
  return 'WESTBOURSE arrive sur WhatsApp : la séance chaque soir, et un assistant';
}

/** Prénom utilisable, ou null : « Bonjour null » est pire que « Bonjour ». */
function salutation(prenom) {
  const p = typeof prenom === 'string' ? prenom.trim().split(/\s+/)[0] : '';
  return p && p.length >= 2 && p.length <= 24 ? `Bonjour ${p},` : 'Bonjour,';
}

const AVERTISSEMENT =
  "En septembre, nous vous avions écrit que vous ne recevriez plus rien de notre part sans l'avoir demandé. Nous faisons une exception pour cette annonce, une seule fois. Pour ne plus recevoir aucun message de ce type, répondez simplement « STOP » à cet email.";

const PROPOSITIONS = [
  {
    titre: 'La Chaîne WhatsApp WESTBOURSE',
    corps:
      "Chaque soir de séance, la vidéo de la BRVM : indice, hausses, baisses, capitaux échangés. Sans compte, sans inscription : il suffit de suivre la Chaîne. Personne ne voit votre numéro.",
    lien: { libelle: 'Suivre la Chaîne', url: URL_CHAINE },
  },
  {
    titre: 'Des réponses immédiates, à toute heure',
    corps: `Écrivez AIDE au ${NUMERO_AFFICHE} : COURS SNTS donne le dernier cours, DIV ORAC les derniers dividendes, PALMARES les plus fortes hausses de la séance. Gratuit, sans compte.`,
    lien: { libelle: 'Écrire AIDE sur WhatsApp', url: URL_AIDE },
  },
  {
    titre: 'Votre compte, sur WhatsApp',
    corps:
      "Liez votre WhatsApp à votre compte en envoyant un code depuis votre téléphone. Vous recevez alors, si vous le choisissez, le point de clôture chaque soir, et vous pouvez interroger l'assistant : 3 questions par jour en gratuit, 100 en Premium avec votre portefeuille, vos alertes et vos dossiers du samedi.",
    lien: { libelle: 'Lier mon WhatsApp', url: URL_PREFERENCES },
  },
  {
    titre: 'Vous préférez Telegram ?',
    corps: 'La même vidéo paraît sur le canal Telegram public, et votre compte peut aussi y être lié.',
    lien: { libelle: 't.me/westbourse7', url: URL_TELEGRAM },
  },
];

/* ─────────────────────────── version texte ─────────────────────────── */

export function texte({ prenom } = {}) {
  return [
    salutation(prenom),
    '',
    AVERTISSEMENT,
    '',
    'WESTBOURSE est désormais sur WhatsApp. Quatre façons de suivre la BRVM, toutes facultatives :',
    '',
    ...PROPOSITIONS.flatMap((p) => [`• ${p.titre}`, `  ${p.corps}`, `  ${p.lien.url}`, '']),
    '— — —',
    "Aucun traceur dans cet email : nous ne saurons pas si vous l'avez ouvert. Répondez « STOP » pour ne plus recevoir ce type de message.",
    `Vos préférences : ${URL_PREFERENCES}`,
    'WESTBOURSE — analyse de la Bourse Régionale des Valeurs Mobilières (UEMOA).',
    'Information de marché. Rien ici ne constitue un conseil en investissement.',
  ].join('\n');
}

/* ─────────────────────────── version HTML ─────────────────────────── */

const echappe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function html({ prenom } = {}) {
  const bloc = (p) => `
    <tr><td style="padding:0 0 22px">
      <p style="margin:0 0 5px;font-size:16px;font-weight:600;color:#16181d">${echappe(p.titre)}</p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#4a4f57">${echappe(p.corps)}</p>
      <a href="${p.lien.url}" style="font-size:14px;font-weight:600;color:#0e7c71">${echappe(p.lien.libelle)} →</a>
    </td></tr>`;

  return `<div style="margin:0;padding:0;background:#f4f5f7">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">La séance chaque soir sur WhatsApp, des réponses immédiates, et un assistant.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e3e5e9;border-radius:10px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">

        <tr><td style="padding:26px 30px 0">
          <img src="${SITE}/icon-192.png" width="40" height="40" alt="WESTBOURSE" style="display:block;border:0;border-radius:8px;margin:0 0 10px">
          <p style="margin:0 0 3px;font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:#8a9099">WESTBOURSE</p>
          <p style="margin:0;font-size:12px;color:#8a9099">Analyse de la BRVM — UEMOA</p>
        </td></tr>

        <!-- La promesse de septembre est reconnue ICI, avant le discours. -->
        <tr><td style="padding:20px 30px 0">
          <p style="margin:0;padding:11px 14px;background:#f4f5f7;border-left:3px solid #16181d;font-size:13px;line-height:1.55;color:#4a4f57">
            ${echappe(AVERTISSEMENT)}
          </p>
        </td></tr>

        <tr><td style="padding:24px 30px 0">
          <p style="margin:0 0 14px;font-size:15px;color:#16181d">${echappe(salutation(prenom))}</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;color:#16181d">WESTBOURSE est désormais sur WhatsApp.</h1>
          <p style="margin:0;font-size:15px;line-height:1.65;color:#4a4f57">
            Quatre façons de suivre la BRVM, toutes facultatives.
          </p>
        </td></tr>

        <tr><td style="padding:26px 30px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${PROPOSITIONS.map(bloc).join('')}</table>
        </td></tr>

        <tr><td style="padding:4px 30px 0">
          <a href="${URL_CHAINE}" style="display:inline-block;padding:13px 24px;background:#16b6a4;color:#ffffff;text-decoration:none;border-radius:7px;font-size:15px;font-weight:600">Suivre la Chaîne WhatsApp</a>
        </td></tr>

        <tr><td style="padding:26px 30px 28px">
          <hr style="border:0;border-top:1px solid #e3e5e9;margin:0 0 16px">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#8a9099">
            <strong style="color:#6b7078">Aucun traceur dans cet email</strong> : nous ne saurons pas si vous l'avez ouvert.
            Répondez « STOP » pour ne plus recevoir ce type de message.
          </p>
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#8a9099">
            <a href="${URL_PREFERENCES}" style="color:#6b7078">Gérer mes préférences</a>
          </p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#a0a5ad">
            Information de marché. Rien ici ne constitue un conseil en investissement.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</div>`;
}
