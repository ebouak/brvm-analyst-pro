import 'server-only';
import brvmSectors from '@/lib/brvmSectors.json';
import { createPublicClient } from '@/lib/supabase/public';
import { calculateSectorBreadth, type DatedClose, type SectorBreadthReading } from '../movingAverages';

export interface SectorCloseRow {
  code: string;
  date_marche: string;
  cours_jour: number | null;
}

export interface SectorBreadthResult {
  status: 'available' | 'insufficient';
  reading: SectorBreadthReading | null;
}

const PAGE_SIZE = 1000;
const WINDOW_DAYS = 400;
const SECTOR_BY_CODE = brvmSectors as Record<string, string>;

export async function paginateSectorRows(
  readPage: (offset: number, pageSize: number) => Promise<SectorCloseRow[]>,
  pageSize = PAGE_SIZE,
): Promise<SectorCloseRow[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('La taille de page doit être un entier positif.');
  }

  const rows: SectorCloseRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await readPage(offset, pageSize);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function firstDate(asOfDate: string): string {
  const date = new Date(`${asOfDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== asOfDate) {
    throw new RangeError(`Date de séance invalide : ${asOfDate}`);
  }
  date.setUTCDate(date.getUTCDate() - (WINDOW_DAYS - 1));
  return date.toISOString().slice(0, 10);
}

function insufficient(reading: SectorBreadthReading | null = null): SectorBreadthResult {
  return { status: 'insufficient', reading };
}

export async function loadSectorBreadth(secteur: string | null, asOfDate: string): Promise<SectorBreadthResult> {
  if (!secteur?.trim()) return insufficient();

  const codes = Object.entries(SECTOR_BY_CODE)
    .filter(([, sector]) => sector === secteur)
    .map(([code]) => code);
  if (codes.length === 0) return insufficient();

  const since = firstDate(asOfDate);
  const supabase = createPublicClient();
  const rows = await paginateSectorRows(async (offset, pageSize) => {
    const { data, error } = await supabase
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour')
      .in('code', codes)
      .gte('date_marche', since)
      .lte('date_marche', asOfDate)
      .not('cours_jour', 'is', null)
      .order('code', { ascending: true })
      .order('date_marche', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Impossible de lire les cours du secteur ${secteur} au ${asOfDate} : ${error.message}`);
    }

    return (data ?? []) as SectorCloseRow[];
  });

  const seriesByCode = new Map<string, DatedClose[]>();
  for (const row of rows) {
    const points = seriesByCode.get(row.code) ?? [];
    points.push({
      code: row.code,
      date: row.date_marche,
      close: row.cours_jour == null ? null : Number(row.cours_jour),
    });
    seriesByCode.set(row.code, points);
  }

  const reading = calculateSectorBreadth([...seriesByCode.values()], asOfDate);
  const available = reading.sma50Above.percent != null || reading.sma200Above.percent != null;
  return { status: available ? 'available' : 'insufficient', reading };
}
