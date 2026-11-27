'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';
import { fmtDateFR, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { EpisodeCrise } from '@/lib/stress/types';

type ModeAxe = 'drawdown' | 'base100';

export function ComparateurCrisesChart({ episodes }: { episodes: readonly EpisodeCrise[] }) {
  const candidats = useMemo(
    () =>
      episodes
        .filter((e) => Array.isArray(e.trajectoire_base100) && e.trajectoire_base100.length >= 2)
        .slice(0, 20),
    [episodes],
  );

  const [mode, setMode] = useState<ModeAxe>('drawdown');
  const [selection, setSelection] = useState<string[]>(() =>
    candidats.slice(0, 4).map((e) => `${e.indice_code}:${e.seuil_pct}:${e.date_sommet}`),
  );

  const theme = chartTheme();
  const palette = [theme.accent, theme.down, theme.warn, theme.up, theme.muted];

  const actifs = useMemo(() => {
    const keys = new Set(selection);
    const chosen = candidats.filter((e) => keys.has(`${e.indice_code}:${e.seuil_pct}:${e.date_sommet}`));
    return chosen.length > 0 ? chosen.slice(0, 5) : candidats.slice(0, 3);
  }, [candidats, selection]);

  const seriesChart = useMemo(() => {
    if (actifs.length === 0) return [];
    const joursSet = new Set<number>();
    for (const ep of actifs) {
      for (const pt of ep.trajectoire_base100) joursSet.add(pt.jour_seance);
    }
    const jours = [...joursSet].sort((a, b) => a - b);

    // Interpolation linéaire sur les jours communs pour une superposition lisible
    return jours.map((j) => {
      const row: Record<string, number | string | null> = { jour: j };
      actifs.forEach((ep, idx) => {
        const pts = ep.trajectoire_base100;
        const exact = pts.find((p) => p.jour_seance === j);
        let val: number | null = null;
        if (exact) {
          val = mode === 'drawdown' ? exact.drawdown_pct : exact.base100;
        } else {
          const maxJ = pts[pts.length - 1]?.jour_seance ?? 0;
          if (j <= maxJ) {
            const pAfterIdx = pts.findIndex((p) => p.jour_seance > j);
            if (pAfterIdx > 0) {
              const p1 = pts[pAfterIdx - 1]!;
              const p2 = pts[pAfterIdx]!;
              const ratio = (j - p1.jour_seance) / (p2.jour_seance - p1.jour_seance);
              const v1 = mode === 'drawdown' ? p1.drawdown_pct : p1.base100;
              const v2 = mode === 'drawdown' ? p2.drawdown_pct : p2.base100;
              val = Math.round((v1 + ratio * (v2 - v1)) * 100) / 100;
            }
          }
        }
        row[`s_${idx}`] = val;
      });
      return row;
    });
  }, [actifs, mode]);

  const toggleEpisode = (key: string) => {
    setSelection((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      if (prev.length >= 5) return [...prev.slice(1), key];
      return [...prev, key];
    });
  };

  if (candidats.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
        Aucune trajectoire historique disponible pour la superposition graphique.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ivory">Comparateur de trajectoires (sommet = 100)</h3>
          <p className="text-xs text-muted">
            Superposition depuis le sommet de référence (jusqu&apos;à 5 épisodes sélectionnés).
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-sunken p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('drawdown')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === 'drawdown' ? 'bg-accent-ink text-bg' : 'text-muted hover:text-ivory'
            }`}
          >
            Drawdown (%)
          </button>
          <button
            type="button"
            onClick={() => setMode('base100')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === 'base100' ? 'bg-accent-ink text-bg' : 'text-muted hover:text-ivory'
            }`}
          >
            Base 100
          </button>
        </div>
      </div>

      {/* Sélecteur d'épisodes */}
      <div className="flex flex-wrap gap-2">
        {candidats.slice(0, 12).map((ep) => {
          const key = `${ep.indice_code}:${ep.seuil_pct}:${ep.date_sommet}`;
          const idxActif = actifs.findIndex(
            (a) => `${a.indice_code}:${a.seuil_pct}:${a.date_sommet}` === key,
          );
          const estActif = idxActif >= 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleEpisode(key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                estActif
                  ? 'border-border-strong bg-elevated text-ivory'
                  : 'border-border bg-sunken text-muted hover:border-border-strong'
              }`}
            >
              {estActif && (
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: palette[idxActif % palette.length] }}
                />
              )}
              <span>{ep.libelle}</span>
              <span className="tabular text-faint">({fmtPctSigne(ep.perte_max_pct, 1)})</span>
            </button>
          );
        })}
      </div>

      {/* Graphique Recharts */}
      <div className="h-[340px] w-full rounded-lg border border-border/60 bg-sunken p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={seriesChart} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid stroke={theme.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="jour"
              tick={{ fill: theme.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: theme.border }}
              tickFormatter={(v) => `J+${v}`}
            />
            <YAxis
              tick={{ fill: theme.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={mode === 'drawdown' ? ['auto', 2] : ['auto', 'auto']}
              tickFormatter={(v) => (mode === 'drawdown' ? `${v} %` : `${v}`)}
            />
            <ReferenceLine y={mode === 'drawdown' ? 0 : 100} stroke={theme.muted} strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderRadius: '0.6rem',
                fontSize: '12px',
              }}
              labelStyle={{ color: theme.ivory, fontWeight: 600 }}
              labelFormatter={(j) => `Séance J+${j} après sommet`}
              formatter={(value: unknown, name: string) => {
                const idx = Number(String(name).replace('s_', ''));
                const ep = actifs[idx];
                const label = ep ? `${ep.libelle} (${fmtDateFR(ep.date_sommet)})` : name;
                const num = Number(value);
                const aff = Number.isFinite(num)
                  ? mode === 'drawdown'
                    ? fmtPctSigne(num, 2)
                    : fmtNumber(num, 1)
                  : '—';
                return [aff, label];
              }}
            />
            {actifs.map((ep, idx) => (
              <Line
                key={`${ep.indice_code}:${ep.seuil_pct}:${ep.date_sommet}`}
                type="monotone"
                dataKey={`s_${idx}`}
                name={`s_${idx}`}
                stroke={palette[idx % palette.length]}
                strokeWidth={ep.statut === 'en_cours' ? 2.5 : 1.75}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
