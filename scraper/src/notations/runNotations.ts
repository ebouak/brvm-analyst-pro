import { chromium } from 'playwright';
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
const HOME_URL = 'https://www.richbourse.com/';

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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });

  try {
    // Visit homepage once to solve the PoW challenge
    logger.info('Bypassing PoW via homepage visit...');
    const warmupPage = await context.newPage();
    await warmupPage.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(8000);
    await warmupPage.close();
    logger.info('PoW bypass complete');

    for (const code of BRVM_CODES) {
      const url = `${BASE_URL}/${code}`;
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await sleep(3000);
        const html = await page.content();
        await page.close();

        const notation = parseNotationPage(html, url);
        if (!notation) {
          logger.debug({ code }, 'Pas de notation');
          result.skipped++;
          await sleep(800);
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

      await sleep(800);
    }
  } finally {
    await browser.close();
  }

  logger.info(result, 'runNotations terminé');
  return result;
}
