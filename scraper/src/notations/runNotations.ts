import axios from 'axios';
import { parseNotationPage } from './parser.js';
import { MOCK_NOTATIONS } from './mock.js';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import type { NotationsResult } from './types.js';

const BRVM_CODES = [
  'ABJC', 'BICB', 'BICC', 'BNBC', 'BOAB', 'BOABF', 'BOAC', 'BOAM', 'BOAN', 'BOAS',
  'CABC', 'CBIBF', 'CFAC', 'CIEC', 'ECOC', 'ETIT', 'FTSC', 'LNBB', 'NEIC',
  'NSBC', 'NTLC', 'ONTBF', 'ORAC', 'ORGT', 'PALC', 'PRSC', 'SAFC', 'SCRC',
  'SDCC', 'SDSC', 'SEMC', 'SGBC', 'SHEC', 'SIBC', 'SICC', 'SIVC', 'SLBC',
  'SMBC', 'SNTS', 'SOGC', 'SPHC', 'STAC', 'STBC', 'TTLC', 'TTLS', 'UNLC', 'UNXC',
];

const BASE_URL = 'https://www.richbourse.com/common/notation-financiere/index';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runNotations(opts: { mock?: boolean } = {}): Promise<NotationsResult> {
  const result: NotationsResult = { updated: 0, skipped: 0, errors: 0 };

  if (opts.mock) {
    const supabase = getSupabase();
    for (const [code, notation] of Object.entries(MOCK_NOTATIONS)) {
      const { error } = await supabase
        .from('brvm_instruments')
        .update({ notation_json: notation, updated_at: new Date().toISOString() })
        .eq('code', code);
      if (error) {
        logger.warn({ code, error: error.message }, 'Mock notation update failed');
        result.errors++;
      } else {
        logger.info({ code, note: notation.note }, 'Notation mock upserted');
        result.updated++;
      }
    }
    return result;
  }

  for (const code of BRVM_CODES) {
    const url = `${BASE_URL}/${code}`;
    try {
      const { data: html } = await axios.get<string>(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVM-Analyst/1.0)' },
        timeout: 10_000,
      });

      const notation = parseNotationPage(html, url);
      if (!notation) {
        logger.debug({ code }, 'Pas de notation');
        result.skipped++;
        await sleep(500);
        continue;
      }

      const supabase = getSupabase();
      const { error } = await supabase
        .from('brvm_instruments')
        .update({ notation_json: notation, updated_at: new Date().toISOString() })
        .eq('code', code);

      if (error) {
        logger.warn({ code, error: error.message }, 'Notation update failed');
        result.errors++;
      } else {
        logger.info({ code, note: notation.note, agence: notation.agence }, 'Notation updated');
        result.updated++;
      }
    } catch (err) {
      logger.warn({ code, err: err instanceof Error ? err.message : String(err) }, 'Notation fetch error');
      result.errors++;
    }

    await sleep(500);
  }

  logger.info(result, 'runNotations terminé');
  return result;
}
