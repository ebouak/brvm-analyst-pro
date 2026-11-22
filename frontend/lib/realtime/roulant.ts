/**
 * Découpage d'un nombre formaté en colonnes pour l'effet « chiffres qui
 * roulent » (pur, testé). Les clés partent de la DROITE : quand le nombre
 * gagne ou perd un chiffre, les unités restent dans la même colonne et
 * roulent au lieu de sauter d'une place.
 */
export type Colonne = { cle: string; chiffre: number } | { cle: string; caractere: string };

export function colonnesRoulant(texte: string): Colonne[] {
  const cars = [...texte];
  return cars.map((c, i) => {
    const cle = `c${cars.length - i}`;
    return /\d/.test(c) ? { cle, chiffre: Number(c) } : { cle, caractere: c };
  });
}
