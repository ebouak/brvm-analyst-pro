import 'server-only';
import { sendEmail } from '@/lib/server/email';

/**
 * Emails du cycle de vie d'un accès API.
 *
 * Principe : ces envois ne doivent JAMAIS faire échouer l'action métier. Si
 * Resend est indisponible, la demande est quand même enregistrée et la clé quand
 * même générée — on journalise l'échec, on ne le propage pas. Perdre un email est
 * ennuyeux ; perdre une approbation déjà écrite en base serait pire (la clé
 * existerait sans que personne ne le sache).
 *
 * La clé n'est envoyée qu'UNE fois, à l'approbation : nous ne stockons que son
 * empreinte SHA-256, donc nous sommes physiquement incapables de la renvoyer.
 * L'email le dit explicitement.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';

/** Enveloppe HTML sobre, sans image ni traceur (délivrabilité + RGPD). */
function wrap(title: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#888;margin:0 0 4px">WESTBOURSE</p>
  <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
  ${body}
  <hr style="border:0;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#888;margin:0">
    API BRVM — <a href="${SITE}/developers" style="color:#0a7ea4">${SITE}/developers</a>
  </p>
</div>`;
}

/**
 * Échec toléré : on trace, on ne casse jamais l'action métier — mais on RENVOIE
 * le résultat. L'appelant en a besoin : sur une approbation, un email non parti
 * signifie que l'admin est le seul à détenir la clé et doit la transmettre à la
 * main. Avaler ce booléen ferait perdre des clés en silence.
 */
async function trySend(to: string, subject: string, html: string, ctx: string): Promise<boolean> {
  const res = await sendEmail({ to, subject, html });
  if (!res.ok) console.error(`api/notify[${ctx}] -> ${to} : ${res.error}`);
  return res.ok;
}

/** Accusé de réception au demandeur : sans lui, il ignore si sa demande est passée. */
export async function notifyRequestReceived(email: string, nom: string): Promise<boolean> {
  return trySend(
    email,
    'Votre demande d’accès à l’API BRVM a bien été reçue',
    wrap(
      'Demande reçue',
      `<p>Bonjour ${escapeHtml(nom)},</p>
       <p>Nous avons bien reçu votre demande d’accès à l’API de données BRVM.
          Elle est en cours d’examen — vous recevrez une réponse sous 48 h ouvrées.</p>
       <p style="color:#666;font-size:14px">Aucune clé n’est active à ce stade.</p>`,
    ),
    'received',
  );
}

/** Approbation : le SEUL moment où la clé transite. Elle n'est pas récupérable ensuite. */
export async function notifyApproved(
  email: string,
  nom: string,
  key: string,
  quotaDaily: number,
): Promise<boolean> {
  return trySend(
    email,
    'Votre clé d’API BRVM est active',
    wrap(
      'Accès approuvé',
      `<p>Bonjour ${escapeHtml(nom)},</p>
       <p>Votre accès à l’API BRVM est actif. Voici votre clé :</p>
       <p style="font-family:ui-monospace,monospace;font-size:14px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:6px;padding:12px;word-break:break-all">${escapeHtml(key)}</p>
       <p style="background:#fff8e1;border-left:3px solid #f5a623;padding:10px 12px;font-size:14px">
         <strong>Conservez-la maintenant.</strong> Nous n’en stockons qu’une empreinte chiffrée :
         nous sommes techniquement incapables de vous la renvoyer. En cas de perte, il faudra
         en générer une nouvelle.
       </p>
       <p>Quota : <strong>${quotaDaily} requêtes/jour</strong> (réinitialisé à minuit UTC).</p>
       <p style="font-family:ui-monospace,monospace;font-size:13px;background:#f5f5f5;border-radius:6px;padding:12px">
         curl -H "x-api-key: …" ${SITE}/api/public/v1/actions
       </p>
       <p style="font-size:14px;color:#666">Ne la publiez pas côté navigateur : elle doit rester
         sur votre serveur.</p>`,
    ),
    'approved',
  );
}

/** Refus : un demandeur sans réponse relance ou se plaint. Le motif évite ça. */
export async function notifyRejected(email: string, nom: string, motif: string): Promise<boolean> {
  return trySend(
    email,
    'Votre demande d’accès à l’API BRVM',
    wrap(
      'Demande non retenue',
      `<p>Bonjour ${escapeHtml(nom)},</p>
       <p>Après examen, nous ne pouvons pas donner suite à votre demande d’accès à l’API.</p>
       <p style="background:#f5f5f5;border-radius:6px;padding:12px;font-size:14px"><strong>Motif :</strong> ${escapeHtml(motif)}</p>
       <p style="font-size:14px;color:#666">Vous pouvez soumettre une nouvelle demande si votre
          usage évolue.</p>`,
    ),
    'rejected',
  );
}

/** Révocation : couper un accès sans prévenir, c'est laisser un partenaire déboussolé. */
export async function notifyRevoked(email: string, nom: string): Promise<boolean> {
  return trySend(
    email,
    'Votre accès à l’API BRVM a été révoqué',
    wrap(
      'Accès révoqué',
      `<p>Bonjour ${escapeHtml(nom)},</p>
       <p>Votre clé d’API a été révoquée et n’est plus valide. Les appels retourneront
          désormais une erreur <code>403</code>.</p>
       <p style="font-size:14px;color:#666">Si vous pensez qu’il s’agit d’une erreur,
          répondez à cet email.</p>`,
    ),
    'revoked',
  );
}

/** Échappement : le nom et le motif viennent d'un formulaire public — jamais injectés bruts. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
