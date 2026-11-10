/** Comptes « anciens » au-delà de 18 mois après la clôture (31/12 de l'exercice). */
export const MOIS_COMPTES_ANCIENS = 18;

export function fraicheurComptes(exercice: number | null, maintenant = new Date()): { exercice: number; ancien: boolean } | null {
  if (exercice == null) return null;
  const limite = new Date(Date.UTC(exercice, 11, 31));
  limite.setUTCMonth(limite.getUTCMonth() + MOIS_COMPTES_ANCIENS);
  return { exercice, ancien: maintenant.getTime() > limite.getTime() };
}
