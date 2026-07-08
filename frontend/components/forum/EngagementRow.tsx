'use client';

import { useState } from 'react';
import type { AwardType } from '@/lib/forum/types';
import { AwardMenu } from './AwardMenu';
import { ShareMenu } from './ShareMenu';

export interface EngagementRowProps {
  postId: string;
  likeCount: number;
  replyCount: number;
  shareUrl: string;
  postTitle: string;
  onLike?: () => Promise<void>;
  onAward?: (type: AwardType) => Promise<void>;
  disabled?: boolean;
}

/**
 * Engagement row: like count, reply count, share menu, award menu
 */
export function EngagementRow({
  postId,
  likeCount,
  replyCount,
  shareUrl,
  postTitle,
  onLike,
  onAward,
  disabled,
}: EngagementRowProps) {
  const [likes, setLikes] = useState(likeCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLike() {
    if (!onLike || disabled || loading) return;
    setLoading(true);
    try {
      const nextLiked = !liked;
      setLiked(nextLiked);
      setLikes((c) => c + (nextLiked ? 1 : -1));
      await onLike();
    } catch (err) {
      setLiked(!liked);
      setLikes((c) => c + (liked ? 1 : -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 text-sm text-muted pt-3 border-t border-border">
      <button
        type="button"
        onClick={handleLike}
        disabled={!onLike || disabled || loading}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition ${
          liked
            ? 'text-up bg-up/10'
            : 'hover:text-up hover:bg-up/10'
        } ${!onLike ? 'cursor-default opacity-50' : ''}`}
        aria-label={liked ? 'Retirer mon like' : 'Aimer'}
      >
        <span>👍</span>
        <span className="tabular">{likes}</span>
      </button>

      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full">
        <span>💬</span>
        <span className="tabular">{replyCount}</span>
      </div>

      <ShareMenu postTitle={postTitle} shareUrl={shareUrl} />

      {onAward && <AwardMenu postId={postId} onAward={onAward} disabled={disabled} />}
    </div>
  );
}
