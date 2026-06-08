'use client';
import { useState } from 'react';
import type { CorrelationSerie } from '@/lib/premium/correlations';

// Dynamic import guard for SSR
let EChartComponent: React.ComponentType<{ option: object; height: number; style?: object }> | null = null;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  EChartComponent = require('@/components/EChart').default;
}

function CorrBadge({ c }: { c: number }) {
  const abs = Math.abs(c);
  const label = abs > 0.7 ? 'Forte' : abs > 0.4 ? 'Modérée' : 'Faible';
  const color = abs > 0.7 ? (c > 0 ? 'text-up bg-up/10 border-up/30' : 'text-down bg-down/10 border-down/30')
    : abs > 0.4 ? 'text-warn bg-warn/10 border-warn/30'
    : 'text-muted bg-surface border-border';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${color}`}>
      {c >= 0 ? '+' : ''}{c.toFixed(2)} — {label}
    </span>
  );
}

function SerieChart({ serie }: { serie: CorrelationSerie }) {
  const EChart = EChartComponent;
  const dates = serie.points.map((p) => p.date.slice(0, 10));
  const cours = serie.points.map((p) => parseFloat(p.cours.toFixed(2)));
  const commo = serie.points.map((p) => parseFloat(p.commodity.toFixed(2)));

  if (!EChart) {
    return <div className="h-48 bg-surface rounded-xl animate-pulse" />;
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['Actions BRVM', 'Matière première (indice)'], textStyle: { color: '#8b93a7' }, top: 0 },
    grid: { left: 50, right: 20, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#8b93a7', fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: '#8b93a7', fontSize: 10, formatter: '{value}' }, splitLine: { lineStyle: { color: '#232733' } } },
    series: [
      {
        name: 'Actions BRVM',
        type: 'line',
        data: cours,
        smooth: true,
        lineStyle: { color: '#00c853', width: 2 },
        symbol: 'none',
      },
      {
        name: 'Matière première (indice)',
        type: 'line',
        data: commo,
        smooth: true,
        lineStyle: { color: serie.couleur, width: 2, type: 'dashed' },
        symbol: 'none',
      },
    ],
  };

  return <EChart option={option} height={240} />;
}

export default function CorrelationsCharts({ series }: { series: CorrelationSerie[] }) {
  const [active, setActive] = useState(series[0]?.matiere ?? '');
  const selected = series.find((s) => s.matiere === active);

  if (series.length === 0) return (
    <div className="bg-surface border border-border rounded-xl p-10 text-center">
      <p className="text-muted text-sm">Aucune donnée de cours disponible pour calculer les corrélations.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {series.map((s) => (
          <button
            key={s.matiere}
            type="button"
            onClick={() => setActive(s.matiere)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              active === s.matiere
                ? 'bg-surface border-up text-white'
                : 'border-border text-muted hover:text-white hover:border-up/40'
            }`}
          >
            {s.label.split('(')[0]!.trim()}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-white">{selected.label}</div>
              <div className="text-xs text-muted mt-0.5">Actions : {selected.codes.join(', ')} · Données : 52 semaines</div>
            </div>
            <CorrBadge c={selected.coefficient} />
          </div>
          <SerieChart serie={selected} />
          <p className="text-xs text-muted">
            ⚠️ La série "matière première" est une approximation calculée à partir du cours des actions liées
            (données commodity live non disponibles). Le coefficient de corrélation reflète la tendance relative.
          </p>
        </div>
      )}

      {/* Summary table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-white">Résumé des corrélations</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted uppercase">
              <th className="text-left py-2 px-4">Matière première</th>
              <th className="text-left py-2 px-4">Actions liées</th>
              <th className="text-right py-2 px-4">Coefficient</th>
              <th className="text-left py-2 px-4">Interprétation</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s, i) => (
              <tr key={s.matiere} className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-elevated/40' : ''}`}>
                <td className="py-2 px-4 text-white">{s.label.split('(')[0]!.trim()}</td>
                <td className="py-2 px-4 text-muted">{s.codes.join(', ')}</td>
                <td className="py-2 px-4 text-right">
                  <CorrBadge c={s.coefficient} />
                </td>
                <td className="py-2 px-4 text-muted text-xs">
                  {Math.abs(s.coefficient) > 0.7 ? `Mouvement synchrone — surveiller le cours mondial`
                    : Math.abs(s.coefficient) > 0.4 ? 'Corrélation partielle — facteurs locaux prédominent'
                    : 'Peu corrélé — diversification efficace'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
