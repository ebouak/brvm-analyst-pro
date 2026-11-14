/**
 * Instantané d'édition et comparaison « Depuis la dernière édition » — module
 * PUR et testé (instantane.test.ts).
 *
 * L'instantané fige ce que l'édition a MESURÉ (table `dossier_instantanes`,
 * migration 0231). L'encadré compare l'édition courante à l'édition STRICTEMENT
 * antérieure, la plus récente. Trois conséquences, voulues :
 *  - sans édition antérieure, PAS d'encadré (jamais « 0 % » ni « aucune
 *    évolution » : on ne sait rien de ce qui précède) ;
 *  - deux éditions de `version` différente ne se comparent pas (les grandeurs
 *    n'ont plus la même définition) : encadré absent ;
 *  - une donnée absente d'un côté rend la mesure correspondante `null`, qui
 *    n'est pas affichée.
 */

import type { DossierValeur } from './build';

/** Version du schéma de `mesures` écrit aujourd'hui. */
export const VERSION_MESURES = 1;

export interface MesuresEdition {
  version: typeof VERSION_MESURES;
  /** Cours de référence (dernière clôture de la séance de l'édition). */
  cours: number | null;
  per: number | null;
  /** Fraction (0,05 = 5 %). */
  rendement: number | null;
  /** Nombre de publications connues en base pour la société. */
  publications: number | null;
  /** Statut de chaque pilier de suivi : clé → tenu / non_tenu / non_mesurable / non_applicable. */
  piliers: Record<string, string>;
}

export interface EntreeMesures {
  cours: number | null;
  per: number | null;
  rendement: number | null;
  publications: number | null;
  piliers: { cle: string; statut: string }[];
}

export function mesuresDe(e: EntreeMesures): MesuresEdition {
  const piliers: Record<string, string> = {};
  for (const p of e.piliers) piliers[p.cle] = p.statut;
  return { version: VERSION_MESURES, cours: e.cours, per: e.per, rendement: e.rendement, publications: e.publications, piliers };
}

/**
 * Les mesures d'un dossier calculé. UNE fonction pour la route qui fige l'édition
 * ET pour la page qui la compare : si les deux lisaient les champs chacune de
 * leur côté, un pilier lu différemment produirait un faux « a changé ».
 */
export function mesuresDuDossier(d: DossierValeur): MesuresEdition {
  return mesuresDe({
    cours: d.chiffres_cles.cours,
    per: d.ratios?.per ?? null,
    rendement: d.dividende.rendement,
    publications: d.nb_publications,
    piliers: d.suivi.piliers.map((p) => ({ cle: p.cle, statut: p.statut })),
  });
}

const nombre = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Relit des `mesures` venues de la base ; null si la forme n'est pas celle de la version courante. */
export function lireMesures(brut: unknown, version: number): MesuresEdition | null {
  if (version !== VERSION_MESURES || !brut || typeof brut !== 'object') return null;
  const m = brut as Record<string, unknown>;
  const piliers: Record<string, string> = {};
  if (m.piliers && typeof m.piliers === 'object') {
    for (const [k, v] of Object.entries(m.piliers as Record<string, unknown>)) if (typeof v === 'string') piliers[k] = v;
  }
  return { version: VERSION_MESURES, cours: nombre(m.cours), per: nombre(m.per), rendement: nombre(m.rendement), publications: nombre(m.publications), piliers };
}

export interface EditionPrecedente {
  edition: string;
  version: number;
  mesures: unknown;
}

export interface ChangementPilier {
  cle: string;
  avant: string;
  apres: string;
}

export interface ComparaisonEditions {
  edition_precedente: string;
  /** Fraction ; null si un des deux cours manque. */
  variation_cours: number | null;
  /** Publications ajoutées depuis ; null si le nombre n'est pas connu des deux côtés ou a diminué. */
  publications_parues: number | null;
  piliers_changes: ChangementPilier[];
}

export function comparerEditions(courant: MesuresEdition, precedente: EditionPrecedente | null): ComparaisonEditions | null {
  if (!precedente) return null;
  const avant = lireMesures(precedente.mesures, precedente.version);
  if (!avant) return null;

  const variation = courant.cours != null && avant.cours != null && avant.cours > 0 ? courant.cours / avant.cours - 1 : null;
  const parues =
    courant.publications != null && avant.publications != null && courant.publications >= avant.publications
      ? courant.publications - avant.publications
      : null;
  const changes: ChangementPilier[] = [];
  for (const [cle, apres] of Object.entries(courant.piliers)) {
    const av = avant.piliers[cle];
    if (av != null && av !== apres) changes.push({ cle, avant: av, apres });
  }
  return { edition_precedente: precedente.edition, variation_cours: variation, publications_parues: parues, piliers_changes: changes };
}
