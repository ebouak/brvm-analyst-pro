'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Info, Layers } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { MetriquesPeriodeStrategie, SyntheseBacktest } from '@/lib/stress/backtestingTypes';

type SegmentPeriode = 'globale' | 'in_sample' | 'out_of_sample';

function lireSegment(
  s: SyntheseBacktest['strategies'][number],
  seg: SegmentPeriode,
): MetriquesPeriodeStrategie | null {
  if (seg === 'in_sample') return s.in_sample;
  if (seg === 'out_of_sample') return s.out_of_sample;
  return s.globale;
}

export function ComparateurStrategies({ initialData }: { initialData: SyntheseBacktest }) {
  const [data, setData] = useState<SyntheseBacktest>(initialData);
  const [indice, setIndice] = useState<string>(initialData.indice_code);
  const [frais, setFrais] = useState<number>(initialData.frais_aller_retour_pct);
  const [segment, setSegment] = useState<SegmentPeriode>('globale');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const theme = chartTheme();
  const palette = [theme.muted, theme.accent, theme.up, theme.warn, '#a78bfa'];

  const recharger = async (nouvelIndice: string, nouveauxFrais: number) => {
    setIndice(nouvelIndice);
    setFrais(nouveauxFrais);
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch(
        `/api/stress/backtest?indice=${encodeURIComponent(nouvelIndice)}&frais=${nouveauxFrais}&clustering=${data.mode_clustering_jours}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SyntheseBacktest;
      setData(json);
    } catch {
      setErreur('Impossible de recalculer les simulations pour ces paramètres.');
    } finally {
      setChargement(false);
    }
  };

  const strategiesDisponibles = useMemo(
    () => data.strategies.filter((s) => s.disponible && s.courbe_base100.length > 1),
    [data.strategies],
  );

  // Construire une grille commune de dates pour comparer les courbes base 100
  const seriesChart = useMemo(() => {
    if (strategiesDisponibles.length === 0) return [];
    const datesSet = new Set<string>();
    for (const st of strategiesDisponibles) {
      for (const p of st.courbe_base100) datesSet.add(p.date);
    }
    const dates = [...datesSet].sort((a, b) => a.localeCompare(b));
    // Sous-échantillonner la grille combinée si > 220 dates
    const step = dates.length > 220 ? Math.ceil(dates.length / 220) : 1;
    const grille = dates.filter((_, i) => i % step === 0 || i === dates.length - 1);

    const maps = strategiesDisponibles.map((st) => new Map(st.courbe_base100.map((p) => [p.date, p.base100])));
    const derniers = strategiesDisponibles.map(() => null as number | null);

    return grille.map((d) => {
      const row: Record<string, number | string | null> = { date: d };
      strategiesDisponibles.forEach((st, idx) => {
        const exact = maps[idx]!.get(d);
        if (exact != null) {
          derniers[idx] = exact;
        } else {
          const debut = st.courbe_base100[0]?.date ?? '9999-12-31';
          if (d >= debut && derniers[idx] == null) {
            const proche = st.courbe_base100.find((p) => p.date >= d);
            if (proche) derniers[idx] = proche.base100;
          }
        }
        row[st.id] = derniers[idx];
      });
      return row;
    });
  }, [strategiesDisponibles]);

  return (
    <div className="space-y-8">
      {/* Contrôles */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface p-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-muted">
            Indice
            <select
              value={indice}
              disabled={chargement}
              onChange={(e) => recharger(e.target.value, frais)}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="BRVMC">BRVM Composite (2007+)</option>
              <option value="BRVM30">BRVM-30 (2023+)</option>
              <option value="BRVMPRES">BRVM Prestige (2023+)</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-muted">
            Frais aller-retour
            <select
              value={String(frais)}
              disabled={chargement}
              onChange={(e) => recharger(indice, Number(e.target.value))}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="0">0,0 % (brut)</option>
              <option value="1.5">1,5 % (standard BRVM)</option>
              <option value="2.5">2,5 % (prudent)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-sunken p-1">
          {(
            [
              ['globale', 'Période complète'],
              ['in_sample', 'In-Sample (< 2018)'],
              ['out_of_sample', 'Out-of-Sample (2018+)'],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSegment(id)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                segment === id ? 'bg-accent-ink text-bg' : 'text-muted hover:text-ivory'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {erreur && (
        <p className="rounded-lg border border-down/30 bg-down/10 p-3 text-xs text-down">{erreur}</p>
      )}

      {/* Courbes Base 100 */}
      <section className="rounded-panel border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent-ink" strokeWidth={1.75} />
            <h2 className="text-base font-semibold text-ivory">
              Trajectoires comparées (Base 100 · net de frais {fmtNumber(data.frais_aller_retour_pct, 1)} %)
            </h2>
          </div>
          {chargement && <span className="text-xs text-muted">Recalcul…</span>}
        </div>

        {seriesChart.length === 0 ? (
          <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
            Aucune courbe disponible pour cet indice.
          </p>
        ) : (
          <div className="h-[320px] w-full rounded-lg border border-border/60 bg-sunken p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesChart} margin={{ top: 10, right: 16, left: 4, bottom: 5 }}>
                <CartesianGrid stroke={theme.border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: theme.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: theme.border }}
                  tickFormatter={(d) => fmtDateCourte(String(d))}
                />
                <YAxis
                  tick={{ fill: theme.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <ReferenceLine y={100} stroke={theme.muted} strokeDasharray="3 3" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-surface p-2.5 text-xs shadow-card space-y-1">
                        <p className="font-semibold text-ivory">{fmtDateCourte(String(label))}</p>
                        {payload.map((p) => (
                          <p key={String(p.dataKey)} className="tabular text-muted">
                            <span style={{ color: p.color }}>●</span> {p.name} :{' '}
                            <span className="font-semibold text-ivory">
                              {p.value != null ? fmtNumber(Number(p.value), 1) : '—'}
                            </span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {strategiesDisponibles.map((st, idx) => (
                  <Line
                    key={st.id}
                    type="monotone"
                    dataKey={st.id}
                    name={st.libelle}
                    stroke={palette[idx % palette.length]}
                    strokeWidth={st.id === 'buy_and_hold' ? 1.75 : 2.2}
                    strokeDasharray={st.id === 'buy_and_hold' ? '4 4' : undefined}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Tableau comparatif des métriques */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ivory">
          Comparaison quantitative ({segment === 'globale' ? 'Période complète' : segment === 'in_sample' ? 'In-Sample < 2018' : 'Out-of-Sample ≥ 2018'})
        </h2>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-faint">
                <th className="px-3 py-2.5 font-medium">Stratégie</th>
                <th className="px-3 py-2.5 text-right font-medium">Rend. total</th>
                <th className="px-3 py-2.5 text-right font-medium">CAGR</th>
                <th className="px-3 py-2.5 text-right font-medium">Drawdown max</th>
                <th className="px-3 py-2.5 text-right font-medium">Volatilité ann.</th>
                <th className="px-3 py-2.5 text-right font-medium">Calmar</th>
                <th className="px-3 py-2.5 text-right font-medium">Exposition moy.</th>
                <th className="px-3 py-2.5 text-right font-medium">Entrées / Frais</th>
              </tr>
            </thead>
            <tbody>
              {data.strategies.map((st) => {
                const m = lireSegment(st, segment);
                return (
                  <tr key={st.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ivory">{st.libelle}</p>
                      <p className="text-faint">{st.description}</p>
                      {!st.disponible && st.raison_indisponibilite && (
                        <p className="mt-1 inline-flex items-center gap-1 text-warn">
                          <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
                          <span>{st.raison_indisponibilite}</span>
                        </p>
                      )}
                    </td>
                    {m ? (
                      <>
                        <td
                          className={`tabular px-3 py-2.5 text-right font-semibold ${
                            m.rendement_total_pct >= 0 ? 'text-up' : 'text-down'
                          }`}
                        >
                          {fmtPctSigne(m.rendement_total_pct, 1)}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-ivory">
                          {m.cagr_pct != null ? fmtPctSigne(m.cagr_pct, 2) : '—'}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-down">
                          {fmtPctSigne(m.drawdown_max_pct, 1)}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-muted">
                          {m.volatilite_ann_pct != null ? `${fmtNumber(m.volatilite_ann_pct, 1)} %` : '—'}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-ivory">
                          {m.ratio_calmar != null ? fmtNumber(m.ratio_calmar, 2) : '—'}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-muted">
                          {fmtNumber(m.exposition_moyenne_pct, 0)} %
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-muted">
                          {fmtNumber(m.nb_entrees, 0)} ({fmtNumber(m.cout_frais_pct, 1)} %)
                        </td>
                      </>
                    ) : (
                      <td colSpan={7} className="px-3 py-2.5 text-right text-faint">
                        Segment indisponible sur cette plage
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hypothèses & limites */}
      <section className="rounded-panel border border-border bg-surface p-5 space-y-2 text-xs text-muted">
        <div className="flex items-center gap-2 font-semibold text-ivory">
          <Info className="h-4 w-4 text-accent-ink" strokeWidth={1.75} />
          <h3>Règles de simulation & biais contrôlés</h3>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>{data.limites_methodologiques.hypothese_cash}</li>
          <li>{data.limites_methodologiques.fenetre_walk_forward}</li>
          <li>{data.limites_methodologiques.lag_publication_strategie4}</li>
          <li>{data.limites_methodologiques.biais_survie}</li>
        </ul>
      </section>
    </div>
  );
}
