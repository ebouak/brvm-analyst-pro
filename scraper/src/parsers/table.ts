/**
 * Helpers génériques d'extraction de tableaux HTML (ASP.NET GridView).
 *
 * Stratégie de robustesse : on identifie les colonnes par le LIBELLÉ de
 * l'en-tête (normalisé sans accents/casse) plutôt que par un index fixe.
 * Si BDFIN réordonne ou insère une colonne, le mapping suit (cf. §11 :
 * "le scraping peut casser si le markup change" — on minimise ce risque).
 */
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { cleanText } from '../utils/parseNumber.js';

/** Normalise un libellé d'en-tête pour le matching : minuscules, sans accents. */
export function normalizeHeader(s: string): string {
  return cleanText(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedTable {
  /** Libellés d'en-tête normalisés, dans l'ordre. */
  headers: string[];
  /** Lignes de données : chaque ligne = tableau de cellules (texte nettoyé). */
  rows: string[][];
}

/**
 * Extrait un tableau à partir d'un sélecteur CSS.
 * Gère <thead>/<tbody> ou un simple ensemble de <tr>.
 */
export function parseTable($: CheerioAPI, selector: string): ParsedTable | null {
  const table = $(selector).first();
  if (table.length === 0) return null;

  // En-têtes : <th> en priorité, sinon première ligne.
  let headers: string[] = [];
  const ths = table.find('tr').first().find('th');
  if (ths.length > 0) {
    headers = ths.toArray().map((el) => normalizeHeader($(el).text()));
  }

  const trs = table.find('tr').toArray();
  const rows: string[][] = [];
  for (let i = 0; i < trs.length; i++) {
    const tr = $(trs[i] as Element);
    const cells = tr.find('td');
    if (cells.length === 0) {
      // ligne d'en-tête (que des <th>) : si on n'a pas encore d'en-têtes, on la prend.
      if (headers.length === 0) {
        const hcells = tr.find('th');
        if (hcells.length > 0) {
          headers = hcells.toArray().map((el) => normalizeHeader($(el).text()));
        }
      }
      continue;
    }
    rows.push(cells.toArray().map((el) => cleanText($(el).text())));
  }

  return { headers, rows };
}

/**
 * Construit un index "nom logique" -> position de colonne, en testant
 * plusieurs alias possibles d'en-tête pour chaque champ.
 *
 * Stratégie en deux passes pour éviter qu'un alias générique ne capture une
 * colonne plus spécifique (ex: l'alias "cours" de cours_jour ne doit pas
 * matcher "cours precedent" avant que cours_precedent ne soit assigné) :
 *   1) correspondance EXACTE (h === alias), prioritaire ;
 *   2) correspondance par inclusion, uniquement sur les colonnes non encore
 *      assignées.
 * Une colonne n'est jamais affectée à deux champs.
 */
export function buildColumnIndex(
  headers: string[],
  spec: Record<string, string[]>,
): Record<string, number> {
  const index: Record<string, number> = {};
  const used = new Set<number>();

  // Passe 1 : exact.
  for (const [field, aliases] of Object.entries(spec)) {
    const pos = headers.findIndex(
      (h, i) => !used.has(i) && aliases.some((a) => h === a),
    );
    if (pos >= 0) {
      index[field] = pos;
      used.add(pos);
    }
  }

  // Passe 2 : inclusion, sur colonnes libres, pour les champs non résolus.
  for (const [field, aliases] of Object.entries(spec)) {
    if (field in index) continue;
    const pos = headers.findIndex(
      (h, i) => !used.has(i) && aliases.some((a) => h.includes(a)),
    );
    if (pos >= 0) {
      index[field] = pos;
      used.add(pos);
    }
  }

  return index;
}

/** Récupère la cellule d'une ligne pour un champ logique (ou null). */
export function cell(
  row: string[],
  index: Record<string, number>,
  field: string,
): string | null {
  const pos = index[field];
  if (pos == null) return null;
  return row[pos] ?? null;
}

/** Filtre les lignes vides ou de pied de page (totaux).
 * La première cellule peut être vide (image de tendance BDFIN) — on cherche
 * la première cellule non-vide pour détecter les lignes "total". */
export function isDataRow(row: string[]): boolean {
  const joined = row.join('').trim();
  if (joined === '') return false;
  // Cherche la première cellule non-vide (ignore les colonnes image).
  const firstNonEmpty = row.find((c) => c.trim() !== '') ?? '';
  const firstNorm = normalizeHeader(firstNonEmpty);
  return !['total', 'totaux', 'volume total'].includes(firstNorm);
}

export type { Cheerio, Element };
