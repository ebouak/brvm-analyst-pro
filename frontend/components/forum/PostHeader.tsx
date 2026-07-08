import type { AuthorProfile, ForumPost } from '@/lib/forum/types';
import { Avatar } from './Avatar';
import { displayName, relativeTimeFR } from '@/lib/forum/identity';

export interface PostHeaderProps {
  post: ForumPost;
  author: AuthorProfile | null;
  isPinned?: boolean;
}

/**
 * Post header: avatar, author name, reputation, timestamp, pinned indicator
 */
export function PostHeader({ post, author, isPinned }: PostHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar profile={author} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ivory truncate">{displayName(author)}</span>
          {author?.is_verified && (
            <span title="Compte vérifié" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/20 text-accent text-xs">
              ✓
            </span>
          )}
          {author && (
            <span className="text-xs text-faint" title={`Réputation: ${author.reputation_score}`}>
              {author.reputation_score.toLocaleString('fr-FR')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{relativeTimeFR(post.created_at)}</span>
          {isPinned && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-medium">
              📌 Épinglé
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
