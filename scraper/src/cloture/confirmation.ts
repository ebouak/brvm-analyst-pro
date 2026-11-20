/**
 * Clôture confirmée — la seule preuve qu'une séance est définitive.
 *
 * La ligne du jour de `brvm_actions_daily` existe dès l'intraday, bien avant
 * la fin de séance (15:00 UTC). La consolidation de clôture est la commande
 * `daily` (workflow `bdfin.yml`), monitorée dans `scraper_runs` sous la source
 * `daily`. Colonnes réelles : `scraper_runs.status`, `finished_at`, et dans
 * `metadata` (écrit par index.ts) `date_marche` et `nb_actions`. Il n'existe
 * pas de colonne « séance » hors de `metadata`.
 *
 * DUPLICATION ASSUMÉE : video/cloture.mjs porte la même règle (deux paquets
 * distincts, comme scraper/src/hebdo/pure/). Toute correction des deux côtés.
 * La fonction SQL `public.cloture_confirmee` (migration 0251) aussi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const SEUIL_ACTIONS = 20;
export const HEURE_CLOTURE_UTC = 15;

export interface RunDaily {
  id?: string | null;
  status: string;
  finished_at: string | null;
  metadata: { date_marche?: string | null; nb_actions?: number | string | null } | null;
}

export interface Confirmation {
  confirmee: boolean;
  raison: string;
  runId: string | null;
  fin: string | null;
}

const non = (raison: string): Confirmation => ({ confirmee: false, raison, runId: null, fin: null });

/** PURE. */
export function evaluerCloture(seance: string | null, runs: RunDaily[] | null | undefined): Confirmation {
  if (!seance || !/^\d{4}-\d{2}-\d{2}$/.test(seance)) return non('séance inconnue');
  const reussis = (runs ?? []).filter((r) => r && r.status === 'success' && r.finished_at);
  if (!reussis.length) return non(`aucun run « daily » réussi connu pour la séance du ${seance}`);

  const memeSeance = reussis.filter((r) => r.metadata?.date_marche === seance);
  if (!memeSeance.length) {
    const vues = [...new Set(reussis.map((r) => r.metadata?.date_marche ?? 'sans date'))].join(', ');
    return non(`aucun run « daily » réussi pour la séance du ${seance} (séances lues : ${vues})`);
  }

  const seuilFin = Date.parse(`${seance}T${String(HEURE_CLOTURE_UTC).padStart(2, '0')}:00:00Z`);
  const apres = memeSeance.filter((r) => Date.parse(r.finished_at as string) >= seuilFin);
  if (!apres.length) {
    return non(
      `run « daily » de la séance du ${seance} terminé avant ${HEURE_CLOTURE_UTC}:00 UTC (chiffres possiblement provisoires)`,
    );
  }

  const complets = apres.filter((r) => Number(r.metadata?.nb_actions) >= SEUIL_ACTIONS);
  if (!complets.length) {
    const max = Math.max(...apres.map((r) => Number(r.metadata?.nb_actions) || 0));
    return non(`run « daily » de la séance du ${seance} avec ${max} action(s) écrite(s), moins de ${SEUIL_ACTIONS}`);
  }

  const r = [...complets].sort((a, b) => Date.parse(b.finished_at as string) - Date.parse(a.finished_at as string))[0] as RunDaily;
  return {
    confirmee: true,
    raison: `clôture confirmée par le run « daily » terminé le ${r.finished_at}`,
    runId: r.id ?? null,
    fin: r.finished_at,
  };
}

/**
 * Lit les runs `daily` d'une séance (clé service : RLS sans policy) puis
 * évalue. Une lecture en erreur LÈVE : elle n'est jamais un refus muet.
 */
export async function lireConfirmation(sb: SupabaseClient, seance: string): Promise<Confirmation> {
  const src = await sb.from('scraper_sources').select('id').eq('code', 'daily').maybeSingle();
  if (src.error) throw new Error(`scraper_sources illisible : ${src.error.message}`);
  if (!src.data) return non('source « daily » absente de scraper_sources (jamais exécutée)');
  const { data, error } = await sb
    .from('scraper_runs')
    .select('id, status, finished_at, metadata')
    .eq('source_id', (src.data as { id: string }).id)
    .gte('started_at', `${seance}T00:00:00Z`)
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw new Error(`scraper_runs illisible : ${error.message}`);
  return evaluerCloture(seance, (data ?? []) as RunDaily[]);
}
