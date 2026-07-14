import { logger } from '../logger.js';
import { fetchGitHubIssues, fetchGitHubIssuesMock } from './fetchers/github-fetcher.js';
import {
  fetchTwitterTrends,
  fetchTwitterTrendsMock,
} from './fetchers/twitter-fetcher.js';
import {
  fetchStackOverflowSolutions,
  fetchStackOverflowSolutionsMock,
} from './fetchers/stackoverflow-fetcher.js';
import {
  fetchYouTubeTutorials,
  fetchYouTubeTutorialsMock,
} from './fetchers/youtube-fetcher.js';
import { fetchRSSFeeds, fetchRSSFeedsMock } from './fetchers/rss-fetcher.js';
import {
  fetchLinkedInIntelligence,
  fetchLinkedInIntelligenceMock,
} from './fetchers/linkedin-fetcher.js';
import {
  upsertVeilleDigest,
  recordVeilleJobRun,
  createVeilleAlert,
} from './repository.js';
import type { VeilleDigestRow, VeilleJobRun } from './types.js';

/**
 * Run the complete BRVM Veille monitoring system
 * Fetches from all sources and aggregates into unified digest
 */
export async function runVeilleDigest(
  dateMarche: Date,
  useMock: boolean = false
): Promise<void> {
  logger.info(
    { date: dateMarche.toISOString(), useMock },
    'Starting BRVM Veille digest'
  );

  const startTime = Date.now();
  const dateStr = dateMarche.toISOString().slice(0, 10);
  const since = new Date(dateMarche.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Run all fetchers in parallel
    const [githubIssues, twitterTrends, soSolutions, youtubeTutorials, rssFeeds, linkedinIntel] =
      await Promise.allSettled([
        // GitHub désactivé : contenu dev (issues), hors périmètre veille MARCHÉ.
        Promise.resolve([] as VeilleDigestRow[]),
        useMock
          ? fetchTwitterTrendsMock()
          : fetchTwitterTrends(['#BRVM', 'BRVM trading', 'fintech']),
        // StackOverflow désactivé : contenu dev, hors périmètre veille MARCHÉ.
        Promise.resolve([] as VeilleDigestRow[]),
        useMock
          ? fetchYouTubeTutorialsMock()
          : fetchYouTubeTutorials(['intraday patterns', 'technical analysis']),
        useMock
          ? fetchRSSFeedsMock()
          : fetchRSSFeeds(since),
        useMock
          ? fetchLinkedInIntelligenceMock()
          : fetchLinkedInIntelligence(),
      ]);

    const allDigests: VeilleDigestRow[] = [];
    let fetchErrors = 0;

    // Aggregate results
    if (githubIssues.status === 'fulfilled' && githubIssues.value) {
      allDigests.push(...githubIssues.value);
      logger.info(
        { count: githubIssues.value.length },
        'GitHub issues fetched'
      );
    } else {
      fetchErrors++;
      logger.warn('GitHub issues fetch failed');
    }

    if (twitterTrends.status === 'fulfilled' && twitterTrends.value) {
      allDigests.push(...twitterTrends.value);
      logger.info(
        { count: twitterTrends.value.length },
        'Twitter trends fetched'
      );
    } else {
      fetchErrors++;
      logger.warn('Twitter trends fetch failed');
    }

    if (soSolutions.status === 'fulfilled' && soSolutions.value) {
      allDigests.push(...soSolutions.value);
      logger.info(
        { count: soSolutions.value.length },
        'Stack Overflow solutions fetched'
      );
    } else {
      fetchErrors++;
      logger.warn('Stack Overflow solutions fetch failed');
    }

    if (youtubeTutorials.status === 'fulfilled' && youtubeTutorials.value) {
      allDigests.push(...youtubeTutorials.value);
      logger.info(
        { count: youtubeTutorials.value.length },
        'YouTube tutorials fetched'
      );
    } else {
      fetchErrors++;
      logger.warn('YouTube tutorials fetch failed');
    }

    if (rssFeeds.status === 'fulfilled' && rssFeeds.value) {
      allDigests.push(...rssFeeds.value);
      logger.info(
        { count: rssFeeds.value.length },
        'RSS feeds fetched'
      );
    } else {
      fetchErrors++;
      logger.warn('RSS feeds fetch failed');
    }

    if (linkedinIntel.status === 'fulfilled' && linkedinIntel.value) {
      allDigests.push(...linkedinIntel.value);
      logger.info(
        { count: linkedinIntel.value.length },
        'LinkedIn intelligence fetched'
      );
    } else {
      fetchErrors++;
      logger.warn('LinkedIn intelligence fetch failed');
    }

    // Store digests
    await upsertVeilleDigest(allDigests, dateMarche);

    // Detect and create alerts from critical findings
    const criticalDigests = allDigests.filter((d) => d.is_critical);
    logger.info(
      { critical: criticalDigests.length },
      'Critical veille items detected'
    );

    // Record job run
    const duration = Date.now() - startTime;
    const jobRun: VeilleJobRun = {
      date_marche: dateStr,
      source: 'orchestrator',
      status: fetchErrors === 0 ? 'success' : fetchErrors < 3 ? 'partial' : 'failed',
      items_fetched: allDigests.length,
      items_stored: allDigests.length,
      errors_count: fetchErrors,
      duration_ms: duration,
      metadata: {
        sources_count: 6,
        critical_items: criticalDigests.length,
      },
    };

    await recordVeilleJobRun(jobRun);

    logger.info(
      {
        total: allDigests.length,
        critical: criticalDigests.length,
        duration,
      },
      'BRVM Veille digest completed successfully'
    );
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error(
      { err, duration },
      'BRVM Veille digest failed'
    );

    const jobRun: VeilleJobRun = {
      date_marche: dateStr,
      source: 'orchestrator',
      status: 'failed',
      items_fetched: 0,
      items_stored: 0,
      errors_count: 6,
      error_message: String(err),
      duration_ms: duration,
    };

    await recordVeilleJobRun(jobRun);
    throw err;
  }
}

/**
 * Run Veille digest for a specific date (for backfill/recovery)
 */
export async function runVeilleForDate(
  dateStr: string,
  useMock: boolean = false
): Promise<void> {
  const dateMarche = new Date(dateStr);
  if (isNaN(dateMarche.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return runVeilleDigest(dateMarche, useMock);
}
