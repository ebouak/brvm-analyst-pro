/**
 * Backfill historique BRVM depuis le repo public GitHub :
 * https://github.com/Fredysessie/brvm-data-public
 *
 * URL pattern : https://raw.githubusercontent.com/Fredysessie/brvm-data-public/main/data/{CODE}/{CODE}.daily.csv
 * Format CSV : Date,Open,High,Low,Close,Volume
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';

const BASE_RAW = 'https://raw.githubusercontent.com/Fredysessie/brvm-data-public/main/data';
const API_URL  = 'https://api.github.com/repos/Fredysessie/brvm-data-public/contents/data';

export interface BackfillRow {
  code:            string;
  date_marche:     string;   // YYYY-MM-DD
  cours_precedent: number | null;
  cours_jour:      number;
  variation_pct:   number | null;
  volume:          number | null;
  // valeur_echangee estimée : volume (titres) × cours_jour
  valeur_echangee: number | null;
}

/** Liste les codes disponibles dans le repo GitHub. */
export async function listGithubCodes(): Promise<string[]> {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'brvm-analyst-pro/backfill' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as { name: string; type: string }[];
  return data.filter((d) => d.type === 'dir' && !d.name.startsWith('BRVM') && !d.name.startsWith('currency')).map((d) => d.name);
}

/** Télécharge et parse le CSV daily pour un code donné. */
export async function fetchDailyCSV(code: string): Promise<BackfillRow[]> {
  const url = `${BASE_RAW}/${code}/${code}.daily.csv`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'brvm-analyst-pro/backfill' },
  });
  if (res.status === 404) {
    logger.warn({ code }, 'CSV non trouvé sur GitHub — ignoré');
    return [];
  }
  if (!res.ok) throw new Error(`Fetch ${code} ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const rows: BackfillRow[] = [];
  let prevClose: number | null = null;

  // Sauter l'en-tête
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(',');
    if (parts.length < 5) continue;

    const date = parts[0]!.trim();
    const close = parseFloat(parts[4]!.trim());
    const vol   = parts[5] ? parseInt(parts[5].trim(), 10) : null;

    if (!date || isNaN(close)) continue;

    const variation_pct = prevClose != null && prevClose > 0
      ? ((close - prevClose) / prevClose) * 100
      : null;

    const volumeVal = !isNaN(vol as number) && vol !== null ? (vol as number) : null;
    rows.push({
      code,
      date_marche:     date,
      cours_precedent: prevClose,
      cours_jour:      close,
      variation_pct:   variation_pct != null ? Math.round(variation_pct * 10000) / 10000 : null,
      volume:          volumeVal,
      // Valeur échangée estimée (volume titres × cours) — approximation pour compatibilité dashboard
      valeur_echangee: volumeVal != null ? Math.round(volumeVal * close) : null,
    });

    prevClose = close;
  }

  return rows;
}

/** Upsert idempotent des lignes dans brvm_actions_daily (batch de 500). */
export async function upsertBackfillRows(rows: BackfillRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = getSupabase();
  const BATCH = 500;
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb
      .from('brvm_actions_daily')
      .upsert(batch, { onConflict: 'code,date_marche', ignoreDuplicates: false });
    if (error) throw new Error(`upsert batch ${i}: ${error.message}`);
    total += batch.length;
  }

  return total;
}

/** Vérifie que le code existe dans brvm_instruments, l'insère sinon. */
export async function ensureInstrument(code: string): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb
    .from('brvm_instruments')
    .select('code')
    .eq('code', code)
    .limit(1);
  if ((data?.length ?? 0) === 0) {
    await sb.from('brvm_instruments').upsert(
      [{ code, designation: code, type: 'action', actif: true }],
      { onConflict: 'code' },
    );
    logger.info({ code }, 'Instrument créé depuis backfill GitHub');
  }
}
