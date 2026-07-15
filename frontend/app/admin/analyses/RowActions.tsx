'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPublished, deletePage } from './actions';

export function RowActions({ slug, published }: { slug: string; published: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <Link href={`/admin/analyses/${slug}`} className="rounded-lg border border-border px-2.5 py-1 text-muted hover:text-ivory">
        Éditer
      </Link>
      <button type="button" disabled={pending}
        onClick={() => start(async () => { await setPublished(slug, !published); router.refresh(); })}
        className={`rounded-lg border px-2.5 py-1 disabled:opacity-40 ${published ? 'border-warn/40 text-warn hover:bg-warn/10' : 'border-up/40 text-up hover:bg-up/10'}`}>
        {published ? 'Dépublier' : 'Publier'}
      </button>
      <button type="button" disabled={pending}
        onClick={() => {
          if (!confirm(`Supprimer « ${slug} » ? Cette action est irréversible.`)) return;
          start(async () => { await deletePage(slug); router.refresh(); });
        }}
        className="rounded-lg border border-down/40 px-2.5 py-1 text-down hover:bg-down/10 disabled:opacity-40">
        Suppr.
      </button>
    </div>
  );
}
