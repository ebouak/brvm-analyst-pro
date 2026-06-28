import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyses Hebdo Matières Premières — WESTBOURSE' };

interface WeeklyArticle {
  id: string;
  titre: string;
  date_publication: string;
  resume: string | null;
  slug: string | null;
  metadata: Record<string, unknown> | null;
  ticker_codes: string[] | null;
}

async function fetchWeeklyArticles(): Promise<WeeklyArticle[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from('brvm_news')
    .select('id, titre, date_publication, resume, slug, metadata, ticker_codes')
    .eq('source_type', 'analyse')
    .like('slug', 'westbourse-commodities-weekly-%')
    .order('date_publication', { ascending: false })
    .limit(20);

  if (error) {
    console.error('weekly fetch error:', error);
    return [];
  }
  return (data ?? []) as WeeklyArticle[];
}

function CommodityBadges({ tickers }: { tickers: string[] | null }) {
  if (!tickers?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tickers.slice(0, 6).map(t => (
        <span key={t} className="font-mono text-xs px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-400 bg-[#0a1417]">
          {t}
        </span>
      ))}
    </div>
  );
}

export default async function WeeklyPage() {
  const articles = await fetchWeeklyArticles();

  return (
    <div className="min-h-screen bg-[#030303] text-[#FCFCFC] px-4 py-8 max-w-5xl mx-auto">
      <SectionHeader
        title="Analyses Hebdo – Matières Premières"
        subtitle="Impact du cacao, pétrole, caoutchouc et huile de palme sur les valeurs BRVM"
      />

      {articles.length === 0 ? (
        <div className="mt-12 text-center text-gray-500">
          <p className="text-lg">Aucune analyse disponible pour le moment.</p>
          <p className="text-sm mt-2">Les analyses sont publiées chaque vendredi.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {articles.map(article => {
            const meta = article.metadata as Record<string, unknown> | null;
            const week = meta?.week as number | undefined;
            const year = meta?.year as number | undefined;

            return (
              <Link
                key={article.id}
                href={`/weekly/${article.slug}`}
                className="group block bg-[#0a1417] border border-[#1a2a30] rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {week && year && (
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                          S{String(week).padStart(2, '0')}/{year}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(article.date_publication).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-[#FCFCFC] group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {article.titre}
                    </h2>
                    {article.resume && (
                      <p className="mt-2 text-sm text-gray-400 line-clamp-2">{article.resume}</p>
                    )}
                    <CommodityBadges tickers={article.ticker_codes} />
                  </div>
                  <div className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0">
                    →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
