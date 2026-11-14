/**
 * Désabonnement de la newsletter : liens et en-têtes (RFC 8058).
 * Pur et testable, sans accès base ni réseau.
 */

/** Gabarit remplacé par destinataire au moment de l'envoi. */
export const UNSUB_PLACEHOLDER = '{{UNSUBSCRIBE_URL}}';

/** Lien de désabonnement en un clic (jeton = `newsletter_subscribers.confirm_token`). */
export function lienDesabonnement(base: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Lien propre à un destinataire. Un abonné de la liste publique a un jeton ; un
 * compte inscrit via ses préférences de thème n'en a pas : il gère ses envois
 * sur la page existante `/account/newsletters`.
 */
export function lienPourDestinataire(base: string, token: string | null): { url: string; unClic: boolean } {
  if (token) return { url: lienDesabonnement(base, token), unClic: true };
  return { url: `${base.replace(/\/+$/, '')}/account/newsletters`, unClic: false };
}

/**
 * En-têtes `List-Unsubscribe`. `List-Unsubscribe-Post` n'est posé que si le lien
 * accepte réellement un POST sans interaction (route à jeton).
 */
export function entetesDesabonnement(url: string, unClic: boolean): Record<string, string> {
  const h: Record<string, string> = { 'List-Unsubscribe': `<${url}>` };
  if (unClic) h['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  return h;
}
