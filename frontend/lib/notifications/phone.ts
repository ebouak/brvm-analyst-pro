/**
 * Normalisation de numéros de téléphone UEMOA vers E.164 (+225…).
 * Fonction pure — testée dans phone.test.mjs.
 */

/** Indicatifs UEMOA proposés dans l'UI (pays BRVM). */
export const UEMOA_DIAL_CODES: { code: string; label: string }[] = [
  { code: '+225', label: "Côte d'Ivoire (+225)" },
  { code: '+221', label: 'Sénégal (+221)' },
  { code: '+229', label: 'Bénin (+229)' },
  { code: '+226', label: 'Burkina Faso (+226)' },
  { code: '+223', label: 'Mali (+223)' },
  { code: '+227', label: 'Niger (+227)' },
  { code: '+228', label: 'Togo (+228)' },
  { code: '+245', label: 'Guinée-Bissau (+245)' },
];

/**
 * Normalise une saisie en E.164 :
 * - déjà internationale (« +225 07 01 02 03 04 », « 00225... ») → nettoyée ;
 * - nationale (« 07 01 02 03 04 ») → préfixée par `defaultDial` ;
 * - renvoie null si le résultat n'est pas plausible (8 à 15 chiffres).
 */
export function normalizeE164(input: string, defaultDial = '+225'): string | null {
  const raw = input.replace(/[\s.\-()]/g, '');
  if (!raw) return null;
  let e164: string;
  if (raw.startsWith('+')) e164 = '+' + raw.slice(1).replace(/\D/g, '');
  else if (raw.startsWith('00')) e164 = '+' + raw.slice(2).replace(/\D/g, '');
  else {
    // Format national : on préfixe tel quel (en CI le 0 initial se conserve
    // en international : 07 01 02 03 04 → +2250701020304).
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    e164 = defaultDial + digits;
  }
  // 10 à 15 chiffres : écarte les saisies manifestement tronquées (les mobiles
  // UEMOA font 11-14 chiffres en E.164).
  return /^\+\d{10,15}$/.test(e164) ? e164 : null;
}
