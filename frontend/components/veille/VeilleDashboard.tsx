'use client';

import { useState, useMemo, useCallback } from 'react';
import type { VeilleNews } from '@/app/veille/page.tsx';

type View = 'flux' | 'heatmap' | 'alertes' | 'matieres' | 'sources';
type Period = 7 | 30 | 90 | 365;

const MATIERES_SECTEURS = new Set(['petrole','caoutchouc','huile_palme','cacao','coton','metaux','utilities']);

/* ── Badge tickers ── */
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
function tickerColor(code: string) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0xffff;
  return BADGE_COLORS[h % BADGE_COLORS.length];
}
function TickerBadge({ code }: { code: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${tickerColor(code)}`}>
      {code}
    </span>
  );
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (diffH < 1) return '< 1h';
  if (diffH < 24) return `${diffH}h`;
  const days = Math.floor(diffH / 24);
  if (days < 30) return `${days}j`;
  return `${Math.floor(days / 30)}mois`;
}

/* ── Carte article ── */
function ArticleCard({ item }: { item: VeilleNews }) {
  const tickers = [...new Set(item.ticker_codes ?? [])].slice(0, 5);
  const isAlerte = (item.score_impact ?? 0) >= 70;
  const sent = item.sentiment ?? 'neutre';
  const borderLeft = sent === 'positif'
    ? 'border-l-[3px] border-l-[#3fe18b]'
    : sent === 'négatif'
    ? 'border-l-[3px] border-l-[#ff6b6b]'
    : 'border-l-[3px] border-l-transparent';
  const sentEmoji = sent === 'positif' ? '🟢' : sent === 'négatif' ? '🔴' : '⚪';
  const srcLabel = (item.source_label && item.source_label !== 'brvm' && item.source_label !== 'Inconnu')
    ? item.source_label
    : item.source ?? 'Source';

  return (
    <a
      href={item.source_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`block border border-border rounded-lg pl-3 pr-3 pt-3 pb-2.5 hover:border-accent/40 transition-colors group space-y-1.5 ${borderLeft} ${isAlerte ? 'bg-[#ff6b6b]/5' : 'bg-surface'}`}
    >
      <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors leading-snug line-clamp-2">
        {item.titre}
      </p>
      {item.resume && (
        <p className="text-xs text-muted line-clamp-2 leading-relaxed">{item.resume}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted shrink-0">
          {srcLabel.length > 35 ? srcLabel.slice(0, 35) + '…' : srcLabel}
        </span>
        <span className="text-[10px] text-muted/60">· il y a {relativeTime(item.created_at ?? item.date_publication)}</span>
        {isAlerte && (
          <span className="text-[10px] bg-[#ff6b6b]/20 text-[#ff6b6b] border border-[#ff6b6b]/30 px-1.5 py-0.5 rounded font-medium ml-1">
            ALERTE
          </span>
        )}
        {tickers.map((t) => <TickerBadge key={t} code={t} />)}
        <span className="ml-auto text-base" title={`Sentiment : ${sent}`}>{sentEmoji}</span>
      </div>
    </a>
  );
}

/* ── Heatmap ── */
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

  if (!tickers.length) return <p className="text-muted text-sm text-center py-12">Aucune couverture sur la période.</p>;
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

/* ── Matières ── */
function MatieresView({ news }: { news: VeilleNews[] }) {
  const items = useMemo(() => {
    const byMat = new Map<string, VeilleNews[]>();
    for (const n of news) {
      const m = n.secteur ?? '';
      if (MATIERES_SECTEURS.has(m)) {
        if (!byMat.has(m)) byMat.set(m, []);
        byMat.get(m)!.push(n);
      }
    }
    return [...byMat.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [news]);

  if (!items.length) return <p className="text-muted text-sm text-center py-12">Aucun article matière première sur la période.</p>;
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
function exportCSV(news: VeilleNews[], period: Period) {
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
  a.download = `veille-brvm-${period}j-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

/* ── Composant principal ── */
export default function VeilleDashboard({ news: allNews }: { news: VeilleNews[] }) {
  const [period, setPeriod] = useState<Period>(30);
  const [view, setView] = useState<View>('flux');
  const [secteurFilter, setSecteurFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAlertes, setShowAlertes] = useState(false);

  // Filtrage par période (côté client)
  const news = useMemo(() => {
    const cutoff = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return allNews.filter((n) => n.date_publication >= cutoff);
  }, [allNews, period]);

  // Stats calculées depuis la période sélectionnée
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = news.filter((n) => n.date_publication === today);
    const alertes = news.filter((n) => (n.score_impact ?? 0) >= 70);
    const covered = new Set<string>();
    for (const n of news) {
      if (n.instrument_code) covered.add(n.instrument_code);
      for (const t of n.ticker_codes ?? []) covered.add(t);
    }
    return {
      total: news.length,
      today: todayItems.length,
      alertes: alertes.length,
      covered: covered.size,
      totalSocietes: 47,
      gnews: news.filter((n) => n.source_type === 'google_news').length,
      sitesOff: news.filter((n) => n.source_type === 'site_officiel' || n.source_type === 'institution').length,
      matieres: news.filter((n) => n.source_type === 'commodite').length,
    };
  }, [news]);

  const alertes = useMemo(() => news.filter((n) => (n.score_impact ?? 0) >= 70), [news]);
  const alertesCritiques = alertes.slice(0, 3);

  // Secteurs BRVM (hors matières)
  const secteurs = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of news) {
      if (n.secteur && !MATIERES_SECTEURS.has(n.secteur))
        map.set(n.secteur, (map.get(n.secteur) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([secteur, count]) => ({ secteur, count }));
  }, [news]);

  // Sources distinctes
  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of news) {
      const lbl = (n.source_label && n.source_label !== 'brvm' && n.source_label !== 'Inconnu')
        ? n.source_label : n.source ?? 'Autre';
      map.set(lbl, (map.get(lbl) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([label, count]) => ({ label, count }));
  }, [news]);

  // Flux filtré
  const filtered = useMemo(() => {
    let items = showAlertes ? alertes : news;
    if (secteurFilter) items = items.filter((n) => n.secteur === secteurFilter);
    if (sentimentFilter) items = items.filter((n) => n.sentiment === sentimentFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((n) =>
        n.titre.toLowerCase().includes(q) ||
        (n.resume ?? '').toLowerCase().includes(q) ||
        (n.ticker_codes ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (n.source_label ?? '').toLowerCase().includes(q),
      );
    }
    return items;
  }, [news, alertes, showAlertes, secteurFilter, sentimentFilter, search]);

  const reset = useCallback(() => {
    setSecteurFilter(''); setSentimentFilter(''); setSearch(''); setShowAlertes(false);
  }, []);

  const lastItem = news[0];
  const lastTime = lastItem ? relativeTime(lastItem.created_at ?? lastItem.date_publication) : '—';
  const lastSrc = (lastItem?.source_label && lastItem.source_label !== 'brvm')
    ? lastItem.source_label : lastItem?.source ?? '—';

  const VIEWS: { id: View; label: string; icon: string; count: number }[] = [
    { id: 'flux', label: 'Flux', icon: '≡', count: news.length },
    { id: 'heatmap', label: 'Heatmap', icon: '⬛', count: stats.covered },
    { id: 'alertes', label: 'Alertes', icon: '🔔', count: stats.alertes },
    { id: 'matieres', label: 'Matières', icon: '◈', count: stats.matieres },
    { id: 'sources', label: 'Sources', icon: '⌬', count: topSources.length },
  ];

  const PERIODS: { val: Period; label: string }[] = [
    { val: 7, label: '7j' },
    { val: 30, label: '30j' },
    { val: 90, label: '3 mois' },
    { val: 365, label: '1 an' },
  ];

  return (
    <div className="space-y-4">
      {/* Sélecteur de période */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted uppercase tracking-widest">Période :</span>
        {PERIODS.map((p) => (
          <button
            key={p.val}
            type="button"
            onClick={() => setPeriod(p.val)}
            className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              period === p.val
                ? 'bg-accent text-bg border-accent'
                : 'bg-surface border-border text-muted hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-xs text-muted ml-2 tabular">{allNews.length} articles chargés</span>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { label: period === 365 ? 'ARTICLES 1 AN' : `ARTICLES ${period}J`, val: stats.total, cls: 'text-foreground' },
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
            <option key={s.secteur} value={s.secteur}>{s.secteur} ({s.count})</option>
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
            showAlertes ? 'bg-[#ff6b6b] border-[#ff6b6b] text-white' : 'bg-surface border-border text-muted hover:text-foreground'
          }`}
        >
          🔔 Alertes
        </button>
        <button type="button" onClick={reset} className="px-3 py-1.5 rounded-lg text-sm border border-border text-muted hover:text-foreground transition-colors cursor-pointer">
          ✕ Reset
        </button>
        <button
          type="button"
          onClick={() => exportCSV(filtered, period)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-bg border border-accent hover:bg-accent/90 transition-colors cursor-pointer"
        >
          ↓ CSV
        </button>
      </div>

      {/* Body */}
      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-48 shrink-0 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2 px-1">Vues</p>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  view === v.id ? 'bg-accent/10 text-accent font-semibold' : 'text-muted hover:text-foreground hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs w-4">{v.icon}</span>
                  {v.label}
                </span>
                {v.count > 0 && (
                  <span className={`text-xs tabular px-1.5 rounded ${view === v.id ? 'bg-accent/20 text-accent' : 'bg-white/5 text-muted'}`}>
                    {v.count > 999 ? '999+' : v.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {secteurs.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2 px-1">Secteurs</p>
              {secteurs.slice(0, 10).map((s) => (
                <button
                  key={s.secteur}
                  type="button"
                  onClick={() => setSecteurFilter(secteurFilter === s.secteur ? '' : s.secteur)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
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

        {/* Main */}
        <div className="flex-1 min-w-0 space-y-3">
          {lastItem && view === 'flux' && (
            <p className="text-xs text-muted border-b border-border pb-2">
              ● Dernier : il y a {lastTime} — {lastSrc.length > 40 ? lastSrc.slice(0, 40) + '…' : lastSrc}
            </p>
          )}

          {/* Alertes critiques */}
          {view === 'flux' && alertesCritiques.length > 0 && !showAlertes && (
            <div className="bg-[#ff6b6b]/5 border border-[#ff6b6b]/30 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-[#ff6b6b] uppercase tracking-widest">
                🔔 Alertes critiques ({stats.alertes})
              </p>
              {alertesCritiques.map((n) => (
                <a key={n.id} href={n.source_url ?? '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                  <div className="flex gap-1 shrink-0">
                    {(n.ticker_codes ?? []).slice(0, 3).map((t) => <TickerBadge key={t} code={t} />)}
                  </div>
                  <span className="text-sm text-foreground group-hover:text-accent transition-colors line-clamp-1">{n.titre}</span>
                </a>
              ))}
            </div>
          )}

          {/* Flux / Alertes */}
          {(view === 'flux' || view === 'alertes') && (
            <>
              <p className="text-xs text-muted">
                {view === 'alertes' ? `Alertes — ${alertes.length}` : `Flux — ${filtered.length} résultat(s)`}
              </p>
              {(view === 'alertes' ? alertes : filtered).length === 0 ? (
                <p className="text-center text-muted text-sm py-10">Aucun article sur cette période avec ces filtres.</p>
              ) : (
                <div className="space-y-2">
                  {(view === 'alertes' ? alertes : filtered).map((n) => (
                    <ArticleCard key={n.id} item={n} />
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'heatmap' && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#3fe18b]/30 inline-block" />Positif</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ff6b6b]/30 inline-block" />Négatif</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-border inline-block" />Neutre</span>
              </div>
              <HeatmapView news={news} />
            </div>
          )}

          {view === 'sources' && (
            <div className="space-y-2">
              {topSources.map((s, i) => (
                <div key={s.label} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                  <span className="text-lg font-bold tabular text-muted w-6 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-foreground">{s.label}</span>
                  <span className="text-sm font-bold tabular text-accent">{s.count}</span>
                </div>
              ))}
            </div>
          )}

          {view === 'matieres' && <MatieresView news={news} />}
        </div>
      </div>
    </div>
  );
}
