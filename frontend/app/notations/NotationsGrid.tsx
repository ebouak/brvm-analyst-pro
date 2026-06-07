'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { InstrumentNotation, NotationEntry } from './page';

const SECTOR_COLORS: Record<string, string> = {
  'Consommation de base':          'text-emerald-400  border-emerald-400',
  'Consommation discrétionnaire':  'text-amber-400    border-amber-400',
  'Énergie':                       'text-red-400      border-red-400',
  'Industriels':                   'text-violet-400   border-violet-400',
  'Services financiers':           'text-blue-400     border-blue-400',
  'Services publics':              'text-purple-400   border-purple-400',
  'Télécommunications':            'text-pink-400     border-pink-400',
};

const SECTOR_BAR: Record<string, string> = {
  'Consommation de base':          'bg-emerald-400',
  'Consommation discrétionnaire':  'bg-amber-400',
  'Énergie':                       'bg-red-400',
  'Industriels':                   'bg-violet-400',
  'Services financiers':           'bg-blue-400',
  'Services publics':              'bg-purple-400',
  'Télécommunications':            'bg-pink-400',
};

function noteColor(note: string): string {
  const n = note.toUpperCase();
  if (n.startsWith('AAA') || n.startsWith('AA')) return 'text-up';
  if (n.startsWith('A')) return 'text-up/80';
  if (n.startsWith('BBB')) return 'text-warn';
  if (n.startsWith('BB') || n.startsWith('B')) return 'text-warn/60';
  return 'text-down';
}

function noteBg(note: string): string {
  const n = note.toUpperCase();
  if (n.startsWith('AAA') || n.startsWith('AA')) return 'bg-up/10 border-up/30 text-up';
  if (n.startsWith('A')) return 'bg-up/5 border-up/20 text-up/80';
  if (n.startsWith('BBB')) return 'bg-warn/10 border-warn/30 text-warn';
  if (n.startsWith('BB') || n.startsWith('B')) return 'bg-warn/5 border-warn/20 text-warn/60';
  return 'bg-down/10 border-down/30 text-down';
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

function shortNote(s: string | null): string {
  if (!s) return '—';
  return s.split(' ')[0] ?? s;
}

// Trend arrow between two notes
const SCALE = ['D','C','CC','CCC','B-','B','B+','BB-','BB','BB+','BBB-','BBB','BBB+','A-','A','A+','AA-','AA','AA+','AAA'];
function rank(n: string) { const i = SCALE.indexOf(n); return i === -1 ? 8 : i; }

function TrendArrow({ curr, prev }: { curr: string; prev: string }) {
  const d = rank(curr) - rank(prev);
  if (d > 0) return <span className="text-up text-xs font-bold">↑</span>;
  if (d < 0) return <span className="text-down text-xs font-bold">↓</span>;
  return <span className="text-muted text-xs">→</span>;
}

function HistoryRow({ entry, prev }: { entry: NotationEntry; prev?: NotationEntry }) {
  return (
    <div className="bg-bg rounded-lg p-3 border border-border space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{fmtDate(entry.date_notation)}</span>
        {prev && <TrendArrow curr={entry.note} prev={prev.note} />}
      </div>
      <div className="flex gap-5">
        {entry.long_terme && (
          <div>
            <p className="text-[10px] text-faint mb-0.5">Long terme</p>
            <p className={`text-sm font-bold ${noteColor(shortNote(entry.long_terme))}`}>
              {entry.long_terme}
            </p>
          </div>
        )}
        {entry.court_terme && (
          <div>
            <p className="text-[10px] text-faint mb-0.5">Court terme</p>
            <p className={`text-sm font-bold ${noteColor(shortNote(entry.court_terme))}`}>
              {entry.court_terme}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyCard({ instrument }: { instrument: InstrumentNotation }) {
  const [expanded, setExpanded] = useState(false);
  const { ticker, name, sector, agence, note, history } = instrument;
  const latest = history[0] ?? null;
  const sectorColor = SECTOR_COLORS[sector] ?? 'text-muted border-muted';
  const sectorBar = SECTOR_BAR[sector] ?? 'bg-muted';

  return (
    <div
      className={`relative bg-surface border rounded-xl overflow-hidden transition-all duration-200 ${
        expanded ? 'border-border' : 'border-border/60 hover:border-border'
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 w-[3px] h-full ${sectorBar}`} />

      <div className="pl-4 pr-4 pt-4 pb-3">
        {/* Top row: ticker + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/actions/${ticker}`}
                className={`text-xs font-bold tracking-widest ${sectorColor.split(' ')[0]} hover:underline`}
                onClick={(e) => e.stopPropagation()}
              >
                {ticker}
              </Link>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sectorColor} border-opacity-40`}>
                {sector}
              </span>
            </div>
            <p className="text-sm text-white/90 font-medium leading-tight truncate">{name}</p>
          </div>
          {note ? (
            <span className={`tabular text-sm font-bold px-2.5 py-1 rounded border shrink-0 ${noteBg(note)}`}>
              {note}
            </span>
          ) : (
            <span className="text-xs text-faint border border-border/40 rounded px-2 py-1 shrink-0">
              N/A
            </span>
          )}
        </div>

        {/* Agence + date */}
        {agence && latest && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span className="text-white/60">{agence}</span>
            <span className="text-faint">·</span>
            <span>{fmtDate(latest.date_notation)}</span>
            {latest.court_terme && (
              <>
                <span className="text-faint">·</span>
                <span className="text-info">CT: {shortNote(latest.court_terme)}</span>
              </>
            )}
          </div>
        )}

        {/* History count + expand */}
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs text-muted hover:text-white transition flex items-center gap-1"
          >
            <span>{history.length} notation{history.length > 1 ? 's' : ''}</span>
            <span className="text-faint">{expanded ? '▲' : '▼'}</span>
          </button>
        )}

        {!agence && (
          <p className="mt-2 text-xs text-faint italic">Aucune notation disponible</p>
        )}
      </div>

      {/* Expanded history */}
      {expanded && history.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
          <p className="text-[10px] text-faint uppercase tracking-widest mb-2">
            Historique des notations · {agence}
          </p>
          {history.map((entry, i) => (
            <HistoryRow key={entry.date_notation + i} entry={entry} prev={history[i + 1]} />
          ))}
        </div>
      )}
    </div>
  );
}

const ALL_SECTORS = [
  'Consommation de base',
  'Consommation discrétionnaire',
  'Énergie',
  'Industriels',
  'Services financiers',
  'Services publics',
  'Télécommunications',
];

export default function NotationsGrid({ data }: { data: InstrumentNotation[] }) {
  const [filter, setFilter] = useState('Tous');
  const [search, setSearch] = useState('');
  const [onlyNoted, setOnlyNoted] = useState(false);

  const filtered = data.filter((d) => {
    if (filter !== 'Tous' && d.sector !== filter) return false;
    if (onlyNoted && !d.note) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.ticker.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-faint outline-none focus:border-up/40 w-48"
        />

        <div className="flex flex-wrap gap-1.5">
          {['Tous', ...ALL_SECTORS].map((s) => {
            const active = filter === s;
            const barCls = s !== 'Tous' ? SECTOR_BAR[s] : '';
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-chip border transition ${
                  active
                    ? 'border-up text-up bg-up/10'
                    : 'border-border text-muted hover:border-up/30 hover:text-white'
                }`}
              >
                {s !== 'Tous' && (
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${barCls}`} />
                )}
                {s}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={onlyNoted}
            onChange={(e) => setOnlyNoted(e.target.checked)}
            className="accent-up"
          />
          Notées uniquement
        </label>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((inst) => (
          <CompanyCard key={inst.ticker} instrument={inst} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Aucune société correspondante.</p>
        </div>
      )}

      {/* Legend */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-[10px] text-faint uppercase tracking-widest mb-3">Légende des notes</p>
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'AAA / AA / AA+', cls: 'text-up',      desc: 'Très haute qualité' },
            { label: 'A+ / A / A-',    cls: 'text-up/80',   desc: 'Haute qualité' },
            { label: 'BBB+ / BBB',     cls: 'text-warn',    desc: 'Investment grade' },
            { label: 'BB / B',         cls: 'text-warn/60', desc: 'Spéculatif' },
            { label: 'CCC / D',        cls: 'text-down',    desc: 'Risque élevé' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span className={`text-xs font-bold ${l.cls}`}>{l.label}</span>
              <span className="text-xs text-faint">— {l.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
