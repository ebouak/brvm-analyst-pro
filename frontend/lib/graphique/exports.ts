// Graphique avancé : construction des exports de cours (CSV, TXT, XLSX, PDF).
//
// Les quatre formats partagent UN tableau construit ici : mêmes colonnes,
// mêmes lignes, même mention de source. Une donnée absente en base reste une
// cellule VIDE — jamais un zéro, jamais une estimation.

import type { Barre, Intervalle } from './donnees';

export type FormatExport = 'csv' | 'xlsx' | 'txt' | 'pdf';

export const COLONNES_EXPORT = [
  'Date',
  'Ouverture',
  'Plus haut',
  'Plus bas',
  'Clôture',
  'Variation (%)',
  'Volume (titres)',
  'Valeur échangée (FCFA)',
] as const;

export type Cellule = string | number | null;

export interface MetaExport {
  code: string;
  designation: string | null;
  intervalle: Intervalle;
  extraitLe: Date;
}

export interface TableauExport {
  titre: string;
  mentions: string[];
  colonnes: readonly string[];
  lignes: Cellule[][];
}

export const SOURCE_EXPORT =
  'Source : Bourse Régionale des Valeurs Mobilières (BRVM), cours collectés et conservés par WESTBOURSE (westbourse.com).';

const LIBELLE_INTERVALLE: Record<Intervalle, string> = { jour: 'séance', semaine: 'semaine', mois: 'mois' };

function deuxDecimales(n: number): number {
  return Math.round(n * 100) / 100;
}

/** « 16/11/2026 à 14:05 UTC » — l'heure UTC évite toute ambiguïté de fuseau. */
export function horodatage(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} à ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export function construireTableau(barres: readonly Barre[], meta: MetaExport): TableauExport {
  const nom = meta.designation ? `${meta.code} — ${meta.designation}` : meta.code;
  const debut = barres[0]?.date ?? null;
  const fin = barres[barres.length - 1]?.date ?? null;
  const mentions = [
    `Valeur : ${nom}`,
    `Intervalle : ${LIBELLE_INTERVALLE[meta.intervalle]}${debut && fin ? `, du ${debut} au ${fin}` : ''} (${barres.length} ligne${barres.length > 1 ? 's' : ''})`,
    SOURCE_EXPORT,
    `Extraction : ${horodatage(meta.extraitLe)}`,
    meta.intervalle === 'jour'
      ? 'Variation : publiée par la BRVM pour la séance.'
      : 'Variation : calculée de clôture à clôture par rapport à la période précédente. Date = dernière séance de la période.',
    'Cellule vide : donnée non disponible dans la base (jamais remplacée par zéro ni estimée).',
  ];
  const lignes: Cellule[][] = barres.map((b) => [
    b.date,
    b.ouverture,
    b.haut,
    b.bas,
    b.cloture,
    b.variationPct == null ? null : deuxDecimales(b.variationPct),
    b.volume,
    b.valeur,
  ]);
  return { titre: `Cours ${nom}`, mentions, colonnes: COLONNES_EXPORT, lignes };
}

/** Nombre au format français, sans séparateur de milliers (lisible par Excel FR). */
export function nombreFr(v: number): string {
  return String(v).replace('.', ',');
}

function texteCellule(c: Cellule): string {
  if (c == null) return '';
  return typeof c === 'number' ? nombreFr(c) : c;
}

function echapperCsv(s: string): string {
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV séparé par des points-virgules, UTF-8 avec BOM (Excel FR). */
export function versCsv(t: TableauExport): string {
  const l: string[] = [];
  l.push(echapperCsv(t.titre));
  for (const m of t.mentions) l.push(echapperCsv(m));
  l.push('');
  l.push(t.colonnes.map(echapperCsv).join(';'));
  for (const row of t.lignes) l.push(row.map((c) => echapperCsv(texteCellule(c))).join(';'));
  return '﻿' + l.join('\r\n') + '\r\n';
}

/** Texte tabulé. Les tabulations et retours à la ligne d'une cellule sont neutralisés. */
export function versTxt(t: TableauExport): string {
  const net = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  const l: string[] = [net(t.titre), ...t.mentions.map(net), ''];
  l.push(t.colonnes.map(net).join('\t'));
  for (const row of t.lignes) l.push(row.map((c) => net(texteCellule(c))).join('\t'));
  return '﻿' + l.join('\r\n') + '\r\n';
}

/** Nom de fichier : `SNTS_cours_jour_2007-01-02_2026-11-13.csv`. */
export function nomFichier(t: TableauExport, meta: MetaExport, format: FormatExport): string {
  const debut = (t.lignes[0]?.[0] as string | undefined) ?? 'vide';
  const fin = (t.lignes[t.lignes.length - 1]?.[0] as string | undefined) ?? 'vide';
  const code = meta.code.replace(/[^A-Z0-9]/gi, '');
  return `${code}_cours_${meta.intervalle}_${debut}_${fin}.${format}`;
}

/** Classeur XLSX (ExcelJS) : mentions en tête, puis tableau numérique. */
export async function versXlsx(t: TableauExport): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WESTBOURSE';
  wb.created = new Date();
  const ws = wb.addWorksheet('Cours');
  ws.addRow([t.titre]).font = { bold: true, size: 13 };
  for (const m of t.mentions) ws.addRow([m]).font = { size: 9, color: { argb: 'FF555555' } };
  ws.addRow([]);
  const entete = ws.addRow([...t.colonnes]);
  entete.font = { bold: true };
  entete.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF0' } };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF888888' } } };
  });
  const premiereLigneDonnees = ws.rowCount + 1;
  for (const row of t.lignes) {
    const r = ws.addRow(row.map((c) => (c == null ? null : c)));
    const date = row[0];
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number) as [number, number, number];
      const cell = r.getCell(1);
      cell.value = new Date(Date.UTC(y, m - 1, d));
      cell.numFmt = 'dd/mm/yyyy';
    }
  }
  ws.getColumn(1).width = 12;
  for (let i = 2; i <= t.colonnes.length; i++) ws.getColumn(i).width = i >= 7 ? 18 : 12;
  ws.getColumn(6).numFmt = '0.00';
  for (const i of [2, 3, 4, 5, 7, 8]) ws.getColumn(i).numFmt = '#,##0.##';
  ws.views = [{ state: 'frozen', ySplit: premiereLigneDonnees - 1 }];
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
