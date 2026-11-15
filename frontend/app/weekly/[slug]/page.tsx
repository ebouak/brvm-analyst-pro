import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { sanitizeReportHtml } from '@/lib/sanitizeHtml';
import {
  PriceVariationsChart,
  WorldBankChart,
  BrvmExposureChart,
} from '@/components/weekly/CommodityCharts';
import './weekly.css';

/** Gabarit « feuille » : HTML du générateur en classes `wk-*`, grammaire du dossier A4. */
const FORMAT_FEUILLE = 'feuille-v1';
const NOM_EDITION: Record<string, string> = {
  note: 'Note d’analyste',
  briefing: 'Briefing',
  dossier: 'Dossier de la semaine',
};

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
    .not('hidden', 'is', true) // modération rédactionnelle
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as WeeklyArticle;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await fetchArticle(params.slug);
  if (!article) return { title: 'Article introuvable' };
  return {
    title: `${article.titre}`,
    description: article.resume ?? undefined,
  };
}

export default async function WeeklyArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await fetchArticle(params.slug);
  if (!article) notFound();

  const meta = article.metadata as Record<string, unknown> | null;
  const week = meta?.week as number | undefined;
  const year = meta?.year as number | undefined;
  const yf_prices = (meta?.yf_prices as Record<string, unknown>) ?? {};
  const wb_snapshot = (meta?.wb_snapshot as Record<string, unknown>) ?? {};
  const brvm_scores = (meta?.brvm_scores as Record<string, unknown>) ?? {};

  const hasCharts = Object.keys(yf_prices).length > 0 || Object.keys(brvm_scores).length > 0;
  const semaine = week && year ? `S${String(week).padStart(2, '0')}/${year}` : null;
  const datePub = new Date(article.date_publication).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (meta?.format === FORMAT_FEUILLE && article.content_html) {
    const edition = NOM_EDITION[String(meta?.edition ?? '')];
    return (
      <div className="wk">
        <nav className="wk-nav print:hidden" aria-label="Navigation de l’hebdo">
          <Link href="/weekly">← Analyses hebdo</Link>
          {semaine ? <span>Semaine {semaine}</span> : null}
        </nav>
        <article className="wk-feuille">
          <div className="wk-courant">
            <span className="wk-marque">WESTBOURSE</span>
            <span>Hebdo matières premières{semaine ? ` · ${semaine}` : ''}</span>
          </div>
          <header className="wk-entete">
            <h1 className="wk-h1">{article.titre}</h1>
            {article.resume ? <p className="wk-chapeau">{article.resume}</p> : null}
            <p className="wk-signature">
              Rédaction WESTBOURSE · publié le {datePub}
              {edition ? ` · édition « ${edition} »` : ''}
            </p>
            {article.ticker_codes?.length ? (
              <ul className="wk-valeurs" aria-label="Valeurs citées">
                {article.ticker_codes.map((t) => (
                  <li key={t}>
                    <Link href={`/societes/${t}`}>{t}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </header>
          <div
            className="wk-corps"
            dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(article.content_html) }}
          />
        </article>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ivory">
      {/* Hero */}
      <div className="border-b border-border bg-bg">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/weekly" className="text-sm text-faint hover:text-accent transition-colors">
              ← Analyses hebdo
            </Link>
            {week && year && (
              <span className="text-xs font-mono text-accent bg-cyan-400/10 px-2 py-0.5 rounded">
                Semaine {String(week).padStart(2, '0')}/{year}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-ivory leading-tight mb-4 [font-family:var(--font-display)]">
            {article.titre}
          </h1>

          {article.resume && (
            <p className="text-lg text-muted leading-relaxed mb-6">{article.resume}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-faint">
            <span>
              {new Date(article.date_publication).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
            <span>·</span>
            <span className="text-accent">{article.source_label ?? 'WESTBOURSE PRO'}</span>
          </div>

          {/* Tickers */}
          {article.ticker_codes?.length ? (
            <div className="flex flex-wrap gap-2 mt-5">
              {article.ticker_codes.map(t => (
                <a
                  key={t}
                  href={`/actions/${t}`}
                  className="font-mono text-xs px-2.5 py-1 rounded border border-cyan-500/30 text-accent bg-surface hover:bg-cyan-400/10 transition-colors"
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
            <h2 className="text-sm font-semibold text-accent mb-5">
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
          <p className="text-faint text-center py-12">Contenu non disponible.</p>
        )}

        {/* Footer article */}
        <footer className="border-t border-border pt-6 text-xs text-faint space-y-1">
          <p>Les informations contenues dans cet article sont fournies à titre informatif uniquement et ne constituent pas un conseil en investissement.</p>
          <p>Sources : Yahoo Finance (contrats à terme), Banque mondiale (Pink Sheet), BRVM.</p>
          <p>© {new Date().getFullYear()} WESTBOURSE. Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  );
}
