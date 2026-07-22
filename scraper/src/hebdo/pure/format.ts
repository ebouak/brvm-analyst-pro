// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
/**
 * Formatage de montants FCFA pour un lecteur non averti : « 96,6 millions FCFA »
 * plutôt que « 96558000 ». PUR, testé. Renvoie toujours la valeur ABSOLUE :
 * le signe (perte / bénéfice) est porté par la phrase qui l'entoure.
 */

const nf1 = (x: number) => x.toFixed(1).replace('.', ',');

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
