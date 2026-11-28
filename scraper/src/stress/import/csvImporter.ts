/**
 * Parseur CSV/TSV tolérant pour import historique d'indices BRVM
 * (fichiers officiels BRVM, Investing.com, Sikafinance, exports manuels).
 *
 * Accepte séparateurs `,`, `;` ou `\t`, dates ISO `YYYY-MM-DD` ou FR `DD/MM/YYYY`,
 * nombres FR (`1 234,56`) ou US (`1234.56`), et passe systématiquement par
 * `validerSerieIndice` pour bloquer doublons, valeurs nulles et dates pré-création.
 */
import { parseFrNumber } from '../../utils/parseNumber.js';
import { validerSerieIndice } from '../pure/dataQuality.js';
import type { AnomalieQualite, PointIndice } from '../pure/types.js';

function normCol(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["']/g, '')
    .trim();
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseDateFlexible(raw: string): string | null {
  const s = raw.replace(/["']/g, '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  const us = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  return null;
}

function parseNumberFlexible(raw: string): number | null {
  const s = raw.replace(/["']/g, '').trim();
  if (!s || s === '-' || s === '—' || s.toLowerCase() === 'null') return null;
  // Format US avec virgule milliers et point décimal : "1,234.56"
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  // Format US simple : "555.48"
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return parseFrNumber(s);
}

export function parseIndexCsv(
  csvText: string,
  indiceCode: string,
  sourceLabel: string,
): { seriePropre: PointIndice[]; anomalies: AnomalieQualite[]; lignesLues: number } {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { seriePropre: [], anomalies: [], lignesLues: 0 };
  }

  const headerLine = lines[0]!;
  const sep = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';
  const headers = splitCsvLine(headerLine, sep).map(normCol);

  const findIdx = (patterns: string[]) =>
    headers.findIndex((h) => patterns.some((p) => h === p || h.includes(p)));

  const iDate = findIdx(['date_marche', 'date', 'seance']);
  const iVal = findIdx(['valeur', 'cloture', 'close', 'dernier', 'price', 'indice']);
  const iVar = findIdx(['variation_pct', 'variation', 'change %', 'var']);
  const iVol = findIdx(['volume', 'vol']);
  const iCap = findIdx(['capitalisation', 'market cap']);

  if (iDate < 0 || iVal < 0) {
    throw new Error(`En-têtes CSV invalides pour ${indiceCode} (Date/Valeur introuvables : ${headers.join(', ')})`);
  }

  const bruts: PointIndice[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]!, sep);
    const date = parseDateFlexible(cols[iDate] ?? '');
    const val = parseNumberFlexible(cols[iVal] ?? '');
    if (!date || val == null) continue;
    const varPct = iVar >= 0 ? parseNumberFlexible(cols[iVar] ?? '') : null;
    const vol = iVol >= 0 ? parseNumberFlexible(cols[iVol] ?? '') : null;
    const cap = iCap >= 0 ? parseNumberFlexible(cols[iCap] ?? '') : null;
    bruts.push({
      date_marche: date,
      valeur: val,
      variation_pct: varPct,
      volume: vol != null && vol >= 0 ? Math.round(vol) : null,
      capitalisation: cap != null && cap >= 0 ? cap : null,
      source: sourceLabel,
      qualite: 'import_csv_valide',
    });
  }

  const { seriePropre, anomalies } = validerSerieIndice(indiceCode, bruts);

  // Compléter variation_pct si absente du CSV
  for (let i = 0; i < seriePropre.length; i++) {
    const cur = seriePropre[i]!;
    if (cur.variation_pct == null && i > 0) {
      const prev = seriePropre[i - 1]!;
      if (prev.valeur > 0) {
        cur.variation_pct = Math.round(((cur.valeur / prev.valeur) - 1) * 10_000) / 100;
      }
    }
  }

  return { seriePropre, anomalies, lignesLues: lines.length - 1 };
}
