// frontend/lib/forum/types.ts

/* ============================================================================
   Type aliases & constants
   ============================================================================ */
export type TopicCategory = 'instrument' | 'evenement' | 'general';
export type InteractionType = 'like' | 'award';
export type AwardType = '💡' | '🔥' | '⭐';
export type EmailDigestFrequency = 'daily' | 'weekly' | 'never';
export type ForumReportReason = 'spam' | 'inappropriate' | 'misleading';
export type ForumReportStatus = 'open' | 'resolved' | 'dismissed';

export const AWARD_TYPES = ['💡', '🔥', '⭐'] as const;
export const INTERACTION_TYPES = ['like', 'award'] as const;
export const EMAIL_FREQUENCIES = ['daily', 'weekly', 'never'] as const;
export const FORUM_REPORT_REASONS = ['spam', 'inappropriate', 'misleading'] as const;
export const FORUM_REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;

/* ============================================================================
   Forum entities
   ============================================================================ */

export interface ForumTopic {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  instrument_code: string | null;
  event_id: string | null;
  hidden: boolean;
  created_at: string;
  last_activity_at: string;
}

/**
 * Forum post extended with 212 redesign fields:
 * - image_urls: attachments
 * - is_pinned: moderator-pinned for visibility
 * - trending_score: calculated engagement
 * - author: denormalized profile for display
 * - interaction counts: likes and replies
 * - award_count: map of award emoji → count
 */
export interface ForumPost {
  id: string;
  topic_id: string;
  author_id: string | null;
  body: string;
  image_urls?: string[];
  is_pinned?: boolean;
  pinned_at?: string | null;
  hidden: boolean;
  created_at: string;
  edited_at: string | null;
  trending_score?: number;
  author?: AuthorProfile;
  like_count?: number;
  reply_count?: number;
  award_count?: Map<string, number>;
}

/**
 * Forum reply: replies to posts (threaded discussion).
 * Supports nested replies (parent_reply_id) and image attachments.
 */
export interface ForumReply {
  id: string;
  post_id: string;
  author_id: string | null;
  body: string;
  image_urls?: string[];
  parent_reply_id?: string | null;
  hidden: boolean;
  created_at: string;
  edited_at?: string | null;
  author?: AuthorProfile;
  like_count?: number;
}

/**
 * User profile for forum display.
 * Denormalized from auth.users for performance.
 */
export interface AuthorProfile {
  user_id: string;
  avatar_url: string | null;
  display_name: string;
  is_verified: boolean;
  reputation_score: number;
  created_at: string;
  updated_at?: string;
}

/**
 * User engagement on forum posts (likes, awards).
 * Tracked for activity feed and notifications.
 */
export interface PostInteraction {
  id: string;
  post_id: string;
  user_id: string;
  interaction_type: InteractionType;
  award_type?: AwardType | null;
  created_at: string;
}

/**
 * User notification and digest preferences.
 * Controls email notifications and instrument tracking.
 */
export interface UserPreferences {
  user_id: string;
  email_digest_frequency: EmailDigestFrequency;
  followed_instruments: string[];
  notify_replies: boolean;
  notify_likes: boolean;
  notify_awards: boolean;
  created_at: string;
  updated_at?: string;
}

/**
 * Forum post report for moderation.
 * Tracks community flags and admin resolution.
 */
export interface ForumReport {
  id: string;
  post_id: string;
  reporter_id: string | null;
  reason: ForumReportReason;
  details?: string;
  status: ForumReportStatus;
  resolution_notes?: string;
  resolved_by_admin_id?: string;
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
}
