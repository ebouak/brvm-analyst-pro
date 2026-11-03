/**
 * Tour de contrôle : collecte des workflows GitHub Actions — logique PURE.
 *
 * Pourquoi : seules certaines commandes du scraper écrivent dans scraper_runs
 * (via `monitored`). alerts.yml, video-seance.yml, dossier.yml,
 * crm-sequences.yml… n'y apparaissent pas, et GitHub DÉSACTIVE en silence les
 * workflows planifiés d'un dépôt public après 60 jours sans activité. On lit
 * donc l'état réel chez GitHub lui-même (voir runOpsWorkflows.ts pour les I/O).
 *
 * Aucune donnée personnelle : noms de fichiers, états, horodatages, URL de runs.
 */

/* ------------------------------------------------------------------------- */
/* Réponses GitHub (champs utilisés seulement)                               */
/* ------------------------------------------------------------------------- */

/** Élément de `GET /repos/{o}/{r}/actions/workflows`. */
export interface WorkflowGitHub {
  id: number;
  name: string;
  /** Ex. '.github/workflows/alerts.yml' — ou 'dynamic/…' pour Dependabot. */
  path: string;
  /** active | deleted | disabled_fork | disabled_inactivity | disabled_manually */
  state: string;
}

export interface ListeWorkflowsGitHub {
  total_count: number;
  workflows: WorkflowGitHub[];
}

/** Élément de `GET /repos/{o}/{r}/actions/workflows/{id}/runs`. */
export interface RunGitHub {
  id: number;
  event: string;
  /** queued | in_progress | completed | waiting | requested | pending */
  status: string | null;
  /** success | failure | cancelled | skipped | timed_out | neutral | … ; null tant que non terminé */
  conclusion: string | null;
  run_started_at?: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface ListeRunsGitHub {
  total_count: number;
  workflow_runs: RunGitHub[];
}

/* ------------------------------------------------------------------------- */
/* Crons                                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Extrait les expressions `- cron: '…'` du bloc `schedule:` d'un workflow.
 *
 * Volontairement sans bibliothèque YAML : les workflows du dépôt n'utilisent
 * que la forme bloc (`schedule:` puis une liste `- cron:`). On lit les lignes
 * plus indentées que `schedule:` jusqu'à la première clé sœur ; commentaires
 * (pleins ou en fin de ligne) et lignes vides sont ignorés.
 */
export function crons(yamlTexte: string): string[] {
  const lignes = yamlTexte.split(/\r?\n/);
  const debut = lignes.findIndex((l) => /^\s*schedule:\s*(#.*)?$/.test(l));
  if (debut < 0) return [];
  const indentSchedule = indentation(lignes[debut] ?? '');

  const out: string[] = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i] ?? '';
    if (l.trim() === '' || /^\s*#/.test(l)) continue;
    if (indentation(l) <= indentSchedule) break;
    const m = /^\s*-\s*cron:\s*(.*)$/.exec(l);
    if (!m) continue;
    const v = valeurCron(m[1] ?? '');
    if (v) out.push(v);
  }
  return out;
}

function indentation(l: string): number {
  return /^[ \t]*/.exec(l)?.[0].length ?? 0;
}

function valeurCron(brut: string): string | null {
  const s = brut.trim();
  const q = s[0];
  if (q === "'" || q === '"') {
    const fin = s.indexOf(q, 1);
    if (fin < 0) return null;
    return s.slice(1, fin).trim() || null;
  }
  // Valeur nue : un cron ne contient jamais « # », tout ce qui suit est commentaire.
  return s.replace(/\s+#.*$/, '').trim() || null;
}

/* ------------------------------------------------------------------------- */
/* Runs                                                                       */
/* ------------------------------------------------------------------------- */

/** Conclusions qui comptent comme un échec. */
const ECHECS = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
// Les autres conclusions (cancelled — souvent une annulation par `concurrency` —,
// skipped, neutral, stale) sont NEUTRES : ni échec, ni remise à zéro.

export interface DernierRun {
  id: number;
  evenement: string;
  status: string | null;
  conclusion: string | null;
  debut: string;
  /** null tant que le run n'est pas terminé. */
  fin: string | null;
  url: string;
}

export interface ResumeRuns {
  /** Le plus récent, terminé ou non. */
  dernier: DernierRun | null;
  /** Fin du dernier run réussi DANS LA FENÊTRE lue (20 runs) ; null sinon. */
  dernierSuccesAt: string | null;
  /**
   * Échecs terminés depuis le dernier succès. Sans succès dans la fenêtre,
   * c'est un minorant (tous les échecs de la fenêtre).
   */
  echecsConsecutifs: number;
}

export function resumerRuns(runs: RunGitHub[]): ResumeRuns {
  const tries = [...runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const premier = tries[0];
  const dernier: DernierRun | null = premier
    ? {
        id: premier.id,
        evenement: premier.event,
        status: premier.status,
        conclusion: premier.conclusion,
        debut: premier.run_started_at ?? premier.created_at,
        fin: premier.status === 'completed' ? premier.updated_at : null,
        url: premier.html_url,
      }
    : null;

  let echecsConsecutifs = 0;
  let dernierSuccesAt: string | null = null;
  for (const r of tries) {
    if (r.status !== 'completed') continue; // en cours : ni échec ni succès
    if (r.conclusion === 'success') {
      dernierSuccesAt = r.updated_at;
      break;
    }
    if (r.conclusion && ECHECS.has(r.conclusion)) echecsConsecutifs++;
  }
  return { dernier, dernierSuccesAt, echecsConsecutifs };
}

/* ------------------------------------------------------------------------- */
/* Ligne ops_workflows                                                        */
/* ------------------------------------------------------------------------- */

export type EtatWorkflow = 'active' | 'disabled_manually' | 'disabled_inactivity' | 'deleted' | 'autre';

const ETATS: ReadonlySet<string> = new Set(['active', 'disabled_manually', 'disabled_inactivity', 'deleted']);

export function etatWorkflow(state: string): EtatWorkflow {
  return ETATS.has(state) ? (state as EtatWorkflow) : 'autre';
}

const PREFIXE = '.github/workflows/';

/** 'alerts.yml' pour un fichier du dépôt ; chemin tel quel pour un workflow dynamique (Dependabot). */
export function fichierWorkflow(path: string): string {
  return path.startsWith(PREFIXE) ? path.slice(PREFIXE.length) : path;
}

/** Reflète EXACTEMENT les colonnes de la migration 0187_ops_workflows.sql. */
export interface LigneOpsWorkflow {
  fichier: string;
  nom: string;
  etat: EtatWorkflow;
  crons: string[];
  dernier_run_id: number | null;
  dernier_evenement: string | null;
  dernier_statut: string | null;
  derniere_conclusion: string | null;
  dernier_debut: string | null;
  derniere_fin: string | null;
  dernier_url: string | null;
  dernier_succes_at: string | null;
  echecs_consecutifs: number;
  collecte_at: string;
}

export function ligneOpsWorkflow(
  wf: WorkflowGitHub,
  listeCrons: string[],
  resume: ResumeRuns,
  collecteAt: string,
): LigneOpsWorkflow {
  const d = resume.dernier;
  return {
    fichier: fichierWorkflow(wf.path),
    nom: wf.name,
    etat: etatWorkflow(wf.state),
    crons: listeCrons,
    dernier_run_id: d?.id ?? null,
    dernier_evenement: d?.evenement ?? null,
    dernier_statut: d?.status ?? null,
    derniere_conclusion: d?.conclusion ?? null,
    dernier_debut: d?.debut ?? null,
    derniere_fin: d?.fin ?? null,
    // La table impose 'https://github.com/%' : une autre URL serait rejetée et
    // ferait échouer tout le lot — on la laisse vide plutôt.
    dernier_url: d && d.url.startsWith('https://github.com/') ? d.url : null,
    dernier_succes_at: resume.dernierSuccesAt,
    echecs_consecutifs: resume.echecsConsecutifs,
    collecte_at: collecteAt,
  };
}
