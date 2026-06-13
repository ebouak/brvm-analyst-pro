'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyValuation } from '@/lib/valuation/server';

function pct(v: number | null, d = 0): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;
}
function num(v: number | null, d = 1): string {
  return v == null ? '—' : v.toFixed(d);
}

type SortKey = 'upside' | 'per' | 'pbr' | 'roe' | 'quality';

const STANCE_LABEL: Record<CompanyValuation['verdict']['stance'], { txt: string; cls: string }> = {
  decote: { txt: 'Décote', cls: 'text-up bg-up/10 border-up/30' },
  surcote: { txt: 'Surcote', cls: 'text-down bg-down/10 border-down/30' },
  proche: { txt: 'Juste prix', cls: 'text-warn bg-warn/10 border-warn/30' },
  indisponible: { txt: 'n/d', cls: 'text-muted bg-surface border-border' },
};

export default function ValuationScreener({ data }: { data: CompanyValuation[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('upside');
  const [onlyValuable, setOnlyValuable] = useState(true);

  const rows = useMemo(() => {
    let r = data.filter((c) => c.metrics.reliable);
    if (onlyValuable) r = r.filter((c) => c.fairValue.upside != null);
    const val = (c: CompanyValuation): number => {
      switch (sortKey) {
        case 'upside': return c.fairValue.upside ?? -Infinity;
        case 'per': return c.metrics.per ?? Infinity;
        case 'pbr': return c.metrics.pbr ?? Infinity;
        case 'roe': return c.metrics.roe ?? -Infinity;
        case 'quality': return c.quality.score;
      }
    };
    const asc = sortKey === 'per' || sortKey === 'pbr';
    return [...r].sort((a, b) => (asc ? val(a) - val(b) : val(b) - val(a)));
  }, [data, sortKey, onlyValuable]);

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="text-right py-2 px-3">
      <button type="button" onClick={() => setSortKey(k)} aria-label={`Trier par ${label}`}
        className={`hover:text-white transition ${sortKey === k ? 'text-up' : ''}`}>
        {label}{sortKey === k ? ' ▾' : ''}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyValuable} onChange={(e) => setOnlyValuable(e.target.checked)} />
          Uniquement les sociétés avec juste-valeur estimable
        </label>
        <span className="text-xs text-faint">{rows.length} sociétés</span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border">
            <tr>
              <th className="text-left py-2 px-3">Société</th>
              <th className="text-left py-2 px-3">Secteur</th>
              <Th k="upside" label="Potentiel" />
              <Th k="per" label="P/E" />
              <Th k="pbr" label="P/B" />
              <Th k="roe" label="ROE" />
              <Th k="quality" label="Qualité" />
              <th className="text-right py-2 px-3">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const s = STANCE_LABEL[c.verdict.stance];
              return (
                <tr key={c.code} className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-bg/20' : ''}`}>
                  <td className="py-2 px-3">
                    <Link href={`/actions/${c.code}`} className="font-medium text-white hover:text-up transition">{c.code}</Link>
                  </td>
                  <td className="py-2 px-3 text-xs text-muted">{c.secteur}</td>
                  <td className={`py-2 px-3 text-right tabular font-semibold ${(c.fairValue.upside ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{pct(c.fairValue.upside)}</td>
                  <td className="py-2 px-3 text-right tabular text-ivory">{num(c.metrics.per, 1)}</td>
                  <td className="py-2 px-3 text-right tabular text-ivory">{num(c.metrics.pbr, 2)}</td>
                  <td className="py-2 px-3 text-right tabular text-ivory">{pct(c.metrics.roe, 1)}</td>
                  <td className="py-2 px-3 text-right tabular text-muted">{c.quality.score}/{c.quality.max}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.txt}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">
        Juste-valeur par multiples sectoriels (P/E, P/B médians) et DDM pour les valeurs à dividende. P/E, P/B et potentiel
        nécessitent le nombre d’actions (disponible pour une partie des sociétés). Outil informatif.
      </p>
    </div>
  );
}
