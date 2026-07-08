import type { AuthorProfile, AwardType, ForumPost } from '@/lib/forum/types';
import { PostHeader } from './PostHeader';
import { ImageGallery } from './ImageGallery';
import { EngagementRow } from './EngagementRow';
import { cn } from '@/lib/utils';

export interface PostCardProps {
  post: ForumPost;
  author: AuthorProfile | null;
  likeCount?: number;
  replyCount?: number;
  onLike?: () => Promise<void>;
  onAward?: (type: AwardType) => Promise<void>;
  canInteract?: boolean;
  className?: string;
}

/**
 * Post card: composition of header, content, images, and engagement
 */
export function PostCard({
  post,
  author,
  likeCount = post.like_count ?? 0,
  replyCount = post.reply_count ?? 0,
  onLike,
  onAward,
  canInteract,
  className,
}: PostCardProps) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/forum/${post.topic_id}#${post.id}` : '';

  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-surface p-4 hover:border-accent/20 transition',
        className,
      )}
    >
      <PostHeader post={post} author={author} isPinned={post.is_pinned} />

      <div className="mt-3 text-body-md text-ivory leading-relaxed">
        {post.body}
      </div>

      {post.image_urls && post.image_urls.length > 0 && (
        <ImageGallery images={post.image_urls} altPrefix={`Post ${post.id}`} />
      )}

      <EngagementRow
        postId={post.id}
        likeCount={likeCount}
        replyCount={replyCount}
        shareUrl={shareUrl}
        postTitle={post.body.slice(0, 100)}
        onLike={onLike}
        onAward={onAward}
        disabled={!canInteract}
      />
    </article>
  );
}
