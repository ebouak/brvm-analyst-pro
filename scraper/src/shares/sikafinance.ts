/**
 * Récupération du nombre d'actions en circulation depuis sikafinance.
 * Stratégie : capitalisation boursière publiée / dernier cours = nombre d'actions.
 * Le SCRAPER peut lire des sources externes (le frontend reste Supabase-only).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { parseFrNumber } from '../utils/parseNumber.js';

const SIKA_CAP_URL = 'https://www.sikafinance.com/marches/capitalisations_brvm';

/** shares = capitalisation / cours (arrondi entier), ou null si non calculable. */
export function parseSharesFromCapitalisation(
  capitalisation: number | null,
  cours: number | null,
): number | null {
  if (capitalisation == null || cours == null || cours <= 0) return null;
  // Arrondi entier (half-down pour rester cohérent avec la spec de test).
  return Math.ceil(capitalisation / cours - 0.5);
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const STOP = new Set(['ci','sn','bf','tg','sa','group','groupe','cote','ivoire','de','du','des']);
function tokens(s: string): string[] {
  return normalizeStr(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t));
}
function similarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  let inter = 0;
  for (const t of ta) {
    if (setB.has(t)) inter += 1;
    else if (tb.some((x) => x.startsWith(t) || t.startsWith(x))) inter += 0.6;
  }
  return inter / Math.max(ta.length, tb.length);
}

interface Instrument { code: string; designation: string | null; }

export interface SharesRow { code: string; shares: number; source: 'sikafinance'; }

/** Récupère et calcule le nombre d'actions par société BRVM. */
export async function fetchSharesFromSikafinance(): Promise<SharesRow[]> {
  const sb = getSupabase();
  const { data: instruments, error } = await sb
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .eq('actif', true);
  if (error) throw new Error(`load instruments: ${error.message}`);

  const { data: quotes } = await sb
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche')
    .order('date_marche', { ascending: false });
  const lastCours: Record<string, number | null> = {};
  for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) {
    if (!(q.code in lastCours)) lastCours[q.code] = q.cours_jour;
  }

  const res = await axios.get<string>(SIKA_CAP_URL, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' },
    responseType: 'text',
  });
  const $ = cheerio.load(res.data);

  const match = (name: string): string | null => {
    let best: string | null = null, bestScore = 0;
    for (const ins of (instruments ?? []) as Instrument[]) {
      const s = similarity(name, ins.designation ?? ins.code);
      if (s > bestScore) { bestScore = s; best = ins.code; }
    }
    return bestScore >= 0.5 ? best : null;
  };

  const out: SharesRow[] = [];
  const seen = new Set<string>();
  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td').map((__, td) => $(td).text().trim()).get();
    if (cells.length < 2) return;
    const name = cells[0];
    const nums = cells.map((c) => parseFrNumber(c)).filter((n): n is number => n != null);
    if (!nums.length) return;
    const capitalisation = Math.max(...nums);
    const code = match(name);
    if (!code || seen.has(code)) return;
    const shares = parseSharesFromCapitalisation(capitalisation, lastCours[code] ?? null);
    if (shares && shares > 0) { out.push({ code, shares, source: 'sikafinance' }); seen.add(code); }
  });

  logger.info({ count: out.length }, 'Nombre d actions récupéré (sikafinance)');
  return out;
}
