/**
 * Verdict d'une exécution de tests, DÉRIVÉ à la lecture.
 *
 * Deux règles qui ne se négocient pas :
 *   - aucun test exécuté n'est jamais un succès (tout ignoré = « aucun test ») ;
 *   - une erreur d'infrastructure reste une erreur, même si des tests ont passé.
 *
 * « Incomplet » n'est pas stocké : un runner tué net n'envoie plus rien, son
 * exécution reste « en cours » en base, et c'est l'âge qui la requalifie ici.
 * Pas de tâche planifiée à surveiller pour cela.
 */

export type StatutRun = 'en_cours' | 'termine' | 'interrompu' | 'erreur_infra';
export type Verdict =
  | 'succes' | 'intermittent' | 'echec' | 'aucun_test'
  | 'erreur_infra' | 'interrompu' | 'en_cours' | 'incomplet';

export interface RunResume {
  statut: StatutRun;
  debut_at: string;
  fin_at: string | null;
  nb_reussis: number;
  nb_echoues: number;
  nb_intermittents: number;
  nb_ignores: number;
}

/** Au-delà, une exécution sans fin déclarée est tenue pour incomplète (le job e2e dure ~15 min). */
export const DELAI_INCOMPLET_MS = 3 * 3600_000;
/** Au-delà, les résultats affichés sont signalés comme anciens. */
export const DELAI_ANCIEN_MS = 7 * 24 * 3600_000;

export function verdictRun(run: RunResume, maintenant: Date): Verdict {
  if (run.statut === 'en_cours') {
    const age = maintenant.getTime() - new Date(run.debut_at).getTime();
    return age > DELAI_INCOMPLET_MS ? 'incomplet' : 'en_cours';
  }
  if (run.statut === 'erreur_infra') return 'erreur_infra';
  if (run.statut === 'interrompu') return 'interrompu';
  if (run.nb_echoues > 0) return 'echec';
  if (run.nb_reussis + run.nb_intermittents === 0) return 'aucun_test';
  if (run.nb_intermittents > 0) return 'intermittent';
  return 'succes';
}

export function resultatsAnciens(date: string, maintenant: Date): boolean {
  return maintenant.getTime() - new Date(date).getTime() > DELAI_ANCIEN_MS;
}

/** Version testée face à la version en ligne : on ne laisse jamais croire que l'une vaut l'autre. */
export function compareVersions(testee: string, deployee: string | undefined | null): 'identique' | 'differente' | 'inconnue' {
  if (!deployee) return 'inconnue';
  return testee.toLowerCase() === deployee.toLowerCase() ? 'identique' : 'differente';
}

export const LIBELLE_VERDICT: Record<Verdict, string> = {
  succes: 'Tous les scénarios exécutés ont réussi',
  intermittent: 'Réussi, avec des scénarios intermittents',
  echec: 'Des scénarios ont échoué',
  aucun_test: 'Aucun test exécuté',
  erreur_infra: "Erreur d'infrastructure",
  interrompu: 'Exécution interrompue',
  en_cours: 'Exécution en cours',
  incomplet: 'Exécution incomplète (aucune fin reçue)',
};
