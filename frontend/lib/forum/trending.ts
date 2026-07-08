/**
 * Trending score calculation for forum posts.
 * Ranks posts by engagement (likes, replies, awards) over time.
 */

/**
 * Input for trending score calculation.
 */
export interface TrendingInput {
  likesCount: number;
  repliesCount: number;
  awardsCount: number;
  hoursOld: number;
}

/**
 * Calculate trending score based on engagement metrics.
 * Formula: (likes × 1.5 + replies × 3 + awards × 5) / (hoursOld + 1)
 *
 * Higher engagement and freshness = higher score.
 * Time decay prevents old posts from dominating forever.
 *
 * @param input Engagement metrics and time elapsed
 * @returns Trending score (higher = more trending)
 */
export function calculateTrendingScore(input: TrendingInput): number {
  const { likesCount, repliesCount, awardsCount, hoursOld } = input;
  const engagement = likesCount * 1.5 + repliesCount * 3 + awardsCount * 5;
  return engagement / (hoursOld + 1);
}

/**
 * Calculate hours since creation date.
 * Returns 0 for dates in the future (clock skew).
 *
 * @param createdAt ISO 8601 timestamp
 * @returns Hours elapsed since creation (minimum 0)
 */
export function getHoursSince(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, Math.floor(diffHours));
}
