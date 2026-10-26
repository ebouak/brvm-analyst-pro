/**
 * Variation impossible = donnée fausse, jamais un mouvement de marché.
 *
 * La BRVM plafonne la variation journalière à ±7,5 %. Le 26/10/2026, le
 * fractionnement SNTS (1 → 10) a produit −89,28 % au lieu de +7,18 % : veille
 * non ajustée face au cours ajusté. La vidéo, le point du soir et le brief
 * l'ont publié. Au-delà du seuil, aucune publication automatique ne part :
 * soit l'opération sur titres est enregistrée (operations_titres, et le
 * trigger de 0166 corrige la variation), soit un humain regarde.
 *
 * Même règle dans video/genere.mjs (paquet distinct) — à corriger des deux côtés.
 */
export const SEUIL_VARIATION_ABERRANTE = 50;

export function variationsAberrantes(
  cotes: { code: string; variation_pct: number | null }[],
  seuil = SEUIL_VARIATION_ABERRANTE,
): string[] {
  return cotes
    .filter((c) => c.variation_pct != null && Math.abs(c.variation_pct) > seuil)
    .map((c) => `${c.code} ${c.variation_pct} %`);
}
