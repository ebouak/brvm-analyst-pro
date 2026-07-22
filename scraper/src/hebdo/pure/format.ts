// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
/**
 * Formatage de montants FCFA pour un lecteur non averti : « 96,6 millions FCFA »
 * plutôt que « 96558000 ». PUR, testé. Renvoie toujours la valeur ABSOLUE :
 * le signe (perte / bénéfice) est porté par la phrase qui l'entoure.
 */

const nf1 = (x: number) => x.toFixed(1).replace('.', ',');

/**
 * Espace fine insécable utilisée comme séparateur de milliers en typographie
 * française. On la fige (plutôt que de dépendre de `toLocaleString`) pour que
 * le rendu soit identique côté serveur, côté navigateur et dans les posts.
 */
const MILLIER = ' ';

/** 3050 → « 3 050 » · 2990.5 → « 2 990,5 ». Séparateur de milliers français. */
export function fmtNombre(x: number, decimales = 0): string {
  const fixe = x.toFixed(decimales);
  const [entier, dec] = fixe.split('.');
  const avecEspaces = (entier ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, MILLIER);
  return dec ? `${avecEspaces},${dec}` : avecEspaces;
}

/** 6.42 → « 6,42 % ». La virgule décimale est la marque du français écrit. */
export function fmtPct(x: number, decimales = 2): string {
  return `${fmtNombre(x, decimales)} %`;
}

/** 4.3 → « 4,3 ». Pour les ratios (volume, PER…). */
export function fmtRatio(x: number, decimales = 1): string {
  return fmtNombre(x, decimales);
}

export function fmtMontant(montant: number): string {
  const v = Math.abs(montant);
  if (v >= 1_000_000_000) {
    const n = v / 1_000_000_000;
    return `${nf1(n)} ${n >= 2 ? 'milliards' : 'milliard'} FCFA`;
  }
  if (v >= 1_000_000) {
    const n = v / 1_000_000;
    return `${nf1(n)} ${n >= 2 ? 'millions' : 'million'} FCFA`;
  }
  return `${Math.round(v).toLocaleString('fr-FR')} FCFA`;
}
