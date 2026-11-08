import { exerciceRetenu, type ExerciceRetenu } from './exerciceRetenu';

type Sb = { from: (t: string) => any };

/**
 * Chargeur serveur : lit les trois tables et délègue à `exerciceRetenu`.
 * Une lecture en erreur LÈVE (pas de repli silencieux sur « aucune donnée »).
 */
export async function chargerExerciceRetenu(sb: Sb, code: string): Promise<ExerciceRetenu> {
  const [inc, bil, fon] = await Promise.all([
    sb.from('income_statements').select('periode, resultat_net, revenu_total').eq('code', code).eq('type_periode', 'annuel').order('periode', { ascending: false }).limit(10),
    sb.from('balance_sheets').select('periode, total_capitaux_propres, dette_court_terme, dette_long_terme').eq('code', code).eq('type_periode', 'annuel').order('periode', { ascending: false }).limit(10),
    sb.from('fundamentals').select('year, revenue, net_income, equity, debt').eq('code', code).order('year', { ascending: false }).limit(10),
  ]);
  for (const r of [inc, bil, fon]) if (r.error) throw new Error(`exerciceRetenu(${code}) : ${r.error.message}`);
  return exerciceRetenu({ income: inc.data ?? [], balance: bil.data ?? [], fundamentals: fon.data ?? [] });
}
