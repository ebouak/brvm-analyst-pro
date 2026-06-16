import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard } from '@/components/ui/premium';
import { CONTENT_KINDS, loadContent, type ContentKind } from '@/lib/admin/content';
import { ContentTable, CreateToggle } from './ContentTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contenu — Administration' };

const KINDS: ContentKind[] = ['news', 'communique', 'bulletin'];
const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isKind(v: string | undefined): v is ContentKind {
  return v === 'news' || v === 'communique' || v === 'bulletin';
}

export default async function Page({ searchParams }: { searchParams: { kind?: string; q?: string } }) {
  await requirePermission('content.read');
  const kind: ContentKind = isKind(searchParams.kind) ? searchParams.kind : 'news';
  const search = searchParams.q ?? '';
  const { rows, kpis } = await loadContent(kind, search);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="Contenu" subtitle="Actualités, communiqués et bulletins — modération, édition, création." />
      <div className="gold-rule" />

      <nav className="flex gap-2">
        {KINDS.map((k) => (
          <Link key={k} href={`/admin/content?kind=${k}`}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${k === kind ? 'bg-accent text-obsidian font-semibold' : 'border border-border text-muted hover:text-ivory'}`}>
            {CONTENT_KINDS[k].label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Entrées" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Masquées" value={nf.format(kpis.hidden)} accent={kpis.hidden > 0 ? 'gold' : 'neutral'} />
        <MetricCard label="Dernière date" value={fmtDate(kpis.lastDate)} accent="neutral" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <form action="/admin/content" method="get" className="flex-1">
          <input type="hidden" name="kind" value={kind} />
          <input name="q" defaultValue={search} placeholder="Rechercher…" className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory" />
        </form>
        <CreateToggle kind={kind} />
      </div>

      <ContentTable kind={kind} rows={rows} />
    </div>
  );
}
