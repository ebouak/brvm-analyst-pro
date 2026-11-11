/**
 * Opérations, avis et communiqués lus dans le Bulletin Officiel de la Cote
 * (tables `boc_operations`, `boc_avis`). Module PUR.
 */

export interface BocOperation {
  emetteur: string;
  code: string | null;
  operation: string;
  type_operation: string;
  date_operation: string | null;
  premier_bulletin: string;
  dernier_bulletin: string;
}

export interface BocAvis {
  categorie: 'avis' | 'communique';
  entite: string;
  code: string | null;
  numero: string | null;
  nature: string | null;
  objet: string;
  date_bulletin: string;
}

export const COLONNES_OPERATION = 'emetteur, code, operation, type_operation, date_operation, premier_bulletin, dernier_bulletin';
export const COLONNES_AVIS = 'categorie, entite, code, numero, nature, objet, date_bulletin';

/**
 * Opérations EN COURS : celles que le dernier bulletin lu liste encore.
 * Une opération qui n'y figure plus est terminée ; la montrer « en cours »
 * serait faux. Triées par échéance (sans échéance en dernier).
 */
export function operationsEnCours(rows: readonly BocOperation[], dernier: string | null): BocOperation[] {
  if (!dernier) return [];
  return rows
    .filter((r) => r.dernier_bulletin === dernier)
    .sort((a, b) => (a.date_operation ?? '9999').localeCompare(b.date_operation ?? '9999'));
}

/** « 1004-2026 » → 1004 : un tri de chaînes mettrait « 999 » après « 1004 ». */
function rang(numero: string | null): number {
  const m = numero ? /^(\d+)/.exec(numero) : null;
  return m ? Number(m[1]) : -1;
}

/** Avis et communiqués, du plus récent au plus ancien, au plus `n`. */
export function derniersAvis(rows: readonly BocAvis[], n = 5): BocAvis[] {
  return [...rows]
    .sort((a, b) => b.date_bulletin.localeCompare(a.date_bulletin) || rang(b.numero) - rang(a.numero))
    .slice(0, n);
}

export function libelleCategorie(c: BocAvis['categorie']): string {
  return c === 'avis' ? 'Avis BRVM' : 'Communiqué';
}
