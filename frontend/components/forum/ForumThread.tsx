import { displayName, relativeTimeFR } from '@/lib/forum/identity';
import type { ForumTopic, ForumPost, AuthorProfile } from '@/lib/forum/types';
import { ReportButton } from './ReportButton';
import { ForumReplyForm } from './ForumReplyForm';
import { Avatar } from './Avatar';
import { VoteButton } from './VoteButton';

export function ForumThread({ topic, posts, authors, canPost, voteCounts, myVotes }: {
  topic: ForumTopic; posts: ForumPost[]; authors: Map<string, AuthorProfile>; canPost: boolean;
  voteCounts?: Map<string, number>; myVotes?: Set<string>;
}) {
  const profileOf = (id: string | null) => (id ? authors.get(id) ?? null : null);

  return (
    <div className="space-y-6">
      {/* Sujet */}
      <article className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <Avatar profile={profileOf(topic.author_id)} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{displayName(profileOf(topic.author_id))}</p>
            <p className="text-xs text-faint">{relativeTimeFR(topic.created_at)}</p>
          </div>
          {topic.instrument_code && (
            <span className="ml-auto rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
              {topic.instrument_code}
            </span>
          )}
        </div>
        <h1 className="mt-4 text-lg font-semibold text-white">{topic.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{topic.body}</p>
        <div className="mt-3"><ReportButton targetType="topic" targetId={topic.id} /></div>
      </article>

      {/* Réponses */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {posts.length} réponse{posts.length !== 1 ? 's' : ''}
        </p>
        {posts.map((p) => (
          <div key={p.id} className="flex gap-3 rounded-xl border border-border/60 bg-surface/60 p-4">
            <Avatar profile={profileOf(p.author_id)} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                <span className="font-medium text-white">{displayName(profileOf(p.author_id))}</span>
                {' · '}{relativeTimeFR(p.created_at)}{p.edited_at ? ' · modifié' : ''}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-white/90">{p.body}</p>
              <div className="mt-2 flex items-center gap-3">
                <VoteButton
                  postId={p.id}
                  initialCount={voteCounts?.get(p.id) ?? 0}
                  initialVoted={myVotes?.has(p.id) ?? false}
                  canVote={canPost}
                />
                <ReportButton targetType="post" targetId={p.id} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <ForumReplyForm topicId={topic.id} canPost={canPost} />
    </div>
  );
}
