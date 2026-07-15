import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader } from '@/components/ui/premium';
import { RowActions } from './RowActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyses citables — Administration' };

export default async function AdminAnalysesPage() {
  await requirePermission('content.write');
  const db = getServiceClient();
  const { data } = await db
    .from('citable_pages')
    .select('slug, title, kind, published, updated_at')
    .order('updated_at', { ascending: false });

  const pages = (data ?? []) as { slug: string; title: string; kind: string; published: boolean; updated_at: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <SectionHeader
        kicker="Administration"
        title="Analyses citables"
        subtitle="Pages optimisées pour la citation (Perplexity, ChatGPT). Data auto ou éditorial."
      />

      <Link href="/admin/analyses/nouvelle"
        className="inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-[#03222b]">
        + Nouvelle analyse
      </Link>

      {pages.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Aucune analyse. Créez-en une.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border bg-surface">
          {pages.map((p) => (
            <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ivory">{p.title}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${p.kind === 'data' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-muted'}`}>
                    {p.kind === 'data' ? 'data' : 'éditorial'}
                  </span>
                  {p.published
                    ? <span className="rounded-full border border-up/30 bg-up/10 px-2 py-0.5 text-[10px] text-up">publiée</span>
                    : <span className="rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] text-warn">brouillon</span>}
                </div>
                <p className="text-xs text-faint">/analyses/{p.slug}</p>
              </div>
              <RowActions slug={p.slug} published={p.published} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
