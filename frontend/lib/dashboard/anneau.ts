export interface PartAnneau {
  code: string;
  part: number;
  debut: number;
  fin: number;
}

/**
 * Parts d'un anneau de répartition. Valeurs non finies ou <= 0 ignorées ;
 * au-delà de `maxParts - 1` lignes, le reste est regroupé sous « Autres ».
 * Les parts somment à 1 ; `debut`/`fin` sont des fractions cumulées.
 */
export function partsAnneau(lignes: { code: string; valeur: number }[], maxParts = 5): PartAnneau[] {
  // Une valeur détenue en plusieurs lots (plusieurs lignes) ne forme qu'une part.
  const parCode = new Map<string, number>();
  for (const l of lignes) {
    if (!Number.isFinite(l.valeur) || l.valeur <= 0) continue;
    parCode.set(l.code, (parCode.get(l.code) ?? 0) + l.valeur);
  }
  const valides = [...parCode.entries()]
    .map(([code, valeur]) => ({ code, valeur }))
    .sort((a, b) => b.valeur - a.valeur);
  const total = valides.reduce((s, l) => s + l.valeur, 0);
  if (total <= 0) return [];

  const plafond = Math.max(1, Math.floor(maxParts));
  let retenues = valides.map((l) => ({ code: l.code, valeur: l.valeur }));
  if (valides.length > plafond) {
    const tete = retenues.slice(0, plafond - 1);
    const reste = retenues.slice(plafond - 1).reduce((s, l) => s + l.valeur, 0);
    retenues = [...tete, { code: 'Autres', valeur: reste }];
  }

  let cumul = 0;
  return retenues.map((l, i) => {
    const debut = cumul;
    // La dernière borne est forcée à 1 pour absorber l'arrondi flottant.
    const fin = i === retenues.length - 1 ? 1 : cumul + l.valeur / total;
    cumul = fin;
    return { code: l.code, part: fin - debut, debut, fin };
  });
}
