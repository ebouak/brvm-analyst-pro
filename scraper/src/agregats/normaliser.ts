/**
 * Réponse Gemini (validée par zod) → observations prêtes pour
 * indicateur_source. PUR : la génération d'identifiant est injectée.
 *
 * Règles (spec §3-§4, avenant du 2026-11-15) : montants mis à l'unité dans la
 * devise PUBLIÉE — FCFA (`fcfa`) ou USD (`usd`, ETIT), jamais convertis ; une
 * observation par indicateur pour la colonne courante, « non_trouve » s'il
 * manque ; colonne comparative seulement si lue ; un périmètre n'est jamais
 * deviné ; une valeur de branche (fenêtre islamique) ou un document dans une
 * autre devise ne sont pas exploitables.
 */
import { randomUUID } from 'node:crypto';
import { AGREGATS, defDe } from './indicateurs.js';
import { lireNombre, facteur, type UniteSource } from './nombres.js';
import { periodeDeDate, type CodePeriode, type PeriodeDoc } from './periode.js';
import type { Lecture, ValeurLue } from './schema.js';
import type { Comparateur, Motif, Perimetre } from '../prudentiel/selection.js';

export interface DocumentLu {
  code: string;
  url: string;
  libelle: string;
  date: string | null;
  publication_id: string | null;
  periode: PeriodeDoc;
  modele: string;
}

export type Statut = 'publie' | 'non_applicable' | 'non_trouve' | 'publie_non_exploitable';
export type Controle = 'ok' | 'a_relire' | 'valide' | 'rejete';
/** Unité stockée : montant en FCFA, montant en USD (tel que publié), pourcentage. */
export type UniteStockee = 'fcfa' | 'usd' | 'pct';

/** Une ligne d'indicateur_source, colonnes de 0147, 0148, 0149 et 0245. */
export interface ObservationNouvelle {
  id: string;
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  perimetre: Perimetre;
  statut: Statut;
  valeur: number | null;
  comparateur: Comparateur;
  unite: UniteStockee | null;
  unite_source: UniteSource | null;
  devise_source: string | null;
  texte_original: string | null;
  decimales: number | null;
  motif: Motif | null;
  document_url: string;
  document_libelle: string;
  document_date: string | null;
  publication_id: string | null;
  page: number | null;
  libelle_exact: string | null;
  extrait: string | null;
  methode: 'gemini-agregats';
  modele: string;
  nature_source: 'emetteur';
  provisoire: boolean;
  controle: Controle;
  controle_motif: string | null;
}

const BRANCHE = /islam|fen[eê]tre|branche/i;
const FCFA = /^(f\s*\.?\s*cfa|fcfa|xof|cfa)$/i;
const USD = /^(usd|us\s*\$|\$|dollars?(\s+us)?|dollars?\s+am[ée]ricains?)$/i;

/** Devise du document → unité stockée des montants ; null = devise non prise en charge. */
export function uniteMontant(devise: string | null): 'fcfa' | 'usd' | null {
  if (devise == null || FCFA.test(devise.trim())) return 'fcfa';
  if (USD.test(devise.trim())) return 'usd';
  return null;
}

function base(doc: DocumentLu, lecture: Lecture, indicateur: string, date: string, periode: CodePeriode, perimetre: Perimetre, id: string): ObservationNouvelle {
  return {
    id, code: doc.code, indicateur, periode, date_arrete: date, perimetre,
    statut: 'non_trouve', valeur: null, comparateur: '=', unite: null, unite_source: null,
    devise_source: lecture.devise, texte_original: null, decimales: null, motif: null,
    document_url: doc.url, document_libelle: doc.libelle, document_date: doc.date, publication_id: doc.publication_id,
    page: null, libelle_exact: null, extrait: null, methode: 'gemini-agregats', modele: doc.modele,
    nature_source: 'emetteur', provisoire: lecture.provisoire, controle: 'ok', controle_motif: null,
  };
}

function nonExploitable(o: ObservationNouvelle, motif: Motif, pourquoi: string): ObservationNouvelle {
  return { ...o, statut: 'publie_non_exploitable', valeur: null, unite: null, motif, controle_motif: pourquoi };
}

function depuisValeur(o: ObservationNouvelle, v: ValeurLue, montant: 'fcfa' | 'usd' | null): ObservationNouvelle {
  const def = defDe(v.indicateur)!;
  const lu: ObservationNouvelle = {
    ...o, page: v.page, libelle_exact: v.libelle_exact, extrait: v.extrait, texte_original: v.texte, unite_source: v.unite, comparateur: v.comparateur,
  };
  if (!montant) return nonExploitable(lu, 'definition_incompatible', `devise ${o.devise_source ?? 'inconnue'} non prise en charge`);
  if (BRANCHE.test(`${v.libelle_exact ?? ''} ${v.extrait ?? ''}`)) return nonExploitable(lu, 'definition_incompatible', 'valeur propre à une branche ou une fenêtre');
  const nombre = v.texte ? lireNombre(v.texte) : null;
  if (!nombre) return nonExploitable(lu, 'illisible', 'nombre illisible');
  const estRatio = def.nature === 'ratio';
  if (v.unite == null || (estRatio !== (v.unite === 'pct'))) return nonExploitable(lu, 'definition_incompatible', `unité ${v.unite ?? 'absente'} incompatible`);
  const valeur = estRatio ? nombre.valeur : Math.round(nombre.valeur * facteur(v.unite));
  return {
    ...lu, statut: 'publie', valeur, unite: estRatio ? 'pct' : montant, decimales: nombre.decimales,
    motif: v.approximation ? 'approximation' : null,
  };
}

export function normaliser(lecture: Lecture, doc: DocumentLu, nouvelId: () => string = randomUUID): ObservationNouvelle[] {
  const montant = uniteMontant(lecture.devise);
  const dateCourante = doc.periode.dateArrete;
  const dateComparative = lecture.date_arrete_comparative;
  const periodeComparative = dateComparative ? periodeDeDate(dateComparative) : null;
  const dateIncoherente = lecture.date_arrete != null && lecture.date_arrete !== dateCourante;

  // Regroupe par (indicateur, colonne, périmètre) : deux textes différents = conflit déclaré.
  const groupes = new Map<string, ValeurLue[]>();
  for (const v of lecture.valeurs) {
    if (!v.trouve) continue;
    const cle = `${v.indicateur}|${v.colonne}|${v.perimetre}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), v]);
  }

  const sortie: ObservationNouvelle[] = [];
  for (const def of AGREGATS) {
    const courants = [...groupes.keys()].filter((k) => k.startsWith(`${def.indicateur}|courante|`));
    if (courants.length === 0) {
      sortie.push(base(doc, lecture, def.indicateur, dateCourante, doc.periode.code, 'non_precise', nouvelId()));
    }
    for (const [cle, vals] of [...groupes.entries()].filter(([k]) => k.startsWith(`${def.indicateur}|`))) {
      const [, colonne, perimetre] = cle.split('|') as [string, 'courante' | 'comparative', Perimetre];
      const date = colonne === 'courante' ? dateCourante : dateComparative;
      const periode = colonne === 'courante' ? doc.periode.code : periodeComparative;
      if (!date || !periode) continue; // comparatif sans date lisible : ignoré, jamais deviné
      const o = base(doc, lecture, def.indicateur, date, periode, perimetre, nouvelId());
      const textes = [...new Set(vals.map((x) => x.texte ?? ''))];
      sortie.push(
        textes.length > 1
          ? nonExploitable({ ...o, texte_original: textes[0] ?? null, page: vals[0]!.page, extrait: vals[0]!.extrait }, 'source_conflict', `deux valeurs dans le même document : ${textes.join(' / ')}`)
          : depuisValeur(o, vals[0]!, montant),
      );
    }
  }

  return dateIncoherente
    ? sortie.map((o) => ({ ...o, controle: 'a_relire' as const, controle_motif: [o.controle_motif, `date d’arrêté lue ${lecture.date_arrete} ≠ période du libellé ${dateCourante}`].filter(Boolean).join(' ; ') }))
    : sortie;
}
