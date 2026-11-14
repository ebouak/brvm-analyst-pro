/**
 * Assemblées générales lues dans le Bulletin Officiel de la Cote (table
 * `boc_assemblees`, collecteur `scraper/src/boc/`). Module PUR.
 *
 * `date_ag` est la date de la RÉUNION, publiée par la BRVM — pas la date d'un
 * avis de convocation. Une AG à venir n'est montrée que si elle figure dans le
 * DERNIER bulletin lu : absente de celui-ci, elle a été retirée ou reportée, et
 * l'afficher serait annoncer une réunion qui n'aura pas lieu ce jour-là.
 */
import type { AssembleeSource } from '@/lib/dashboard/agenda';

export type NatureAg = 'ordinaire' | 'extraordinaire' | 'mixte' | 'autre';

export interface BocAssemblee {
  code: string | null;
  societe: string;
  nature: string;
  nature_cle: NatureAg;
  date_ag: string;
  heure: string | null;
  lieu: string | null;
  premier_bulletin: string;
  dernier_bulletin: string;
}

/** Source portée par les AG du bulletin dans l'agenda : statut « officiel ». */
export const SOURCE_BOC = 'brvm-boc';

export const COLONNES_AG = 'code, societe, nature, nature_cle, date_ag, heure, lieu, premier_bulletin, dernier_bulletin';

export function libelleNature(n: NatureAg): string {
  switch (n) {
    case 'ordinaire': return 'ordinaire';
    case 'extraordinaire': return 'extraordinaire';
    case 'mixte': return 'mixte';
    default: return '';
  }
}

/** « 15:00:00 » → « 15 h », « 09:30:00 » → « 9 h 30 » ; illisible → null. */
export function heureCourte(h: string | null): string | null {
  const m = h ? /^(\d{1,2}):(\d{2})/.exec(h) : null;
  if (!m) return null;
  const hh = Number(m[1]);
  return m[2] === '00' ? `${hh} h` : `${hh} h ${m[2]}`;
}

/** « Assemblée générale extraordinaire », ou sans qualificatif si la nature est inconnue. */
export function titreAg(a: Pick<BocAssemblee, 'nature_cle'>): string {
  const n = libelleNature(a.nature_cle);
  return n ? `Assemblée générale ${n}` : 'Assemblée générale';
}

/** Date du bulletin le plus récent parmi des lignes lues, ou null. */
export function dernierBulletin(rows: readonly Pick<BocAssemblee, 'dernier_bulletin'>[]): string | null {
  let d: string | null = null;
  for (const r of rows) if (d == null || r.dernier_bulletin > d) d = r.dernier_bulletin;
  return d;
}

/**
 * AG à venir encore au calendrier : date >= aujourd'hui ET présente dans le
 * dernier bulletin lu. Triées par date puis heure.
 */
export function agAVenir(rows: readonly BocAssemblee[], aujourdhui: string, dernier: string | null): BocAssemblee[] {
  if (!dernier) return [];
  return rows
    .filter((r) => r.date_ag >= aujourdhui && r.dernier_bulletin === dernier)
    .sort((a, b) => a.date_ag.localeCompare(b.date_ag) || (a.heure ?? '').localeCompare(b.heure ?? ''));
}

/** Pour l'agenda du tableau de bord. */
export function versAgenda(a: BocAssemblee): AssembleeSource {
  const h = heureCourte(a.heure);
  const qui = a.code ?? a.societe;
  return {
    code: a.code,
    date_reunion: a.date_ag,
    title: `${titreAg(a)} ${qui}${h ? ` à ${h}` : ''}`,
    source: SOURCE_BOC,
  };
}

/**
 * Historique d'une société pour sa fiche : à venir d'abord (si encore au
 * calendrier), puis les passées, de la plus récente à la plus ancienne. Une
 * AG passée garde sa place même si elle a quitté le calendrier de l'année.
 */
export function agDeLaSociete(
  rows: readonly BocAssemblee[],
  aujourdhui: string,
  dernier: string | null,
): { aVenir: BocAssemblee[]; passees: BocAssemblee[] } {
  const aVenir = agAVenir(rows, aujourdhui, dernier);
  const passees = rows
    .filter((r) => r.date_ag < aujourdhui)
    .sort((a, b) => b.date_ag.localeCompare(a.date_ag));
  return { aVenir, passees };
}

/**
 * Élément du calendrier `/calendrier` (forme `CalendarItem`). La société et son
 * secteur viennent du référentiel quand le code est connu, sinon du nom publié.
 */
export function versCalendrier(
  a: BocAssemblee,
  instruments: Record<string, { designation: string | null; secteur: string | null; pays: string | null }>,
) {
  const instr = a.code ? (instruments[a.code] ?? null) : null;
  const h = heureCourte(a.heure);
  return {
    id: `boc-ag-${a.code ?? a.societe}-${a.date_ag}-${a.nature_cle}`,
    date: a.date_ag,
    kind: 'AG' as const,
    code: a.code,
    societe: instr?.designation ?? a.societe,
    secteur: instr?.secteur ?? null,
    pays: instr?.pays ?? null,
    detail: `${titreAg(a)}${h ? ` à ${h}` : ''}${a.lieu ? ` · ${a.lieu}` : ''}`,
    href: a.code ? `/societes/${a.code}` : undefined,
  };
}
