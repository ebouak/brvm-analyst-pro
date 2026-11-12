/**
 * Titres-constats des documents (Dossier, Revue, Relevé) : un titre AFFIRME un
 * constat mesuré, il n'étiquette pas une rubrique. « Chiffre d'affaires : +8,3 %
 * en 2025, cinquième hausse consécutive » plutôt que « Trajectoire des résultats ».
 *
 * PUR. Chaque fonction a un repli neutre quand la donnée manque : jamais de
 * chiffre deviné, jamais de verbe de recommandation (acheter, vendre, objectif…).
 */
import { fmtNumber, fmtFcfa } from '@/lib/format';

const pct = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNumber(Math.abs(v), d)} %`;
const ORDINAUX = ['', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième'];

export interface PointExercice { exercice: string; valeur: number | null }

/** Variation en % du dernier exercice sur le précédent, ou null. */
function croissance(points: PointExercice[]): { exercice: string; pct: number } | null {
  const tries = [...points].filter((p) => p.valeur != null).sort((a, b) => Number(a.exercice) - Number(b.exercice));
  const n = tries.length;
  if (n < 2) return null;
  const a = tries[n - 2]!.valeur!, b = tries[n - 1]!.valeur!;
  if (a === 0) return null;
  return { exercice: tries[n - 1]!.exercice, pct: ((b - a) / Math.abs(a)) * 100 };
}

/** Nombre de hausses (ou de baisses) consécutives terminant au dernier exercice. */
function serie(points: PointExercice[]): number {
  const v = [...points].filter((p) => p.valeur != null).sort((a, b) => Number(a.exercice) - Number(b.exercice)).map((p) => p.valeur!);
  if (v.length < 2) return 0;
  const sens = Math.sign(v[v.length - 1]! - v[v.length - 2]!);
  if (sens === 0) return 0;
  let k = 0;
  for (let i = v.length - 1; i > 0 && Math.sign(v[i]! - v[i - 1]!) === sens; i--) k += 1;
  return k;
}

/** « Chiffre d'affaires : +8,3 % en 2025, cinquième hausse consécutive ». */
export function constatSerie(libelle: string, points: PointExercice[]): string {
  const c = croissance(points);
  if (!c) return libelle;
  const k = serie(points);
  const base = `${libelle} : ${pct(c.pct)} en ${c.exercice}`;
  if (k >= 2 && k < ORDINAUX.length) return `${base}, ${ORDINAUX[k]} ${c.pct > 0 ? 'hausse' : 'baisse'} consécutive`;
  return base;
}

/** Phrase de couverture : le résultat net du dernier exercice et sa variation. */
export function constatCouverture(e: { exercice: string | null; resultatNet: number | null; resultatNetPrecedent: number | null }): string | null {
  if (e.exercice == null || e.resultatNet == null) return null;
  const montant = `${fmtFcfa(e.resultatNet)} FCFA`;
  if (e.resultatNet < 0) return `Perte nette de ${fmtFcfa(-e.resultatNet)} FCFA en ${e.exercice}.`;
  if (e.resultatNetPrecedent == null || e.resultatNetPrecedent <= 0) return `Résultat net de ${montant} en ${e.exercice}.`;
  const v = ((e.resultatNet - e.resultatNetPrecedent) / e.resultatNetPrecedent) * 100;
  const sens = Math.abs(v) < 0.05 ? 'stable sur un an' : `${v > 0 ? 'en hausse' : 'en baisse'} de ${fmtNumber(Math.abs(v), 1)} % sur un an`;
  return `Résultat net de ${montant} en ${e.exercice}, ${sens}.`;
}

/**
 * « PER de 10,1 : en dessous de la médiane des comparables (12,4) ».
 * Une POSITION, pas un jugement : « en dessous » n'est pas « bon marché ».
 */
export function constatValorisation(per: number | null, medianePer: number | null): string {
  if (per == null || per <= 0) return 'Valorisation';
  const p = `PER de ${fmtNumber(per, 1)}`;
  if (medianePer == null || medianePer <= 0) return p;
  const ecart = (per - medianePer) / medianePer;
  const pos = Math.abs(ecart) <= 0.1 ? 'proche de' : ecart > 0 ? 'au-dessus de' : 'en dessous de';
  return `${p} : ${pos} la médiane des comparables (${fmtNumber(medianePer, 1)})`;
}

/**
 * Déclaration de la page « L'essentiel » : « En 2025, SONATEL a réalisé 1 923 Md FCFA
 * de chiffre d'affaires (+8,3 %) pour un résultat net de 413,59 Md FCFA (+5,1 %). »
 * Chaque membre absent disparaît ; sans chiffre d'affaires, repli sur la couverture.
 */
export function declarationEssentiel(e: {
  societe: string; exercice: string | null; ca: number | null; caPrecedent: number | null;
  resultatNet: number | null; resultatNetPrecedent: number | null;
}): string | null {
  if (e.exercice == null || e.ca == null) {
    return constatCouverture({ exercice: e.exercice, resultatNet: e.resultatNet, resultatNetPrecedent: e.resultatNetPrecedent });
  }
  const evo = (a: number, b: number | null) => (b != null && b > 0 ? ` (${pct(((a - b) / b) * 100)})` : '');
  let s = `En ${e.exercice}, ${e.societe} a réalisé ${fmtFcfa(e.ca)} FCFA de chiffre d’affaires${evo(e.ca, e.caPrecedent)}`;
  if (e.resultatNet != null) {
    s += e.resultatNet >= 0
      ? ` pour un résultat net de ${fmtFcfa(e.resultatNet)} FCFA${evo(e.resultatNet, e.resultatNetPrecedent)}`
      : ` pour une perte nette de ${fmtFcfa(-e.resultatNet)} FCFA`;
  }
  return `${s}.`;
}

/**
 * Dernière publication intermédiaire, comparée à la même période un an plus tôt :
 * « Sur les 9 premiers mois de 2026 : chiffre d'affaires +10,5 %, résultat net
 * +13,8 % par rapport à la même période de 2025. » null si rien n'est comparable.
 */
export function constatIntermediaire(i: {
  libelle: string; periodePrecedente: string;
  revenu: number | null; revenuPrecedent: number | null;
  resultatNet: number | null; resultatNetPrecedent: number | null;
} | null): string | null {
  if (!i) return null;
  const v = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? pct(((a - b) / b) * 100) : null);
  const membres = [
    v(i.revenu, i.revenuPrecedent) ? `chiffre d’affaires ${v(i.revenu, i.revenuPrecedent)}` : null,
    i.resultatNet != null && i.resultatNet < 0 ? 'résultat net en perte'
      : v(i.resultatNet, i.resultatNetPrecedent) ? `résultat net ${v(i.resultatNet, i.resultatNetPrecedent)}` : null,
  ].filter(Boolean);
  if (membres.length === 0) return null;
  const annee = i.periodePrecedente.slice(0, 4);
  return `Sur les ${i.libelle.replace(/^9 premiers mois/, '9 premiers mois')} : ${membres.join(', ')} par rapport à la même période de ${annee}.`
    .replace('Sur les 1er', 'Au 1er');
}
