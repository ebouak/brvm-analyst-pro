'use client';
import { ecartAffiche } from '@/lib/valuation/verdict';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyValuation } from '@/lib/valuation/server';
import type { CompanyScoring } from '@/lib/scoring/server';
import { fmtPctSigne } from '@/lib/format';

function pct(v: number | null, d = 0): string {
  if (v == null) return '—';
  return fmtPctSigne(v * 100, d);
}
function num(v: number | null, d = 1): string {
  return v == null ? '—' : v.toFixed(d);
}

type SortKey = 'upside' | 'per' | 'pbr' | 'roe' | 'quality';

const STANCE_LABEL: Record<CompanyValuation['verdict']['stance'], { txt: string; cls: string }> = {
  decote: { txt: 'Valeur > cours', cls: 'text-up bg-up/5 border-up/30' },
  surcote: { txt: 'Valeur < cours', cls: 'text-down bg-down/5 border-down/30' },
  proche: { txt: 'Proche du cours', cls: 'text-warn bg-warn/10 border-warn/30' },
  desaccord: { txt: 'Méthodes en désaccord', cls: 'text-muted bg-surface border-border' },
  non_estimable: { txt: 'Non estimable', cls: 'text-muted bg-surface border-border' },
  indisponible: { txt: 'n/d', cls: 'text-muted bg-surface border-border' },
};

export default function ValuationScreener({ data, scoring = {} }: { data: CompanyValuation[]; scoring?: Record<string, CompanyScoring> }) {
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
        {label}
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

      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="bg-surface border border-border rounded-xl overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border">
            <tr>
              <th className="text-left py-2 px-3">Société</th>
              <th className="text-left py-2 px-3">Secteur</th>
              <Th k="upside" label="Écart valeur estimée / cours" />
              <Th k="per" label="P/E" />
              <Th k="pbr" label="P/B" />
              <Th k="roe" label="ROE" />
              <th className="text-right py-2 px-3">F-Score</th>
              <th className="text-right py-2 px-3">Altman Z</th>
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
                  <td className={`py-2 px-3 text-right tabular font-semibold ${(c.fairValue.upside ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                    {/* Un écart n'a de sens que si les méthodes sont du même côté du cours. */}
                    {c.fairValue.upside != null && ['decote', 'surcote', 'proche'].includes(c.verdict.stance) ? ecartAffiche(c.fairValue.upside) : <span className="text-faint">—</span>}
                  </td>
                  <td className="py-2 px-3 text-right tabular text-ivory">{num(c.metrics.per, 1)}</td>
                  <td className="py-2 px-3 text-right tabular text-ivory">{num(c.metrics.pbr, 2)}</td>
                  <td className="py-2 px-3 text-right tabular text-ivory">{pct(c.metrics.roe, 1)}</td>
                  <td className="py-2 px-3 text-right tabular text-muted">
                    {scoring[c.code]?.fscoreNonApplicable ? <span className="text-faint" title="Le F-Score ne s’applique pas à un bilan bancaire">n. a.</span> : scoring[c.code]?.fscore?.reliable ? `${scoring[c.code]!.fscore!.score}/9` : '—'}
                  </td>
                  <td className="py-2 px-3 text-right tabular">
                    {(() => {
                      const a = scoring[c.code]?.altman;
                      if (!a?.applicable || a.zone == null) return <span className="text-faint">—</span>;
                      const cls = a.zone === 'safe' ? 'text-up' : a.zone === 'grey' ? 'text-warn' : 'text-down';
                      return <span className={cls}>{a.z}</span>;
                    })()}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span
                      title={s.txt === 'Méthodes en désaccord' ? 'Les bénéfices et les fonds propres donnent deux valeurs de part et d’autre du cours : l’une dit l’action chère, l’autre bon marché. Aucun écart n’est affiché.' : undefined}
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}
                    >
                      {s.txt}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">
        Juste-valeur par multiples sectoriels (P/E, P/B médians) et DDM pour les valeurs à dividende. P/E, P/B et écart
        nécessitent le nombre d’actions (disponible pour une partie des sociétés). L’écart compare le cours à une
        valeur estimée par des modèles : ce n’est pas un objectif de cours. Outil informatif.
      </p>
    </div>
  );
}
