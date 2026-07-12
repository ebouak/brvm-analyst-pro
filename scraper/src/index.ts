/**
 * Point d'entrée CLI du scraper BDFIN BRVM.
 *
 * Usage :
 *   tsx src/index.ts daily                 # scrape la séance courante
 *   tsx src/index.ts daily --mock          # données mock (sans BDFIN)
 *   tsx src/index.ts daily:full            # orchestration complète (5 étapes)
 *   tsx src/index.ts daily:full 2025-05-20 # avec date cible
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
 *   tsx src/index.ts forum-trending        # calcule les scores de tendance du forum
 *   tsx src/index.ts forum-trending --mock # démo (sans Supabase)
 *   tsx src/index.ts publications          # ingère les publications BDFIN
 *   tsx src/index.ts publications --mock   # publications mock
 *   tsx src/index.ts backfill              # backfill tous les codes GitHub
 *   tsx src/index.ts backfill SNTS ETIT    # backfill codes spécifiques
 *   tsx src/index.ts backfill --from=2022-01-01  # depuis une date
 *   tsx src/index.ts backfill --dry-run    # simuler sans écrire
 *   tsx src/index.ts monthly-reports       # générer rapports PDF mensuels
 *   tsx src/index.ts monthly-reports 2026-06  # mois spécifique
 *   tsx src/index.ts monthly-reports --dry-run # mode test (sans email/DB)
 *   tsx src/index.ts paper-trading:auto    # ouvrir positions depuis signaux forts
 *   tsx src/index.ts paper-trading:auto --mock # démo (sans Supabase)
 *   tsx src/index.ts veille                # monitoring BRVM Veille Intelligente
 *   tsx src/index.ts veille [<YYYY-MM-DD>] [--mock] # date spécifique ou démo
 *
 * Codes de sortie : 0 = success/mock/partial, 1 = failed (utile pour le cron).
 */

// IMPORTANT : doit rester le PREMIER import (polyfill WebSocket + TLS).
import './polyfills.js';

import { runDaily } from './runners/runDaily.js';
import { runDailyFull } from './runners/runDailyFull.js';
import { runScoring } from './scoring/runScoring.js';
import { runEvents } from './events/runEvents.js';
import { runDividends } from './dividends/runDividends.js';
import { runShares } from './shares/runShares.js';
import { runSecteurs } from './refdata/runSecteurs.js';
import { runAlerts } from './alerts/runAlerts.js';
import { runBacktestCmd } from './backtesting/runBacktest.js';
import { runBacktestSignals } from './scoring/runBacktestSignals.js';
import { runPublications } from './publications/runPublications.js';
import { runBackfill } from './backfill/runBackfill.js';
import { runNotations } from './notations/runNotations.js';
import { runDetails } from './scrapers/runDetails.js';
import { runIntraday } from './scrapers/runIntraday.js';
import { runAfricanIndices } from './scrapers/runAfricanIndices.js';
import { runBceaoMacro } from './scrapers/runBceaoMacro.js';
import { runObligations } from './scrapers/runObligations.js';
import { runCommodities } from './commodities/runCommodities.js';
import { runValidation } from './validation/runValidation.js';
import { runPaperTradingAuto } from './runners/runPaperTradingAuto.js';
import { runBrief } from './brief/runBrief.js';
import { runVeille } from './runners/runVeille.js';
import { runForumTrending } from './crons/forum-trending.js';
// runMonthlyReports importé dynamiquement (dépend de pdfkit) — voir case 'monthly-reports'.
import { isIsoDate } from './utils/dates.js';
import { logger } from './logger.js';
import { withMonitoring, type MonitoredResult, type SourceRef } from './monitoring/recordRun.js';
import { createSupabaseMonitoringClient } from './monitoring/supabaseClient.js';

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  const mock = rest.includes('--mock');
  const positional = rest.filter((a) => !a.startsWith('--'));

  const triggerType =
    rest.find((a) => a.startsWith('--trigger='))?.split('=')[1] ?? process.env.SCRAPER_TRIGGER ?? 'manual';

  /**
   * Enrobe un runner cron avec le monitoring (scraper_runs/errors).
   * Neutralisé en mock (aucune écriture) et tolérant aux pannes de monitoring :
   * l'erreur du runner remonte telle quelle (relancée par withMonitoring).
   */
  async function monitored<T>(
    source: SourceRef,
    run: () => Promise<MonitoredResult<T>>,
  ): Promise<T> {
    if (mock) return (await run()).value;
    const client = createSupabaseMonitoringClient();
    return (await withMonitoring(client, source, triggerType, run)).value;
  }

  switch (command) {
    case 'daily':
    case undefined: {
      const res = await monitored(
        { code: 'daily', label: 'Séance quotidienne (BDFIN)' },
        async () => {
          const r = await runDaily({ mock });
          // ScrapeStatus includes 'mock' — map it to 'success' for RunOutcome.
          const outcomeStatus =
            r.status === 'failed' ? 'failed' : r.status === 'partial' ? 'partial' : 'success';
          const total = r.nb_actions + r.nb_obligations + r.nb_indices;
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: total,
              rows_upserted: total,
              metadata: {
                status: r.status,
                nb_actions: r.nb_actions,
                nb_obligations: r.nb_obligations,
                nb_indices: r.nb_indices,
                date_marche: r.date_marche,
              },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'daily:full': {
      logger.info('Executing daily full scrape');
      const result = await runDailyFull(positional[0]);
      console.log(JSON.stringify(result, null, 2));
      return result.status === 'failed' ? 1 : 0;
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
      const res = await monitored(
        { code: 'score', label: 'Scoring / signaux' },
        async () => {
          const r = await runScoring({ date, mock });
          // ScoringRunResult.status includes 'mock' — map it to 'success'.
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.nb_signaux,
              rows_upserted: r.nb_signaux,
              metadata: { status: r.status, nb_signaux: r.nb_signaux, date_marche: r.date_marche },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'events': {
      const res = await monitored(
        { code: 'events', label: 'Événements BRVM' },
        async () => {
          const r = await runEvents({ mock });
          // EventsRunResult.status includes 'mock' — map it to 'success'.
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.nb_events,
              rows_upserted: r.nb_events,
              metadata: { status: r.status, nb_events: r.nb_events },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'dividends': {
      const res = await monitored(
        { code: 'dividends', label: 'Dividendes' },
        async () => {
          const r = await runDividends({ mock });
          // DividendsRunResult.status includes 'mock' — map it to 'success'.
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.nb,
              rows_upserted: r.nb,
              metadata: { status: r.status, nb: r.nb },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'obligations': {
      const res = await monitored(
        { code: 'obligations', label: 'Obligations' },
        async () => {
          const r = await runObligations({ mock });
          // ObligationsRunResult.status includes 'mock' — map it to 'success'.
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.nb,
              rows_upserted: r.nb,
              metadata: { status: r.status, nb: r.nb },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'commodities': {
      const res = await runCommodities({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'intraday': {
      const res = await monitored(
        { code: 'intraday', label: 'Cours intraday (brvm.org)' },
        async () => {
          const r = await runIntraday({ mock });
          return {
            value: r,
            outcome: {
              status: r.nbActions > 0 ? 'success' : 'failed',
              rows_extracted: r.nbActions + r.nbIndices,
              rows_upserted: r.nbActions + r.nbIndices,
              metadata: { nbActions: r.nbActions, nbIndices: r.nbIndices },
            },
          };
        },
      );
      return res.nbActions > 0 ? 0 : 1;
    }
    case 'african': {
      const res = await monitored(
        { code: 'african', label: 'Indices pan-africains (AFX)' },
        async () => {
          const r = await runAfricanIndices({ mock });
          return {
            value: r,
            outcome: {
              status: r.failures.length === 0 ? 'success' : 'partial',
              rows_extracted: r.nb,
              rows_upserted: r.nb,
              metadata: { nb: r.nb, failures: r.failures },
            },
          };
        },
      );
      return res.nb > 0 ? 0 : 1;
    }
    case 'shares': {
      const res = await runShares();
      return res.status === 'failed' ? 1 : 0;
    }
    case 'macro-bceao': {
      const res = await monitored(
        { code: 'macro-bceao', label: 'Taux directeurs BCEAO' },
        async () => {
          const r = await runBceaoMacro({ mock });
          return {
            value: r,
            outcome: {
              status: r.status === 'failed' ? 'failed' : 'success',
              rows_extracted: r.updated.length,
              rows_upserted: r.updated.length,
              metadata: { updated: r.updated },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'alerts': {
      const res = await runAlerts({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'forum-trending': {
      const res = await monitored(
        { code: 'forum-trending', label: 'Forum Trending Scores' },
        async () => {
          const r = await runForumTrending({ mock });
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.postsProcessed,
              rows_upserted: r.postsUpdated,
              metadata: {
                status: r.status,
                postsProcessed: r.postsProcessed,
                postsUpdated: r.postsUpdated,
              },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    case 'brief': {
      const res = await runBrief({ force: rest.includes('--force') });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'brief:whatsapp': {
      const { runBriefWhatsapp } = await import('./brief/runBriefWhatsapp.js');
      const res = await monitored(
        { code: 'brief:whatsapp', label: 'Brief quotidien — envoi WhatsApp' },
        async () => {
          const r = await runBriefWhatsapp({ mock });
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.recipients,
              rows_upserted: r.sent,
              metadata: {
                status: r.status,
                dateMarche: r.dateMarche,
                sent: r.sent,
                skippedAlreadySent: r.skippedAlreadySent,
              },
            },
          };
        },
      );
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
    case 'backtest-signals': {
      const res = await runBacktestSignals();
      if (res.status === 'failed') {
        logger.error({ message: res.message }, 'backtest-signals échoué');
        return 1;
      }
      logger.info(
        { codesTraites: res.codesTraites, signauxInseres: res.signauxInseres },
        'backtest-signals terminé',
      );
      return 0;
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
    case 'cotations': {
      const { runCotations } = await import('./scrapers/runCotations.js');
      const codes = positional.length > 0 ? positional : undefined;
      const res = await runCotations({ codes });
      return res.status === 'failed' ? 1 : 0;
    }
    case 'intraday:patterns': {
      const dateArg = positional[0] || new Date().toISOString().split('T')[0];
      const res = await monitored(
        { code: 'intraday:patterns', label: 'Patterns intraday (détection)' },
        async () => {
          const { runIntraDayPatternsBatch } = await import('./intraday/index.js');

          logger.info({ date: dateArg }, `Starting intraday patterns batch`);
          const result = await runIntraDayPatternsBatch(dateArg);

          logger.info(
            {
              date: result.date_marche,
              codes_processed: result.codes_processed,
              raw_patterns: result.total_raw_patterns,
              qualified_patterns: result.total_qualified_patterns,
              codes_with_scores: result.codes_with_scores,
              errors: result.errors.length,
              duration_ms: result.duration_ms,
            },
            `\n=== Intraday Patterns Summary ===`,
          );

          const outcomeStatus = result.errors.length === 0 ? 'success' : result.codes_processed > 0 ? 'partial' : 'failed';
          return {
            value: result,
            outcome: {
              status: outcomeStatus,
              rows_extracted: result.codes_processed,
              rows_upserted: result.codes_with_scores,
              metadata: {
                codes_processed: result.codes_processed,
                raw_patterns: result.total_raw_patterns,
                qualified_patterns: result.total_qualified_patterns,
                codes_with_scores: result.codes_with_scores,
                errors: result.errors.length,
                duration_ms: result.duration_ms,
              },
            },
          };
        },
      );

      return res.errors.length === 0 ? 0 : res.codes_processed === 0 ? 1 : 0;
    }
    case 'scrape-sgi': {
      // Annuaire SGI RichBourse (Playwright). Manuel (pas de cron) : la liste
      // change rarement et le site est protégé par anti-bot. --no-pdfs pour
      // sauter le téléchargement best-effort des PDF tarifs.
      const withPdfs = !rest.includes('--no-pdfs');
      const { runSgiRichbourse } = await import('./sgi/runSgiRichbourse.js');
      const res = await monitored(
        { code: 'scrape-sgi', label: 'Annuaire SGI (RichBourse)' },
        async () => {
          const r = await runSgiRichbourse({ mock, withPdfs });
          return {
            value: r,
            outcome: {
              status: r.status === 'success' ? ('success' as const) : ('failed' as const),
              rows_extracted: r.scraped,
              rows_upserted: r.inserts + r.enrichments,
              metadata: { inserts: r.inserts, enrichments: r.enrichments, pdfsSaved: r.pdfsSaved },
            },
          };
        },
      );
      logger.info(res, 'Scrape SGI terminé');
      return res.status === 'failed' ? 1 : 0;
    }
    case 'monthly-reports': {
      const dryRun = rest.includes('--dry-run');
      const month = positional[0];
      const { runMonthlyReports } = await import('./runners/runMonthlyReports.js');
      const res = await monitored(
        { code: 'monthly-reports', label: 'Rapports mensuels (par portefeuille)' },
        async () => {
          const r = await runMonthlyReports({ month, dryRun });
          return {
            value: r,
            outcome: {
              status: r.status,
              rows_extracted: r.usersProcessed,
              rows_upserted: r.reportsGenerated,
              metadata: {
                status: r.status,
                reportsGenerated: r.reportsGenerated,
                skipped: r.skipped,
                errors: r.errors.length,
                month: month ?? 'auto',
              },
            },
          };
        },
      );
      logger.info(res, 'Monthly reports generation complete');
      return res.status === 'failed' ? 1 : 0;
    }
    case 'paper-trading:auto': {
      const res = await runPaperTradingAuto();
      console.log(JSON.stringify(res, null, 2));
      return res.status === 'error' ? 1 : 0;
    }
    case 'veille': {
      const date = positional[0];
      if (date && !isIsoDate(date)) {
        logger.error('Usage: veille [<YYYY-MM-DD>] [--mock]');
        return 1;
      }
      const res = await monitored(
        { code: 'veille', label: 'BRVM Veille Intelligente' },
        async () => {
          const r = await runVeille({ date, mock });
          const outcomeStatus =
            r.status === 'failed' ? 'failed' : r.status === 'mock' ? 'success' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.digests_count,
              rows_upserted: r.digests_count,
              metadata: {
                status: r.status,
                digests: r.digests_count,
                alerts: r.alerts_count,
                date_marche: r.date_marche,
              },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
    default:
      logger.error(
        { command },
        'Commande inconnue. Commandes: daily | daily:full | date | score | events | dividends | shares | secteurs | alerts | forum-trending | publications | backtest | backfill | validate | notations | details | news | veille | monthly-reports',
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
