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
 *   tsx src/index.ts publications          # ingère les publications BDFIN
 *   tsx src/index.ts publications --mock   # publications mock
 *   tsx src/index.ts backfill              # backfill tous les codes GitHub
 *   tsx src/index.ts backfill SNTS ETIT    # backfill codes spécifiques
 *   tsx src/index.ts backfill --from=2022-01-01  # depuis une date
 *   tsx src/index.ts backfill --dry-run    # simuler sans écrire
 *   tsx src/index.ts monthly-reports       # générer rapports PDF mensuels
 *   tsx src/index.ts monthly-reports 2026-06  # mois spécifique
 *   tsx src/index.ts monthly-reports --dry-run # mode test (sans email/DB)
 *
 * Codes de sortie : 0 = success/mock/partial, 1 = failed (utile pour le cron).
 */

// IMPORTANT : doit rester le PREMIER import (polyfill WebSocket + TLS).
import './polyfills.js';

import { runDaily } from './runners/runDaily.js';
import { runScoring } from './scoring/runScoring.js';
import { runEvents } from './events/runEvents.js';
import { runDividends } from './dividends/runDividends.js';
import { runShares } from './shares/runShares.js';
import { runSecteurs } from './refdata/runSecteurs.js';
import { runAlerts } from './alerts/runAlerts.js';
import { runBacktestCmd } from './backtesting/runBacktest.js';
import { runPublications } from './publications/runPublications.js';
import { runBackfill } from './backfill/runBackfill.js';
import { runNotations } from './notations/runNotations.js';
import { runDetails } from './scrapers/runDetails.js';
import { runIntraday } from './scrapers/runIntraday.js';
import { runValidation } from './validation/runValidation.js';
// runMonthlyReports importé dynamiquement (dépend de pdfkit) — voir case 'monthly-reports'.
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
    case 'intraday': {
      const res = await runIntraday({ mock });
      return res.nbActions > 0 ? 0 : 1;
    }
    case 'shares': {
      const res = await runShares();
      return res.status === 'failed' ? 1 : 0;
    }
    case 'alerts': {
      const res = await runAlerts({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'publications': {
      const res = await runPublications({ mock });
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
    case 'notations': {
      const res = await runNotations({ mock });
      logger.info(res, 'Notations terminées');
      return res.errors > 0 ? 1 : 0;
    }
    case 'details': {
      const codes = positional.length > 0 ? positional : undefined;
      const res = await runDetails({ codes, mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'news': {
      const { runNews } = await import('./scrapers/runNews.js');
      await runNews();
      return 0;
    }
    case 'secteurs': {
      const res = await runSecteurs();
      return res.status === 'failed' ? 1 : 0;
    }
    case 'monthly-reports': {
      const dryRun = rest.includes('--dry-run');
      const month = positional[0];
      const { runMonthlyReports } = await import('./runners/runMonthlyReports.js');
      const res = await runMonthlyReports({ month, dryRun });
      logger.info(res, 'Monthly reports generation complete');
      return res.status === 'failed' ? 1 : 0;
    }
    default:
      logger.error(
        { command },
        'Commande inconnue. Commandes: daily | date | score | events | dividends | shares | secteurs | alerts | publications | backtest | backfill | validate | notations | details | news | monthly-reports',
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
