import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { parseSikaSociete } from './sikaSociete.js';

/**
 * Historique des dividendes (5 exercices) depuis les fiches sociétés Sikafinance.
 *
 * ── Pourquoi cette commande existe ──
 * La table `dividends` était inexploitable :
 *   • 90 lignes de PUR BRUIT (montant == exercice) — l'ancien parser lisait
 *     « Dividende 2012 » et retenait 2012 COMME MONTANT. Les communiqués BDFIN ne
 *     contiennent que des TITRES de PDF, pas de montants : il n'y avait rien à lire.
 *   • 29 couples (code, exercice) en DOUBLON CONTRADICTOIRE — BOAM 2025 avait
 *     quatre valeurs différentes (305,04 / 450 / 397 / 305). Impossible d'arbitrer.
 *
 * On reconstruit donc depuis une source unique et cohérente : la fiche société,
 * qui donne UNE valeur par exercice sur cinq ans.
 *
 * Idempotent : upsert sur (code, exercice).
 */

const BASE = 'https://www.sikafinance.com';
const LISTE = `${BASE}/marches/dividendes`;
const UA = 'Mozilla/5.0 (compatible; WestbourseBot/1.0; +https://www.westbourse.com)';

/** Tickers Sikafinance (« BOAC.ci ») — le suffixe pays fait partie de l'URL. */
export async function fetchTickers(): Promise<string[]> {
  const resp = await fetch(LISTE, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!resp.ok) throw new Error(`Sikafinance liste : HTTP ${resp.status}`);

  const $ = cheerio.load(await resp.text());
  const out: string[] = [];
  $('#dpShares option').each((_, el) => {
    const v = ($(el).attr('value') ?? '').trim();
    // On écarte les INDICES (BRVMAG, BRVMC…) : ils ne versent pas de dividende.
    if (v && v.includes('.') && !v.startsWith('BRVM')) out.push(v);
  });
  return out;
}

/** Code interne (BOAC) à partir du ticker Sikafinance (BOAC.ci). */
function toCode(ticker: string): string {
  return (ticker.split('.')[0] ?? ticker).toUpperCase();
}

export interface HistoryResult {
  titres: number;
  lignes: number;
  echecs: number;
}

export async function runDividendHistory(
  opts: { mock?: boolean; dryRun?: boolean } = {},
): Promise<HistoryResult> {
  if (opts.mock) {
    logger.info('dividend-history: mode mock, rien collecté');
    return { titres: 0, lignes: 0, echecs: 0 };
  }

  const tickers = await fetchTickers();
  logger.info({ tickers: tickers.length }, 'dividend-history: valeurs à traiter');

  const rows: Record<string, unknown>[] = [];
  let echecs = 0;
  const titresOk = new Set<string>();

  for (const ticker of tickers) {
    const code = toCode(ticker);
    try {
      const resp = await fetch(`${BASE}/marches/societe/${ticker}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(25000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const divs = parseSikaSociete(await resp.text());
      if (divs.length === 0) {
        // Pas de tableau : on ne sait rien. On NE crée PAS de ligne à zéro —
        // « inconnu » et « n'a rien versé » sont deux choses différentes.
        logger.warn({ code }, 'dividend-history: aucun historique publié');
        continue;
      }

      for (const d of divs) {
        rows.push({
          code,
          exercice: d.exercice,
          montant: d.montant,
          devise: 'XOF',
          source: 'sikafinance-societe',
          source_url: `${BASE}/marches/societe/${ticker}`,
        });
      }
      titresOk.add(code);
      logger.info({ code, exercices: divs.length }, 'dividend-history: collecté');
    } catch (e) {
      echecs++;
      // Un titre en échec ne doit pas faire tomber les cinquante autres.
      logger.error({ code, err: (e as Error).message }, 'dividend-history: échec');
    }

    // Politesse : on n'assomme pas la source.
    await new Promise((r) => setTimeout(r, 400));
  }

  if (rows.length === 0) throw new Error('dividend-history: aucune donnée collectée');

  if (opts.dryRun) {
    logger.info({ lignes: rows.length }, 'dividend-history: DRY_RUN, rien écrit');
    return { titres: titresOk.size, lignes: rows.length, echecs };
  }

  const { error } = await getSupabase()
    .from('dividends')
    .upsert(rows, { onConflict: 'code,exercice' });
  if (error) throw new Error(`dividend-history: upsert échoué — ${error.message}`);

  logger.info(
    { titres: titresOk.size, lignes: rows.length, echecs },
    'dividend-history: écrit en base',
  );
  return { titres: titresOk.size, lignes: rows.length, echecs };
}
