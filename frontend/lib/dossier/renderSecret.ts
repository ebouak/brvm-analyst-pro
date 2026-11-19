/**
 * Comparaison utilisable dans le middleware Edge et dans la page Node.
 * Le secret de rendu n’est jamais exposé au navigateur.
 */
export function secretRenduDossierValide(
  attendu: string | undefined,
  fourni: string | null,
): boolean {
  if (!attendu || !fourni || attendu.length < 32 || attendu.length !== fourni.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) {
    diff |= attendu.charCodeAt(i) ^ fourni.charCodeAt(i);
  }
  return diff === 0;
}
