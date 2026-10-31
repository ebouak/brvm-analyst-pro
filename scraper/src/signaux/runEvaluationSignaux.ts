import { appendFileSync } from 'node:fs';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { evaluerSignaux, formaterRapport, HORIZONS_DEFAUT, type PointCours, type PointSignal, type ResultatTranche } from './evaluation.js';

/**
 * Banc d'évaluation des signaux, en lecture seule (voir evaluation.ts).
 * Le rapport part dans le journal et, en CI, dans le résumé du run
 * ($GITHUB_STEP_SUMMARY) : c'est là qu'on lit le verdict chaque semaine.
 */
export async function runEvaluationSignaux(): Promise<{ resultats: ResultatTranche[]; rapport: string; nSignaux: number }> {
  const sb = getSupabase();
  const TAILLE = 1000;

  // PAGINATION OBLIGATOIRE : PostgREST tronque à 1000 lignes en silence ; des
  // statistiques sur la première page seraient fausses et plausibles.
  async function toutLire<T>(construire: (debut: number, fin: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    const lignes: T[] = [];
    for (let debut = 0; ; debut += TAILLE) {
      const { data, error } = await construire(debut, debut + TAILLE - 1);
      if (error) throw new Error(`lecture : ${error.message}`);
      const lot = (data ?? []) as T[];
      lignes.push(...lot);
      if (lot.length < TAILLE) break;
    }
    return lignes;
  }

  const brutsSignaux = await toutLire<{ code: string; date_marche: string; score_total: number | null }>((a, b) =>
    sb.from('signals_daily').select('code, date_marche, score_total')
      .not('score_total', 'is', null)
      .order('date_marche', { ascending: true }).order('code', { ascending: true })
      .range(a, b));
  const signaux: PointSignal[] = brutsSignaux.map((s) => ({ code: s.code, date: s.date_marche, score: Number(s.score_total) }));
  const premier = signaux[0];
  const dernier = signaux[signaux.length - 1];
  if (!premier || !dernier) throw new Error('aucun signal en base : rien à évaluer');
  const debut = premier.date;
  const fin = dernier.date;
  // Cours à partir du premier signal : les rendements regardent vers l'avant.
  const brutsCours = await toutLire<{ code: string; date_marche: string; cours_jour: number | null }>((a, b) =>
    sb.from('brvm_actions_daily').select('code, date_marche, cours_jour')
      .gte('date_marche', debut).gt('cours_jour', 0)
      .order('date_marche', { ascending: true }).order('code', { ascending: true })
      .range(a, b));
  const cours: PointCours[] = brutsCours.map((c) => ({ code: c.code, date: c.date_marche, cours: Number(c.cours_jour) }));

  const resultats = evaluerSignaux(signaux, cours, { horizons: HORIZONS_DEFAUT });
  const rapport = formaterRapport(resultats, { debut, fin, nSignaux: signaux.length });

  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${rapport}\n`);
  logger.info(
    {
      nSignaux: signaux.length,
      nCours: cours.length,
      debut,
      fin,
      prouves: resultats.filter((r) => r.verdict.startsWith('prouve')).map((r) => `${r.tranche.id}@${r.horizon}:${r.verdict}`),
    },
    'eval:signaux terminé',
  );
  return { resultats, rapport, nSignaux: signaux.length };
}
