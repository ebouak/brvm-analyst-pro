import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { computeTrueReturn, type TrueReturnResult, type DividendeExercice } from './trueReturn';
import { PAYS_LABELS, type PaysUemoa } from '@/lib/tax/rates';

/**
 * Assemble les données du RENDEMENT VRAI depuis la base.
 *
 * ── La fenêtre : 3 ans (2023-2025) ──
 * Voir la constante ANNEE_DEBUT : c'est l'HISTORIQUE DES COURS qui borne, pas les
 * dividendes.
 *
 * ── Le prix de réinvestissement ──
 * Faute de date de détachement publiée avant 2026, on retient la clôture la plus
 * proche du 30 juin de l'année de détachement — les détachements réellement datés
 * (2026) tombent entre fin mai et fin juin, ce qui valide la convention. Elle est
 * affichée à l'utilisateur : une convention assumée vaut mieux qu'une précision
 * feinte.
 */

/** ISO3 (macro_inflation) → code du barème fiscal. */
const ISO3_TO_FISCAL: Record<string, PaysUemoa> = {
  BEN: 'BJ', BFA: 'BF', CIV: 'CI', GNB: 'GW',
  MLI: 'ML', NER: 'NE', SEN: 'SN', TGO: 'TG',
};

/**
 * Fenêtre de détention : 3 années civiles pleines.
 *
 * ── Ce qui borne la fenêtre, ce ne sont PAS les dividendes ──
 * On dispose bien des exercices 2021 à 2025. Mais l'HISTORIQUE DES COURS n'est
 * dense qu'à partir de 2023 : 10 287 lignes en 2023 (47 titres × 249 séances),
 * contre 674 en 2022 — soit deux ou trois titres épars. Le dividende de
 * l'exercice 2021, détaché mi-2022, ne peut donc pas être réinvesti : il n'y a
 * pas de cours à cette date.
 *
 * On s'arrête donc à ce que les données permettent réellement. Prétendre couvrir
 * 2022 reviendrait à réinvestir à un prix qui n'existe pas.
 */
export const ANNEE_DEBUT = 2023;
export const ANNEE_FIN = 2025;
/** Exercices encaissés pendant la détention (chacun détaché l'année suivante). */
const EXERCICES = [2022, 2023, 2024];

export interface PaysRendement {
  iso3: string;
  nom: string;
  resultat: TrueReturnResult;
}

export interface TrueReturnReport {
  code: string;
  designation: string | null;
  coursDebut: number;
  coursFin: number;
  /** Dividendes NETS encaissés, par exercice. */
  dividendes: DividendeExercice[];
  /** Total des dividendes NETS versés sur la période, par action détenue au départ. */
  totalDividendesNets: number;
  pays: PaysRendement[];
}

/** Titres disposant de TOUS les exercices de la fenêtre — les seuls calculables. */
export async function listCodesEligibles(): Promise<{ code: string; designation: string | null }[]> {
  const db = createPublicClient();

  const { data: divs } = await db
    .from('dividends')
    .select('code, exercice')
    .gte('exercice', EXERCICES[0]!)
    .lte('exercice', EXERCICES[EXERCICES.length - 1]!);

  const parCode = new Map<string, Set<number>>();
  for (const d of (divs ?? []) as { code: string; exercice: number }[]) {
    if (!parCode.has(d.code)) parCode.set(d.code, new Set());
    parCode.get(d.code)!.add(d.exercice);
  }
  const complets = [...parCode.entries()]
    .filter(([, ex]) => EXERCICES.every((e) => ex.has(e)))
    .map(([code]) => code);
  if (complets.length === 0) return [];

  const { data: instr } = await db
    .from('brvm_instruments')
    .select('code, designation')
    .in('code', complets);

  const nom = new Map(
    ((instr ?? []) as { code: string; designation: string | null }[]).map((i) => [i.code, i.designation]),
  );
  return complets
    .map((code) => ({ code, designation: nom.get(code) ?? null }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Clôture la plus proche d'une date cible (fenêtre ±45 j). Null si aucune. */
async function coursProche(code: string, cible: string): Promise<number | null> {
  const db = createPublicClient();
  const d = new Date(cible);
  const avant = new Date(d); avant.setDate(avant.getDate() - 45);
  const apres = new Date(d); apres.setDate(apres.getDate() + 45);

  const { data } = await db
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour')
    .eq('code', code)
    .not('cours_jour', 'is', null)
    .gte('date_marche', avant.toISOString().slice(0, 10))
    .lte('date_marche', apres.toISOString().slice(0, 10))
    .order('date_marche', { ascending: true });

  const rows = (data ?? []) as { date_marche: string; cours_jour: number }[];
  if (rows.length === 0) return null;

  // La plus proche de la cible, pas simplement la première.
  const t = d.getTime();
  let best = rows[0]!;
  let bestGap = Math.abs(new Date(best.date_marche).getTime() - t);
  for (const r of rows.slice(1)) {
    const gap = Math.abs(new Date(r.date_marche).getTime() - t);
    if (gap < bestGap) { best = r; bestGap = gap; }
  }
  return best.cours_jour;
}

/** Bornes : première clôture de ANNEE_DEBUT, dernière clôture de ANNEE_FIN. */
async function bornes(code: string): Promise<{ debut: number; fin: number } | null> {
  const db = createPublicClient();

  const [{ data: d1 }, { data: d2 }] = await Promise.all([
    db.from('brvm_actions_daily').select('cours_jour').eq('code', code)
      .not('cours_jour', 'is', null)
      .gte('date_marche', `${ANNEE_DEBUT}-01-01`).order('date_marche', { ascending: true }).limit(1),
    db.from('brvm_actions_daily').select('cours_jour').eq('code', code)
      .not('cours_jour', 'is', null)
      .lte('date_marche', `${ANNEE_FIN}-12-31`).order('date_marche', { ascending: false }).limit(1),
  ]);

  const debut = ((d1 ?? [])[0] as { cours_jour: number } | undefined)?.cours_jour;
  const fin = ((d2 ?? [])[0] as { cours_jour: number } | undefined)?.cours_jour;
  if (!debut || !fin || debut <= 0 || fin <= 0) return null;
  return { debut, fin };
}

export async function buildTrueReturn(code: string): Promise<TrueReturnReport | null> {
  const db = createPublicClient();
  const CODE = code.toUpperCase();

  const b = await bornes(CODE);
  if (!b) return null;

  // Dividendes des exercices encaissés pendant la détention.
  const { data: divRows } = await db
    .from('dividends')
    .select('exercice, montant')
    .eq('code', CODE)
    .in('exercice', EXERCICES)
    .order('exercice', { ascending: true });

  const bruts = (divRows ?? []) as { exercice: number; montant: number }[];
  // Série incomplète → on ne calcule PAS. Un exercice manquant n'est pas un zéro.
  if (bruts.length !== EXERCICES.length) return null;

  // Cours de réinvestissement : ~30 juin de l'année de détachement (exercice + 1).
  // Le montant est NET (prélevé à la source par l'émetteur) — voir trueReturn.ts.
  const dividendes: DividendeExercice[] = [];
  for (const d of bruts) {
    const coursReinvest = await coursProche(CODE, `${d.exercice + 1}-06-30`);
    if (!coursReinvest || coursReinvest <= 0) return null; // pas de prix → pas de calcul
    dividendes.push({ exercice: d.exercice, montantNet: Number(d.montant), coursReinvest });
  }

  const { data: instr } = await db
    .from('brvm_instruments').select('designation').eq('code', CODE).maybeSingle();

  // Inflation réelle de chaque pays sur la fenêtre de DÉTENTION (2022-2025).
  const { data: inflRows } = await db
    .from('macro_inflation')
    .select('pays_code, pays_nom, annee, taux_pct')
    .gte('annee', ANNEE_DEBUT)
    .lte('annee', ANNEE_FIN);

  const parPays = new Map<string, { nom: string; taux: number[] }>();
  for (const r of (inflRows ?? []) as { pays_code: string; pays_nom: string; taux_pct: number }[]) {
    const e = parPays.get(r.pays_code) ?? { nom: r.pays_nom, taux: [] };
    e.taux.push(Number(r.taux_pct));
    parPays.set(r.pays_code, e);
  }

  const nbAnnees = ANNEE_FIN - ANNEE_DEBUT + 1;
  const pays: PaysRendement[] = [];

  for (const [iso3, { nom, taux }] of parPays) {
    if (taux.length < nbAnnees) continue; // série incomplète → pays écarté, pas complété

    const fiscal = ISO3_TO_FISCAL[iso3];
    // Le dividende étant déjà NET à la source, l'impôt ne se réapplique pas : la
    // différence entre pays vient uniquement de l'INFLATION propre à chacun.
    const resultat = computeTrueReturn({
      coursDebut: b.debut,
      coursFin: b.fin,
      dividendes,
      inflations: taux,
    });
    if (!resultat) continue;

    pays.push({
      iso3,
      nom: fiscal ? PAYS_LABELS[fiscal] : nom,
      resultat,
    });
  }

  // Du plus favorable au moins favorable : l'écart EST le message de l'écran.
  pays.sort((a, b2) => b2.resultat.vraiPct - a.resultat.vraiPct);

  return {
    code: CODE,
    designation: (instr as { designation: string | null } | null)?.designation ?? null,
    coursDebut: b.debut,
    coursFin: b.fin,
    dividendes,
    totalDividendesNets: dividendes.reduce((s, d) => s + d.montantNet, 0),
    pays,
  };
}
