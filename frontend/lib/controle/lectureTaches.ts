import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { DonneesTaches, EtatWorkflow, LigneWorkflow } from './taches';

/**
 * Chargeur serveur du domaine « tâches » de la Tour de contrôle.
 *
 * LÈVE dès qu'une lecture échoue — table absente (ops_workflows tant que sa
 * migration n'est pas appliquée), clé manquante, base indisponible. La page en
 * fait un signal « inconnu » : une source illisible n'est jamais montrée saine.
 *
 * scraper_runs est agrégé par comptages (`head: true`), pas en rapatriant les
 * lignes : PostgREST tronque à 1000 en silence, et un total tronqué ferait
 * baisser le taux d'échec sans que rien ne le signale.
 */

const ETATS: readonly EtatWorkflow[] = ['active', 'disabled_manually', 'disabled_inactivity', 'deleted', 'autre'];

function versLigne(r: Record<string, unknown>): LigneWorkflow {
  const etat = String(r.etat ?? 'autre');
  const runId = r.dernier_run_id;
  return {
    fichier: String(r.fichier),
    nom: (r.nom as string | null) ?? null,
    etat: (ETATS as readonly string[]).includes(etat) ? (etat as EtatWorkflow) : 'autre',
    crons: Array.isArray(r.crons) ? (r.crons as unknown[]).map(String) : [],
    dernier_run_id: runId === null || runId === undefined ? null : Number(runId),
    dernier_evenement: (r.dernier_evenement as string | null) ?? null,
    dernier_statut: (r.dernier_statut as string | null) ?? null,
    derniere_conclusion: (r.derniere_conclusion as string | null) ?? null,
    dernier_debut: (r.dernier_debut as string | null) ?? null,
    derniere_fin: (r.derniere_fin as string | null) ?? null,
    dernier_url: (r.dernier_url as string | null) ?? null,
    dernier_succes_at: (r.dernier_succes_at as string | null) ?? null,
    echecs_consecutifs: Number(r.echecs_consecutifs ?? 0),
    collecte_at: (r.collecte_at as string | null) ?? null,
  };
}

export async function chargerTaches(maintenant: Date = new Date()): Promise<DonneesTaches> {
  const db = getServiceClient();
  const depuis = new Date(maintenant.getTime() - 24 * 3600_000).toISOString();

  const bloqueAvant = new Date(maintenant.getTime() - 2 * 3600_000).toISOString();

  // La collecte horaire des workflows écrit elle-même dans scraper_runs : on
  // l'exclut des comptes, sinon elle dilue le taux d'échec de 24 lignes par jour.
  const src = await db.from('scraper_sources').select('id').eq('code', 'ops-workflows').maybeSingle();
  if (src.error) throw new Error(`scraper_sources illisible : ${src.error.message}`);
  const idCollecte = (src.data?.id as string | undefined) ?? null;
  const compter = (filtre: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const q = filtre(base());
    return idCollecte ? q.neq('source_id', idCollecte) : q;
  };
  function base() {
    return db.from('scraper_runs').select('id', { count: 'exact', head: true });
  }

  const [wf, total, echecs, dernier, partiels, bloques, plusAncienBloque] = await Promise.all([
    db.from('ops_workflows').select('*').order('fichier'),
    // Les runs encore « running » ne sont ni un succès ni un échec : exclus du total.
    compter((q) => q.gte('started_at', depuis).neq('status', 'running')),
    compter((q) => q.gte('started_at', depuis).eq('status', 'failed')),
    db.from('scraper_runs').select('started_at').gte('started_at', depuis).eq('status', 'failed').order('started_at', { ascending: false }).limit(1),
    compter((q) => q.gte('started_at', depuis).eq('status', 'partial')),
    // Sans borne de 24 h : un job tué reste « running » pour toujours.
    base().eq('status', 'running').lt('started_at', bloqueAvant),
    db.from('scraper_runs').select('started_at').eq('status', 'running').lt('started_at', bloqueAvant).order('started_at', { ascending: true }).limit(1),
  ]);

  if (wf.error) throw new Error(`ops_workflows illisible : ${wf.error.message}`);
  const lectures = { total, échecs: echecs, 'dernier échec': dernier, partiels, bloqués: bloques, 'plus ancien bloqué': plusAncienBloque };
  for (const [quoi, r] of Object.entries(lectures)) {
    if (r.error) throw new Error(`scraper_runs illisible (${quoi}) : ${r.error.message}`);
  }
  if (total.count === null || echecs.count === null || partiels.count === null || bloques.count === null) {
    throw new Error('scraper_runs : comptage indisponible');
  }

  const workflows = (wf.data ?? []).map((r) => versLigne(r as Record<string, unknown>));
  const collecteAt = workflows.reduce<string | null>((max, w) => {
    if (!w.collecte_at) return max;
    return max === null || new Date(w.collecte_at) > new Date(max) ? w.collecte_at : max;
  }, null);

  return {
    workflows,
    collecteAt,
    scraperRuns24h: {
      total: total.count,
      echecs: echecs.count,
      dernierEchec: (dernier.data?.[0]?.started_at as string | undefined) ?? null,
      partiels: partiels.count,
      bloques: { total: bloques.count, plusAncien: (plusAncienBloque.data?.[0]?.started_at as string | undefined) ?? null },
    },
  };
}
