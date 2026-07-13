import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Santé des tâches planifiées (pg_cron).
 *
 * `scraper_runs` ne couvre que les workers GitHub Actions. Les tâches pg_cron
 * n'écrivaient nulle part que nous lisions — c'est ainsi qu'un job a pu échouer
 * 672 fois en une semaine sans qu'aucun écran ne le signale.
 */

export interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  runs_24h: number;
  failures_24h: number;
  last_status: string | null;
  last_run: string | null;
  last_error: string | null;
}

export async function loadCronHealth(): Promise<CronJob[]> {
  try {
    const db = getServiceClient();
    const { data, error } = await db.rpc('get_cron_health');
    if (error) throw error;
    return (data ?? []) as CronJob[];
  } catch {
    // Tolérant : une base sans la migration 0095 ne doit pas faire tomber la page.
    return [];
  }
}

/** Un job en échec sur sa DERNIÈRE exécution est en panne maintenant. */
export function isBroken(j: CronJob): boolean {
  return j.active && j.last_status === 'failed';
}
