import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WorkflowAutorise {
  alias: string;
  fichier: string;
  libelle: string;
  description: string;
  workflowSuivant?: string;
}

export const WORKFLOWS_AUTORISES: readonly WorkflowAutorise[] = [
  {
    alias: 'ops-controle',
    fichier: 'ops-controle.yml',
    libelle: 'Collecte workflows',
    description: 'Recollecte l’état de tous les workflows GitHub dans ops_workflows.',
  },
  {
    alias: 'daily-brvm',
    fichier: 'daily-brvm.yml',
    libelle: 'Collecte BRVM quotidienne',
    description: 'Scrape les cours de clôture et indices BRVM.',
    workflowSuivant: 'score',
  },
  {
    alias: 'daily',
    fichier: 'daily.yml',
    libelle: 'Consolidation clôture',
    description: 'Consolide la séance quotidienne.',
    workflowSuivant: 'score',
  },
  {
    alias: 'score',
    fichier: 'score.yml',
    libelle: 'Calcul signaux',
    description: 'Recalcule signals_daily et liquidité.',
    workflowSuivant: 'alerts',
  },
  {
    alias: 'alerts',
    fichier: 'alerts.yml',
    libelle: 'Évaluation & envoi alertes',
    description: 'Évalue et envoie les alertes utilisateurs.',
  },
  {
    alias: 'controle-boc',
    fichier: 'controle-boc.yml',
    libelle: 'Contrôle BOC',
    description: 'Collecte le Bulletin Officiel de la Cote et contrôle les écarts.',
  },
  {
    alias: 'coherence',
    fichier: 'coherence.yml',
    libelle: 'Balayage cohérence',
    description: 'Vérifie la cohérence des fiches société.',
  },
  {
    alias: 'video-seance',
    fichier: 'video-seance.yml',
    libelle: 'Vidéo de séance',
    description: 'Génère et publie la vidéo quotidienne de clôture.',
  },
  {
    alias: 'carnet',
    fichier: 'carnet.yml',
    libelle: 'Carnet d’ordres',
    description: 'Collecte le carnet d’ordres BRVM.',
  },
  {
    alias: 'intraday',
    fichier: 'intraday.yml',
    libelle: 'Collecte intraday',
    description: 'Passage ponctuel des cours en séance.',
  },
  {
    alias: 'sante-llm',
    fichier: 'sante-llm.yml',
    libelle: 'Santé fournisseurs LLM',
    description: 'Vérifie DeepSeek, Gemini et Grok.',
  },
  {
    alias: 'whatsapp-sante',
    fichier: 'whatsapp-sante.yml',
    libelle: 'Santé passerelle WhatsApp',
    description: 'Sonde la session WAHA WhatsApp.',
  },
  {
    alias: 'e2e',
    fichier: 'e2e.yml',
    libelle: 'Tests E2E Playwright',
    description: 'Lance la suite E2E nocturne.',
  },
  {
    alias: 'hebdo',
    fichier: 'hebdo.yml',
    libelle: 'Rapports hebdo',
    description: 'Génère les synthèses hebdomadaires.',
  },
  {
    alias: 'articles',
    fichier: 'articles.yml',
    libelle: 'Articles de presse',
    description: 'Collecte et publie les décryptages presse.',
  },
  {
    alias: 'dossier',
    fichier: 'dossier.yml',
    libelle: 'Dossiers valeurs',
    description: 'Génère et envoie les dossiers PDF par valeur.',
  },
  {
    alias: 'crm-sequences',
    fichier: 'crm-sequences.yml',
    libelle: 'Séquences CRM',
    description: 'Exécute les relances CRM planifiées.',
  },
];

export function resoudreWorkflow(entree: string): WorkflowAutorise | null {
  const norm = entree.trim().toLowerCase().replace(/^\/+/, '');
  if (!norm) return null;
  return (
    WORKFLOWS_AUTORISES.find((w) => w.alias === norm || w.fichier.toLowerCase() === norm) ?? null
  );
}

function getGithubRepo(): string {
  return process.env.GITHUB_OPS_REPO?.trim() || 'ebouak/brvm-analyst-pro';
}

export interface DispatchResult {
  ok: boolean;
  correlationId?: string;
  workflow?: WorkflowAutorise;
  erreur?: string;
  dejaEnCours?: boolean;
}

export async function declencherWorkflowGithub(
  db: SupabaseClient,
  opts: {
    aliasOuFichier: string;
    chatId: number;
    source: 'telegram' | 'admin_ui' | 'cron';
    messageId?: number;
    actorUserId?: string;
  },
): Promise<DispatchResult> {
  const wf = resoudreWorkflow(opts.aliasOuFichier);
  if (!wf) {
    return {
      ok: false,
      erreur: `Workflow « ${opts.aliasOuFichier} » hors liste blanche.`,
    };
  }

  const token = process.env.GITHUB_OPS_TOKEN?.trim();
  if (!token) {
    return { ok: false, workflow: wf, erreur: 'GITHUB_OPS_TOKEN non configuré sur le serveur.' };
  }

  // Verrou anti-doublon (10 minutes) sur ce workflow.
  const depuis10m = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: enCours } = await db
    .from('ops_command_runs')
    .select('id, cree_le')
    .eq('workflow_fichier', wf.fichier)
    .eq('statut', 'en_cours')
    .gte('cree_le', depuis10m)
    .limit(1)
    .maybeSingle();

  if (enCours) {
    return {
      ok: false,
      workflow: wf,
      dejaEnCours: true,
      erreur: `${wf.fichier} a déjà été déclenché il y a moins de 10 minutes.`,
    };
  }

  const correlationId = randomUUID();
  const { data: runRow } = await db
    .from('ops_command_runs')
    .insert({
      chat_id: opts.chatId,
      source: opts.source,
      commande: 'relancer',
      args: { alias: wf.alias, fichier: wf.fichier },
      statut: 'en_cours',
      niveau_risque: 1,
      workflow_fichier: wf.fichier,
      correlation_id: correlationId,
      telegram_message_id: opts.messageId ?? null,
    })
    .select('id')
    .maybeSingle();

  const repo = getGithubRepo();
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(wf.fichier)}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!resp.ok) {
      const errText = (await resp.text().catch(() => '')).slice(0, 200);
      if (runRow?.id) {
        await db
          .from('ops_command_runs')
          .update({
            statut: 'echec',
            erreur: `GitHub HTTP ${resp.status} ${errText}`.trim(),
            maj_le: new Date().toISOString(),
          })
          .eq('id', runRow.id);
      }
      return {
        ok: false,
        workflow: wf,
        erreur: `GitHub a refusé le lancement (HTTP ${resp.status}).`,
      };
    }

    await db.from('admin_audit_logs').insert({
      actor_user_id: opts.actorUserId ?? null,
      actor_role: opts.source === 'telegram' ? 'telegram_ops' : 'admin',
      action: 'ops.workflow.dispatch',
      resource_type: 'github_workflow',
      resource_id: wf.fichier,
      severity: 'warning',
      metadata: {
        source: opts.source,
        chat_id: opts.source === 'telegram' ? opts.chatId : null,
        correlation_id: correlationId,
      },
    });

    return { ok: true, correlationId, workflow: wf };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runRow?.id) {
      await db
        .from('ops_command_runs')
        .update({ statut: 'echec', erreur: msg, maj_le: new Date().toISOString() })
        .eq('id', runRow.id);
    }
    return { ok: false, workflow: wf, erreur: `Erreur réseau GitHub : ${msg}` };
  }
}

export interface DernierRunInfo {
  fichier: string;
  statut: string;
  conclusion: string | null;
  url: string;
  creeLe: string;
  etapeEchec: string | null;
}

export async function lireDernierRunWorkflow(fichier: string): Promise<DernierRunInfo | null> {
  const token = process.env.GITHUB_OPS_TOKEN?.trim();
  const repo = getGithubRepo();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(fichier)}/runs?per_page=1`,
      { headers, signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) return null;
    const j = (await r.json().catch(() => ({}))) as {
      workflow_runs?: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        html_url: string;
        created_at: string;
        jobs_url: string;
      }>;
    };
    const run = j.workflow_runs?.[0];
    if (!run) return null;

    let etapeEchec: string | null = null;
    if (run.conclusion && run.conclusion !== 'success' && run.jobs_url) {
      const jr = await fetch(run.jobs_url, { headers, signal: AbortSignal.timeout(8_000) }).catch(
        () => null,
      );
      if (jr?.ok) {
        const jj = (await jr.json().catch(() => ({}))) as {
          jobs?: Array<{
            name: string;
            conclusion: string | null;
            steps?: Array<{ name: string; conclusion: string | null }>;
          }>;
        };
        for (const job of jj.jobs ?? []) {
          const failedStep = (job.steps ?? []).find(
            (s) => s.conclusion && s.conclusion !== 'success' && s.conclusion !== 'skipped',
          );
          if (failedStep) {
            etapeEchec = `${job.name} → ${failedStep.name} (${failedStep.conclusion})`;
            break;
          }
          if (job.conclusion && job.conclusion !== 'success') {
            etapeEchec = `${job.name} (${job.conclusion})`;
            break;
          }
        }
      }
    }

    return {
      fichier,
      statut: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      creeLe: run.created_at,
      etapeEchec,
    };
  } catch {
    return null;
  }
}
