// frontend/lib/forum/identity.ts
import type { AuthorProfile } from './types';

/** Affichage de l'auteur. Jamais l'email ni le nom réel (minimisation RGPD). */
export function displayName(profile: AuthorProfile | null): string {
  if (!profile) return 'Utilisateur supprimé';
  const name = (profile.display_name ?? '').trim();
  return name.length > 0 ? name : 'Membre';
}

/** Temps écoulé en français compact : « à l'instant », « 3 h », « 2 j », « 5 sem ». */
export function relativeTimeFR(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "à l'instant";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `${j} j`;
  const sem = Math.floor(j / 7);
  if (sem < 5) return `${sem} sem`;
  const mois = Math.floor(j / 30);
  if (mois < 12) return `${mois} mois`;
  return `${Math.floor(j / 365)} an${Math.floor(j / 365) > 1 ? 's' : ''}`;
}
