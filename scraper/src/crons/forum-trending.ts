/**
 * Forum Trending Score Cron Job
 *
 * Calculates trending_score for all forum posts hourly:
 *   trending_score = (likes*1.5 + replies*3 + awards*5) / (hoursOld + 1)
 *
 * Engagement signals:
 * - Likes: basic upvotes (weight 1.5)
 * - Replies: discussion depth (weight 3)
 * - Awards: premium engagement (weight 5, one of: 💡 insight, 🔥 hot, ⭐ star)
 *
 * Recency decay: older posts gradually cool down as denominator increases.
 * Planifiable via cron (see docs/DEPLOYMENT.md).
 */

import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

export interface ForumTrendingRunResult {
  status: 'success' | 'failed' | 'mock';
  postsProcessed: number;
  postsUpdated: number;
  message: string | null;
}

interface PostRow {
  id: string;
  created_at: string;
  trending_score: number;
}

interface InteractionCountRow {
  post_id: string;
  likes_count: number;
  awards_count: number;
}

interface ReplyCountRow {
  post_id: string;
  reply_count: number;
}

/**
 * Pure function: calculate trending score given interaction counts and age.
 * @param likesCount Number of likes
 * @param repliesCount Number of replies
 * @param awardsCount Number of awards
 * @param createdAtIso ISO timestamp of post creation
 * @returns Trending score (numeric, 2 decimal places)
 */
function calculateTrendingScore(
  likesCount: number,
  repliesCount: number,
  awardsCount: number,
  createdAtIso: string,
): number {
  const createdTime = new Date(createdAtIso).getTime();
  const nowTime = Date.now();
  const ageMs = nowTime - createdTime;
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));

  const engagement = likesCount * 1.5 + repliesCount * 3 + awardsCount * 5;
  const score = engagement / (ageHours + 1);

  return Math.round(score * 100) / 100; // Round to 2 decimals
}

export async function runForumTrending(
  opts: { mock?: boolean } = {},
): Promise<ForumTrendingRunResult> {
  const cfg = getConfig();

  if (opts.mock || cfg.USE_MOCK) {
    logger.warn('Mode MOCK forum-trending : pas de calcul réel');
    return {
      status: 'mock',
      postsProcessed: 0,
      postsUpdated: 0,
      message: null,
    };
  }

  try {
    const sb = getSupabase();

    // 1. Fetch all non-hidden posts
    const { data: postsData, error: postsError } = await sb
      .from('forum_posts')
      .select('id, created_at, trending_score')
      .eq('hidden', false);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    const posts = (postsData ?? []) as PostRow[];
    if (posts.length === 0) {
      logger.info('No posts to process');
      return {
        status: 'success',
        postsProcessed: 0,
        postsUpdated: 0,
        message: null,
      };
    }

    const postIds = posts.map((p) => p.id);

    // 2. Count likes per post (from post_interactions where interaction_type = 'like')
    const { data: likeCountsData, error: likeError } = await sb
      .from('post_interactions')
      .select('post_id')
      .eq('interaction_type', 'like')
      .in('post_id', postIds);

    if (likeError) {
      throw new Error(`Failed to fetch likes: ${likeError.message}`);
    }

    const likesPerPost: Record<string, number> = {};
    for (const row of (likeCountsData ?? []) as { post_id: string }[]) {
      likesPerPost[row.post_id] = (likesPerPost[row.post_id] ?? 0) + 1;
    }

    // 3. Count awards per post (from post_interactions where interaction_type = 'award')
    const { data: awardCountsData, error: awardError } = await sb
      .from('post_interactions')
      .select('post_id')
      .eq('interaction_type', 'award')
      .in('post_id', postIds);

    if (awardError) {
      throw new Error(`Failed to fetch awards: ${awardError.message}`);
    }

    const awardsPerPost: Record<string, number> = {};
    for (const row of (awardCountsData ?? []) as { post_id: string }[]) {
      awardsPerPost[row.post_id] = (awardsPerPost[row.post_id] ?? 0) + 1;
    }

    // 4. Count replies per post (from forum_replies, if table exists)
    let repliesPerPost: Record<string, number> = {};
    try {
      const { data: replyCountsData, error: replyError } = await sb
        .from('forum_replies')
        .select('post_id')
        .in('post_id', postIds)
        .is('parent_reply_id', null); // Only root replies to posts, not nested

      if (!replyError) {
        for (const row of (replyCountsData ?? []) as { post_id: string }[]) {
          repliesPerPost[row.post_id] = (repliesPerPost[row.post_id] ?? 0) + 1;
        }
      } else {
        // Table might not exist yet; log warning but continue
        logger.warn('forum_replies table not found or inaccessible; skipping reply counts');
      }
    } catch {
      logger.warn('Error fetching reply counts (table may not exist yet)');
    }

    // 5. Calculate new trending scores and batch update
    const updates: { id: string; trending_score: number }[] = [];

    for (const post of posts) {
      const likesCount = likesPerPost[post.id] ?? 0;
      const repliesCount = repliesPerPost[post.id] ?? 0;
      const awardsCount = awardsPerPost[post.id] ?? 0;

      const newScore = calculateTrendingScore(
        likesCount,
        repliesCount,
        awardsCount,
        post.created_at,
      );

      updates.push({
        id: post.id,
        trending_score: newScore,
      });
    }

    // Update-only (jamais upsert) : ces posts existent déjà (on vient de les
    // lire à l'étape 1). Un upsert avec un payload partiel {id, trending_score}
    // emprunte le chemin INSERT ON CONFLICT de Postgres, qui déclenche le
    // trigger de création de author_profiles avec un user_id absent du
    // payload → violation de la contrainte NOT NULL. Un simple update ne
    // touche jamais ce chemin.
    const updateResults = await Promise.all(
      updates.map((u) =>
        sb.from('forum_posts').update({ trending_score: u.trending_score }).eq('id', u.id),
      ),
    );
    const updateError = updateResults.find((r) => r.error)?.error;

    if (updateError) {
      throw new Error(`Failed to update trending scores: ${updateError.message}`);
    }

    logger.info(
      {
        postsProcessed: posts.length,
        postsUpdated: updates.length,
        avgScore: (
          updates.reduce((sum, u) => sum + u.trending_score, 0) / updates.length
        ).toFixed(2),
      },
      'Forum trending scores calculated',
    );

    return {
      status: 'success',
      postsProcessed: posts.length,
      postsUpdated: updates.length,
      message: null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ error: msg }, 'Forum trending calculation failed');
    return {
      status: 'failed',
      postsProcessed: 0,
      postsUpdated: 0,
      message: msg,
    };
  }
}
