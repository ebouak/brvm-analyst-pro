import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { monthlyReturnsFromPrices, type MonthlyReturn, type DailyClose } from './compute';
import { bandeHistorique, etatMois, trajectoireMois, type EtatMois, type PointBande, type PointTrajectoire } from './trajectoire';

const WINDOW_YEARS_MAX = 15; // plafond des cours quotidiens lus (trajectoires)
const PAGE = 1000;

/** Une ligne de `saisonnalite_mensuelle` (migration 0206), telle que lue. */
export interface FaitLu {
  annee: number;
  mois: number;
  rdtPrix: number | null;
  rdtTotal: number | null;
  rdtMarche: number | null;
  dividende: number | null;
  detachements: string[];
  exclu: string | null;
  difficulte: boolean;
  complet: boolean;
}

type LigneTable = {
  annee: number; mois: number; rdt_prix: number | null; rdt_total: number | null; rdt_marche: number | null;
  dividende: number | null; evenements: { type: string; date: string }[] | null; exclu: string | null; difficulte: boolean; complet: boolean;
};
const num = (v: unknown) => (v == null ? null : Number(v));

/** Faits mensuels d'une valeur, écrits par le scraper. [] si la table est vide pour ce code. */
export const lireFaits = cache(async (code: string): Promise<FaitLu[]> => {
  const sb = createPublicClient();
  const out: FaitLu[] = [];
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb
      .from('saisonnalite_mensuelle')
      .select('annee, mois, rdt_prix, rdt_total, rdt_marche, dividende, evenements, exclu, difficulte, complet')
      .eq('code', code.toUpperCase())
      .order('annee').order('mois')
      .range(from, from + PAGE - 1);
    if (error) return [];
    const lot = (data ?? []) as LigneTable[];
    for (const r of lot) {
      out.push({
        annee: r.annee, mois: r.mois,
        rdtPrix: num(r.rdt_prix), rdtTotal: num(r.rdt_total), rdtMarche: num(r.rdt_marche), dividende: num(r.dividende),
        detachements: (r.evenements ?? []).filter((e) => e.type === 'detachement').map((e) => e.date),
        exclu: r.exclu, difficulte: r.difficulte, complet: r.complet,
      });
    }
    if (lot.length < PAGE) break;
  }
  return out;
});

/** Cours de clôture quotidiens sur 15 ans au plus. */
const lireCours = cache(async (code: string): Promise<DailyClose[]> => {
  const sb = createPublicClient();
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - WINDOW_YEARS_MAX);
  const fromDate = since.toISOString().slice(0, 10);
  const closes: DailyClose[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code.toUpperCase())
      .gte('date_marche', fromDate)
      .not('cours_jour', 'is', null)
      .order('date_marche', { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as Array<{ date_marche: string; cours_jour: number }>;
    for (const r of batch) closes.push({ date: r.date_marche, close: r.cours_jour });
    if (batch.length < PAGE) break;
  }
  return closes;
});

/** Rendements mensuels COMPLETS et non exclus, en total (dividende réinvesti) ou en prix. */
export function rendementsDepuisFaits(faits: FaitLu[], mode: 'total' | 'prix'): MonthlyReturn[] {
  return faits
    .filter((f) => f.complet && !f.exclu)
    .map((f) => ({ year: f.annee, month: f.mois, ret: mode === 'total' ? f.rdtTotal : f.rdtPrix, gapMonths: 0 }))
    .filter((r): r is MonthlyReturn => r.ret != null && Number.isFinite(r.ret));
}

/**
 * Série mensuelle d'un titre (encart de la fiche action) : rendement total lu
 * dans `saisonnalite_mensuelle` ; à défaut (table vide, obligation), calcul sur
 * les cours comme au lot 1.
 */
export const getMonthlyReturns = cache(async (code: string): Promise<MonthlyReturn[]> => {
  const faits = await lireFaits(code);
  if (faits.length > 0) return rendementsDepuisFaits(faits, 'total');
  return monthlyReturnsFromPrices(await lireCours(code));
});

export interface Confrontation {
  annee: number;
  mois: number;
  rangSeance: number;
  rdtEnCours: number;
  etat: EtatMois;
  q25: number | null;
  mediane: number | null;
  q75: number | null;
  /** Années comparables au rang courant. */
  n: number;
  enCours: PointTrajectoire[];
  bande: PointBande[];
}

export interface SaisonValeur {
  source: 'table' | 'calcul';
  total: MonthlyReturn[];
  prix: MonthlyReturn[];
  anneesDifficiles: number[];
  /** Années où chaque mois (index 0 = janvier) a porté un détachement. */
  detachementsParMois: number[];
  faits: FaitLu[];
  confrontation: Confrontation | null;
}

/** Tout ce que la page /saisonnalite affiche pour une valeur. */
export const getSaisonValeur = cache(async (code: string, now: Date = new Date()): Promise<SaisonValeur> => {
  const [faits, closes] = await Promise.all([lireFaits(code), lireCours(code)]);
  const annee = now.getUTCFullYear();
  const mois = now.getUTCMonth() + 1;

  if (faits.length === 0) {
    const r = monthlyReturnsFromPrices(closes, { asOf: now });
    return { source: 'calcul', total: r, prix: r, anneesDifficiles: [], detachementsParMois: Array(12).fill(0), faits: [], confrontation: null };
  }

  const detachementsParMois = Array(12).fill(0) as number[];
  for (const f of faits) if (f.complet && f.detachements.length) detachementsParMois[f.mois - 1]!++;
  const anneesDifficiles = [...new Set(faits.filter((f) => f.difficulte).map((f) => f.annee))].sort();

  // Confrontation du mois en cours : années passées du même mois, sans les mois exclus.
  const coupons = (f: FaitLu | undefined) =>
    f && f.dividende && f.detachements.length ? [{ date: f.detachements[0]!, montant: f.dividende }] : [];
  const faitDe = (y: number) => faits.find((f) => f.annee === y && f.mois === mois);
  const enCours = trajectoireMois(closes, annee, mois, coupons(faitDe(annee))) ?? [];
  const passees: PointTrajectoire[][] = [];
  for (let y = annee - WINDOW_YEARS_MAX; y < annee; y++) {
    const f = faitDe(y);
    if (!f || f.exclu || !f.complet) continue;
    const t = trajectoireMois(closes, y, mois, coupons(f));
    if (t && t.length) passees.push(t);
  }
  const bande = bandeHistorique(passees);
  let confrontation: Confrontation | null = null;
  if (enCours.length > 0) {
    const dernier = enCours[enCours.length - 1]!;
    const e = etatMois({ rdtEnCours: dernier.cumul, rangSeance: dernier.rang, bande });
    confrontation = { annee, mois, rangSeance: dernier.rang, rdtEnCours: dernier.cumul, ...e, enCours, bande };
  }

  return {
    source: 'table',
    total: rendementsDepuisFaits(faits, 'total'),
    prix: rendementsDepuisFaits(faits, 'prix'),
    anneesDifficiles,
    detachementsParMois,
    faits,
    confrontation,
  };
});

/** Rendement mensuel du marché (moyenne équipondérée écrêtée), mois complets, tout l'historique. */
export const lireMarcheMensuel = cache(async (): Promise<MonthlyReturn[]> => {
  const sb = createPublicClient();
  const vus = new Map<string, MonthlyReturn>();
  for (let from = 0; from < 40000; from += PAGE) {
    const { data, error } = await sb
      .from('saisonnalite_mensuelle')
      .select('annee, mois, rdt_marche')
      .eq('complet', true)
      .not('rdt_marche', 'is', null)
      .order('annee').order('mois').order('code')
      .range(from, from + PAGE - 1);
    if (error) return [];
    const lot = (data ?? []) as { annee: number; mois: number; rdt_marche: number }[];
    for (const r of lot) {
      const k = `${r.annee}-${r.mois}`;
      if (!vus.has(k)) vus.set(k, { year: r.annee, month: r.mois, ret: Number(r.rdt_marche), gapMonths: 0 });
    }
    if (lot.length < PAGE) break;
  }
  return [...vus.values()];
});
