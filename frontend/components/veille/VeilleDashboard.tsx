'use client';

import { useState, useMemo } from 'react';
import type { VeilleNews } from '@/app/veille/page';

type Tab = 'flux' | 'heatmap' | 'alertes' | 'sources';

interface Props {
  news: VeilleNews[];
  stats: {
    total7d: number;
    today: number;
    alertes: number;
    covered: number;
    totalSocietes: number;
  };
  secteurs: { secteur: string; count: number }[];
  topSources: { label: string; count: number }[];
}

const SENTIMENT_COLORS = {
  positif: 'text-up bg-up/10 border-up/30',
  négatif: 'text-down bg-down/10 border-down/30',
  neutre: 'text-muted bg-surface border-border',
};
const SENTIMENT_ICONS = { positif: '▲', négatif: '▼', neutre: '●' };

function sentimentClass(s: string | null) {
  return SENTIMENT_COLORS[(s ?? 'neutre') as keyof typeof SENTIMENT_COLORS] ?? SENTIMENT_COLORS.neutre;
}
function sentimentIcon(s: string | null) {
  return SENTIMENT_ICONS[(s ?? 'neutre') as keyof typeof SENTIMENT_ICONS] ?? '●';
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (diffH < 1) return "< 1h";
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}j`;
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
      <p className="text-muted text-xs uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold tabular text-foreground">{value}</p>
      {sub && <p className="text-muted text-xs">{sub}</p>}
    </div>
  );
}

function NewsCard({ item }: { item: VeilleNews }) {
  const tickers = [
    ...(item.instrument_code ? [item.instrument_code] : []),
    ...(item.ticker_codes ?? []).filter((t) => t !== item.instrument_code),
  ].slice(0, 4);

  return (
    <a
      href={item.source_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-2 flex-1">
          {item.titre}
        </p>
        <span
          className={`shrink-0 text-xs px-1.5 py-0.5 rounded border font-mono tabular ${sentimentClass(item.sentiment)}`}
        >
          {sentimentIcon(item.sentiment)}
        </span>
      </div>

      {item.resume && (
        <p className="text-muted text-xs line-clamp-2">{item.resume}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted tabular">
          {relativeTime(item.created_at ?? item.date_publication)}
        </span>
        {item.source_label && (
          <span className="text-xs bg-surface-alt px-1.5 py-0.5 rounded text-muted border border-border">
            {item.source_label}
          </span>
        )}
        {item.secteur && (
          <span className="text-xs text-info px-1.5 py-0.5 rounded bg-info/10 border border-info/20">
            {item.secteur}
          </span>
        )}
        {tickers.map((t) => (
          <span
            key={t}
            className="text-xs font-mono tabular text-accent px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20"
          >
            {t}
          </span>
        ))}
        {(item.score_impact ?? 0) >= 70 && (
          <span className="text-xs text-gold px-1.5 py-0.5 rounded bg-gold/10 border border-gold/20">
            🔔 Alerte
          </span>
        )}
      </div>
    </a>
  );
}

function HeatmapView({ news }: { news: VeilleNews[] }) {
  const tickers = useMemo(() => {
    const map = new Map<string, { count: number; sentiments: string[] }>();
    for (const n of news) {
      const codes = [
        ...(n.instrument_code ? [n.instrument_code] : []),
        ...(n.ticker_codes ?? []),
      ];
      for (const c of codes) {
        if (!map.has(c)) map.set(c, { count: 0, sentiments: [] });
        const e = map.get(c)!;
        e.count++;
        if (n.sentiment) e.sentiments.push(n.sentiment);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([code, { count, sentiments }]) => {
        const pos = sentiments.filter((s) => s === 'positif').length;
        const neg = sentiments.filter((s) => s === 'négatif').length;
        const dominant = pos > neg ? 'positif' : neg > pos ? 'négatif' : 'neutre';
        return { code, count, dominant };
      });
  }, [news]);

  if (tickers.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-12">
        Aucune couverture sur les 7 derniers jours.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {tickers.map(({ code, count, dominant }) => {
        const bg =
          dominant === 'positif'
            ? 'bg-up/20 border-up/40 text-up'
            : dominant === 'négatif'
              ? 'bg-down/20 border-down/40 text-down'
              : 'bg-surface border-border text-muted';
        return (
          <div
            key={code}
            className={`rounded-lg border p-3 text-center cursor-default ${bg}`}
            title={`${count} article${count > 1 ? 's' : ''}`}
          >
            <p className="text-xs font-mono font-bold tabular">{code}</p>
            <p className="text-xs mt-0.5 opacity-70">{count}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function VeilleDashboard({ news, stats, secteurs, topSources }: Props) {
  const [tab, setTab] = useState<Tab>('flux');
  const [secteurFilter, setSecteurFilter] = useState<string>('');
  const [sentimentFilter, setSentimentFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const alertes = useMemo(
    () => news.filter((n) => (n.score_impact ?? 0) >= 70),
    [news],
  );

  const filteredNews = useMemo(() => {
    return news.filter((n) => {
      if (secteurFilter && n.secteur !== secteurFilter) return false;
      if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
      if (
        search &&
        !n.titre.toLowerCase().includes(search.toLowerCase()) &&
        !(n.resume ?? '').toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [news, secteurFilter, sentimentFilter, search]);

  const TABS = [
    { id: 'flux' as Tab, label: 'Flux', count: news.length },
    { id: 'heatmap' as Tab, label: 'Heatmap', count: stats.covered },
    { id: 'alertes' as Tab, label: 'Alertes', count: stats.alertes },
    { id: 'sources' as Tab, label: 'Sources', count: topSources.length },
  ];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Articles 7j" value={stats.total7d} />
        <StatCard label="Aujourd'hui" value={stats.today} />
        <StatCard
          label="Alertes"
          value={stats.alertes}
          sub="impact ≥ 70%"
        />
        <StatCard
          label="Couverts"
          value={`${stats.covered}/${stats.totalSocietes}`}
          sub="sociétés 7j"
        />
        <StatCard
          label="Sans actu"
          value={stats.totalSocietes - stats.covered}
          sub="derniers 7j"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              tab === t.id
                ? 'bg-accent text-bg font-semibold'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t.label}
            <span
              className={`text-xs tabular px-1 rounded ${
                tab === t.id ? 'bg-bg/30 text-bg' : 'bg-surface-alt text-muted'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {(tab === 'flux' || tab === 'alertes') && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main feed */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Filters (flux only) */}
            {tab === 'flux' && (
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 min-w-48 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                />
                <select
                  value={secteurFilter}
                  onChange={(e) => setSecteurFilter(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">Tous secteurs</option>
                  {secteurs.map((s) => (
                    <option key={s.secteur} value={s.secteur}>
                      {s.secteur}
                    </option>
                  ))}
                </select>
                <select
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">Tout sentiment</option>
                  <option value="positif">▲ Positif</option>
                  <option value="neutre">● Neutre</option>
                  <option value="négatif">▼ Négatif</option>
                </select>
              </div>
            )}

            {/* Articles */}
            {tab === 'alertes' ? (
              alertes.length === 0 ? (
                <div className="text-center py-12 text-muted text-sm">
                  Aucune alerte haute priorité sur les 7 derniers jours.
                </div>
              ) : (
                <div className="space-y-3">
                  {alertes.map((n) => (
                    <NewsCard key={n.id} item={n} />
                  ))}
                </div>
              )
            ) : filteredNews.length === 0 ? (
              <div className="text-center py-12 text-muted text-sm">
                Aucun article ne correspond à ces filtres.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNews.map((n) => (
                  <NewsCard key={n.id} item={n} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-widest text-muted font-semibold">
                Par secteur
              </h3>
              {secteurs.length === 0 ? (
                <p className="text-muted text-xs">—</p>
              ) : (
                <ul className="space-y-2">
                  {secteurs.slice(0, 8).map((s) => (
                    <li
                      key={s.secteur}
                      className="flex items-center justify-between text-sm cursor-pointer hover:text-accent transition-colors"
                      onClick={() =>
                        setSecteurFilter(secteurFilter === s.secteur ? '' : s.secteur)
                      }
                    >
                      <span
                        className={
                          secteurFilter === s.secteur ? 'text-accent' : 'text-foreground'
                        }
                      >
                        {s.secteur}
                      </span>
                      <span className="tabular text-xs text-muted">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-widest text-muted font-semibold">
                Top sources
              </h3>
              {topSources.length === 0 ? (
                <p className="text-muted text-xs">—</p>
              ) : (
                <ul className="space-y-2">
                  {topSources.map((s) => (
                    <li key={s.label} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate max-w-40">{s.label}</span>
                      <span className="tabular text-xs text-muted">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'heatmap' && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-up/30 inline-block" />
              Sentiment positif
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-down/30 inline-block" />
              Sentiment négatif
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-border inline-block" />
              Neutre / non classifié
            </span>
          </div>
          <HeatmapView news={news} />
        </div>
      )}

      {tab === 'sources' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topSources.map((s, i) => (
            <div
              key={s.label}
              className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <span className="text-2xl font-bold tabular text-muted w-8 shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                <p className="text-xs text-muted">
                  {s.count} article{s.count > 1 ? 's' : ''} — 7j
                </p>
              </div>
              <span className="ml-auto text-2xl font-bold tabular text-accent shrink-0">
                {s.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
