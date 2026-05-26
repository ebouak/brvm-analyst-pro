/**
 * Point d'entrée CLI du scraper BDFIN BRVM.
 *
 * Usage :
 *   tsx src/index.ts daily                 # scrape la séance courante
 *   tsx src/index.ts daily --mock          # données mock (sans BDFIN)
 *   tsx src/index.ts date 2025-05-20       # scrape une date précise (reprise)
 *   tsx src/index.ts date 2025-05-20 --mock
 *   tsx src/index.ts score                 # génère les signaux (séance courante)
 *   tsx src/index.ts score 2025-05-20      # signaux pour une date précise
 *   tsx src/index.ts score --mock          # démonstration scoring hors-ligne
 *   tsx src/index.ts events                # ingère les événements BRVM
 *   tsx src/index.ts events --mock         # événements mock
 *   tsx src/index.ts dividends             # ingère les dividendes
 *   tsx src/index.ts dividends --mock      # dividendes mock
 *   tsx src/index.ts alerts                # évalue les alertes et notifie
 *   tsx src/index.ts alerts --mock         # notification de démonstration
 *   tsx src/index.ts backfill              # backfill tous les codes GitHub
 *   tsx src/index.ts backfill SNTS ETIT    # backfill codes spécifiques
 *   tsx src/index.ts backfill --from=2022-01-01  # depuis une date
 *   tsx src/index.ts backfill --dry-run    # simuler sans écrire
 *
 * Codes de sortie : 0 = success/mock/partial, 1 = failed (utile pour le cron).
 */
import { runDaily } from './runners/runDaily.js';
import { runScoring } from './scoring/runScoring.js';
import { runEvents } from './events/runEvents.js';
import { runDividends } from './dividends/runDividends.js';
import { runAlerts } from './alerts/runAlerts.js';
import { runBacktestCmd } from './backtesting/runBacktest.js';
import { runBackfill } from './backfill/runBackfill.js';
import { runValidation } from './validation/runValidation.js';
import { isIsoDate } from './utils/dates.js';
import { logger } from './logger.js';

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  const mock = rest.includes('--mock');
  const positional = rest.filter((a) => !a.startsWith('--'));

  switch (command) {
    case 'daily':
    case undefined: {
      const res = await runDaily({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'date': {
      const date = positional[0];
      if (!date || !isIsoDate(date)) {
        logger.error('Usage: date <YYYY-MM-DD> [--mock]');
        return 1;
      }
      const res = await runDaily({ date, mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'score': {
      const date = positional[0];
      if (date && !isIsoDate(date)) {
        logger.error('Usage: score [<YYYY-MM-DD>] [--mock]');
        return 1;
      }
      const res = await runScoring({ date, mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'events': {
      const res = await runEvents({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'dividends': {
      const res = await runDividends({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'alerts': {
      const res = await runAlerts({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'backtest': {
      const code = positional[0];
      if (!code) {
        logger.error('Usage: backtest <CODE> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--mock]');
        return 1;
      }
      const from = rest.find((a) => a.startsWith('--from='))?.split('=')[1];
      const to = rest.find((a) => a.startsWith('--to='))?.split('=')[1];
      const res = await runBacktestCmd({ code, from, to, mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'backfill': {
      const dryRun = rest.includes('--dry-run');
      const fromDate = rest.find((a) => a.startsWith('--from='))?.split('=')[1];
      // Les positionnels sans -- sont des codes (ex: SNTS ETIT BOAB)
      const codes = positional.length > 0 ? positional : undefined;
      await runBackfill({ codes, fromDate, dryRun });
      return 0;
    }
    case 'validate': {
      await runValidation();
      return 0;
    }
    default:
      logger.error(
        { command },
        'Commande inconnue. Commandes: daily | date | score | events | dividends | alerts | backtest | backfill | validate',
      );
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Crash');
    process.exit(1);
  });
