import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import { displayName } from '@/lib/forum/identity';
import type { ForumTopic, AuthorProfile } from '@/lib/forum/types';
import { EmptyStatePremium } from '@/components/ui/premium';

export function ForumTopicList({ topics, authors }: { topics: ForumTopic[]; authors: Map<string, AuthorProfile> }) {
  if (topics.length === 0) {
    return <EmptyStatePremium icon="💬" title="Aucune discussion" hint="Lancez la première discussion de la communauté." />;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {topics.map((t) => (
        <li key={t.id} className="bg-surface hover:bg-elevated/40 transition">
          <Link href={`/forum/${t.id}`} className="block px-4 py-3">
            <p className="font-medium text-white">{t.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {displayName(t.author_id ? authors.get(t.author_id) ?? null : null)} ·{' '}
              {fmtDateFR(t.last_activity_at)}
              {t.instrument_code ? ` · ${t.instrument_code}` : ''}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
