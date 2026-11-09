import { bootstrapIid, bootstrapStationnaire, moyenne, quantile, testSigne } from './stats.js';
import { evaluerSeance } from './evaluerSeance.js';
import { scoresFamilles } from './facteurs.js';
import { classeA } from './liquiditeGlissante.js';
import { perfIndice, type Indice } from './indice.js';
import type { Regle } from './decision.js';
import { rendementTotal } from './dividendes.js';
import { FAMILLES_FACTEURS, type Donnees, type FamilleFacteur } from './types.js';

/** Protocole FIGÉ (spec §2). Toute modification invalide le PREREG. */
export const PROTOCOLE = {
  horizon: 20,
  horizonSecondaire: 60,
  /** Coût aller-retour déduit de l'écart Acheter − Vendre (1,5 %). */
  cout: 0.015,
  blocMoyen: 3,
  tirages: 10000,
  graine: 20261109,
  minDates: 30,
  limiteVariation: 7.5,
} as const;

/** Une date toutes les `pas` séances, en gardant entrée (t+1) et sortie (t+1+pas) dans le calendrier. */
export function datesRebalancement(calendrier: string[], debut: string, pas: number): string[] {
  const out: string[] = [];
  const i0 = calendrier.findIndex((d) => d >= debut);
  for (let i = i0; i >= 0 && i + 1 + pas < calendrier.length; i += pas) out.push(calendrier[i]!);
  return out;
}

export interface Panier { date: string; achats: number[]; ventes: number[] }

export function ecartsParDate(paniers: Panier[]): { date: string; ecart: number }[] {
  return paniers
    .filter((p) => p.achats.length > 0 && p.ventes.length > 0)
    .map((p) => ({ date: p.date, ecart: moyenne(p.achats) - moyenne(p.ventes) - PROTOCOLE.cout }));
}

export type VerdictBanc = 'prouve' | 'non_prouve' | 'insuffisant';

export function verdictBanc(ecarts: number[]): { verdict: VerdictBanc; moyenne: number | null; borneBasse: number | null; n: number } {
  if (ecarts.length < PROTOCOLE.minDates) {
    return { verdict: 'insuffisant', moyenne: ecarts.length ? moyenne(ecarts) : null, borneBasse: null, n: ecarts.length };
  }
  const boot = bootstrapStationnaire(ecarts, { blocMoyen: PROTOCOLE.blocMoyen, tirages: PROTOCOLE.tirages, graine: PROTOCOLE.graine });
  const borneBasse = quantile(boot, 0.05);
  return { verdict: borneBasse > 0 ? 'prouve' : 'non_prouve', moyenne: moyenne(ecarts), borneBasse, n: ecarts.length };
}

/** Début de la mesure descriptive de la règle à cinq familles (spec §11.1). */
export const DEBUT_CINQ_FAMILLES = '2021-07-01';

export interface OptionsBanc {
  /** Règle de décision ; par défaut cœur prix (test confirmatoire, spec §11.1). */
  regle?: Regle;
  debut: string;
  fin?: string;
  horizon?: number;
  /** Robustesse : exclure les valeurs de classe C/D (au lieu de les forcer à Conserver). */
  exclureCD?: boolean;
  /** Robustesse : exclure les valeurs à la limite de variation le jour du signal. */
  exclureLimite?: boolean;
}

/** Règle appliquée à chaque date : signal à t, entrée à t+1, sortie à t+1+h, en excès de l'indice. */
export function construirePaniers(d: Donnees, ind: Indice, o: OptionsBanc): {
  paniers: Panier[]; conserves: Map<string, { total: number; conserver: number }>; exclues: number;
} {
  const h = o.horizon ?? PROTOCOLE.horizon;
  const dates = datesRebalancement(d.calendrier, o.debut, h);
  const paniers: Panier[] = [];
  const conserves = new Map<string, { total: number; conserver: number }>();
  let exclues = 0;
  for (const date of dates) {
    const iCal = d.calendrier.indexOf(date);
    const entree = d.calendrier[iCal + 1];
    const sortie = d.calendrier[iCal + 1 + h];
    if (!entree || !sortie) continue;
    if (o.fin && sortie > o.fin) continue;
    const marche = perfIndice(ind, d.calendrier, entree, sortie);
    const panier: Panier = { date, achats: [], ventes: [] };
    const an = date.slice(0, 4);
    const acc = conserves.get(an) ?? { total: 0, conserver: 0 };
    // exclureCD : les valeurs C/D sortent de l'univers de classement (rangs et médianes).
    const univers = o.exclureCD
      ? (code: string) => { const c = classeA(d.series.get(code)!, d.calendrier, date); return c === 'A' || c === 'B'; }
      : undefined;
    for (const dec of evaluerSeance(d, ind, date, univers, o.regle ?? 'coeur_prix')) {
      const s = d.series.get(dec.code)!;
      const p = s.pos.get(date)!;
      if (o.exclureLimite && Math.abs(s.variations[p] ?? 0) >= PROTOCOLE.limiteVariation) continue;
      acc.total++;
      if (dec.action === 'conserver') { acc.conserver++; continue; }
      const a = s.pos.get(entree);
      const b = s.pos.get(sortie);
      if (a == null || b == null) { exclues++; continue; }
      const r = rendementTotal(s, dec.code, d.dividendes, a, b, d.ruptures.get(dec.code));
      if (r == null) { exclues++; continue; }
      (dec.action === 'acheter' ? panier.achats : panier.ventes).push(r - marche);
    }
    conserves.set(an, acc);
    paniers.push(panier);
  }
  return { paniers, conserves, exclues };
}

/** Analyse secondaire : par famille, tiers haut − tiers bas en excès du marché, par date. */
export function ecartsFamille(d: Donnees, ind: Indice, debut: string, f: FamilleFacteur): number[] {
  const out: number[] = [];
  for (const date of datesRebalancement(d.calendrier, debut, PROTOCOLE.horizon)) {
    const iCal = d.calendrier.indexOf(date);
    const entree = d.calendrier[iCal + 1]!;
    const sortie = d.calendrier[iCal + 1 + PROTOCOLE.horizon]!;
    const marche = perfIndice(ind, d.calendrier, entree, sortie);
    const haut: number[] = [];
    const bas: number[] = [];
    for (const [code, sc] of scoresFamilles(d, ind, date)) {
      const v = sc[f];
      if (v == null) continue;
      const s = d.series.get(code)!;
      const a = s.pos.get(entree);
      const b = s.pos.get(sortie);
      if (a == null || b == null) continue;
      const r = rendementTotal(s, code, d.dividendes, a, b, d.ruptures.get(code));
      if (r == null) continue;
      if (v >= 1 / 3) haut.push(r - marche);
      else if (v <= -1 / 3) bas.push(r - marche);
    }
    if (haut.length && bas.length) out.push(moyenne(haut) - moyenne(bas));
  }
  return out;
}

/** Sur-confiance d'un banc qui regroupe les cas : largeur de l'IC par dates / largeur de l'IC par cas. */
export function ratioLargeurs(paniers: Panier[]): number | null {
  const cas = paniers.flatMap((p) => [...p.achats, ...p.ventes.map((x) => -x)]);
  const dates = ecartsParDate(paniers).map((e) => e.ecart);
  if (cas.length < 10 || dates.length < 10) return null;
  const bc = bootstrapIid(cas, 2000, PROTOCOLE.graine);
  const bd = bootstrapStationnaire(dates, { blocMoyen: PROTOCOLE.blocMoyen, tirages: 2000, graine: PROTOCOLE.graine });
  const largeur = (b: number[]) => quantile(b, 0.975) - quantile(b, 0.025);
  return largeur(bd) / largeur(bc);
}

export { testSigne, FAMILLES_FACTEURS };
