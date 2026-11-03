/**
 * Tour de contrôle : collecte des workflows GitHub Actions → ops_workflows.
 *
 * Lit chez GitHub (jeton natif GITHUB_TOKEN du workflow, AUCUN jeton
 * personnel) la liste des workflows et leurs 20 derniers runs, lit les crons
 * dans le checkout local, puis upsert une ligne par workflow (clé `fichier`).
 *
 * Échec BRUYANT : une erreur d'API ou d'upsert LÈVE — le run passe rouge et
 * `monitored` l'enregistre. Une photo partielle présentée comme complète
 * serait pire que pas de photo.
 *
 * DRY_RUN=true : collecte et affiche, n'écrit rien.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../config.js';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import {
  crons,
  resumerRuns,
  ligneOpsWorkflow,
  type LigneOpsWorkflow,
  type ListeRunsGitHub,
  type ListeWorkflowsGitHub,
  type WorkflowGitHub,
} from './workflows.js';

const API = 'https://api.github.com';
const USER_AGENT = 'westbourse-ops-controle/1.0 (+https://www.westbourse.com)';
const DEPOT_DEFAUT = 'ebouak/brvm-analyst-pro';
const RUNS_PAR_WORKFLOW = 20;

export interface ResultatOpsWorkflows {
  depot: string;
  lignes: LigneOpsWorkflow[];
  ecrits: number;
  dryRun: boolean;
}

export interface OptionsOpsWorkflows {
  /** Défaut : GITHUB_REPOSITORY, sinon 'ebouak/brvm-analyst-pro'. */
  depot?: string;
  /** Racine du dépôt (là où vit .github/workflows). Défaut : déduite de ce fichier. */
  racine?: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}

/** src/ops/runOpsWorkflows.ts → racine du dépôt (trois niveaux au-dessus). */
function racineParDefaut(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

export async function runOpsWorkflows(opts: OptionsOpsWorkflows = {}): Promise<ResultatOpsWorkflows> {
  const jeton = process.env.GITHUB_TOKEN;
  if (!jeton) throw new Error('GITHUB_TOKEN manquant : impossible de lire les workflows GitHub.');
  const depot = opts.depot ?? (process.env.GITHUB_REPOSITORY || DEPOT_DEFAUT);
  if (!/^[\w.-]+\/[\w.-]+$/.test(depot)) throw new Error(`Dépôt invalide : ${depot}`);
  const racine = opts.racine ?? racineParDefaut();
  const dryRun = opts.dryRun ?? getConfig().DRY_RUN;
  const f = opts.fetchImpl ?? fetch;

  async function get<T>(chemin: string): Promise<T> {
    const res = await f(`${API}${chemin}`, {
      headers: {
        Authorization: `Bearer ${jeton}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) {
      // Le corps d'erreur GitHub ne contient pas le jeton ; tronqué par prudence.
      const corps = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`GitHub ${res.status} sur ${chemin} : ${corps}`);
    }
    return (await res.json()) as T;
  }

  // 1. Liste complète des workflows (pagination).
  const workflows: WorkflowGitHub[] = [];
  for (let page = 1; ; page++) {
    const r = await get<ListeWorkflowsGitHub>(`/repos/${depot}/actions/workflows?per_page=100&page=${page}`);
    workflows.push(...r.workflows);
    if (r.workflows.length === 0 || workflows.length >= r.total_count) break;
    if (page > 20) throw new Error('Pagination des workflows anormalement longue (> 2000).');
  }

  // 2. Pour chacun : crons locaux + 20 derniers runs DE LA BRANCHE PAR DÉFAUT,
  //    pull requests exclues. Sans ce filtre, deux échecs d'e2e sur une branche
  //    de travail faisaient crier la Tour de contrôle pour une production saine,
  //    et un succès sur une branche masquait de vrais échecs sur main.
  const { default_branch } = await get<{ default_branch?: string }>(`/repos/${depot}`);
  const branche = encodeURIComponent(default_branch || 'main');
  const collecteAt = new Date().toISOString();
  const lignes: LigneOpsWorkflow[] = [];
  for (const wf of workflows) {
    const listeCrons = await lireCrons(racine, wf);
    const runs = await get<ListeRunsGitHub>(
      `/repos/${depot}/actions/workflows/${wf.id}/runs?per_page=${RUNS_PAR_WORKFLOW}&branch=${branche}&exclude_pull_requests=true`,
    );
    lignes.push(ligneOpsWorkflow(wf, listeCrons, resumerRuns(runs.workflow_runs), collecteAt));
  }

  // Deux workflows ne peuvent pas partager une clé : un doublon ferait rejeter tout le lot.
  const vus = new Set<string>();
  for (const l of lignes) {
    if (vus.has(l.fichier)) throw new Error(`Fichier de workflow en double : ${l.fichier}`);
    vus.add(l.fichier);
  }

  if (dryRun) {
    logger.info({ depot, workflows: lignes.length }, 'ops:workflows — DRY_RUN, aucune écriture');
    for (const l of lignes) {
      console.log(
        `${l.fichier.padEnd(32)} ${l.etat.padEnd(20)} ${String(l.derniere_conclusion ?? l.dernier_statut ?? '—').padEnd(12)} ` +
          `échecs=${l.echecs_consecutifs} crons=[${l.crons.join(' | ')}]`,
      );
    }
    return { depot, lignes, ecrits: 0, dryRun };
  }

  const { error } = await getSupabase().from('ops_workflows').upsert(lignes, { onConflict: 'fichier' });
  if (error) throw new Error(`Upsert ops_workflows : ${error.message}`);
  logger.info({ depot, ecrits: lignes.length }, 'ops:workflows — collecte écrite');
  return { depot, lignes, ecrits: lignes.length, dryRun };
}

/**
 * Crons d'un workflow lus dans le checkout. Un workflow dynamique (Dependabot)
 * ou un fichier absent du checkout (supprimé, ou seulement sur une autre
 * branche) n'a pas de planification lisible : liste vide, signalée.
 */
async function lireCrons(racine: string, wf: WorkflowGitHub): Promise<string[]> {
  if (!wf.path.startsWith('.github/workflows/') || wf.path.includes('..')) return [];
  try {
    return crons(await readFile(join(racine, wf.path), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      if (wf.state !== 'deleted') logger.warn({ path: wf.path }, 'ops:workflows — fichier absent du checkout');
      return [];
    }
    throw e;
  }
}
