import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Livraison des réponses du formulaire de contact — logique pure.
 *
 * Resend signe ses webhooks selon le protocole Svix
 * (docs.svix.com/receiving/verifying-payloads/how-manual, vérifié le 2026-10-21) :
 *   contenu signé = `${svix-id}.${svix-timestamp}.${corps BRUT}`,
 *   clé = base64 décodé de ce qui suit « whsec_ »,
 *   en-tête svix-signature = une ou plusieurs entrées « v1,<base64> » séparées
 *   par des espaces (plusieurs pendant une rotation de secret).
 * Le corps doit être lu BRUT : re-sérialiser le JSON changerait les octets
 * signés et ferait échouer une signature pourtant valide.
 */

/** Fenêtre d'acceptation de l'horodatage, contre le rejeu d'un événement capturé. */
export const TOLERANCE_S = 5 * 60;

export type Livraison = 'envoye' | 'retarde' | 'remis' | 'rejete' | 'spam';

export const LIVRAISON_LABEL: Record<Livraison, string> = {
  envoye: 'Envoyé, remise non confirmée',
  retarde: 'Remise retardée',
  remis: 'Remis',
  rejete: 'Rejeté',
  spam: 'Signalé comme spam',
};

/** Ordre de progression : un statut ne recule jamais (événements rejoués ou dans le désordre). */
const RANG: Record<Livraison, number> = { envoye: 1, retarde: 2, remis: 3, rejete: 4, spam: 5 };

const PAR_EVENEMENT: Record<string, Livraison> = {
  'email.sent': 'envoye',
  'email.delivery_delayed': 'retarde',
  'email.delivered': 'remis',
  'email.bounced': 'rejete',
  'email.failed': 'rejete',
  'email.suppressed': 'rejete',
  'email.complained': 'spam',
};

export function statutDepuisEvenement(type: string): Livraison | null {
  return PAR_EVENEMENT[type] ?? null;
}

export function peutPasser(actuel: Livraison | null, nouveau: Livraison): boolean {
  return actuel == null || RANG[nouveau] > RANG[actuel];
}

/** Statuts qu'un `nouveau` peut remplacer — pour une mise à jour conditionnelle en base. */
export function statutsRemplacables(nouveau: Livraison): Livraison[] {
  return (Object.keys(RANG) as Livraison[]).filter((s) => RANG[s] < RANG[nouveau]);
}

export function signatureResendValide(
  corpsBrut: string,
  entetes: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined,
  maintenantS: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = entetes;
  if (!secret || !id || !timestamp || !signature) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  if (Math.abs(maintenantS - Number(timestamp)) > TOLERANCE_S) return false;

  const cle = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  if (cle.length === 0) return false;

  const attendu = Buffer.from(createHmac('sha256', cle).update(`${id}.${timestamp}.${corpsBrut}`).digest('base64'));
  return signature
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('v1,'))
    .some((s) => {
      const recu = Buffer.from(s.slice(3));
      // timingSafeEqual lève sur des longueurs différentes : on compare d'abord.
      return recu.length === attendu.length && timingSafeEqual(recu, attendu);
    });
}

export interface EvenementLu {
  type: string;
  emailId: string;
  statut: Livraison;
  /** Raison d'un rejet, bornée — jamais l'adresse du destinataire. */
  detail: string | null;
}

export function lireEvenement(corps: unknown): EvenementLu | null {
  if (!corps || typeof corps !== 'object') return null;
  const c = corps as { type?: unknown; data?: unknown };
  if (typeof c.type !== 'string') return null;
  const statut = statutDepuisEvenement(c.type);
  if (!statut) return null;
  const data = (c.data && typeof c.data === 'object' ? c.data : {}) as Record<string, unknown>;
  const emailId = typeof data.email_id === 'string' && data.email_id ? data.email_id : null;
  if (!emailId) return null;

  let detail: string | null = null;
  const bounce = data.bounce as Record<string, unknown> | undefined;
  if (bounce && typeof bounce === 'object') {
    detail = [bounce.type, bounce.subType, bounce.message].filter((x) => typeof x === 'string' && x).join(' · ');
  } else if (statut !== 'remis' && statut !== 'envoye') {
    detail = c.type;
  }
  return { type: c.type, emailId, statut, detail: detail ? detail.slice(0, 300) : null };
}
