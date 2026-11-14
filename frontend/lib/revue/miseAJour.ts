/**
 * Mention « Mise à jour le … suite à la publication du … » de la Revue. PUR, testé.
 *
 * DÉRIVÉE à l'affichage de la dernière ligne `market_events` de type
 * `resultats` rattachée au code : pas de table dédiée, pas d'état à tenir. Le
 * « suite à » dit la séquence (la Revue lit des comptes publiés à cette date),
 * pas une cause de mouvement de cours.
 */
import { fmtDateFR } from '@/lib/format';

export interface EvenementResultats {
  /** Date de la publication (AAAA-MM-JJ). */
  event_date: string;
  /** Instant d'ingestion de l'événement par le worker. */
  created_at: string | null;
}

/** L'événement `resultats` le plus récent (par date de publication, puis d'ingestion). */
export function dernierEvenementResultats(evts: EvenementResultats[]): EvenementResultats | null {
  const valides = evts.filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.event_date));
  if (valides.length === 0) return null;
  return [...valides].sort(
    (a, b) => b.event_date.localeCompare(a.event_date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  )[0]!;
}

/**
 * « Mise à jour le 10/11/2026 suite à la publication du 06/11/2026. »
 * La date de mise à jour est celle de l'ingestion ; elle ne peut précéder la
 * publication (une date d'ingestion antérieure serait une incohérence : on la
 * remplace alors par la date de publication). Sans événement : null.
 */
export function phraseMiseAJour(e: EvenementResultats | null): string | null {
  if (!e) return null;
  const publie = e.event_date.slice(0, 10);
  const ingere = e.created_at ? e.created_at.slice(0, 10) : null;
  const maj = ingere && ingere >= publie ? ingere : publie;
  return `Mise à jour le ${fmtDateFR(maj)} suite à la publication du ${fmtDateFR(publie)}.`;
}
