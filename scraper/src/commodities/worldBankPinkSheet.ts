/**
 * Ingestion des prix mensuels de matières premières depuis le World Bank
 * « Pink Sheet » (CMO-Historical-Data-Monthly.xlsx).
 *
 * Source vérifiée : feuille « Monthly Prices ».
 *   - ligne 4 : libellés des commodities ; ligne 5 : unités ; données dès ligne 6.
 *   - colonne 0 : date au format `YYYYMmm` (ex. « 2025M12 »).
 * Mapping des colonnes par libellé (jamais par index fixe).
 *
 * Commodities retenues (sous-jacents des actions agro BRVM) :
 *   cocoa, palm_oil, sugar (world), rubber (TSR20).
 */
import axios from 'axios';
import * as XLSX from 'xlsx';
import { logger } from '../logger.js';

const log = logger.child({ module: 'worldBankPinkSheet' });

const PINK_SHEET_URL =
  'https://thedocs.worldbank.org/en/doc/18675f1d1639c7a34d463f59263ba0a2-0050012025/related/CMO-Historical-Data-Monthly.xlsx';

export interface CommodityPriceRow {
  commodity: 'cocoa' | 'palm_oil' | 'sugar' | 'rubber';
  date: string; // YYYY-MM-01
  price: number;
  unit: string | null;
}

/** Libellé Pink Sheet (normalisé, inclusion) → clé interne. Ordre = priorité. */
const HEADER_MAP: { match: string; key: CommodityPriceRow['commodity'] }[] = [
  { match: 'cocoa', key: 'cocoa' },
  { match: 'palm oil', key: 'palm_oil' },
  { match: 'sugar, world', key: 'sugar' },
  { match: 'rubber, tsr20', key: 'rubber' },
];

function normalize(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** « 2025M12 » → « 2025-12-01 ». Renvoie null si non reconnu. */
function parsePinkDate(raw: unknown): string | null {
  const m = String(raw ?? '').match(/^(\d{4})M(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '' || t === '…' || t === '..' || t === 'n/a') return null;
    const n = Number(t.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Parse le classeur déjà téléchargé (buffer xlsx). */
export function parsePinkSheet(buffer: ArrayBuffer | Buffer): CommodityPriceRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Monthly Prices'] ?? wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new Error('Feuille « Monthly Prices » introuvable');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  // Repère la ligne d'en-têtes : celle qui contient « cocoa » ET « palm oil ».
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const norm = (rows[i] ?? []).map(normalize);
    if (norm.some((h) => h.includes('cocoa')) && norm.some((h) => h.includes('palm oil'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Ligne d\'en-têtes Pink Sheet introuvable');

  const headers = (rows[headerIdx] ?? []).map(normalize);
  const units = (rows[headerIdx + 1] ?? []) as unknown[];

  // Colonne cible par commodity (première colonne dont le libellé inclut le motif).
  const colByKey = new Map<CommodityPriceRow['commodity'], { idx: number; unit: string | null }>();
  for (const { match, key } of HEADER_MAP) {
    if (colByKey.has(key)) continue;
    const idx = headers.findIndex((h) => h.includes(match));
    if (idx >= 0) {
      const u = units[idx];
      colByKey.set(key, { idx, unit: u != null ? String(u).replace(/[()]/g, '').trim() : null });
    }
  }
  if (colByKey.size === 0) throw new Error('Aucune commodity cible trouvée dans les en-têtes');

  const out: CommodityPriceRow[] = [];
  for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const date = parsePinkDate(row[0]);
    if (!date) continue;
    for (const [commodity, { idx, unit }] of colByKey) {
      const price = parseNum(row[idx]);
      if (price == null || price <= 0) continue;
      out.push({ commodity, date, price, unit });
    }
  }

  log.info({ count: out.length, commodities: [...colByKey.keys()] }, 'Pink Sheet parsé');
  return out;
}

/** Télécharge puis parse le Pink Sheet. */
export async function fetchPinkSheet(): Promise<CommodityPriceRow[]> {
  const res = await axios.get<ArrayBuffer>(PINK_SHEET_URL, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    headers: { 'User-Agent': 'BRVMAnalystPro/1.0' },
  });
  return parsePinkSheet(Buffer.from(res.data));
}
