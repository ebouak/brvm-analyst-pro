/**
 * Parser des INDICES BRVM (BRVM 30, BRVM Composite, et éventuels autres :
 * BRVM Prestige, indices sectoriels…).
 *
 * Les indices sont souvent rendus soit dans un petit tableau dédié, soit dans
 * des labels/spans en tête de page. On tente les deux stratégies.
 */
import * as cheerio from 'cheerio';
import type { IndiceRow } from '../types.js';
import { parseFrNumber, cleanText } from '../utils/parseNumber.js';
import { parseTable, buildColumnIndex, cell, isDataRow } from './table.js';
import { logger } from '../logger.js';

export const INDICES_TABLE_SELECTORS = [
  '#ContentPlaceHolder1_GridViewIndices',
  '#ContentPlaceHolder1_gvIndices',
  'table[id*="Indice"]',
  'table.gridIndices',
];

const COLUMN_SPEC: Record<string, string[]> = {
  libelle: ['indice', 'libelle', 'designation', 'nom'],
  valeur: ['valeur', 'cours', 'niveau', 'valeur jour'],
  valeur_precedente: ['precedent', 'valeur precedente', 'veille'],
  variation_pct: ['variation', 'var', 'var %'],
};

/** Mappe un libellé d'indice vers un code interne stable. */
export function indexCodeFromLabel(label: string): string {
  const l = cleanText(label).toLowerCase();
  if (l.includes('30')) return 'BRVM30';
  if (l.includes('composite') || l.includes('compos')) return 'BRVMC';
  if (l.includes('prestige')) return 'BRVMP';
  if (l.includes('principal')) return 'BRVMPR';
  // fallback : slug alphanumérique
  return cleanText(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12) || 'IDX';
}

function parseFromTable(html: string): IndiceRow[] {
  const $ = cheerio.load(html);
  for (const sel of INDICES_TABLE_SELECTORS) {
    const table = parseTable($, sel);
    if (!table || table.rows.length === 0) continue;
    const idx = buildColumnIndex(table.headers, COLUMN_SPEC);
    const out: IndiceRow[] = [];
    for (const row of table.rows) {
      if (!isDataRow(row)) continue;
      const libelle = cleanText(cell(row, idx, 'libelle'));
      if (!libelle) continue;
      out.push({
        code: indexCodeFromLabel(libelle),
        libelle,
        valeur: parseFrNumber(cell(row, idx, 'valeur')),
        valeur_precedente: parseFrNumber(cell(row, idx, 'valeur_precedente')),
        variation_pct: parseFrNumber(cell(row, idx, 'variation_pct')),
      });
    }
    if (out.length > 0) {
      logger.debug({ selector: sel, count: out.length }, 'Indices via tableau');
      return out;
    }
  }
  return [];
}

/**
 * Fallback : cherche des libellés connus dans le texte et la valeur numérique
 * la plus proche (utile si les indices sont dans des <span>/<label>).
 */
function parseFromLabels(html: string): IndiceRow[] {
  const $ = cheerio.load(html);
  const text = cleanText($('body').text());
  const out: IndiceRow[] = [];

  const patterns: Array<{ code: string; libelle: string; re: RegExp }> = [
    {
      code: 'BRVM30',
      libelle: 'BRVM 30',
      re: /brvm\s*30[^0-9\-+]*([\-+]?[\d  .,]+)/i,
    },
    {
      code: 'BRVMC',
      libelle: 'BRVM Composite',
      re: /brvm\s*compos\w*[^0-9\-+]*([\-+]?[\d  .,]+)/i,
    },
  ];

  for (const p of patterns) {
    const m = text.match(p.re);
    if (m && m[1]) {
      const valeur = parseFrNumber(m[1]);
      if (valeur != null) {
        out.push({
          code: p.code,
          libelle: p.libelle,
          valeur,
          valeur_precedente: null,
          variation_pct: null,
        });
      }
    }
  }
  if (out.length > 0) logger.debug({ count: out.length }, 'Indices via labels');
  return out;
}

export function parseIndices(html: string): IndiceRow[] {
  const fromTable = parseFromTable(html);
  if (fromTable.length > 0) return fromTable;
  const fromLabels = parseFromLabels(html);
  if (fromLabels.length === 0) {
    logger.warn('Aucun indice détecté (ni tableau ni label)');
  }
  return fromLabels;
}
