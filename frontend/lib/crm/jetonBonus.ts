/**
 * Dossier offert — PUR. Un jeton par relance : un dossier, 14 jours. Toute
 * date illisible vaut « expiré » : le doute ne donne jamais accès.
 * Fraîcheur : même règle que l'envoi du samedi (scraper/src/dossiers/selection.ts,
 * 3 jours) — un dossier périmé livré en silence est pire qu'un dossier absent.
 */
export const VALIDITE_JOURS = 14;
export const FRAICHEUR_JOURS = 3;
const JOUR_MS = 86_400_000;

export type EtatJeton = 'inconnu' | 'expire' | 'utilise' | 'valide';

export function etatJeton(ligne: { created_at: string; bonus_at: string | null } | null, maintenant: Date): EtatJeton {
  if (!ligne) return 'inconnu';
  if (ligne.bonus_at) return 'utilise';
  const cree = Date.parse(ligne.created_at);
  if (!Number.isFinite(cree) || maintenant.getTime() - cree > VALIDITE_JOURS * JOUR_MS) return 'expire';
  return 'valide';
}

export function pdfFrais(majIso: string | null, maintenant: Date): boolean {
  const maj = majIso ? Date.parse(majIso) : NaN;
  return Number.isFinite(maj) && maintenant.getTime() - maj <= FRAICHEUR_JOURS * JOUR_MS;
}

/** Code de valeur accepté dans l'URL et en base (0174 : ^[A-Z0-9]{2,8}$). */
export const estCodeValeur = (c: string): boolean => /^[A-Z0-9]{2,8}$/.test(c);
