import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * État de la double authentification (TOTP) du visiteur courant.
 *
 * Supabase raisonne en « AAL » (Authenticator Assurance Level), porté par le JWT :
 *   - currentLevel = 'aal1' → authentifié par mot de passe seulement
 *   - currentLevel = 'aal2' → le second facteur a été présenté sur CETTE session
 *   - nextLevel    = 'aal2' → l'utilisateur POSSÈDE un facteur vérifié
 *
 * D'où la distinction qui fait tout le travail :
 *   nextLevel='aal2' + currentLevel='aal1' = il a la 2FA mais ne l'a pas encore
 *   saisie sur cette session → il faut le challenger, pas le laisser entrer.
 */

export interface MfaStatus {
  /** L'utilisateur a au moins un facteur TOTP vérifié. */
  hasFactor: boolean;
  /** Session déjà élevée au second facteur. */
  isElevated: boolean;
  /** Il a la 2FA, mais cette session est restée en aal1 → challenge requis. */
  needsChallenge: boolean;
}

const NONE: MfaStatus = { hasFactor: false, isElevated: false, needsChallenge: false };

export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = createClient();

  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // En cas d'erreur, on renvoie « aucun facteur ». On n'invente pas un état de
  // sécurité qu'on n'a pas pu lire : la garde admin refusera l'accès, donc
  // l'échec penche du bon côté (fermé, jamais ouvert).
  if (error || !aal) return NONE;

  const isElevated = aal.currentLevel === 'aal2';

  // `nextLevel` est dérivé des facteurs portés par la session en cookie. Il peut
  // être en retard sur la réalité (facteur inscrit dans un autre onglet, cookie
  // pas encore rafraîchi). On confirme donc auprès du serveur d'auth, qui fait
  // foi — sans quoi un admin fraîchement inscrit resterait renvoyé en boucle vers
  // la page d'inscription qu'il vient pourtant de compléter.
  let hasFactor = aal.nextLevel === 'aal2';
  if (!hasFactor) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    hasFactor = (factors?.totp ?? []).some((f) => f.status === 'verified');
  }

  return {
    hasFactor,
    isElevated,
    needsChallenge: hasFactor && !isElevated,
  };
}
