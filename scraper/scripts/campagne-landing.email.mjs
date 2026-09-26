/**
 * Gabarit de la campagne d'annonce — envoi UNIQUE aux comptes existants.
 *
 * ── CE QUI GOUVERNE CE TEXTE ──
 *
 * 1. L'ENVOI UNIQUE EST DIT EN HAUT, PAS EN BAS. 129 des 130 destinataires
 *    n'ont jamais coché la moindre case de notification : ils reçoivent ce
 *    message parce qu'ils ont un compte, pas parce qu'ils l'ont demandé. Le
 *    leur dire dans la première ligne visible, et non dans un pied de page en
 *    gris clair, est la différence entre une annonce et un démarchage.
 *
 * 2. AUCUNE PROMESSE SANS CONTREPARTIE EXISTANTE. Chaque proposition
 *    ci-dessous correspond à une case réellement présente dans
 *    /parametres/alertes et à un envoi réellement planifié :
 *      - brief de clôture     → notification_prefs.brief_email (migration 0142)
 *                               / brief_telegram, cron video-seance.yml
 *      - canal Telegram       → @westbourse7, vidéo quotidienne déjà publiée
 *      - surveillance         → alerts_email / alerts_telegram, runAlerts
 *    Vanter une quatrième fonctionnalité « bientôt disponible » aurait été
 *    plus vendeur et moins vrai.
 *
 * 3. AUCUN TRACEUR. Pas de pixel de suivi, pas d'URL de redirection qui
 *    compte les clics. Le site promet « aucun traceur » ; un email qui
 *    rapporte qui l'a ouvert contredirait cette promesse au premier envoi.
 *    On renonce donc à mesurer le taux d'ouverture — c'est le prix, il est
 *    assumé.
 *
 * 4. PAS DE CHIFFRE DE MARCHÉ. Une campagne se prépare et peut partir avec un
 *    jour de retard ; un cours cité dans le corps serait faux à la lecture.
 *    Les chiffres vivent dans le brief quotidien, qui est daté.
 */

export const CAMPAGNE = 'landing-2026-09';

const SITE = 'https://www.westbourse.com';
export const URL_PREFERENCES = `${SITE}/parametres/alertes`;
const URL_CANAL = 'https://t.me/westbourse7';

export function sujet() {
  return 'WESTBOURSE fait peau neuve — et vous pouvez choisir ce que vous recevez';
}

/** Prénom utilisable, ou null : « Bonjour null » est pire que « Bonjour ». */
function salutation(prenom) {
  const p = typeof prenom === 'string' ? prenom.trim().split(/\s+/)[0] : '';
  return p && p.length >= 2 && p.length <= 24 ? `Bonjour ${p},` : 'Bonjour,';
}

const PROPOSITIONS = [
  {
    titre: 'Le brief de clôture, chaque soir',
    corps:
      "L'essentiel de la séance en six lignes : l'indice et sa variation, les valeurs en hausse et en baisse, les capitaux traités, et la part du premier échange dans le total — le chiffre qui dit si la séance s'est jouée sur un titre ou sur le marché. Par email ou sur Telegram, à vous de choisir.",
  },
  {
    titre: 'La vidéo de séance, sur Telegram',
    corps:
      "Chaque soir de séance, une vidéo d'une trentaine de secondes reprend les mêmes chiffres, commentés. Elle paraît sur le canal public, sans compte ni inscription.",
  },
  {
    titre: 'La surveillance de vos valeurs',
    corps:
      "Vous fixez un seuil sur une action — un cours franchi, une variation, un volume inhabituel — et vous êtes prévenu quand il est atteint. Rien d'autre ne vous est envoyé.",
  },
];

/* ─────────────────────────── version texte ─────────────────────────── */

export function texte({ prenom } = {}) {
  return [
    salutation(prenom),
    '',
    "Vous recevez ce message une seule fois, parce que vous avez un compte WESTBOURSE. Vous ne recevrez plus rien de notre part sans l'avoir demandé.",
    '',
    "Le site vient d'être entièrement repensé : l'analyse d'une valeur, son carnet d'ordres, ses comptes et sa liquidité se lisent désormais sur une même page.",
    '',
    'Trois choses que vous pouvez recevoir, si vous le souhaitez :',
    '',
    ...PROPOSITIONS.flatMap((p) => [`• ${p.titre}`, `  ${p.corps}`, '']),
    `Choisir ce que vous recevez : ${URL_PREFERENCES}`,
    `Le canal Telegram public : ${URL_CANAL}`,
    '',
    '— — —',
    "Envoi unique. Aucun traceur dans cet email : nous ne saurons pas si vous l'avez ouvert.",
    `Vos préférences : ${URL_PREFERENCES}`,
    'WESTBOURSE — analyse de la Bourse Régionale des Valeurs Mobilières (UEMOA).',
    "Information de marché. Rien ici ne constitue un conseil en investissement.",
  ].join('\n');
}

/* ─────────────────────────── version HTML ─────────────────────────── */

const echappe = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function html({ prenom } = {}) {
  const bloc = (p) => `
    <tr><td style="padding:0 0 22px">
      <p style="margin:0 0 5px;font-size:16px;font-weight:600;color:#16181d">${echappe(p.titre)}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4a4f57">${echappe(p.corps)}</p>
    </td></tr>`;

  return `<div style="margin:0;padding:0;background:#f4f5f7">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Envoi unique. Choisissez ensuite ce que vous recevez.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e3e5e9;border-radius:10px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">

        <tr><td style="padding:26px 30px 0">
          <p style="margin:0 0 3px;font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:#8a9099">WESTBOURSE</p>
          <p style="margin:0;font-size:12px;color:#8a9099">Analyse de la BRVM — UEMOA</p>
        </td></tr>

        <!-- L'envoi unique est annoncé ICI, avant le discours, pas en pied de page. -->
        <tr><td style="padding:20px 30px 0">
          <p style="margin:0;padding:11px 14px;background:#f4f5f7;border-left:3px solid #16181d;font-size:13px;line-height:1.55;color:#4a4f57">
            Vous recevez ce message <strong style="color:#16181d">une seule fois</strong>, parce que vous avez un compte WESTBOURSE.
            Vous ne recevrez plus rien de notre part sans l'avoir demandé.
          </p>
        </td></tr>

        <tr><td style="padding:24px 30px 0">
          <p style="margin:0 0 14px;font-size:15px;color:#16181d">${echappe(salutation(prenom))}</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;color:#16181d">Le site vient d'être entièrement repensé.</h1>
          <p style="margin:0;font-size:15px;line-height:1.65;color:#4a4f57">
            L'analyse d'une valeur, son carnet d'ordres, ses comptes et sa liquidité se lisent désormais sur une même page.
          </p>
        </td></tr>

        <tr><td style="padding:26px 30px 0">
          <p style="margin:0 0 16px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#8a9099">Ce que vous pouvez recevoir, si vous le souhaitez</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${PROPOSITIONS.map(bloc).join('')}</table>
        </td></tr>

        <tr><td style="padding:4px 30px 0">
          <a href="${URL_PREFERENCES}" style="display:inline-block;padding:13px 24px;background:#16181d;color:#ffffff;text-decoration:none;border-radius:7px;font-size:15px;font-weight:600">Choisir ce que je reçois</a>
          <p style="margin:12px 0 0;font-size:13px;color:#8a9099">Tout est décoché par défaut. Rien ne part tant que vous n'avez rien coché.</p>
        </td></tr>

        <tr><td style="padding:22px 30px 0">
          <p style="margin:0;font-size:14px;color:#4a4f57">
            Le canal Telegram public, lui, est ouvert sans compte :
            <a href="${URL_CANAL}" style="color:#16181d;font-weight:600">t.me/westbourse7</a>
          </p>
        </td></tr>

        <tr><td style="padding:26px 30px 28px">
          <hr style="border:0;border-top:1px solid #e3e5e9;margin:0 0 16px">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#8a9099">
            Envoi unique. <strong style="color:#6b7078">Aucun traceur dans cet email</strong> : nous ne saurons pas si vous l'avez ouvert.
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
