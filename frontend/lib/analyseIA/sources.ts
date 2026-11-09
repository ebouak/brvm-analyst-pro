/**
 * Sources affichées sous une réponse (module PUR) : la donnée consultée et la
 * date de son élément le plus récent. Aucune source n'est ajoutée sans avoir
 * été réellement lue.
 */
import type { SourceDonnee } from './types';

const ISO = /^\d{4}-\d{2}-\d{2}/;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Date la plus récente, plafonnée à `plafond` (une date future n'est pas « la donnée la plus récente »). */
export function plusRecente(dates: (string | null | undefined)[], plafond?: string): string | null {
  let max: string | null = null;
  for (const d of dates) {
    if (!d || !ISO.test(d)) continue;
    const j = d.slice(0, 10);
    if (plafond && j > plafond) continue;
    if (!max || j > max) max = j;
  }
  return max;
}

/** Une source par libellé, avec la date la plus récente ; ordre de première consultation conservé. */
export function fusionnerSources(sources: SourceDonnee[]): SourceDonnee[] {
  const parLibelle = new Map<string, SourceDonnee>();
  for (const s of sources) {
    const deja = parLibelle.get(s.libelle);
    if (!deja) parLibelle.set(s.libelle, { ...s });
    else deja.date = plusRecente([deja.date, s.date]);
  }
  return [...parLibelle.values()];
}

export function dateCourte(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return `${j} ${MOIS[(m ?? 1) - 1]} ${a}`;
}

export function formaterSource(s: SourceDonnee): string {
  return s.date ? `${s.libelle} · données au ${dateCourte(s.date)}` : `${s.libelle} · date non précisée`;
}
