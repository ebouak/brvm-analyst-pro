import Link from 'next/link';
import { displayName, relativeTimeFR } from '@/lib/forum/identity';
import type { ForumTopic, AuthorProfile } from '@/lib/forum/types';
import { EmptyStatePremium } from '@/components/ui/premium';
import { Avatar } from './Avatar';

export function ForumTopicList({ topics, authors }: { topics: ForumTopic[]; authors: Map<string, AuthorProfile> }) {
  if (topics.length === 0) {
    return <EmptyStatePremium icon="💬" title="Aucune discussion" hint="Lancez la première discussion de la communauté." />;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {topics.map((t) => {
        const author = t.author_id ? authors.get(t.author_id) ?? null : null;
        return (
          <li key={t.id}>
            <Link
              href={`/forum/${t.id}`}
              className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition hover:border-info/40 hover:bg-elevated/40"
            >
              <div className="flex items-center gap-2.5">
                <Avatar profile={author} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{displayName(author)}</p>
                  <p className="text-xs text-faint">{relativeTimeFR(t.last_activity_at)}</p>
                </div>
                {t.instrument_code && (
                  <span className="ml-auto rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
                    {t.instrument_code}
                  </span>
                )}
              </div>
              <p className="mt-3 font-medium text-white line-clamp-2">{t.title}</p>
              <p className="mt-1 text-sm text-muted line-clamp-2">{t.body}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
