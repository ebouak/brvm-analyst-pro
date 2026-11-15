/**
 * Sélection de la valeur retenue d'un indicateur prudentiel — module pur.
 *
 * `indicateur_source` garde TOUTES les observations (une par document) ;
 * `lignes_specifiques` ne porte que la valeur retenue, lue par le site. Cette
 * fonction décide, pour UN exercice, ce qui passe de l'une à l'autre.
 *
 * Règles (2026-10-07) :
 *   * un exercice se décide sur ses SEULES observations : une valeur d'un autre
 *     exercice ne le remplace jamais (le site afficherait un chiffre ancien
 *     sous l'en-tête de l'exercice courant) ;
 *   * comptes individuels d'abord, puis périmètre non précisé, puis consolidé.
 *     Le premier périmètre qui porte une observation publiée décide — un
 *     conflit en individuel ne se « répare » pas avec le chiffre consolidé ;
 *   * seule une valeur EXACTE (comparateur « = ») est retenue : ni estimation,
 *     ni approximation, ni borne ;
 *   * deux valeurs exactes se comparent à la précision publiée la moins fine
 *     (`rapprocher`) ; un conflit n'est jamais tranché ;
 *   * une borne publiée doit être respectée par la valeur exacte retenue, sinon
 *     les deux sources se contredisent.
 *
 * Règle (2026-10-09, migration 0149) : une source SECONDAIRE (article, analyse
 * de plateforme) n'entre jamais dans la décision — ni comme valeur retenue, ni
 * pour créer un conflit avec un chiffre de l'émetteur. Elle reste en base comme
 * corroboration. Un document de l'émetteur relayé par une plateforme
 * (`reprise_emetteur`) compte comme l'émetteur. Une valeur déclarée provisoire
 * par l'émetteur peut être retenue, mais avec la réserve « provisoire ».
 *
 * Règle (2026-11-15, migration 0245) : une observation rejetée en relecture
 * est ignorée ; une observation « a_relire » dans le périmètre décisif bloque
 * toute valeur ; une observation « valide » l'emporte. Les montants se
 * rapprochent à leur granularité imprimée (montants.ts), jamais d'une devise
 * à l'autre (USD et FCFA ne se comparent pas).
 *
 * ⚠️ Copié dans frontend/lib/agregats/pure/ (scripts/copier-agregats-purs.mjs,
 * vérifié par copie.test.ts) : corriger ICI, puis relancer le script.
 */

import { rapprocher } from './rapprochement.js';
import { rapprocherMontants } from './montants.js';
import type { UniteSource } from '../agregats/nombres.js';

export type Perimetre = 'individuel' | 'consolide' | 'non_precise';
export type Comparateur = '=' | '>' | '>=' | '<' | '<=';
export type Motif =
  | 'rounding_compatible' | 'source_conflict' | 'estime' | 'approximation'
  | 'illisible' | 'definition_incompatible' | 'controle_en_cours';

export interface ObsPrudentielle {
  id: string;
  date_arrete: string | null;
  perimetre: Perimetre;
  statut: 'publie' | 'non_applicable' | 'non_trouve' | 'publie_non_exploitable';
  valeur: number | null;
  comparateur: Comparateur;
  texte_original: string | null;
  motif: Motif | null;
  document_url: string;
  /** Absent = 'emetteur' (observations antérieures à 0149). */
  nature_source?: 'emetteur' | 'reprise_emetteur' | 'secondaire';
  provisoire?: boolean;
  /** État de contrôle (0245). Absent = 'ok'. */
  controle?: 'ok' | 'a_relire' | 'valide' | 'rejete';
  /** Unité stockée (fcfa, usd, pct) ; absente = fcfa pour un montant. */
  unite?: string | null;
  /** Unité imprimée et décimales (montants), pour le rapprochement à la granularité publiée. */
  unite_source?: UniteSource | null;
  decimales?: number | null;
}

export type Decision =
  | { etat: 'retenue'; valeur: number; observation: string; perimetre: Perimetre;
      classe: 'unique' | 'rounding_compatible'; reserve: 'controle_en_cours' | 'provisoire' | null }
  | { etat: 'conflit'; observations: string[] }
  /** Un contrôle a échoué sur une observation du périmètre décisif : rien n'est retenu avant relecture. */
  | { etat: 'a_relire'; observations: string[] }
  | { etat: 'borne'; comparateur: Exclude<Comparateur, '='>; valeur: number; observation: string }
  | { etat: 'non_exploitable'; motif: Motif | null; observations: string[] }
  | { etat: 'non_applicable' }
  /** Cherché et absent d'au moins un document consulté. */
  | { etat: 'non_trouve'; documents: number }
  /** Rien n'a été cherché pour cet exercice : on ne sait rien. */
  | { etat: 'aucune_observation' };

const ORDRE_PERIMETRE: Perimetre[] = ['individuel', 'non_precise', 'consolide'];
const NON_EXACT: ReadonlySet<Motif> = new Set(['estime', 'approximation', 'illisible', 'definition_incompatible']);

/** Texte comparable d'une observation : celui imprimé, sinon la valeur stockée. */
function texte(o: ObsPrudentielle): string {
  return o.texte_original ?? String(o.valeur).replace('.', ',');
}

function respecte(v: number, c: Exclude<Comparateur, '='>, borne: number): boolean {
  switch (c) {
    case '>': return v > borne;
    case '>=': return v >= borne;
    case '<': return v < borne;
    case '<=': return v <= borne;
  }
}

export function selectionnerExercice(obs: ObsPrudentielle[], dateArrete: string, nature: 'pct' | 'montant' = 'pct'): Decision {
  // Les sources secondaires et les observations rejetées en relecture sont
  // écartées AVANT tout : elles ne doivent ni décider, ni contredire.
  const exercice = obs.filter((o) => o.date_arrete === dateArrete && o.nature_source !== 'secondaire' && o.controle !== 'rejete');
  if (exercice.length === 0) return { etat: 'aucune_observation' };

  const publiees = (p: Perimetre) =>
    exercice.filter((o) => o.perimetre === p && (o.statut === 'publie' || o.statut === 'publie_non_exploitable'));
  const perimetre = ORDRE_PERIMETRE.find((p) => publiees(p).length > 0);

  if (!perimetre) {
    if (exercice.some((o) => o.statut === 'non_applicable')) return { etat: 'non_applicable' };
    const docs = new Set(exercice.filter((o) => o.statut === 'non_trouve').map((o) => o.document_url));
    return docs.size ? { etat: 'non_trouve', documents: docs.size } : { etat: 'aucune_observation' };
  }

  const lignes = publiees(perimetre);
  const aRelire = lignes.filter((o) => o.controle === 'a_relire');
  if (aRelire.length) return { etat: 'a_relire', observations: aRelire.map((o) => o.id) };
  const enConflit = lignes.filter((o) => o.motif === 'source_conflict');
  if (enConflit.length) return { etat: 'conflit', observations: enConflit.map((o) => o.id) };

  const utilisables = lignes.filter((o) => o.statut === 'publie' && o.valeur != null && !(o.motif && NON_EXACT.has(o.motif)));
  const exactesToutes = utilisables.filter((o) => o.comparateur === '=');
  // Une valeur confirmée en relecture l'emporte : une personne a tranché.
  const valides = exactesToutes.filter((o) => o.controle === 'valide');
  const exactes = valides.length ? valides : exactesToutes;
  const bornes = utilisables.filter((o) => o.comparateur !== '=') as (ObsPrudentielle & { comparateur: Exclude<Comparateur, '='>; valeur: number })[];

  if (exactes.length) {
    const r = nature === 'montant'
      ? rapprocherMontants(exactes.map((o) => ({ id: o.id, valeur: o.valeur!, unite: o.unite ?? null, unite_source: o.unite_source ?? null, decimales: o.decimales ?? null })))
      : rapprocher(exactes.map((o) => ({ id: o.id, texte: texte(o) })));
    if (r.classe === 'source_conflict') return { etat: 'conflit', observations: [...new Set(r.conflits.flat())] };
    if (r.classe === 'illisible' || r.retenue == null) {
      return { etat: 'non_exploitable', motif: 'illisible', observations: exactes.map((o) => o.id) };
    }
    const retenue = exactes.find((o) => o.id === r.retenue)!;
    const contredite = bornes.filter((b) => !respecte(retenue.valeur!, b.comparateur, b.valeur));
    if (contredite.length) return { etat: 'conflit', observations: [retenue.id, ...contredite.map((b) => b.id)] };
    return {
      etat: 'retenue',
      valeur: retenue.valeur!,
      observation: retenue.id,
      perimetre,
      classe: r.classe === 'unique' ? 'unique' : 'rounding_compatible',
      reserve: exactes.some((o) => o.motif === 'controle_en_cours')
        ? 'controle_en_cours'
        : retenue.provisoire ? 'provisoire' : null,
    };
  }

  if (bornes.length) {
    const b = bornes[0]!;
    return { etat: 'borne', comparateur: b.comparateur, valeur: b.valeur, observation: b.id };
  }

  return {
    etat: 'non_exploitable',
    motif: lignes.find((o) => o.motif)?.motif ?? null,
    observations: lignes.map((o) => o.id),
  };
}
