import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { StatutRun } from './verdict';

/**
 * Lecture des résultats de tests pour /admin/qualite (service_role, serveur
 * seul — les tables qa_* n'ont aucune policy). Les pages appellent d'abord
 * requirePermission('qa.read'). Toute erreur LÈVE : la page affiche un état
 * d'erreur plutôt qu'un tableau vide qui passerait pour « aucun test ».
 */

export const PAR_PAGE = 20;

export interface RunLigne {
  id: string;
  ci_run_id: string;
  ci_tentative: number;
  ci_url: string | null;
  workflow: string | null;
  branche: string | null;
  commit_sha: string;
  environnement: 'ci' | 'preview' | 'production';
  statut: StatutRun;
  motif: string | null;
  debut_at: string;
  fin_at: string | null;
  duree_ms: number | null;
  nb_reussis: number;
  nb_echoues: number;
  nb_intermittents: number;
  nb_ignores: number;
  playwright_version: string | null;
}

export interface ResultatLigne {
  id: string;
  run_id: string;
  test_cle: string;
  module: string;
  fichier: string;
  titre: string;
  projet: string | null;
  statut_final: 'reussi' | 'echoue' | 'intermittent' | 'ignore';
  duree_ms: number | null;
  nb_tentatives: number;
}

export interface ArtefactLigne {
  id: string;
  type: 'capture' | 'trace' | 'video' | 'rapport_html';
  statut: 'attendu' | 'televerse' | 'purge';
}

export interface TentativeLigne {
  id: string;
  numero: number;
  statut: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  debut_at: string | null;
  duree_ms: number | null;
  erreur: string | null;
  qa_artefacts: ArtefactLigne[];
}

export type FiltreVerdict = 'succes' | 'intermittent' | 'echec' | 'aucun_test' | 'erreur_infra' | 'interrompu' | 'en_cours';
export const FILTRES_VERDICT: FiltreVerdict[] = ['succes', 'intermittent', 'echec', 'aucun_test', 'erreur_infra', 'interrompu', 'en_cours'];
export const ENVIRONNEMENTS = ['ci', 'preview', 'production'] as const;
const MODULE = /^[a-z0-9-]{1,60}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLONNES_RUN =
  'id, ci_run_id, ci_tentative, ci_url, workflow, branche, commit_sha, environnement, statut, motif, debut_at, fin_at, duree_ms, nb_reussis, nb_echoues, nb_intermittents, nb_ignores, playwright_version';

const echec = (quoi: string, e: { message: string } | null) => {
  if (e) throw new Error(`${quoi} : ${e.message}`);
};

export interface FiltresTableau {
  page: number;
  environnement?: string;
  verdict?: string;
  module?: string;
}

export async function chargerTableau(f: FiltresTableau) {
  const db = getServiceClient();

  const { data: derniere, error: e1 } = await db.from('qa_runs').select(COLONNES_RUN).order('debut_at', { ascending: false }).limit(1).maybeSingle();
  echec('dernière exécution', e1);

  const { data: mods, error: e2 } = await db.from('qa_resultats').select('module').limit(2000);
  echec('modules', e2);
  const modules = [...new Set((mods ?? []).map((m) => m.module as string))].sort();

  let q = db.from('qa_runs').select(COLONNES_RUN, { count: 'exact' });
  if (f.environnement && (ENVIRONNEMENTS as readonly string[]).includes(f.environnement)) q = q.eq('environnement', f.environnement);

  switch (f.verdict as FiltreVerdict | undefined) {
    case 'succes': q = q.eq('statut', 'termine').eq('nb_echoues', 0).eq('nb_intermittents', 0).gt('nb_reussis', 0); break;
    case 'intermittent': q = q.eq('statut', 'termine').eq('nb_echoues', 0).gt('nb_intermittents', 0); break;
    case 'echec': q = q.eq('statut', 'termine').gt('nb_echoues', 0); break;
    case 'aucun_test': q = q.eq('statut', 'termine').eq('nb_echoues', 0).eq('nb_intermittents', 0).eq('nb_reussis', 0); break;
    case 'erreur_infra': q = q.eq('statut', 'erreur_infra'); break;
    case 'interrompu': q = q.eq('statut', 'interrompu'); break;
    case 'en_cours': q = q.eq('statut', 'en_cours'); break;
  }

  if (f.module && MODULE.test(f.module)) {
    const { data: ids, error } = await db.from('qa_resultats').select('run_id').eq('module', f.module).limit(5000);
    echec('filtre module', error);
    const runIds = [...new Set((ids ?? []).map((r) => r.run_id as string))];
    if (runIds.length === 0) return { derniere: (derniere as RunLigne | null) ?? null, runs: [] as RunLigne[], total: 0, modules };
    q = q.in('id', runIds);
  }

  const page = Math.max(1, Math.floor(f.page) || 1);
  const { data: runs, count, error: e3 } = await q
    .order('debut_at', { ascending: false })
    .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1);
  echec('historique', e3);

  return { derniere: (derniere as RunLigne | null) ?? null, runs: (runs ?? []) as RunLigne[], total: count ?? 0, modules };
}

const ORDRE: Record<ResultatLigne['statut_final'], number> = { echoue: 0, intermittent: 1, reussi: 2, ignore: 3 };

export async function chargerRun(id: string, f: { module?: string; statut?: string }) {
  if (!UUID.test(id)) return null;
  const db = getServiceClient();
  const { data: run, error } = await db.from('qa_runs').select(COLONNES_RUN).eq('id', id).maybeSingle();
  echec('exécution', error);
  if (!run) return null;

  let q = db.from('qa_resultats').select('id, run_id, test_cle, module, fichier, titre, projet, statut_final, duree_ms, nb_tentatives').eq('run_id', id);
  if (f.module && MODULE.test(f.module)) q = q.eq('module', f.module);
  if (f.statut && f.statut in ORDRE) q = q.eq('statut_final', f.statut);
  const { data: resultats, error: e2 } = await q.limit(1000);
  echec('résultats', e2);

  const { data: tous, error: e3 } = await db.from('qa_resultats').select('module').eq('run_id', id).limit(1000);
  echec('modules', e3);

  const { data: rapports, error: e4 } = await db.from('qa_artefacts').select('id, type, statut').eq('run_id', id).eq('type', 'rapport_html').limit(1);
  echec('rapport', e4);

  const tries = ((resultats ?? []) as ResultatLigne[]).sort(
    (a, b) => ORDRE[a.statut_final] - ORDRE[b.statut_final] || a.titre.localeCompare(b.titre, 'fr'),
  );
  return {
    run: run as RunLigne,
    resultats: tries,
    modules: [...new Set((tous ?? []).map((m) => m.module as string))].sort(),
    rapport: ((rapports ?? [])[0] as ArtefactLigne | undefined) ?? null,
  };
}

export async function chargerResultat(id: string) {
  if (!UUID.test(id)) return null;
  const db = getServiceClient();
  const { data: resultat, error } = await db
    .from('qa_resultats')
    .select('id, run_id, test_cle, module, fichier, titre, projet, statut_final, duree_ms, nb_tentatives')
    .eq('id', id)
    .maybeSingle();
  echec('scénario', error);
  if (!resultat) return null;
  const r = resultat as ResultatLigne;

  const { data: run, error: e1 } = await db.from('qa_runs').select(COLONNES_RUN).eq('id', r.run_id).single();
  echec('exécution', e1);

  const { data: tentatives, error: e2 } = await db
    .from('qa_tentatives')
    .select('id, numero, statut, debut_at, duree_ms, erreur, qa_artefacts(id, type, statut)')
    .eq('resultat_id', id)
    .order('numero', { ascending: true });
  echec('tentatives', e2);

  // Historique du MÊME scénario sur les dernières exécutions : c'est ce qui
  // distingue un test intermittent d'une régression franche.
  const { data: hist, error: e3 } = await db
    .from('qa_resultats')
    .select('id, statut_final, qa_runs(id, debut_at, commit_sha, environnement)')
    .eq('test_cle', r.test_cle)
    .limit(100);
  echec('historique du scénario', e3);
  const historique = ((hist ?? []) as unknown as Array<{ id: string; statut_final: ResultatLigne['statut_final']; qa_runs: { id: string; debut_at: string; commit_sha: string; environnement: string } | null }>)
    .filter((h) => h.qa_runs)
    .sort((a, b) => b.qa_runs!.debut_at.localeCompare(a.qa_runs!.debut_at))
    .slice(0, 20);

  return { resultat: r, run: run as RunLigne, tentatives: (tentatives ?? []) as unknown as TentativeLigne[], historique };
}
