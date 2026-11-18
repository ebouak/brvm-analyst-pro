/**
 * État de session dont le chrome du site (barre de cote, onboarding, mode
 * débutant) a besoin. PUR : aucune dépendance, testé.
 *
 * Pourquoi ce module existe : jusqu'au 2026-11-18, `app/layout.tsx` lisait la
 * session côté serveur (`cookies()`). Une seule lecture de cookie dans le
 * layout RACINE rend TOUTES les routes dynamiques : les `revalidate` déclarés
 * par les pages publiques (accueil, /societes, /actualites, /brief…) étaient
 * ignorés, chaque visite exécutait une fonction, et le site a été suspendu par
 * Vercel pour dépassement du temps CPU. La session est désormais lue dans le
 * navigateur (`components/session/SessionShell.tsx`), et la règle de calcul,
 * reprise À L'IDENTIQUE de l'ancien layout, vit ici.
 */

/** Ancien littéral du layout, conservé tel quel (affichage seulement : chaque
 *  page /admin revérifie les droits côté serveur). */
const EMAIL_SUPER_ADMIN = 'ebouak@gmail.com';

export interface ProfilShell {
  is_premium: boolean | null;
  onboarding_done: boolean | null;
  mode_debutant: boolean | null;
}

export interface EtatShell {
  /** `undefined` tant que la session n'est pas lue (premier rendu, HTML en cache). */
  connecte: boolean | undefined;
  isAdmin: boolean;
  isPremium: boolean;
  onboardingDone: boolean;
  modeDebutant: boolean;
}

/** État avant toute lecture : celui d'une page servie depuis le cache. */
export const ETAT_INCONNU: EtatShell = {
  connecte: undefined,
  isAdmin: false,
  isPremium: false,
  onboardingDone: true,
  modeDebutant: false,
};

export function etatShell(email: string | null | undefined, connecte: boolean, profil: ProfilShell | null): EtatShell {
  if (!connecte) return { ...ETAT_INCONNU, connecte: false };
  const isAdmin = email === EMAIL_SUPER_ADMIN;
  return {
    connecte: true,
    isAdmin,
    isPremium: isAdmin || (profil?.is_premium ?? false),
    // superadmin = onboarding sauté (règle de l'ancien layout)
    onboardingDone: profil?.onboarding_done ?? isAdmin,
    modeDebutant: profil?.mode_debutant ?? false,
  };
}
