'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Download, Info } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';
import { fmtDateFR, fmtNumber, fmtPctSigne } from '@/lib/format';
import {
  HORIZONS_MOIS,
  type HorizonMois,
  type SyntheseBacktest,
} from '@/lib/stress/backtestingTypes';

type ModeStat = 'independant' | 'tous_franchissements';

function choisirSeuilInitial(data: SyntheseBacktest): number {
  const dd = data.drawdown_actuel_pct ?? -10;
  const atteints = data.stats_seuils.filter((s) => dd <= s.seuil_pct);
  return atteints.at(-1)?.seuil_pct ?? -10;
}

export function MatriceRebonds({ initialData }: { initialData: SyntheseBacktest }) {
  const [data, setData] = useState<SyntheseBacktest>(initialData);
  const [indice, setIndice] = useState<string>(initialData.indice_code);
  const [mode, setMode] = useState<ModeStat>('independant');
  const [seuilActif, setSeuilActif] = useState<number>(() => choisirSeuilInitial(initialData));
  const [horizonDetail, setHorizonDetail] = useState<HorizonMois>(12);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const theme = chartTheme();

  const changerIndice = async (nouvelIndice: string) => {
    setIndice(nouvelIndice);
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch(
        `/api/stress/backtest?indice=${encodeURIComponent(nouvelIndice)}&frais=${data.frais_aller_retour_pct}&clustering=${data.mode_clustering_jours}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SyntheseBacktest;
      setData(json);
      setSeuilActif(choisirSeuilInitial(json));
    } catch {
      setErreur("Impossible de charger cet indice pour l'instant.");
    } finally {
      setChargement(false);
    }
  };

  const seuilObj = useMemo(
    () => data.stats_seuils.find((s) => s.seuil_pct === seuilActif) ?? data.stats_seuils[0] ?? null,
    [data.stats_seuils, seuilActif],
  );

  const chartData = useMemo(() => {
    if (!seuilObj) return [];
    return seuilObj.horizons.map((h) => {
      const dist = mode === 'independant' ? h.independant : h.tous_franchissements;
      return {
        horizon: `${h.horizon_mois}M`,
        horizon_mois: h.horizon_mois,
        mediane: dist.mediane_pct,
        moyenne: dist.moyenne_pct,
        p25: dist.p25_pct,
        p75: dist.p75_pct,
        n: dist.n,
        proba_positif: dist.proba_positif_pct,
        faible: dist.echantillon_faible,
      };
    });
  }, [seuilObj, mode]);

  const distDetail = useMemo(() => {
    const h = seuilObj?.horizons.find((x) => x.horizon_mois === horizonDetail);
    if (!h) return null;
    return mode === 'independant' ? h.independant : h.tous_franchissements;
  }, [seuilObj, horizonDetail, mode]);

  const exportUrl = `/api/stress/backtest?indice=${encodeURIComponent(data.indice_code)}&frais=${data.frais_aller_retour_pct}&clustering=${data.mode_clustering_jours}&format=csv`;

  return (
    <div className="space-y-8">
      {/* Barre de contrôles */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Indice
            <select
              value={indice}
              disabled={chargement}
              onChange={(e) => changerIndice(e.target.value)}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="BRVMC">BRVM Composite (2007+)</option>
              <option value="BRVM30">BRVM-30 (2023+)</option>
              <option value="BRVMPRES">BRVM Prestige (2023+)</option>
            </select>
          </label>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-sunken p-1">
            <button
              type="button"
              onClick={() => setMode('independant')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === 'independant' ? 'bg-accent-ink text-bg' : 'text-muted hover:text-ivory'
              }`}
            >
              Observations indépendantes
            </button>
            <button
              type="button"
              onClick={() => setMode('tous_franchissements')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === 'tous_franchissements' ? 'bg-accent-ink text-bg' : 'text-muted hover:text-ivory'
              }`}
            >
              Tous franchissements
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {chargement && <span className="text-xs text-muted">Recalcul…</span>}
          <a
            href={exportUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ivory hover:border-accent"
          >
            <Download className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
            Exporter CSV
          </a>
        </div>
      </div>

      {erreur && (
        <p className="rounded-lg border border-down/30 bg-down/10 p-3 text-xs text-down">{erreur}</p>
      )}

      {/* Matrice Seuil x Horizon */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ivory">
              Matrice des rendements médians post-correction ({data.indice_code})
            </h2>
            <p className="text-xs text-muted">
              Cliquez sur un palier pour afficher la distribution par horizon et la liste des épisodes historiques.
              {mode === 'independant'
                ? ' Mode indépendant : fenêtres sans chevauchement.'
                : ' Attention : les franchissements rapprochés partagent une partie des mêmes séances futures.'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-faint">
                <th className="px-3 py-2.5 font-medium">Seuil</th>
                <th className="px-3 py-2.5 text-right font-medium">Épisodes (indép. / brut)</th>
                {HORIZONS_MOIS.map((h) => (
                  <th key={h} className="px-3 py-2.5 text-right font-medium">
                    +{h} mois
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stats_seuils.map((row) => {
                const actif = row.seuil_pct === seuilActif;
                return (
                  <tr
                    key={row.seuil_pct}
                    onClick={() => setSeuilActif(row.seuil_pct)}
                    className={`cursor-pointer border-b border-border/60 transition-colors ${
                      actif ? 'bg-elevated/70' : 'hover:bg-elevated/40'
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-ivory">
                      <span className={actif ? 'text-accent-ink' : 'text-ivory'}>
                        {row.seuil_pct} %
                      </span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">
                      {fmtNumber(row.nb_independants_base, 0)} / {fmtNumber(row.nb_franchissements_total, 0)}
                    </td>
                    {row.horizons.map((h) => {
                      const d = mode === 'independant' ? h.independant : h.tous_franchissements;
                      const val = d.mediane_pct;
                      return (
                        <td key={h.horizon_mois} className="tabular px-3 py-2.5 text-right">
                          {d.n === 0 || val == null ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <div>
                              <span
                                className={`font-semibold ${
                                  val > 0 ? 'text-up' : val < 0 ? 'text-down' : 'text-ivory'
                                }`}
                              >
                                {fmtPctSigne(val, 1)}
                              </span>
                              <p className="text-[11px] text-faint">
                                {d.proba_positif_pct != null ? `${fmtNumber(d.proba_positif_pct, 0)}% pos · ` : ''}
                                n={d.n}
                                {d.echantillon_faible && (
                                  <span className="ml-1 rounded border border-warn/40 bg-warn/10 px-1 text-warn">
                                    N&lt;5
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Graphique & Synthèse détaillée pour le seuil sélectionné */}
      {seuilObj && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-panel border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent-ink" strokeWidth={1.75} />
                <h3 className="text-base font-semibold text-ivory">
                  Médiane des rendements — seuil {seuilObj.seuil_pct} %
                </h3>
              </div>
              <span className="text-xs text-faint">
                {mode === 'independant' ? 'Indépendant' : 'Tous franchissements'}
              </span>
            </div>

            <div className="mt-4 h-[260px] w-full rounded-lg border border-border/60 bg-sunken p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke={theme.border} strokeDasharray="3 3" />
                  <XAxis dataKey="horizon" tick={{ fill: theme.muted, fontSize: 11 }} axisLine={{ stroke: theme.border }} tickLine={false} />
                  <YAxis
                    tick={{ fill: theme.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v} %`}
                  />
                  <ReferenceLine y={0} stroke={theme.muted} />
                  <Tooltip
                    content={({ active, payload }) => {
                      const pt = active && payload?.[0]?.payload ? (payload[0].payload as (typeof chartData)[number]) : null;
                      if (!pt) return null;
                      return (
                        <div className="rounded-lg border border-border bg-surface p-2.5 text-xs shadow-card">
                          <p className="font-semibold text-ivory">Horizon {pt.horizon}</p>
                          <p className="tabular text-ivory">Médiane : {pt.mediane != null ? fmtPctSigne(pt.mediane, 2) : '—'}</p>
                          <p className="tabular text-muted">Moyenne : {pt.moyenne != null ? fmtPctSigne(pt.moyenne, 2) : '—'}</p>
                          <p className="tabular text-muted">
                            Q1 / Q3 : {pt.p25 != null ? fmtPctSigne(pt.p25, 1) : '—'} / {pt.p75 != null ? fmtPctSigne(pt.p75, 1) : '—'}
                          </p>
                          <p className="tabular text-faint">n = {pt.n}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="mediane" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={(entry.mediane ?? 0) >= 0 ? theme.up : theme.down}
                        fillOpacity={entry.faible ? 0.45 : 0.88}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-panel border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-ivory">
                Détail statistique — seuil {seuilObj.seuil_pct} % à +{horizonDetail} mois
              </h3>
              <div className="flex gap-1 text-xs">
                {HORIZONS_MOIS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizonDetail(h)}
                    className={`rounded-md border px-2 py-1 font-medium ${
                      horizonDetail === h
                        ? 'border-accent-ink bg-accent-ink text-bg'
                        : 'border-border bg-sunken text-muted hover:text-ivory'
                    }`}
                  >
                    {h}M
                  </button>
                ))}
              </div>
            </div>

            {!distDetail || distDetail.n === 0 ? (
              <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
                Aucune observation historique complète disponible pour ce palier et cet horizon.
              </p>
            ) : (
              <>
                {distDetail.echantillon_faible && (
                  <div className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>
                      Échantillon faible (n = {distDetail.n} &lt; 5) : intervalle de confiance non calculé et aucune généralisation statistique autorisée.
                    </span>
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-border/50 bg-sunken p-2.5">
                    <dt className="text-faint">Médiane / Moyenne</dt>
                    <dd className="tabular mt-0.5 font-semibold text-ivory">
                      {distDetail.mediane_pct != null ? fmtPctSigne(distDetail.mediane_pct, 1) : '—'} /{' '}
                      {distDetail.moyenne_pct != null ? fmtPctSigne(distDetail.moyenne_pct, 1) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-sunken p-2.5">
                    <dt className="text-faint">IC bootstrap 95 %</dt>
                    <dd className="tabular mt-0.5 font-semibold text-ivory">
                      {distDetail.ic95_moyenne
                        ? `[${fmtPctSigne(distDetail.ic95_moyenne[0], 1)} ; ${fmtPctSigne(distDetail.ic95_moyenne[1], 1)}]`
                        : 'N/A (n < 5)'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-sunken p-2.5">
                    <dt className="text-faint">Part d’issues &gt; 0 %</dt>
                    <dd className="tabular mt-0.5 font-semibold text-ivory">
                      {distDetail.proba_positif_pct != null ? `${fmtNumber(distDetail.proba_positif_pct, 0)} %` : '—'} (n={distDetail.n})
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-sunken p-2.5">
                    <dt className="text-faint">Min / P25 / P75 / Max</dt>
                    <dd className="tabular mt-0.5 font-semibold text-ivory">
                      {[distDetail.min_pct, distDetail.p25_pct, distDetail.p75_pct, distDetail.max_pct]
                        .map((x) => (x != null ? `${fmtNumber(x, 1)}%` : '—'))
                        .join(' · ')}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-sunken p-2.5">
                    <dt className="text-faint">Perte suppl. moy. / pire</dt>
                    <dd className="tabular mt-0.5 font-semibold text-down">
                      {distDetail.perte_sup_moyenne_pct != null ? fmtPctSigne(distDetail.perte_sup_moyenne_pct, 1) : '—'} /{' '}
                      {distDetail.perte_sup_pire_pct != null ? fmtPctSigne(distDetail.perte_sup_pire_pct, 1) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-sunken p-2.5">
                    <dt className="text-faint">Délai médian retour sommet</dt>
                    <dd className="tabular mt-0.5 font-semibold text-ivory">
                      {distDetail.delai_retour_sommet_median_jours != null
                        ? `${fmtNumber(distDetail.delai_retour_sommet_median_jours, 0)} j`
                        : 'Non récupéré'}
                    </dd>
                  </div>
                </dl>

                {/* Liste des franchissements individuels */}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-sunken text-faint">
                      <tr className="border-b border-border">
                        <th className="px-2.5 py-1.5 font-medium">Date entrée</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">DD entrée</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Perf. +{horizonDetail}M</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Perte suppl.</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Retour sommet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distDetail.observations.map((o) => (
                        <tr key={o.date_entree} className="border-b border-border/40 last:border-b-0">
                          <td className="tabular px-2.5 py-1.5 text-ivory">{fmtDateFR(o.date_entree)}</td>
                          <td className="tabular px-2.5 py-1.5 text-right text-down">
                            {fmtPctSigne(o.drawdown_entree_pct, 1)}
                          </td>
                          <td
                            className={`tabular px-2.5 py-1.5 text-right font-semibold ${
                              o.rendement_pct >= 0 ? 'text-up' : 'text-down'
                            }`}
                          >
                            {fmtPctSigne(o.rendement_pct, 1)}
                          </td>
                          <td className="tabular px-2.5 py-1.5 text-right text-down">
                            {fmtPctSigne(o.perte_sup_max_pct, 1)}
                          </td>
                          <td className="tabular px-2.5 py-1.5 text-right text-muted">
                            {o.delai_retour_sommet_jours != null
                              ? `${fmtNumber(o.delai_retour_sommet_jours, 0)} j`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Encart limites méthodologiques */}
      <section className="rounded-panel border border-border bg-surface p-5 space-y-2 text-xs text-muted">
        <div className="flex items-center gap-2 font-semibold text-ivory">
          <Info className="h-4 w-4 text-accent-ink" strokeWidth={1.75} />
          <h3>Hypothèses et limites méthodologiques</h3>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>{data.limites_methodologiques.regle_independance}</li>
          <li>{data.limites_methodologiques.indice_prix_vs_total_return}</li>
          <li>{data.limites_methodologiques.biais_survie}</li>
        </ul>
      </section>
    </div>
  );
}
