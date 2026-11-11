/**
 * Version du prompt de diagnostic, rangée dans `diagnostic_reports.metrics_snapshot`
 * (clé `prompt_version`) à chaque génération.
 *
 * Pourquoi : jusqu'au 2026-11-11 le diagnostic se concluait par un verdict
 * ACHAT/CONSERVER/VENDRE, un objectif de cours, un horizon et un stop (audit de
 * conformité, lot B). Le cache dure 7 jours et la table n'a pas de colonne de
 * version : sans marqueur, l'ancien verdict resterait servi (et cité sur la
 * landing) jusqu'à l'expiration. Les lecteurs filtrent donc sur cette version :
 * un rapport plus ancien est traité comme ABSENT et régénéré à la demande.
 *
 * Aucune migration : `metrics_snapshot` est un jsonb déjà écrit à chaque
 * génération. Changer la valeur ci-dessous invalide tous les rapports.
 */
export const VERSION_PROMPT_DIAGNOSTIC = '2026-11-11-sans-recommandation';

/** Chemin PostgREST du marqueur, pour `.eq(CHEMIN_VERSION_PROMPT, VERSION_PROMPT_DIAGNOSTIC)`. */
export const CHEMIN_VERSION_PROMPT = 'metrics_snapshot->>prompt_version';
