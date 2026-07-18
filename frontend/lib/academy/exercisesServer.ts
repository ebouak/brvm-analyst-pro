import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import {
  buildPerExercise, buildRendementExercise, buildTrapChoice,
  type BuiltExercise, type ExerciseId, type TrapCandidate,
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

/** Charge un exercice complet (énoncé + corrigé). Null si données insuffisantes. */
export async function loadExercise(id: string): Promise<BuiltExercise | null> {
  const db = createPublicClient();
  switch (id as ExerciseId) {
    case 'per-du-jour': return loadPerDuJour(db);
    case 'rendement-net': return loadRendementNet(db);
    case 'value-trap-pick': return loadValueTrapPick(db);
    default: return null;
  }
}
