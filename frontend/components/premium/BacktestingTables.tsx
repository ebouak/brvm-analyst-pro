'use client';
import { useState } from 'react';
import type { BacktestingData, TopDividende, TopPlusValue } from '@/lib/premium/backtesting';

type Vue = 'div_total' | 'div_moyen' | 'pv_abs' | 'pv_pct';

const VUES: { id: Vue; label: string; desc: string }[] = [
  { id: 'div_total',  label: 'Dividendes totaux',      desc: 'Cumul des dividendes versés depuis le début de la cotation' },
  { id: 'div_moyen',  label: 'Dividende moyen/an',     desc: 'Dividende moyen annuel versé aux actionnaires' },
  { id: 'pv_abs',     label: 'Plus-values (FCFA)',      desc: 'Gain absolu en FCFA par action depuis le premier cours disponible' },
  { id: 'pv_pct',     label: 'Plus-values (%)',         desc: 'Performance % depuis le premier cours disponible' },
];

const SIG: Record<string, string> = { BUY: 'text-up bg-up/10', HOLD: 'text-warn bg-warn/10', SELL: 'text-down bg-down/10' };

function fmt(n: number) {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} Md`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  return n.toLocaleString('fr-FR');
}

function DivTable({ rows }: { rows: TopDividende[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-elevated border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider w-8">#</th>
            <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Symbole</th>
            <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider hidden md:table-cell">Société</th>
            <th className="text-center px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Années</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Dernier div.</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Total / Moyen</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.code} className={`border-b border-border/50 hover:bg-white/[0.02] ${i % 2 === 1 ? 'bg-surface/30' : ''}`}>
              <td className="px-4 py-2.5 text-faint text-xs tabular">{i + 1}</td>
              <td className="px-4 py-2.5">
                <a href={`/actions/${r.code}`} className="font-mono text-sm font-semibold text-accent hover:text-white">{r.code}</a>
              </td>
              <td className="px-4 py-2.5 text-white text-xs hidden md:table-cell">{r.designation}</td>
              <td className="px-4 py-2.5 text-center text-muted text-xs tabular">{r.nb_annees}</td>
              <td className="px-4 py-2.5 text-right text-muted text-xs tabular">{r.dernier_div ? `${fmt(r.dernier_div)} F` : '—'}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-white tabular">{fmt(r.total_divs)} F</td>
              <td className="px-4 py-2.5 text-right">
                {r.signal ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SIG[r.signal] ?? ''}`}>{r.signal}</span> : <span className="text-faint text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="py-10 text-center text-muted text-sm">Aucune donnée disponible.</div>}
    </div>
  );
}

function PvTable({ rows }: { rows: TopPlusValue[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-elevated border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider w-8">#</th>
            <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Symbole</th>
            <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider hidden md:table-cell">Société</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">1er cours</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Dernier cours</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">+Value</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Perf %</th>
            <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.code} className={`border-b border-border/50 hover:bg-white/[0.02] ${i % 2 === 1 ? 'bg-surface/30' : ''}`}>
              <td className="px-4 py-2.5 text-faint text-xs tabular">{i + 1}</td>
              <td className="px-4 py-2.5">
                <a href={`/actions/${r.code}`} className="font-mono text-sm font-semibold text-accent hover:text-white">{r.code}</a>
              </td>
              <td className="px-4 py-2.5 text-white text-xs hidden md:table-cell">{r.designation}</td>
              <td className="px-4 py-2.5 text-right text-muted text-xs tabular">{fmt(r.cours_debut)} F</td>
              <td className="px-4 py-2.5 text-right text-white text-xs tabular">{fmt(r.cours_fin)} F</td>
              <td className={`px-4 py-2.5 text-right text-sm font-semibold tabular ${r.performance_abs >= 0 ? 'text-up' : 'text-down'}`}>
                {r.performance_abs >= 0 ? '+' : ''}{fmt(r.performance_abs)} F
              </td>
              <td className={`px-4 py-2.5 text-right text-sm font-semibold tabular ${r.performance_pct >= 0 ? 'text-up' : 'text-down'}`}>
                {r.performance_pct >= 0 ? '+' : ''}{r.performance_pct.toFixed(1)}%
              </td>
              <td className="px-4 py-2.5 text-right">
                {r.signal ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${SIG[r.signal] ?? ''}`}>{r.signal}</span> : <span className="text-faint text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="py-10 text-center text-muted text-sm">Aucune donnée disponible.</div>}
    </div>
  );
}

export function BacktestingTables({ data }: { data: BacktestingData }) {
  const [vue, setVue] = useState<Vue>('div_total');
  const current = VUES.find((v) => v.id === vue)!;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {VUES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVue(v.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              vue === v.id ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:text-white hover:border-accent/30'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted mb-5">{current.desc}</p>

      {(vue === 'div_total') && <DivTable rows={data.topDividendesTotal} />}
      {(vue === 'div_moyen') && <DivTable rows={data.topDividendesMoyen} />}
      {(vue === 'pv_abs')    && <PvTable  rows={data.topPlusValues} />}
      {(vue === 'pv_pct')    && <PvTable  rows={data.topPlusValuesPct} />}
    </div>
  );
}
