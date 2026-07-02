import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { sanitizeReportHtml } from '@/lib/sanitizeHtml';
import {
  PriceVariationsChart,
  WorldBankChart,
  BrvmExposureChart,
} from '@/components/weekly/CommodityCharts';

export const dynamic = 'force-dynamic';

interface WeeklyArticle {
  id: string;
  titre: string;
  date_publication: string;
  resume: string | null;
  content_html: string | null;
  slug: string | null;
  metadata: Record<string, unknown> | null;
  ticker_codes: string[] | null;
  source_label: string | null;
}

async function fetchArticle(slug: string): Promise<WeeklyArticle | null> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from('brvm_news')
    .select('id, titre, date_publication, resume, content_html, slug, metadata, ticker_codes, source_label')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as WeeklyArticle;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await fetchArticle(params.slug);
  if (!article) return { title: 'Article introuvable — WESTBOURSE' };
  return {
    title: `${article.titre} — WESTBOURSE`,
    description: article.resume ?? undefined,
  };
}

export default async function WeeklyArticlePage({ params }: { params: { slug: string } }) {
  const article = await fetchArticle(params.slug);
  if (!article) notFound();

  const meta = article.metadata as Record<string, unknown> | null;
  const week = meta?.week as number | undefined;
  const year = meta?.year as number | undefined;
  const yf_prices = (meta?.yf_prices as Record<string, unknown>) ?? {};
  const wb_snapshot = (meta?.wb_snapshot as Record<string, unknown>) ?? {};
  const brvm_scores = (meta?.brvm_scores as Record<string, unknown>) ?? {};

  const hasCharts = Object.keys(yf_prices).length > 0 || Object.keys(brvm_scores).length > 0;

  return (
    <div className="min-h-screen bg-[#030303] text-[#FCFCFC]">
      {/* Hero */}
      <div className="border-b border-[#1a2a30] bg-[#030303]">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-4">
            <a href="/weekly" className="text-sm text-gray-500 hover:text-cyan-400 transition-colors">
              ← Analyses hebdo
            </a>
            {week && year && (
              <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                Semaine {String(week).padStart(2, '0')}/{year}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-[#FCFCFC] leading-tight mb-4 [font-family:var(--font-display)]">
            {article.titre}
          </h1>

          {article.resume && (
            <p className="text-lg text-gray-400 leading-relaxed mb-6">{article.resume}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span>
              {new Date(article.date_publication).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
            <span>·</span>
            <span className="text-cyan-400">{article.source_label ?? 'WESTBOURSE PRO'}</span>
          </div>

          {/* Tickers */}
          {article.ticker_codes?.length ? (
            <div className="flex flex-wrap gap-2 mt-5">
              {article.ticker_codes.map(t => (
                <a
                  key={t}
                  href={`/actions/${t}`}
                  className="font-mono text-xs px-2.5 py-1 rounded border border-cyan-500/30 text-cyan-400 bg-[#0a1417] hover:bg-cyan-400/10 transition-colors"
                >
                  {t}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* Graphiques Recharts — uniquement si content_html absent (anciens articles sans SVG intégré) */}
        {hasCharts && !article.content_html && (
          <section>
            <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-widest mb-5">
              Données de marché
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.keys(yf_prices).length > 0 && (
                <PriceVariationsChart yf_prices={yf_prices as any} />
              )}
              {Object.keys(wb_snapshot).length > 0 && (
                <WorldBankChart wb_snapshot={wb_snapshot as any} />
              )}
            </div>
            {Object.keys(brvm_scores).length > 0 && (
              <div className="mt-4">
                <BrvmExposureChart brvm_scores={brvm_scores as any} />
              </div>
            )}
          </section>
        )}

        {/* Contenu éditorial (SVG + tables + texte assemblés par Python) */}
        {article.content_html ? (
          <div
            className="weekly-content"
            dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(article.content_html) }}
          />
        ) : (
          <p className="text-gray-500 text-center py-12">Contenu non disponible.</p>
        )}

        {/* Footer article */}
        <footer className="border-t border-[#1a2a30] pt-6 text-xs text-gray-600 space-y-1">
          <p>Les informations contenues dans cet article sont fournies à titre informatif uniquement et ne constituent pas un conseil en investissement.</p>
          <p>Sources : yfinance, Banque Mondiale CMO Pink Sheet, actualités sectorielles BRVM.</p>
          <p>© {new Date().getFullYear()} WESTBOURSE. Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  );
}
