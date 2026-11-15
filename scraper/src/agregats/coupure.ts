/**
 * Coupure du cron des agrégats bancaires — PUR.
 *
 * La spec (§7) exige que l'HISTORIQUE ne soit écrit qu'après l'accord de
 * l'exploitant sur le rapport de la reprise à blanc (PR 3). Le cron hebdomadaire
 * ne traite donc QUE les publications datées de la coupure ou après — jamais
 * « tout ce qui n'a pas encore été lu », qui au premier passage serait tout
 * l'historique, écrit sans relecture.
 *
 * Défaut : la date de fusion de la PR 1. Surcharge explicite possible par
 * AGREGATS_COUPURE (AAAA-MM-JJ). Une publication sans date n'est pas traitée.
 */
export const COUPURE_CRON = '2026-11-16';

export function coupureCron(valeur: string | null | undefined): string {
  const v = (valeur ?? '').trim();
  if (!v) return COUPURE_CRON;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`AGREGATS_COUPURE attend AAAA-MM-JJ, reçu « ${v} »`);
  return v;
}

export function publicationsDuCron<T extends { date_publication: string | null }>(pubs: T[], coupure: string): T[] {
  return pubs.filter((p) => p.date_publication != null && p.date_publication.slice(0, 10) >= coupure);
}
