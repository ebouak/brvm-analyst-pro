import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { DepsIngestion } from './ingestion';
import type { ArtefactLu, DepsLecture } from './artefacts';

/**
 * Branchement Supabase (service_role, serveur seul) des dépendances de
 * lib/qa/ingestion.ts et lib/qa/artefacts.ts. Toute erreur de la base LÈVE :
 * une ingestion qui échoue doit faire échouer la CI, pas s'effacer.
 */

const BUCKET = 'qa-artefacts';
const JOUR_MS = 86_400_000;
export const CONSERVATION_ARTEFACTS_J = 30;
export const CONSERVATION_RUNS_J = 180;

export function depsIngestionSupabase(): DepsIngestion {
  const db = getServiceClient();
  const bucket = db.storage.from(BUCKET);

  return {
    async creerRunSiAbsent(meta) {
      const { error } = await db
        .from('qa_runs')
        .upsert({ ci_fournisseur: 'github', ...meta }, { onConflict: 'ci_fournisseur,ci_run_id,ci_tentative', ignoreDuplicates: true });
      if (error) throw new Error(`qa_runs : ${error.message}`);
    },

    async importer(charge) {
      const { data, error } = await db.rpc('qa_importer_run', { p: charge });
      if (error || !data) throw new Error(`qa_importer_run : ${error?.message ?? 'réponse vide'}`);
      return data as { run_id: string; deja_importe: boolean };
    },

    async attendus(runId) {
      const { data, error } = await db.from('qa_artefacts').select('chemin').eq('run_id', runId).eq('statut', 'attendu').limit(200);
      if (error) throw new Error(`qa_artefacts : ${error.message}`);
      return (data ?? []).map((r) => r.chemin as string);
    },

    async signerDepot(chemin) {
      // upsert : une reprise après un envoi partiel peut réécrire le même fichier.
      const { data, error } = await bucket.createSignedUploadUrl(chemin, { upsert: true });
      if (error || !data) throw new Error(`dépôt signé : ${error?.message ?? 'vide'}`);
      return data.signedUrl;
    },

    async purger() {
      const limite = new Date(Date.now() - CONSERVATION_ARTEFACTS_J * JOUR_MS).toISOString();
      const { data: vieux, error } = await db
        .from('qa_artefacts')
        .select('id, chemin, statut')
        .neq('statut', 'purge')
        .lt('created_at', limite)
        .limit(500);
      if (error) throw new Error(`purge (lecture) : ${error.message}`);
      const recus = (vieux ?? []).filter((a) => a.statut === 'televerse').map((a) => a.chemin as string);
      if (recus.length) {
        const { error: e } = await bucket.remove(recus);
        if (e) throw new Error(`purge (stockage) : ${e.message}`);
      }
      const ids = (vieux ?? []).map((a) => a.id as string);
      if (ids.length) {
        const { error: e } = await db.from('qa_artefacts').update({ statut: 'purge' }).in('id', ids);
        if (e) throw new Error(`purge (marquage) : ${e.message}`);
      }
      const limiteRuns = new Date(Date.now() - CONSERVATION_RUNS_J * JOUR_MS).toISOString();
      const { data: runs, error: eRuns } = await db.from('qa_runs').delete().lt('debut_at', limiteRuns).select('id');
      if (eRuns) throw new Error(`purge (exécutions) : ${eRuns.message}`);
      return { artefacts: ids.length, runs: runs?.length ?? 0 };
    },

    async presents(dossier) {
      const { data, error } = await bucket.list(dossier, { limit: 1000 });
      if (error) throw new Error(`liste du stockage : ${error.message}`);
      return new Set((data ?? []).map((o) => o.name));
    },

    async marquerTeleverses(chemins) {
      const { data, error } = await db
        .from('qa_artefacts')
        .update({ statut: 'televerse' })
        .in('chemin', chemins)
        .eq('statut', 'attendu')
        .select('id');
      if (error) throw new Error(`qa_artefacts : ${error.message}`);
      return data?.length ?? 0;
    },
  };
}

export function depsLectureSupabase(): DepsLecture {
  const db = getServiceClient();
  return {
    async lire(id) {
      const { data, error } = await db.from('qa_artefacts').select('chemin, type, statut').eq('id', id).maybeSingle();
      if (error) throw new Error(`qa_artefacts : ${error.message}`);
      return (data as ArtefactLu | null) ?? null;
    },
    async signerLecture(chemin, dureeS, telechargement) {
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(chemin, dureeS, telechargement ? { download: telechargement } : undefined);
      if (error || !data) throw new Error(`lecture signée : ${error?.message ?? 'vide'}`);
      return data.signedUrl;
    },
  };
}
