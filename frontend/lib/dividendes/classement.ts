/**
 * Classement des rendements de la page /dividendes.
 *
 * Un rendement n'a de sens que pour le DERNIER exercice distribué : rapporter un
 * dividende de 2021 au cours d'aujourd'hui fabriquait des chiffres sans réalité
 * (constaté le 2026-11-10 : PALC 2021 à 16 %, ONTBF 2021 à 14 % en tête du
 * classement, alors que leurs dividendes 2025 donnent bien moins). C'est aussi la
 * définition de Sika Finance, ce qui rend le chiffre recoupable.
 *
 * Plusieurs lignes d'une même société pour le même exercice viennent de sources
 * différentes (une même distribution vue deux fois) : on garde la plus élevée,
 * jamais la somme, qui doublerait le dividende.
 */
export interface LigneRendement {
  code: string;
  exercice: number | null;
  montant: number;
  rendement_pct: number | null;
}

export function meilleursRendements<T extends LigneRendement>(rows: T[], exercice: number | null, n = 5): T[] {
  if (exercice == null) return [];
  const parCode = new Map<string, T>();
  for (const r of rows) {
    if (r.exercice !== exercice || !(r.montant > 0) || r.rendement_pct == null) continue;
    const deja = parCode.get(r.code);
    if (!deja || (deja.rendement_pct ?? 0) < r.rendement_pct) parCode.set(r.code, r);
  }
  return [...parCode.values()]
    .sort((a, b) => (b.rendement_pct ?? 0) - (a.rendement_pct ?? 0) || a.code.localeCompare(b.code))
    .slice(0, n);
}
