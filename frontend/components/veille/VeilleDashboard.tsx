'use client';

import { useState, useMemo, useCallback } from 'react';
import type { VeilleNews } from '@/app/veille/page.tsx';

type View = 'flux' | 'heatmap' | 'alertes' | 'matieres' | 'sources';

interface Props {
  news: VeilleNews[];
  stats: {
    total7d: number;
    today: number;
    alertes: number;
    covered: number;
    totalSocietes: number;
    gnews: number;
    sitesOff: number;
    matieres: number;
  };
  secteurs: { secteur: string; count: number }[];
  topSources: { label: string; count: number }[];
}

/* ── Badges tickers (couleurs distinctives par hash) ── */
const BADGE_COLORS = [
  'bg-[#ff6b35]/20 text-[#ff6b35] border border-[#ff6b35]/40',
  'bg-[#3fe18b]/20 text-[#3fe18b] border border-[#3fe18b]/40',
  'bg-[#56d7fd]/20 text-[#56d7fd] border border-[#56d7fd]/40',
  'bg-[#c77dff]/20 text-[#c77dff] border border-[#c77dff]/40',
  'bg-[#ffd166]/20 text-[#ffd166] border border-[#ffd166]/40',
  'bg-[#ef476f]/20 text-[#ef476f] border border-[#ef476f]/40',
  'bg-[#06d6a0]/20 text-[#06d6a0] border border-[#06d6a0]/40',
  'bg-[#118ab2]/20 text-[#118ab2] border border-[#118ab2]/40',
];
function tickerColorClass(code: string) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0xffff;
  return BADGE_COLORS[h % BADGE_COLORS.length];
}

function TickerBadge({ code }: { code: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${tickerColorClass(code)}`}>
      {code}
    </span>
  );
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (diffH < 1) return '< 1h';
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}j`;
}

/* ── Carte article ── */
function ArticleCard({ item }: { item: VeilleNews }) {
  const tickers = [...new Set([
    ...(item.ticker_codes ?? []),
  ])].slice(0, 5);

  const isAlerte = (item.score_impact ?? 0) >= 70;
  const sent = item.sentiment ?? 'neutre';

  // Bordure gauche colorée selon sentiment
  const borderLeft =
    sent === 'positif' ? 'border-l-[3px] border-l-[#3fe18b]'
    : sent === 'négatif' ? 'border-l-[3px] border-l-[#ff6b6b]'
    : 'border-l-[3px] border-l-transparent';

  // Emoji sentiment
  const sentEmoji = sent === 'positif' ? '🟢' : sent === 'négatif' ? '🔴' : '⚪';

  const srcLabel = item.source_label && item.source_label !== 'brvm' && item.source_label !== 'Inconnu'
    ? item.source_label
    : item.source ?? 'Source';
  const timeStr = relativeTime(item.created_at ?? item.date_publication);

  return (
    <a
      href={item.source_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`block border border-border rounded-lg pl-3 pr-3 pt-3 pb-2.5 hover:border-accent/40 transition-colors group space-y-1.5 ${borderLeft} ${
        isAlerte ? 'bg-[#ff6b6b]/5' : 'bg-surface'
      }`}
    >
      {/* Titre */}
      <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors leading-snug line-clamp-2">
        {item.titre}
      </p>

      {/* Résumé */}
      {item.resume && (
        <p className="text-xs text-muted line-clamp-2 leading-relaxed">{item.resume}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Source + temps */}
        <span className="text-[11px] text-muted shrink-0">
          {srcLabel.length > 35 ? srcLabel.slice(0, 35) + '…' : srcLabel}
        </span>
        <span className="text-[10px] text-muted/60">· il y a {timeStr}</span>

        {/* Alerte tag */}
        {isAlerte && (
          <span className="text-[10px] bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/30 px-1.5 py-0.5 rounded font-medium ml-1">
            ALERTE
          </span>
        )}

        {/* Tickers — affichés sur TOUS les articles ayant des codes */}
        {tickers.map((t) => <TickerBadge key={t} code={t} />)}

        {/* Sentiment emoji en fin de ligne */}
        <span className="ml-auto text-base" title={`Sentiment : ${sent}`}>{sentEmoji}</span>
      </div>
    </a>
  );
}

/* ── Heatmap tickers ── */
function HeatmapView({ news }: { news: VeilleNews[] }) {
  const tickers = useMemo(() => {
    const map = new Map<string, { count: number; pos: number; neg: number }>();
    for (const n of news) {
      for (const c of n.ticker_codes ?? []) {
        if (!map.has(c)) map.set(c, { count: 0, pos: 0, neg: 0 });
        const e = map.get(c)!;
        e.count++;
        if (n.sentiment === 'positif') e.pos++;
        if (n.sentiment === 'négatif') e.neg++;
      }
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [news]);

  if (!tickers.length) return <p className="text-muted text-sm text-center py-12">Aucune couverture sur 7 jours.</p>;

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
      {tickers.map(([code, { count, pos, neg }]) => {
        const dom = pos > neg ? 'up' : neg > pos ? 'down' : 'neu';
        const cls = dom === 'up'
          ? 'bg-[#3fe18b]/15 border-[#3fe18b]/40 text-[#3fe18b]'
          : dom === 'down'
          ? 'bg-[#ff6b6b]/15 border-[#ff6b6b]/40 text-[#ff6b6b]'
          : 'bg-surface border-border text-muted';
        return (
          <div key={code} className={`rounded-lg border p-2.5 text-center ${cls}`} title={`${count} article(s)`}>
            <p className="text-xs font-mono font-bold">{code}</p>
            <p className="text-[10px] mt-0.5 opacity-70">{count}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Matières view ── */
function MatieresView({ news }: { news: VeilleNews[] }) {
  const items = useMemo(() => {
    const MATIERES = ['petrole','caoutchouc','huile_palme','cacao','coton','metaux','utilities'];
    const byMat = new Map<string, VeilleNews[]>();
    for (const n of news) {
      const m = n.secteur ?? '';
      if (MATIERES.includes(m)) {
        if (!byMat.has(m)) byMat.set(m, []);
        byMat.get(m)!.push(n);
      }
    }
    return [...byMat.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [news]);

  if (!items.length) return <p className="text-muted text-sm text-center py-12">Aucun article matière première sur 7 jours.</p>;

  return (
    <div className="space-y-4">
      {items.map(([mat, arts]) => (
        <div key={mat}>
          <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">
            {mat.replace(/_/g, ' ')} ({arts.length})
          </p>
          <div className="space-y-2">
            {arts.slice(0, 5).map((n) => <ArticleCard key={n.id} item={n} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Export CSV ── */
function exportCSV(news: VeilleNews[]) {
  const header = 'Date,Titre,Source,Sentiment,Impact,Tickers,URL';
  const rows = news.map((n) =>
    [
      n.date_publication,
      `"${(n.titre ?? '').replace(/"/g, '""')}"`,
      `"${(n.source_label ?? n.source ?? '').replace(/"/g, '""')}"`,
      n.sentiment ?? '',
      n.score_impact ?? 0,
      (n.ticker_codes ?? []).join(';'),
      n.source_url ?? '',
    ].join(','),
  );
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `veille-brvm-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

/* ── Composant principal ── */
export default function VeilleDashboard({ news, stats, secteurs, topSources }: Props) {
  const [view, setView] = useState<View>('flux');
  const [secteurFilter, setSecteurFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAlertes, setShowAlertes] = useState(false);

  const alertes = useMemo(() => news.filter((n) => (n.score_impact ?? 0) >= 70), [news]);
  const alertesCritiques = alertes.slice(0, 3);

  const filtered = useMemo(() => {
    let items = showAlertes ? alertes : news;
    if (secteurFilter) items = items.filter((n) => n.secteur === secteurFilter);
    if (sentimentFilter) items = items.filter((n) => n.sentiment === sentimentFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (n) =>
          n.titre.toLowerCase().includes(q) ||
          (n.resume ?? '').toLowerCase().includes(q) ||
          (n.ticker_codes ?? []).some((t) => t.toLowerCase().includes(q)) ||
          (n.source_label ?? '').toLowerCase().includes(q),
      );
    }
    return items;
  }, [news, alertes, showAlertes, secteurFilter, sentimentFilter, search]);

  const reset = useCallback(() => {
    setSecteurFilter('');
    setSentimentFilter('');
    setSearch('');
    setShowAlertes(false);
  }, []);

  const lastItem = news[0];
  const lastTime = lastItem ? relativeTime(lastItem.created_at ?? lastItem.date_publication) : '—';
  const lastSrc = lastItem?.source_label && lastItem.source_label !== 'brvm'
    ? lastItem.source_label
    : lastItem?.source ?? '—';

  const VIEWS: { id: View; label: string; icon: string; count: number }[] = [
    { id: 'flux', label: 'Flux', icon: '≡', count: news.length },
    { id: 'heatmap', label: 'Heatmap', icon: '⬛', count: stats.covered },
    { id: 'alertes', label: 'Alertes', icon: '🔔', count: stats.alertes },
    { id: 'matieres', label: 'Matières', icon: '◈', count: stats.matieres },
    { id: 'sources', label: 'Sources', icon: '⌬', count: topSources.length },
  ];

  return (
    <div className="space-y-4">
      {/* Stats bar — 8 compteurs */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { label: 'ARTICLES 7J', val: stats.total7d, cls: 'text-foreground' },
          { label: "AUJOURD'HUI", val: stats.today, cls: 'text-[#3fe18b]' },
          { label: 'ALERTES', val: stats.alertes, cls: 'text-[#ff6b6b]' },
          { label: 'COUVERTS', val: `${stats.covered}/${stats.totalSocietes}`, cls: 'text-accent' },
          { label: 'SANS ACTU', val: stats.totalSocietes - stats.covered, cls: 'text-muted' },
          { label: 'G.NEWS', val: stats.gnews, cls: 'text-[#56d7fd]' },
          { label: 'SITES OFF.', val: stats.sitesOff, cls: 'text-[#c77dff]' },
          { label: 'MATIÈRES', val: stats.matieres, cls: 'text-[#ffd166]' },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted">{s.label}</p>
            <p className={`text-xl font-bold tabular mt-0.5 ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Titre, ticker, source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <select
          title="Filtrer par secteur"
          value={secteurFilter}
          onChange={(e) => setSecteurFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">Tous secteurs</option>
          {secteurs.map((s) => (
            <option key={s.secteur} value={s.secteur}>
              {s.secteur} ({s.count})
            </option>
          ))}
        </select>
        <select
          title="Filtrer par sentiment"
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">Tout sentiment</option>
          <option value="positif">🟢 Positif</option>
          <option value="neutre">⚪ Neutre</option>
          <option value="négatif">🔴 Négatif</option>
        </select>
        <button
          type="button"
          onClick={() => setShowAlertes(!showAlertes)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            showAlertes
              ? 'bg-[#ff6b6b] border-[#ff6b6b] text-white'
              : 'bg-surface border-border text-muted hover:text-foreground'
          }`}
        >
          🔔 Alertes
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-1.5 rounded-lg text-sm border border-border text-muted hover:text-foreground transition-colors"
        >
          ✕ Reset
        </button>
        <button
          type="button"
          onClick={() => exportCSV(filtered)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-bg border border-accent hover:bg-accent/90 transition-colors"
        >
          ↓ CSV
        </button>
      </div>

      {/* Body : sidebar + main */}
      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-48 shrink-0 space-y-4">
          {/* VUES */}
          <div className="bg-surface border border-border rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2 px-1">Vues</p>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  view === v.id
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-muted hover:text-foreground hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs w-4">{v.icon}</span>
                  {v.label}
                </span>
                {v.count > 0 && (
                  <span
                    className={`text-xs tabular px-1.5 rounded ${
                      view === v.id ? 'bg-accent/20 text-accent' : 'bg-white/5 text-muted'
                    }`}
                  >
                    {v.count > 999 ? '999+' : v.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* SECTEURS (uniquement secteurs BRVM — pas les matières premières) */}
          {secteurs.filter(s => !['petrole','caoutchouc','huile_palme','cacao','coton','metaux','utilities'].includes(s.secteur)).length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2 px-1">Secteurs</p>
              {secteurs
                .filter(s => !['petrole','caoutchouc','huile_palme','cacao','coton','metaux','utilities'].includes(s.secteur))
                .slice(0, 10)
                .map((s) => (
                <button
                  key={s.secteur}
                  type="button"
                  onClick={() => setSecteurFilter(secteurFilter === s.secteur ? '' : s.secteur)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                    secteurFilter === s.secteur ? 'text-accent font-semibold' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{s.secteur}</span>
                  <span className="tabular text-muted shrink-0">{s.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Dernier article */}
          {lastItem && view === 'flux' && (
            <p className="text-xs text-muted border-b border-border pb-2">
              ● Dernier : il y a {lastTime} — {lastSrc.length > 40 ? lastSrc.slice(0, 40) + '…' : lastSrc}
            </p>
          )}

          {/* Alertes critiques (bandeau) */}
          {view === 'flux' && alertesCritiques.length > 0 && !showAlertes && (
            <div className="bg-[#ff6b6b]/5 border border-[#ff6b6b]/30 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-[#ff6b6b] uppercase tracking-widest">
                🔔 Alertes critiques ({stats.alertes})
              </p>
              {alertesCritiques.map((n) => {
                const tickers = (n.ticker_codes ?? []).slice(0, 3);
                return (
                  <a
                    key={n.id}
                    href={n.source_url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 group"
                  >
                    <div className="flex gap-1 shrink-0">
                      {tickers.map((t) => <TickerBadge key={t} code={t} />)}
                    </div>
                    <span className="text-sm text-foreground group-hover:text-accent transition-colors line-clamp-1">
                      {n.titre}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Flux / Alertes */}
          {(view === 'flux' || view === 'alertes') && (
            <>
              <p className="text-xs text-muted">
                {view === 'alertes'
                  ? `Alertes — ${alertes.length} résultat(s)`
                  : `Flux — ${filtered.length} résultat(s)`}
              </p>
              {(view === 'alertes' ? alertes : filtered).length === 0 ? (
                <p className="text-center text-muted text-sm py-10">
                  Aucun article ne correspond à ces filtres.
                </p>
              ) : (
                <div className="space-y-2">
                  {(view === 'alertes' ? alertes : filtered).map((n) => (
                    <ArticleCard key={n.id} item={n} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Heatmap */}
          {view === 'heatmap' && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#3fe18b]/30 inline-block" />Positif
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#ff6b6b]/30 inline-block" />Négatif
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-border inline-block" />Neutre
                </span>
              </div>
              <HeatmapView news={news} />
            </div>
          )}

          {/* Sources */}
          {view === 'sources' && (
            <div className="space-y-2">
              {topSources.map((s, i) => (
                <div
                  key={s.label}
                  className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-lg font-bold tabular text-muted w-6 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-foreground">{s.label}</span>
                  <span className="text-sm font-bold tabular text-accent">{s.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Matières premières */}
          {view === 'matieres' && <MatieresView news={news} />}
        </div>
      </div>
    </div>
  );
}
