import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader } from '@/components/ui/premium';
import ViewTabs from '@/components/ViewTabs';
import { INTEL_TABS } from '@/lib/viewTabsPresets';

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

const COMMO_LABELS: Record<string, { label: string; icon: string }> = {
  cocoa: { label: 'Cacao', icon: '🍫' },
  palm_oil: { label: 'Huile de palme', icon: '🌴' },
  rubber: { label: 'Caoutchouc', icon: '🛞' },
  sugar: { label: 'Sucre', icon: '🧊' },
  crude_brent: { label: 'Brent', icon: '🛢️' },
  gold: { label: 'Or', icon: '🥇' },
};

interface CommoTick {
  commodity: string;
  label: string;
  icon: string;
  price: number;
  unit: string;
  varPct: number | null;
  date: string;
}

/** Derniers prix mensuels Banque mondiale (table commodity_prices) + var M/M. */
async function fetchCommodities(): Promise<CommoTick[]> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('commodity_prices')
    .select('commodity, date, price, unit')
    .order('date', { ascending: false })
    .limit(40);
  const rows = (data ?? []) as { commodity: string; date: string; price: number; unit: string }[];
  const byCommo = new Map<string, { commodity: string; date: string; price: number; unit: string }[]>();
  for (const r of rows) {
    const list = byCommo.get(r.commodity) ?? [];
    if (list.length < 2) { list.push(r); byCommo.set(r.commodity, list); }
  }
  const out: CommoTick[] = [];
  for (const [commo, list] of byCommo) {
    const meta = COMMO_LABELS[commo];
    if (!meta || list.length === 0) continue;
    const [last, prev] = list;
    out.push({
      commodity: commo,
      label: meta.label,
      icon: meta.icon,
      price: last.price,
      unit: last.unit,
      varPct: prev && prev.price > 0 ? ((last.price - prev.price) / prev.price) * 100 : null,
      date: last.date,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function CommodityBadges({ tickers }: { tickers: string[] | null }) {
  if (!tickers?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tickers.slice(0, 6).map(t => (
        <span key={t} className="font-mono text-xs px-2 py-0.5 rounded border border-accent/30 text-accent bg-surface">
          {t}
        </span>
      ))}
    </div>
  );
}

export default async function WeeklyPage() {
  const [articles, commos] = await Promise.all([fetchWeeklyArticles(), fetchCommodities()]);

  return (
    <div className="min-h-screen bg-bg text-ivory px-4 py-8 max-w-5xl mx-auto">
      <SectionHeader
        title="Analyses Hebdo – Matières Premières"
        subtitle="Impact du cacao, pétrole, caoutchouc et huile de palme sur les valeurs BRVM"
      />
      <div className="mt-4">
        <ViewTabs tabs={INTEL_TABS} current="/weekly" />
      </div>

      {/* Prix des matières — données réelles Banque mondiale (mensuel) */}
      {commos.length > 0 && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {commos.map((c) => (
              <div key={c.commodity} className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="truncate text-[11px] text-muted">
                  <span aria-hidden className="mr-1">{c.icon}</span>{c.label}
                </p>
                <p className="tabular mt-1 text-lg font-bold leading-none text-ivory">
                  {c.price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                  <span className="ml-1 text-[10px] font-normal text-faint">{c.unit}</span>
                </p>
                <p className={`tabular mt-1 text-xs font-bold ${
                  c.varPct == null ? 'text-faint' : c.varPct >= 0 ? 'text-up' : 'text-down'
                }`}>
                  {c.varPct == null ? '—' : `${c.varPct >= 0 ? '+' : ''}${c.varPct.toFixed(1)} % M/M`}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-faint">
            Prix mensuels — source Banque mondiale (Pink Sheet), dernier point : {commos[0]?.date}.
          </p>
        </div>
      )}

      {/* Thesis tracker — carte permanente illustrée */}
      <Link
        href="/weekly/thesis"
        className="group mt-8 flex gap-0 rounded-xl border border-border overflow-hidden hover:border-accent/40 transition-all duration-200 block"
      >
        <div className="relative hidden sm:block w-40 shrink-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=320&h=200&fit=crop&auto=format&q=80"
            alt="Matières premières"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a1417]/70" />
        </div>
        <div className="flex-1 bg-surface p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-accent/70">Référentiel stratégique</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">permanent</span>
            </div>
            <h2 className="font-semibold text-ivory group-hover:text-accent transition-colors">
              Exposition BRVM aux matières premières
            </h2>
            <p className="text-xs text-muted mt-1">
              Matrice de sensibilité · Fiches valeurs illustrées · Catalyseurs · SICC, SIFCA, SAPH, SOGB, PALC, SCRC, TTLS, SVOC
            </p>
          </div>
          <span className="text-accent shrink-0 text-lg group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </Link>

      {articles.length === 0 ? (
        <div className="mt-12 text-center text-faint">
          <p className="text-lg">Aucune analyse disponible pour le moment.</p>
          <p className="text-sm mt-2">Les analyses sont publiées chaque vendredi.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {articles.map(article => {
            const meta = article.metadata as Record<string, unknown> | null;
            const week = meta?.week as number | undefined;
            const year = meta?.year as number | undefined;

            return (
              <Link
                key={article.id}
                href={`/weekly/${article.slug}`}
                className="group block bg-surface border border-border rounded-xl p-6 hover:border-accent/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {week && year && (
                        <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">
                          S{String(week).padStart(2, '0')}/{year}
                        </span>
                      )}
                      <span className="text-xs text-faint">
                        {new Date(article.date_publication).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-ivory group-hover:text-accent transition-colors line-clamp-2">
                      {article.titre}
                    </h2>
                    {article.resume && (
                      <p className="mt-2 text-sm text-muted line-clamp-2">{article.resume}</p>
                    )}
                    <CommodityBadges tickers={article.ticker_codes} />
                  </div>
                  <div className="text-accent opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0">
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
