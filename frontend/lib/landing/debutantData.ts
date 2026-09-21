/**
 * Données de la page /debutant — une fonction, cache 5 min, clé anon.
 *
 * RIEN N'EST INVENTÉ : la maquette parlait de « 15 200 FCFA », « PER 12,4x »,
 * « +28,4 % », « 25 000 membres ». Ici chaque chiffre est lu ou calculé —
 * cours et variation (brvm_actions_daily), PER (lib/fundamentals : résultat
 * net ÷ nombre d'actions), dividende VÉRIFIÉ (lib/dividends/verified), note
 * (scoreToRating sur signals_daily), simulation (lib/simulate sur les vraies
 * clôtures), membres (getMemberCount). Une valeur absente est `null` et la
 * page l'affiche comme telle.
 */
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { getLastMarketDate } from '@/lib/marketDate';
import { computeRatios } from '@/lib/fundamentals';
import { latestUsable, type FundamentalsRow } from '@/lib/landing/fundamentals';
import { selectVerified, rendementDividende } from '@/lib/dividends/verified';
import { scoreToRating } from '@/lib/rating';
import { simulateInvestment, type PricePoint } from '@/lib/simulate';
import { sparklinePath } from '@/lib/landing/sparkline';
import { getMemberCount } from '@/lib/landing/memberCount';

export interface FicheDebutant {
  code: string;
  nom: string | null;
  cours: number | null;
  variation: number | null;
  per: number | null;
  dividende: number | null;
  exerciceDividende: number | null;
  /** true = détachement daté (ex_date) ; false = dividende déclaré par exercice (source société / Sika Finance). */
  dividendeVerifie: boolean;
  rendement: number | null;
  note: string | null;          // 'A+' … 'E', ou null si non noté
  /** Tracé (44×16) des 20 dernières clôtures, ou null. */
  spark: string | null;
}

export interface SerieMois { d: string; v: number }

export interface Simulation {
  code: string;
  montant: number;
  finalValue: number;
  pct: number;
  years: number;
  totalDividends: number;
  serie: SerieMois[];
}

export interface DebutantData {
  dateMarche: string | null;
  nbActions: number;
  vedette: FicheDebutant | null;
  /** Série 12 mois (une clôture par mois + la dernière) de la vedette. */
  serie12m: SerieMois[];
  comparees: FicheDebutant[];
  simulation: Simulation | null;
  membres: number | null;
}

const VEDETTE = 'SNTS';
const MONTANT = 1_000_000;

async function load(): Promise<DebutantData> {
  const db = createPublicClient();
  const vide: DebutantData = { dateMarche: null, nbActions: 0, vedette: null, serie12m: [], comparees: [], simulation: null, membres: null };
  const [dateMarche, membres] = await Promise.all([getLastMarketDate(db), getMemberCount().catch(() => null)]);
  if (!dateMarche) return { ...vide, membres };

  const depuis3a = new Date(); depuis3a.setFullYear(depuis3a.getFullYear() - 3);
  const from3 = depuis3a.toISOString().slice(0, 10);

  const [rowsRes, instRes, fondRes, sigRes, divsRes, histRes] = await Promise.all([
    db.from('brvm_actions_daily').select('code, cours_jour, variation_pct, valeur_echangee').eq('date_marche', dateMarche),
    db.from('brvm_instruments').select('code, designation, shares'),
    db.from('fundamentals').select('code, year, revenue, net_income, equity, debt'),
    db.from('signals_daily').select('code, score_total, confiance').eq('date_marche', dateMarche),
    db.from('dividends').select('code, montant, exercice, ex_date, payment_date').gt('montant', 0).order('exercice', { ascending: false }),
    db.from('brvm_actions_daily').select('code, date_marche, cours_jour').eq('code', VEDETTE).gte('date_marche', from3).order('date_marche', { ascending: true }),
  ]);

  const cours = new Map((rowsRes.data ?? []).map((r) => [String(r.code), { cours: r.cours_jour == null ? null : Number(r.cours_jour), variation: r.variation_pct == null ? null : Number(r.variation_pct), valeur: r.valeur_echangee == null ? 0 : Number(r.valeur_echangee) }]));
  const inst = new Map((instRes.data ?? []).map((i) => [String(i.code), { nom: (i.designation as string | null) ?? null, shares: i.shares == null ? null : Number(i.shares) }]));
  const fondParCode = new Map<string, FundamentalsRow[]>();
  for (const f of fondRes.data ?? []) {
    const c = String(f.code);
    if (!fondParCode.has(c)) fondParCode.set(c, []);
    fondParCode.get(c)!.push({ code: c, year: Number(f.year), revenue: f.revenue == null ? null : Number(f.revenue), net_income: f.net_income == null ? null : Number(f.net_income), equity: f.equity == null ? null : Number(f.equity), debt: f.debt == null ? null : Number(f.debt) });
  }
  // Dividende : VÉRIFIÉ (ex_date datée, lib/dividends/verified) quand il existe —
  // aujourd'hui SNTS seul — sinon le dernier dividende déclaré par exercice
  // (montant ≠ exercice : les lignes où le montant vaut l'année sont des
  // erreurs connues d'extraction, voir CLAUDE.md). Le drapeau dit lequel.
  const divRows = (divsRes.data ?? []).map((d) => ({ code: String(d.code), montant: d.montant == null ? null : Number(d.montant), exercice: d.exercice == null ? null : Number(d.exercice), ex_date: (d.ex_date as string | null) ?? null, payment_date: (d.payment_date as string | null) ?? null }));
  const verifies = selectVerified(divRows);
  const declares = new Map<string, { montant: number; exercice: number | null; datee: boolean }>();
  for (const r of divRows) {
    if (r.montant == null || r.montant <= 0 || r.exercice == null || r.montant === r.exercice) continue;
    const prev = declares.get(r.code);
    // À exercice égal, la ligne datée (date de paiement, import Richbourse)
    // l'emporte : c'est la valeur exacte, l'autre est un arrondi de fiche.
    const mieux = !prev || (r.exercice ?? -1) > (prev.exercice ?? -1) || ((r.exercice ?? -1) === (prev.exercice ?? -1) && !!r.payment_date && !prev.datee);
    if (mieux) declares.set(r.code, { montant: r.montant, exercice: r.exercice, datee: !!r.payment_date });
  }
  const sig = new Map((sigRes.data ?? []).map((s) => [String(s.code), { score: s.score_total == null ? null : Number(s.score_total), conf: s.confiance == null ? null : Number(s.confiance) }]));

  const fiche = (code: string, spark: string | null): FicheDebutant => {
    const c = cours.get(code);
    const i = inst.get(code);
    const ex = latestUsable(fondParCode.get(code) ?? []);
    const r = ex ? computeRatios({ cours: c?.cours ?? null, shares: i?.shares ?? null, revenue: ex.revenue, net_income: ex.net_income, equity: ex.equity, debt: ex.debt, dividende: null }) : null;
    const vf = verifies.get(code);
    const dv = vf ? { montant: vf.montant, exercice: vf.exercice, verifie: true } : (declares.get(code) ? { montant: declares.get(code)!.montant, exercice: declares.get(code)!.exercice, verifie: false } : undefined);
    const s = sig.get(code);
    const note = s ? scoreToRating(s.score, s.conf).note : 'NR';
    return {
      code, nom: i?.nom ?? null, cours: c?.cours ?? null, variation: c?.variation ?? null,
      per: r?.per != null && r.per > 0 ? r.per : null,
      dividende: dv?.montant ?? null, exerciceDividende: dv?.exercice ?? null, dividendeVerifie: dv?.verifie ?? false,
      rendement: dv ? rendementDividende(dv.montant, c?.cours ?? null) : null,
      note: note === 'NR' ? null : note, spark,
    };
  };

  // Comparateur : la vedette + les deux plus grosses valeurs échangées qui ont
  // à la fois un PER calculable et un dividende vérifié — sinon le tableau
  // aurait des trous et n'apprendrait rien au débutant.
  const candidats = [...cours.entries()]
    .filter(([code]) => code !== VEDETTE)
    .map(([code]) => ({ code, f: fiche(code, null), valeur: cours.get(code)?.valeur ?? 0 }))
    .filter((x) => x.f.per != null && x.f.dividende != null && x.f.cours != null)
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, 2)
    .map((x) => x.code);
  const codes = [VEDETTE, ...candidats];

  const { data: hist20 } = await db.from('brvm_actions_daily').select('code, date_marche, cours_jour').in('code', codes).lte('date_marche', dateMarche).order('date_marche', { ascending: false }).limit(20 * codes.length);
  const spark = (code: string) => {
    const serie = (hist20 ?? []).filter((h) => h.code === code).slice(0, 20).reverse().map((h) => Number(h.cours_jour)).filter((v) => v > 0);
    return sparklinePath(serie, 44, 16)?.line ?? null;
  };
  const comparees = codes.map((c) => fiche(c, spark(c)));
  const vedette = comparees[0] ?? null;

  // Série 12 mois de la vedette (une clôture par mois + la dernière) et simulation 3 ans.
  const prices: PricePoint[] = (histRes.data ?? []).filter((r) => r.cours_jour != null && Number(r.cours_jour) > 0).map((r) => ({ date: String(r.date_marche), close: Number(r.cours_jour) }));
  const parMois = new Map<string, PricePoint>();
  for (const p of prices) { const m = p.date.slice(0, 7); if (!parMois.has(m)) parMois.set(m, p); }
  const derniere = prices[prices.length - 1];
  const serieAll = [...parMois.values()];
  if (derniere && serieAll[serieAll.length - 1]?.date !== derniere.date) serieAll.push(derniere);
  const serie12m = serieAll.slice(-13).map((p) => ({ d: p.date, v: p.close }));

  let simulation: Simulation | null = null;
  const dividends = (divsRes.data ?? [])
    .filter((d) => String(d.code) === VEDETTE && d.montant != null && Number(d.montant) > 0 && (d.exercice == null || Number(d.montant) !== Number(d.exercice)))
    .map((d) => ({ date: String(d.payment_date ?? d.ex_date ?? ''), montant: Number(d.montant) }))
    .filter((d) => d.date);
  const sim = prices.length > 2 ? simulateInvestment(MONTANT, from3, prices, dividends) : null;
  if (sim) {
    simulation = { code: VEDETTE, montant: MONTANT, finalValue: sim.finalValue, pct: sim.totalReturnPct, years: sim.years, totalDividends: sim.totalDividends, serie: serieAll.map((p) => ({ d: p.date, v: p.close })) };
  }

  return { dateMarche, nbActions: cours.size, vedette, serie12m, comparees, simulation, membres };
}

export const getDebutantData = unstable_cache(load, ['debutant-data'], { revalidate: 300 });
