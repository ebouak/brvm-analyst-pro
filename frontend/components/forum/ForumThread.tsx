import { fmtDateFR } from '@/lib/format';
import { displayName } from '@/lib/forum/identity';
import type { ForumTopic, ForumPost, AuthorProfile } from '@/lib/forum/types';
import { ReportButton } from './ReportButton';
import { ForumReplyForm } from './ForumReplyForm';

export function ForumThread({ topic, posts, authors, canPost }: {
  topic: ForumTopic; posts: ForumPost[]; authors: Map<string, AuthorProfile>; canPost: boolean;
}) {
  const author = (id: string | null) => displayName(id ? authors.get(id) ?? null : null);
  return (
    <div className="space-y-6">
      <article className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-lg font-semibold text-white">{topic.title}</h1>
        <p className="mt-1 text-xs text-muted">{author(topic.author_id)} · {fmtDateFR(topic.created_at)}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-white/90">{topic.body}</p>
        <div className="mt-3"><ReportButton targetType="topic" targetId={topic.id} /></div>
      </article>

      <section className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl border border-border/60 bg-surface/60 p-4">
            <p className="text-xs text-muted">{author(p.author_id)} · {fmtDateFR(p.created_at)}{p.edited_at ? ' · modifié' : ''}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{p.body}</p>
            <div className="mt-2"><ReportButton targetType="post" targetId={p.id} /></div>
          </div>
        ))}
      </section>

      <ForumReplyForm topicId={topic.id} canPost={canPost} />
    </div>
  );
}
