/**
 * Contrôles des agrégats bancaires avant toute valeur retenue — PUR.
 * Spec §4 « Contrôles », avenant du 2026-11-15. Un contrôle en échec ne
 * supprime rien : l'observation passe en controle = 'a_relire' avec son motif,
 * la sélection n'en retient rien, et la file de relecture la présente à
 * l'exploitant.
 *
 *   1. unité plausible pour la taille de la banque (confusion milliers/millions) ;
 *   2. égalités comptables à l'arrondi (RBE, marge d'intérêts), même document,
 *      même date, même périmètre, même unité ;
 *   3. recoupement avec la base (résultat net, total du bilan, fonds propres) ;
 *      3 bis. le coefficient d'exploitation DÉJÀ STOCKÉ (en %) est conservé
 *      comme recoupement : recalculé |charges d'exploitation| ÷ PNB, un écart
 *      au-delà de TOLERANCE_COEFFICIENT envoie PNB et charges en relecture ;
 *   4. variation extrême contre la même période N−1, même périmètre, même unité ;
 *   5. périmètre : aucune comparaison entre périmètres différents (les
 *      contrôles 2 et 4 ne rapprochent que des valeurs de même périmètre ; la
 *      substitution est interdite par la sélection, prudentiel/selection.ts).
 *
 * Montants en USD (ETIT) : les comptes ETIT en base sont CONVERTIS en FCFA
 * (migrations 0115/0116) ; les comparer à une lecture en USD exigerait un
 * taux de change, interdit. Une observation en USD n'est donc rapprochée que
 * d'observations en USD (total du bilan du même document, N−1 en USD).
 */
import { defDe } from './indicateurs.js';
import { granularite } from './nombres.js';
import { moisDe } from './periode.js';
import type { ObservationNouvelle } from './normaliser.js';

export interface Reference {
  /** Total du bilan du dernier exercice annuel en base (FCFA), ou null. */
  totalBilanAnnuel: number | null;
  /** Résultat net de la même période en base (income_statements, FCFA), ou null. */
  resultatNetBase: number | null;
  totalActifsBase: number | null;
  fondsPropresBase: number | null;
  /** lignes_specifiques.coefficient_exploitation de la même période, en %, ou null. */
  coefficientBase: number | null;
  /** Valeurs retenues de la même période N−1, clé « indicateur|perimetre|unite ». */
  valeursNm1: Record<string, number>;
}

/** Écart admis, en points de pourcentage, entre coefficient recalculé et stocké. */
export const TOLERANCE_COEFFICIENT = 1;

const BORNES_TB: Record<'fcfa' | 'usd', [number, number, string]> = {
  fcfa: [50e9, 50_000e9, '[50 ; 50 000] Md FCFA'],
  usd: [0.1e9, 100e9, '[0,1 ; 100] Md USD'],
};

const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')} %`;

function plausible(o: ObservationNouvelle, tbRef: number | null): string | null {
  const def = defDe(o.indicateur);
  if (!def || o.valeur == null) return null;
  const v = o.valeur;
  if (def.nature === 'ratio') {
    const max = o.indicateur === 'couverture_creances_souffrance' ? 300 : 100;
    const minExclu = ['solvabilite_total', 'ratio_cet1', 'ratio_tier1'].includes(o.indicateur);
    return (minExclu ? v <= 0 : v < 0) || v > max ? `ratio ${v} hors des bornes [0 ; ${max}] %` : null;
  }
  if (o.indicateur === 'total_bilan' && tbRef == null) {
    const [min, max, libelle] = BORNES_TB[o.unite === 'usd' ? 'usd' : 'fcfa'];
    return v < min || v > max ? `unité : total du bilan hors ${libelle}` : null;
  }
  if (tbRef == null) return null;
  const part = moisDe(o.periode) / 12;
  if (def.nature === 'flux') {
    if (Math.abs(v) > 0.45 * tbRef * part) return 'unité : flux supérieur à 45 % du total du bilan annualisé';
    if (o.indicateur === 'pnb' && v < 0.002 * tbRef * part) return 'unité : PNB inférieur à 0,2 % du total du bilan annualisé';
    return null;
  }
  if (o.indicateur === 'total_bilan') return v < 0.4 * tbRef || v > 2.5 * tbRef ? 'unité : total du bilan hors [0,4 ; 2,5] × le dernier annuel' : null;
  if (v > 1.1 * tbRef) return 'unité : encours supérieur au total du bilan';
  if (['credits_clientele', 'depots_clientele', 'fonds_propres'].includes(o.indicateur) && v < 0.01 * tbRef) {
    return 'unité : encours inférieur à 1 % du total du bilan';
  }
  return null;
}

function marquer(obs: ObservationNouvelle[], ids: Set<string>, motif: string): void {
  for (const o of obs) {
    if (!ids.has(o.id)) continue;
    o.controle = 'a_relire';
    o.controle_motif = [o.controle_motif, motif].filter(Boolean).join(' ; ');
  }
}

function egalite(groupe: ObservationNouvelle[], total: string, a: string, b: string, nom: string): [Set<string>, string] | null {
  const t = groupe.find((x) => x.indicateur === total);
  const x = groupe.find((y) => y.indicateur === a);
  const y = groupe.find((z) => z.indicateur === b);
  if (!t || !x || !y || t.valeur == null || x.valeur == null || y.valeur == null) return null;
  const tol = granularite(t) + granularite(x) + granularite(y);
  const ecart = Math.abs(t.valeur - (x.valeur - Math.abs(y.valeur)));
  return ecart > tol ? [new Set([t.id, x.id, y.id]), `${nom} : écart de ${Math.round(ecart)} au-delà de l’arrondi`] : null;
}

function recoupe(o: ObservationNouvelle | undefined, base: number | null, nom: string): [Set<string>, string] | null {
  if (!o || o.valeur == null || base == null || o.unite !== 'fcfa') return null;
  const tol = Math.max(granularite(o), 0.005 * Math.abs(base));
  return Math.abs(o.valeur - base) > tol ? [new Set([o.id]), `${nom} lu différent de la base (${base})`] : null;
}

function coefficient(groupe: ObservationNouvelle[], stocke: number | null): [Set<string>, string] | null {
  if (stocke == null) return null;
  const pnb = groupe.find((x) => x.indicateur === 'pnb');
  const ch = groupe.find((x) => x.indicateur === 'charges_exploitation');
  if (!pnb || !ch || pnb.valeur == null || ch.valeur == null || pnb.valeur <= 0) return null;
  const recalcule = (Math.abs(ch.valeur) / pnb.valeur) * 100;
  return Math.abs(recalcule - stocke) > TOLERANCE_COEFFICIENT
    ? [new Set([pnb.id, ch.id]), `coefficient d’exploitation recalculé ${pct1(recalcule)} ≠ stocké ${pct1(stocke)} (tolérance ${TOLERANCE_COEFFICIENT} point)`]
    : null;
}

export function controler(entree: ObservationNouvelle[], ref: Reference): ObservationNouvelle[] {
  const obs = entree.map((o) => ({ ...o }));
  const publiees = obs.filter((o) => o.statut === 'publie' && o.valeur != null);

  // 1. Unité. Le total du bilan lu dans le même document (même unité) sert de
  //    repère à défaut de la base ; une observation en USD n'a QUE ce repère.
  const tbDoc = (unite: ObservationNouvelle['unite']) => publiees.find((o) => o.indicateur === 'total_bilan' && o.unite === unite)?.valeur ?? null;
  for (const o of publiees) {
    const tbBase = o.unite === 'fcfa' ? ref.totalBilanAnnuel : null;
    const m = plausible(o, o.indicateur === 'total_bilan' ? tbBase : tbBase ?? tbDoc(o.unite));
    if (m) marquer(obs, new Set([o.id]), m);
  }

  // 2. Égalités, par (document, date, périmètre, unité).
  const groupes = new Map<string, ObservationNouvelle[]>();
  for (const o of publiees) {
    const k = `${o.document_url}|${o.date_arrete}|${o.perimetre}|${o.unite}`;
    groupes.set(k, [...(groupes.get(k) ?? []), o]);
  }
  for (const g of groupes.values()) {
    for (const e of [
      egalite(g, 'resultat_brut_exploitation', 'pnb', 'charges_exploitation', 'RBE ≠ PNB − charges d’exploitation'),
      egalite(g, 'marge_interets', 'produits_interets', 'charges_interets', 'marge d’intérêts ≠ produits − charges d’intérêts'),
    ]) if (e) marquer(obs, e[0], e[1]);
  }

  // 3. Recoupements (colonne de la période du document seulement : la plus récente date).
  const dateCourante = publiees.map((o) => o.date_arrete).sort().at(-1);
  const courante = (ind: string) => publiees.find((o) => o.indicateur === ind && o.date_arrete === dateCourante && o.unite === 'fcfa');
  for (const r of [
    recoupe(courante('resultat_net'), ref.resultatNetBase, 'résultat net'),
    recoupe(courante('total_bilan'), ref.totalActifsBase, 'total du bilan'),
    recoupe(courante('fonds_propres'), ref.fondsPropresBase, 'fonds propres'),
  ]) if (r) marquer(obs, r[0], r[1]);

  // 3 bis. Coefficient d'exploitation stocké (ratio : sans unité, vaut pour USD comme FCFA).
  for (const g of groupes.values()) {
    if (g[0]?.date_arrete !== dateCourante) continue;
    const c = coefficient(g, ref.coefficientBase);
    if (c) marquer(obs, c[0], c[1]);
  }

  // 4. Variation extrême contre la même période N−1, même périmètre, même unité.
  for (const o of publiees.filter((x) => x.date_arrete === dateCourante)) {
    const def = defDe(o.indicateur);
    const prec = ref.valeursNm1[`${o.indicateur}|${o.perimetre}|${o.unite}`];
    if (!def || def.nature === 'ratio' || prec == null || prec === 0) continue;
    const variation = (o.valeur! - prec) / Math.abs(prec);
    const seuil = def.nature === 'flux' ? 1 : 0.6;
    const signeChange = ['pnb', 'charges_exploitation', 'credits_clientele', 'depots_clientele'].includes(o.indicateur) && Math.sign(o.valeur!) !== Math.sign(prec);
    if (Math.abs(variation) > seuil || signeChange) {
      marquer(obs, new Set([o.id]), `variation extrême : ${Math.round(variation * 100)} % contre la même période N−1`);
    }
  }
  return obs;
}
