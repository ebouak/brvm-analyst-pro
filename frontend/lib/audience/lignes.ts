/**
 * Lecture des lignes PostHog -> types métier — PUR. PostHog renvoie des tableaux
 * de valeurs non typées : tout passe par ces fonctions, qui refusent de fabriquer
 * un chiffre (une valeur illisible devient 0 pour un compte, `null` pour une moyenne).
 */
import { estUemoa, nomPays } from '../crm/geo';
import type { AppareilLigne, ClicLigne, ContinentLigne, Entonnoir, JourSerie, Overview, PageLigne, PaysLigne, SessionsStats, TendancePoint, VilleLigne } from './types';

export type Ligne = unknown[];
const CONTINENTS_FR: Record<string, string> = { AF: 'Afrique', EU: 'Europe', NA: 'Amérique du Nord', SA: 'Amérique du Sud', AS: 'Asie', OC: 'Océanie', AN: 'Antarctique' };

export function nombre(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}
export function nombreOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const code = (v: unknown): string | null => { const t = texte(v); return t && /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null; };

export const continentFr = (c: string | null): string => (c ? CONTINENTS_FR[c] ?? c : 'Inconnu');

export const lireOverview = (r: Ligne | undefined): Overview => ({ evenements: nombre(r?.[0]), pagesVues: nombre(r?.[1]), personnes: nombre(r?.[2]), sessions: nombre(r?.[3]) });

/** Afrique en tête, puis par audience décroissante. */
export function lireContinents(rows: Ligne[]): ContinentLigne[] {
  const l = rows.map((r): ContinentLigne => {
    const c = code(r[0]);
    return { code: c, nom: continentFr(c), personnes: nombre(r[2]), sessions: nombre(r[3]) };
  });
  return l.sort((a, b) => (a.code === 'AF' ? -1 : b.code === 'AF' ? 1 : b.personnes - a.personnes));
}

export function lirePays(rows: Ligne[]): PaysLigne[] {
  return rows.map((r): PaysLigne => {
    const c = code(r[0]);
    return { code: c, nom: c ? nomPays(c) : texte(r[1]) ?? 'Inconnu', personnes: nombre(r[2]), sessions: nombre(r[3]), uemoa: estUemoa(c) };
  });
}

/** Sous-total UEMOA : somme par pays (une personne vue depuis deux pays est comptée deux fois). */
export function sousTotalUemoa(pays: PaysLigne[]): { personnes: number; sessions: number; pays: number } {
  const u = pays.filter((p) => p.uemoa);
  return { personnes: u.reduce((s, p) => s + p.personnes, 0), sessions: u.reduce((s, p) => s + p.sessions, 0), pays: u.length };
}

export const lireVilles = (rows: Ligne[]): VilleLigne[] => rows.map((r) => ({ ville: texte(r[0]) ?? 'Inconnue', pays: nomPays(code(r[1])), personnes: nombre(r[2]) }));

export function lireSessions(r: Ligne | undefined): SessionsStats {
  return { sessions: nombre(r?.[0]), dureeMoyenneS: nombreOuNull(r?.[1]), dureeMedianeS: nombreOuNull(r?.[2]), pagesParSession: nombreOuNull(r?.[3]) };
}

export const lirePages = (rows: Ligne[]): PageLigne[] => rows.map((r) => ({ chemin: texte(r[0]) ?? '(inconnu)', vues: nombre(r[1]), personnes: nombre(r[2]) }));
/** Libellés conservés tels quels (ex. « fermeture (✕) ») : aucune interprétation du texte des éléments. */
export const lireClics = (rows: Ligne[]): ClicLigne[] => rows.map((r) => ({ libelle: (texte(r[0]) ?? '(sans texte)').slice(0, 80), clics: nombre(r[1]), personnes: nombre(r[2]) }));
export const lireAppareils = (rows: Ligne[]): AppareilLigne[] => rows.map((r) => ({ type: texte(r[0]) ?? 'Inconnu', personnes: nombre(r[1]), sessions: nombre(r[2]) }));
export const lireTendance = (rows: Ligne[]): TendancePoint[] => rows.map((r) => ({ semaine: String(r[0] ?? '').slice(0, 10), continent: continentFr(code(r[1])), personnes: nombre(r[2]) }));
export const lireEntonnoir = (r: Ligne | undefined): Entonnoir => ({ academy: nombre(r?.[0]), lecon: nombre(r?.[1]), inscription: nombre(r?.[2]) });
export const lireSerieJour = (rows: Ligne[]): JourSerie[] => rows.map((r) => ({ jour: String(r[0] ?? '').slice(0, 10), personnes: nombre(r[1]), sessions: nombre(r[2]), pagesVues: nombre(r[3]), afrique: nombre(r[4]) }));

/** Pivot pour Recharts : une ligne par semaine, une colonne par continent. */
export function pivoterTendance(points: TendancePoint[]): { donnees: Record<string, string | number>[]; continents: string[] } {
  const totaux = new Map<string, number>();
  for (const p of points) totaux.set(p.continent, (totaux.get(p.continent) ?? 0) + p.personnes);
  const continents = [...totaux.keys()].sort((a, b) => (a === 'Afrique' ? -1 : b === 'Afrique' ? 1 : (totaux.get(b) ?? 0) - (totaux.get(a) ?? 0)));
  const parSemaine = new Map<string, Record<string, string | number>>();
  for (const p of points) {
    const ligne = parSemaine.get(p.semaine) ?? { semaine: p.semaine };
    ligne[p.continent] = ((ligne[p.continent] as number) ?? 0) + p.personnes;
    parSemaine.set(p.semaine, ligne);
  }
  const donnees = [...parSemaine.values()].sort((a, b) => String(a.semaine).localeCompare(String(b.semaine)));
  for (const d of donnees) for (const c of continents) d[c] ??= 0;
  return { donnees, continents };
}

/** Variation en % ; `null` si la référence est nulle ou absente (jamais un « +∞ % » inventé). */
export function delta(courant: number | null | undefined, precedent: number | null | undefined): number | null {
  if (courant == null || precedent == null || !Number.isFinite(courant) || !Number.isFinite(precedent) || precedent === 0) return null;
  return ((courant - precedent) / precedent) * 100;
}

export function fmtDuree(s: number | null): string {
  if (s == null) return '—';
  const t = Math.round(s);
  return t < 60 ? `${t} s` : `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, '0')} s`;
}
export function fmtDelta(d: number | null): string {
  if (d === null) return 'n/d';
  const r = Math.round(d);
  return `${r > 0 ? '+' : ''}${r} %`;
}
