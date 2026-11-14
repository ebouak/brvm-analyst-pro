/**
 * Lignes du bulletin → lignes de base, et fusion avec l'existant. Module pur.
 *
 * Une même AG ou opération est publiée dans bulletin après bulletin. On garde :
 *   - `premier_bulletin` = le PLUS ANCIEN bulletin où elle a été vue ;
 *   - `dernier_bulletin` = le PLUS RÉCENT ;
 *   - le contenu (lieu, heure, texte) du bulletin le plus récent.
 * La fusion ne dépend PAS de l'ordre de lecture : une reprise d'antériorité
 * qui lit un vieux bulletin après un récent ne recule rien.
 *
 * La clé naturelle est une chaîne lisible ; le collecteur la condense en
 * empreinte pour la base (`cle`).
 */
import type { LigneAg } from './assemblees.js';
import type { LigneAvis, LigneOperation } from './informations.js';
import { normaliser } from '../publications/emetteur.js';
import { codeEmetteur, estEmetteurHorsActions } from './noms.js';

export interface AgBase {
  cle: string;
  code: string | null;
  societe: string;
  nature: string;
  nature_cle: LigneAg['natureCle'];
  date_ag: string;
  heure: string | null;
  lieu: string | null;
  premier_bulletin: string;
  dernier_bulletin: string;
}

export interface OperationBase {
  cle: string;
  emetteur: string;
  code: string | null;
  operation: string;
  type_operation: LigneOperation['typeOperation'];
  date_operation: string | null;
  premier_bulletin: string;
  dernier_bulletin: string;
}

export interface AvisBase {
  cle: string;
  categorie: LigneAvis['categorie'];
  entite: string;
  code: string | null;
  numero: string | null;
  nature: string | null;
  objet: string;
  date_bulletin: string;
}

export function cleNaturelleAg(l: Pick<LigneAg, 'societe' | 'date' | 'natureCle'>): string {
  return `ag|${normaliser(l.societe)}|${l.date}|${l.natureCle}`;
}

export function cleNaturelleOperation(o: Pick<LigneOperation, 'emetteur' | 'operation'>): string {
  return `op|${normaliser(o.emetteur)}|${normaliser(o.operation)}`;
}

/** Un avis se reconnaît à son numéro ; sans numéro, à son objet. */
export function cleNaturelleAvis(a: Pick<LigneAvis, 'categorie' | 'entite' | 'numero' | 'objet'>): string {
  const n = a.numero ? a.numero.replace(/\s+/g, '') : `objet:${normaliser(a.objet)}`;
  return `${a.categorie}|${normaliser(a.entite)}|${n}`;
}

export interface Rapprochement {
  code: string | null;
  /** Nom à signaler : ni rapproché, ni émetteur hors actions. */
  aSignaler: string | null;
}

export function rapprocher(nom: string, codesConnus?: ReadonlySet<string>): Rapprochement {
  const code = codeEmetteur(nom, codesConnus);
  if (code) return { code, aSignaler: null };
  return { code: null, aSignaler: estEmetteurHorsActions(nom) ? null : nom };
}

/**
 * Prépare les lignes d'UN bulletin. Les doublons internes (même clé deux fois
 * dans le même bulletin) sont fusionnés : un upsert refuserait de toucher deux
 * fois la même ligne.
 */
export function preparer(
  e: { assemblees: LigneAg[]; operations: LigneOperation[]; avis: LigneAvis[] },
  dateBulletin: string,
  empreinte: (cleNaturelle: string) => string,
  codesConnus?: ReadonlySet<string>,
): { assemblees: AgBase[]; operations: OperationBase[]; avis: AvisBase[]; nonRapproches: string[] } {
  const nonRapproches = new Set<string>();
  const code = (nom: string) => {
    const r = rapprocher(nom, codesConnus);
    if (r.aSignaler) nonRapproches.add(r.aSignaler);
    return r.code;
  };

  const ag = new Map<string, AgBase>();
  for (const l of e.assemblees) {
    const cle = empreinte(cleNaturelleAg(l));
    ag.set(cle, {
      cle, code: code(l.societe), societe: l.societe, nature: l.nature, nature_cle: l.natureCle,
      date_ag: l.date, heure: l.heure, lieu: l.lieu,
      premier_bulletin: dateBulletin, dernier_bulletin: dateBulletin,
    });
  }
  const ops = new Map<string, OperationBase>();
  for (const o of e.operations) {
    const cle = empreinte(cleNaturelleOperation(o));
    ops.set(cle, {
      cle, emetteur: o.emetteur, code: code(o.emetteur), operation: o.operation,
      type_operation: o.typeOperation, date_operation: o.dateOperation,
      premier_bulletin: dateBulletin, dernier_bulletin: dateBulletin,
    });
  }
  const avis = new Map<string, AvisBase>();
  for (const a of e.avis) {
    const cle = empreinte(cleNaturelleAvis(a));
    avis.set(cle, {
      cle, categorie: a.categorie, entite: a.entite, code: code(a.entite), numero: a.numero,
      nature: a.nature || null, objet: a.objet, date_bulletin: dateBulletin,
    });
  }
  return {
    assemblees: [...ag.values()],
    operations: [...ops.values()],
    avis: [...avis.values()],
    nonRapproches: [...nonRapproches].sort(),
  };
}

const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);

/**
 * Fusionne une ligne lue avec la ligne déjà en base (même clé).
 * Le contenu le plus récent l'emporte ; les bornes de bulletins s'élargissent.
 */
export function fusionnerSuivi<T extends { premier_bulletin: string; dernier_bulletin: string }>(
  lue: T,
  existante: T | undefined,
): T {
  if (!existante) return lue;
  const plusRecente = lue.dernier_bulletin >= existante.dernier_bulletin ? lue : existante;
  return {
    ...plusRecente,
    premier_bulletin: min(lue.premier_bulletin, existante.premier_bulletin),
    dernier_bulletin: max(lue.dernier_bulletin, existante.dernier_bulletin),
  };
}

/** Un avis garde la date du PREMIER bulletin où il paraît, et son contenu le plus récent. */
export function fusionnerAvis(lu: AvisBase, existant: AvisBase | undefined): AvisBase {
  if (!existant) return lu;
  const recent = lu.date_bulletin >= existant.date_bulletin ? lu : existant;
  return { ...recent, date_bulletin: min(lu.date_bulletin, existant.date_bulletin) };
}

/**
 * La page des AG doit-elle exister dans ce bulletin ? En début d'année le
 * calendrier peut être vide ou absent ; de mars à décembre, son absence
 * signale une page que l'on ne sait plus lire.
 */
export function agAttenduesLe(dateBulletin: string): boolean {
  const mois = Number(dateBulletin.slice(5, 7));
  return mois >= 3;
}
