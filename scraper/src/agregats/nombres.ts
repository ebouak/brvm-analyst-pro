/**
 * Nombres imprimés dans les documents bancaires — PUR.
 * Virgule décimale française ; espaces (y compris insécables) et points en
 * séparateurs de milliers ; parenthèses ou signe moins = négatif.
 *
 * ⚠️ Copié dans frontend/lib/agregats/pure/ (scripts/copier-agregats-purs.mjs,
 * vérifié par copie.test.ts) : corriger ICI, puis relancer le script.
 */
export type UniteSource = 'unites' | 'milliers' | 'millions' | 'milliards' | 'pct';

const FACTEURS: Record<UniteSource, number> = { unites: 1, milliers: 1e3, millions: 1e6, milliards: 1e9, pct: 1 };

export const facteur = (u: UniteSource | null | undefined): number => FACTEURS[u ?? 'unites'];

/** Plus petit écart que l'impression permet de distinguer, en unité stockée. */
export function granularite(o: { unite_source?: UniteSource | null; decimales?: number | null }): number {
  return facteur(o.unite_source) * 10 ** -(o.decimales ?? 0);
}

export function lireNombre(texte: string): { valeur: number; decimales: number } | null {
  let t = texte.trim().replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(/%$/, '');
  if (!t) return null;
  let negatif = false;
  const par = /^\((.*)\)$/.exec(t);
  if (par) {
    negatif = true;
    t = par[1]!;
  }
  if (t.startsWith('-')) {
    negatif = !negatif;
    t = t.slice(1);
  }
  let decimales = 0;
  if (t.includes(',')) {
    const morceaux = t.split(',');
    if (morceaux.length !== 2) return null;
    const [ent, dec] = morceaux as [string, string];
    decimales = dec.length;
    t = `${ent.replace(/\./g, '')}.${dec}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (/^\d+\.\d+$/.test(t)) {
    decimales = t.split('.')[1]!.length;
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return { valeur: negatif ? -v : v, decimales };
}
