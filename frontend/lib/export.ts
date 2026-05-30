export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  format?: (value: unknown) => string;
}

/** Sanitize/escape une cellule CSV */
export function escapeCSV(
  value: string | number | null | undefined,
  sep: string,
): string {
  if (value == null) return '';
  const str = String(value);
  const needsQuote =
    str.includes(sep) || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (!needsQuote) return str;
  return '"' + str.replace(/"/g, '""') + '"';
}

/**
 * Génère et déclenche le téléchargement d'un CSV (UTF-8 avec BOM pour Excel FR).
 */
export function downloadCSV<T>(args: {
  filename: string;
  columns: CsvColumn<T>[];
  rows: T[];
  separator?: ',' | ';';
}): void {
  const sep = args.separator ?? ';';
  const BOM = '﻿';

  const header = args.columns
    .map((col) => escapeCSV(col.header, sep))
    .join(sep);

  const dataRows = args.rows.map((row) => {
    return args.columns
      .map((col) => {
        const raw = col.accessor(row);
        const value = col.format ? col.format(raw) : raw;
        return escapeCSV(value as string | number | null | undefined, sep);
      })
      .join(sep);
  });

  const csv = BOM + [header, ...dataRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = args.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
