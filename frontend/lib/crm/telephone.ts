/**
 * Numéro saisi → E.164 (`+<indicatif><numéro>`). PUR, utilisable côté client.
 * L'indicatif est EXIGÉ : « 07 07… » est ivoirien, français ou autre selon le
 * pays — deviner enverrait la relance à un inconnu.
 * Même contrainte qu'en base (0174) : ^\+[1-9][0-9]{7,14}$.
 */
export type ResultatTelephone = { ok: true; e164: string | null } | { ok: false; erreur: string };

export const ERREUR_INDICATIF = "Indiquez l'indicatif du pays, par exemple +225 07 07 12 34 56.";

export function normaliserTelephone(saisie: string): ResultatTelephone {
  const brut = saisie.trim();
  if (!brut) return { ok: true, e164: null };
  if (/[^\d\s+().-]/.test(brut)) return { ok: false, erreur: 'Le numéro ne doit contenir que des chiffres.' };
  const compact = brut.replace(/[\s().-]/g, '');
  const international = compact.startsWith('+') ? compact.slice(1) : compact.startsWith('00') ? compact.slice(2) : null;
  if (international === null) return { ok: false, erreur: ERREUR_INDICATIF };
  if (!/^[1-9]\d{7,14}$/.test(international)) return { ok: false, erreur: 'Numéro trop court ou trop long.' };
  return { ok: true, e164: `+${international}` };
}
