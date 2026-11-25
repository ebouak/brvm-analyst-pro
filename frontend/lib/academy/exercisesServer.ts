import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { sma, rsi } from '@/lib/indicators';
import {
  buildPerExercise,
  buildRendementExercise,
  buildTrapChoice,
  buildCapitalisationExercise,
  buildCoutOrdreExercise,
  buildVariationExercise,
  buildPositionMoyenneExercise,
  buildRsiZoneChoice,
  buildEcartIpoExercise,
  type BuiltExercise,
  type ExerciseId,
  type TrapCandidate,
} from './exercises';

/**
 * Loaders des exercices live : branchés sur les données RÉELLES de la base
 * (cours de clôture, BPA alignés Sika, dividendes vérifiés). La correction
 * appelle le même loader → énoncé et corrigé partagent les mêmes données.
 */

type Db = ReturnType<typeof createPublicClient>;

async function lastClose(db: Db, code: string): Promise<{ cours: number; date: string } | null> {
  const { data } = await db
    .from('brvm_actions_daily')
    .select('cours_jour, date_marche')
    .eq('code', code)
    .not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const r = data as { cours_jour: number; date_marche: string } | null;
  return r ? { cours: r.cours_jour, date: r.date_marche } : null;
}

async function latestBpa(db: Db, code: string): Promise<number | null> {
  const { data } = await db
    .from('income_statements')
    .select('benefice_par_action, periode')
    .eq('code', code)
    .eq('type_periode', 'annuel')
    .not('benefice_par_action', 'is', null)
    .order('periode', { ascending: false })
    .limit(1)
    .maybeSingle();
  const bpa = (data as { benefice_par_action: number } | null)?.benefice_par_action ?? null;
  return bpa && bpa > 0 ? bpa : null;
}

async function netsSeries(db: Db, code: string): Promise<(number | null)[]> {
  const { data } = await db
    .from('income_statements')
    .select('resultat_net, periode')
    .eq('code', code)
    .eq('type_periode', 'annuel')
    .order('periode', { ascending: true });
  return ((data ?? []) as { resultat_net: number | null }[]).map((r) => r.resultat_net);
}

async function loadPerDuJour(db: Db): Promise<BuiltExercise | null> {
  for (const code of ['SNTS', 'SGBC', 'BICC', 'ORAC']) {
    const [px, bpa] = await Promise.all([lastClose(db, code), latestBpa(db, code)]);
    if (px && bpa) return buildPerExercise({ code, cours: px.cours, bpa, date: px.date });
  }
  return null;
}

async function loadRendementNet(db: Db): Promise<BuiltExercise | null> {
  for (const code of ['SNTS', 'SGBC', 'BOAB']) {
    const [{ data: div }, px] = await Promise.all([
      db.from('dividends')
        .select('montant, exercice')
        .eq('code', code)
        .not('ex_date', 'is', null)
        .gt('montant', 0)
        .order('exercice', { ascending: false })
        .limit(1)
        .maybeSingle(),
      lastClose(db, code),
    ]);
    const d = div as { montant: number; exercice: number } | null;
    if (d && px) {
      return buildRendementExercise({
        code, cours: px.cours, dividende: d.montant, exercice: d.exercice, date: px.date,
      });
    }
  }
  return null;
}

async function loadValueTrapPick(db: Db): Promise<BuiltExercise | null> {
  const codes: [string, string][] = [
    ['PALC', 'PALMCI'],
    ['SNTS', 'SONATEL'],
    ['SGBC', 'SGCI'],
  ];
  const candidates: TrapCandidate[] = [];
  for (const [code, nom] of codes) {
    const [px, bpa, nets] = await Promise.all([
      lastClose(db, code), latestBpa(db, code), netsSeries(db, code),
    ]);
    candidates.push({
      code, nom,
      per: px && bpa ? px.cours / bpa : null,
      nets,
    });
  }
  return buildTrapChoice(candidates);
}

async function lastCloses(
  db: Db,
  code: string,
  limit: number,
): Promise<{ cours: number; date: string }[]> {
  const { data } = await db
    .from('brvm_actions_daily')
    .select('cours_jour, date_marche')
    .eq('code', code)
    .not('cours_jour', 'is', null)
    .gt('cours_jour', 0)
    .order('date_marche', { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as { cours_jour: number; date_marche: string }[])
    .map((r) => ({ cours: Number(r.cours_jour), date: r.date_marche }))
    .reverse();
  return rows;
}

async function instrumentMeta(
  db: Db,
  code: string,
): Promise<{ nom: string; shares: number | null } | null> {
  const { data } = await db
    .from('brvm_instruments')
    .select('designation, shares')
    .eq('code', code)
    .maybeSingle();
  const r = data as { designation: string | null; shares: number | null } | null;
  if (!r) return null;
  return {
    nom: r.designation ?? code,
    shares: r.shares == null ? null : Number(r.shares),
  };
}

async function loadCapitalisationDuJour(db: Db): Promise<BuiltExercise | null> {
  for (const code of ['SNTS', 'ORAC', 'SGBC', 'ETIT']) {
    const [px, meta] = await Promise.all([lastClose(db, code), instrumentMeta(db, code)]);
    if (px && meta?.shares && meta.shares > 0) {
      return buildCapitalisationExercise({
        code,
        nom: meta.nom,
        cours: px.cours,
        shares: meta.shares,
        date: px.date,
      });
    }
  }
  return null;
}

async function loadCoutOrdreDuJour(db: Db): Promise<BuiltExercise | null> {
  for (const code of ['SNTS', 'SGBC', 'ORAC']) {
    const px = await lastClose(db, code);
    if (px && px.cours > 0) {
      return buildCoutOrdreExercise({
        code,
        cours: px.cours,
        quantite: 10,
        tauxPct: 1.5,
        minimumFcfa: 2500,
        date: px.date,
      });
    }
  }
  return null;
}

async function loadVariation20Seances(db: Db): Promise<BuiltExercise | null> {
  let fallback: BuiltExercise | null = null;
  for (const code of ['SNTS', 'ORAC', 'SGBC', 'BOAB', 'TTLS']) {
    const [series, meta] = await Promise.all([lastCloses(db, code, 21), instrumentMeta(db, code)]);
    if (series.length < 21) continue;
    const first = series[0]!;
    const last = series[series.length - 1]!;
    if (first.cours <= 0) continue;
    const ex = buildVariationExercise({
      code,
      nom: meta?.nom ?? code,
      coursInitial: first.cours,
      dateInitiale: first.date,
      coursFinal: last.cours,
      dateFinale: last.date,
      nbSeances: 20,
    });
    if (Math.abs(ex.expected) >= 1) return ex;
    fallback ??= ex;
  }
  return fallback;
}

async function loadPositionMoyenne20(db: Db): Promise<BuiltExercise | null> {
  let fallback: BuiltExercise | null = null;
  for (const code of ['SNTS', 'ORAC', 'SGBC', 'BOAB', 'TTLS']) {
    const [series, meta] = await Promise.all([lastCloses(db, code, 20), instrumentMeta(db, code)]);
    if (series.length < 20) continue;
    const closes = series.map((s) => s.cours);
    const mm20 = sma(closes, 20);
    const last = series[series.length - 1]!;
    if (!mm20 || mm20 <= 0) continue;
    const ex = buildPositionMoyenneExercise({
      code,
      nom: meta?.nom ?? code,
      cours: last.cours,
      mm20,
      date: last.date,
    });
    if (Math.abs(ex.expected) >= 1) return ex;
    fallback ??= ex;
  }
  return fallback;
}

async function loadRsiZoneDuJour(db: Db): Promise<BuiltExercise | null> {
  for (const code of ['SNTS', 'SGBC', 'ORAC', 'BOAB', 'TTLS']) {
    const [series, meta] = await Promise.all([lastCloses(db, code, 45), instrumentMeta(db, code)]);
    if (series.length < 15) continue;
    const rsiVal = rsi(series.map((s) => s.cours), 14);
    const last = series[series.length - 1]!;
    if (rsiVal != null && Number.isFinite(rsiVal)) {
      return buildRsiZoneChoice({
        code,
        nom: meta?.nom ?? code,
        rsi: rsiVal,
        date: last.date,
      });
    }
  }
  return null;
}

async function loadEcartIpoBbgc(db: Db): Promise<BuiltExercise | null> {
  const px = await lastClose(db, 'BBGC');
  if (!px || px.cours <= 0) return null;
  return buildEcartIpoExercise({
    cours: px.cours,
    date: px.date,
    prixIpo: 6750,
    code: 'BBGC',
    nom: 'Bridge Bank Group CI',
  });
}

/** Charge un exercice complet (énoncé + corrigé). Null si données insuffisantes. */
export async function loadExercise(id: string): Promise<BuiltExercise | null> {
  const db = createPublicClient();
  switch (id as ExerciseId) {
    case 'per-du-jour': return loadPerDuJour(db);
    case 'rendement-net': return loadRendementNet(db);
    case 'value-trap-pick': return loadValueTrapPick(db);
    case 'capitalisation-du-jour': return loadCapitalisationDuJour(db);
    case 'cout-ordre-du-jour': return loadCoutOrdreDuJour(db);
    case 'variation-20-seances': return loadVariation20Seances(db);
    case 'position-moyenne-20': return loadPositionMoyenne20(db);
    case 'rsi-zone-du-jour': return loadRsiZoneDuJour(db);
    case 'ecart-ipo-bbgc': return loadEcartIpoBbgc(db);
    default: return null;
  }
}
