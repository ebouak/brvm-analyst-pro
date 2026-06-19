// frontend/lib/forum/identity.ts
import type { AuthorProfile } from './types';

/** Affichage de l'auteur. Jamais l'email ni le nom réel (minimisation RGPD). */
export function displayName(profile: AuthorProfile | null): string {
  if (!profile) return 'Utilisateur supprimé';
  const name = (profile.display_name ?? '').trim();
  return name.length > 0 ? name : 'Membre';
}
