/**
 * Décisions PURES du passage quotidien des séquences (route cron) : l'auth, le
 * plafond du jour et l'agrégation des issues y vivent pour être testables sans
 * base ni réseau. Aucune donnée personnelle : des comptes seulement.
 */
import { timingSafeEqual } from 'node:crypto';

export type Issue = 'envoye' | 'simulation' | 'echec' | 'refus' | 'indisponible' | 'reporte';
export const ISSUES: readonly Issue[] = ['envoye', 'simulation', 'echec', 'refus', 'indisponible', 'reporte'];
export const issueVide = (): Record<Issue, number> => ({ envoye: 0, simulation: 0, echec: 0, refus: 0, indisponible: 0, reporte: 0 });

/** Bearer CRON_SECRET, comparé à temps constant. Secret ou en-tête vide : refus. */
export function autorise(secret: string | undefined, enTete: string | null): boolean {
  const bearer = enTete?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !bearer) return false;
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(bearer, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Étapes encore permises aujourd'hui : plafond du jour moins ce qui a déjà été traité (jamais négatif). */
export const restantAujourdhui = (plafond: number, dejaAujourdhui: number): number => Math.max(0, plafond - Math.max(0, dejaAujourdhui));

/** Début du jour UTC (ISO) de l'instant donné. */
export const debutJourUtc = (maintenant: Date): string => `${maintenant.toISOString().slice(0, 10)}T00:00:00.000Z`;

export interface Resume { total: number; parIssue: Record<Issue, number>; http: 200 | 500; alerter: boolean }

/** Échec ET indisponible font passer le passage en 500 : un run vert ne doit jamais cacher une panne. */
export function resumer(parSequence: Record<string, Record<Issue, number>>): Resume {
  const parIssue = issueVide();
  for (const c of Object.values(parSequence)) for (const k of ISSUES) parIssue[k] += c[k];
  const total = ISSUES.reduce((n, k) => n + parIssue[k], 0);
  const panne = parIssue.echec + parIssue.indisponible > 0;
  return { total, parIssue, http: panne ? 500 : 200, alerter: parIssue.envoye + parIssue.simulation + parIssue.echec + parIssue.indisponible > 0 };
}
