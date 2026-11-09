/** Une valeur affichée est de la prose dès qu'elle contient un mot (hors unités FCFA/Md/M/x). */
export function estProse(v: string): boolean {
  return /[a-zàâçéèêëîïôûùü]{3,}/i.test(v.replace(/FCFA/gi, ''));
}

/** Le monospace est réservé aux chiffres : un texte reste en police de texte. */
export function classeValeur(v: string): string {
  return estProse(v) ? '' : 'tabular';
}
