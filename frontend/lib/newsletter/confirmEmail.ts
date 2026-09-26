/**
 * Email de confirmation d'inscription (double opt-in) — fonction PURE, testée.
 *
 * POURQUOI. Depuis la migration 0037, `newsletter_subscribers` porte
 * `confirmed=false` + `confirm_token`, l'email s'intitulait « Confirmez votre
 * inscription »… et aucune route ne passait jamais `confirmed` à true. Les
 * inscrits de la landing ne pouvaient donc recevoir AUCUNE campagne (celles-ci
 * ne partent qu'aux confirmés). Ce gabarit porte le lien qui manquait.
 *
 * Le lien de désabonnement est présent dès ce premier email : c'est le même
 * jeton, et une personne doit pouvoir se retirer avant même d'avoir confirmé.
 */

export interface ConfirmEmailParams {
  confirmUrl: string;
  unsubscribeUrl: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const CONFIRM_SUBJECT = 'Bienvenue sur WESTBOURSE — Confirmez votre inscription';

export function buildConfirmEmailHtml({ confirmUrl, unsubscribeUrl }: ConfirmEmailParams): string {
  return `
<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1a1a2e">
  <h2 style="color:#c9a227">Bienvenue sur WESTBOURSE</h2>
  <p>Encore un clic pour recevoir chaque semaine notre lettre sur les marchés BRVM :</p>
  <p style="margin:24px 0">
    <a href="${esc(confirmUrl)}" style="display:inline-block;background:#10203a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Confirmer mon inscription</a>
  </p>
  <p>Vous recevrez ensuite :</p>
  <ul>
    <li>Le résumé de marché (top hausses/baisses)</li>
    <li>Les signaux d'opportunité détectés</li>
    <li>La note de conjoncture</li>
  </ul>
  <p style="color:#888;font-size:12px">Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email : sans confirmation, vous ne recevrez rien.
    <a href="${esc(unsubscribeUrl)}" style="color:#888">Se désabonner</a>.</p>
</div>`;
}
