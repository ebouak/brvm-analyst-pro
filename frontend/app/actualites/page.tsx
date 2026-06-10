import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Actualités BRVM' };

const SOURCE_LABELS: Record<string, string> = {
  brvm: 'BRVM',
  cosumaf: 'COSUMAF',
  autre: 'Autre',
};

interface NewsRow {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_url: string | null;
  resume: string | null;
  instrument_code: string | null;
}

export default async function ActualitesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('brvm_news')
    .select('id, titre, date_publication, source, source_url, resume, instrument_code')
    .order('date_publication', { ascending: false })
    .limit(100);

  const news = (data ?? []) as NewsRow[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Marché · BRVM · COSUMAF"
        title="Actualités"
        subtitle="Communiqués officiels BRVM et COSUMAF mis à jour quotidiennement."
      />

      {news.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">
            Aucune actualité disponible.{' '}
            <code className="text-cyan text-xs">npm run news</code>{' '}
            dans le scraper pour alimenter le fil.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((item) => (
            <div key={item.id} className="bg-surface border border-border rounded-xl p-4 hover:border-cyan/30 transition space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan/30 text-cyan bg-cyan/10 font-semibold">
                  {SOURCE_LABELS[item.source] ?? item.source}
                </span>
                <span className="text-xs text-faint tabular">{item.date_publication}</span>
                {item.instrument_code && (
                  <Link href={`/actions/${item.instrument_code}`} className="text-xs text-gold hover:underline">
                    {item.instrument_code}
                  </Link>
                )}
              </div>
              {item.source_url ? (
                <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-ivory hover:text-cyan transition line-clamp-2">
                  {item.titre}
                </a>
              ) : (
                <p className="text-sm font-semibold text-ivory line-clamp-2">{item.titre}</p>
              )}
              {item.resume && (
                <p className="text-xs text-muted line-clamp-2">{item.resume}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
