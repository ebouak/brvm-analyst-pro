'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import ScreenerFilters from '@/components/ScreenerFilters';
import ViewTabs from '@/components/ViewTabs';
import { FILTER_TABS } from '@/lib/filterTabs';
import ScreenerResults from '@/components/ScreenerResults';
import { applyFilters, exclusFauteDeDonnee, type ActionRow } from '@/lib/screener/filters';
import type { ScreenerPreset } from '@/lib/screener/presets';
import { computeLiquidity } from '@/lib/liquidity';
import { fetchAllRows } from '@/lib/supabase/paginate';
import SECTEURS from '@/lib/brvmSectors.json';
import {
  dernierSignalParCode, dernierDividendeParCode, rsiParCode, ratioVolumeParCode,
  type SignalLigne, type DividendeLigne,
} from '@/lib/screener/donnees';

export default function ScreenerClient({ isPremium }: { isPremium: boolean }) {
  const [allActions, setAllActions] = useState<ActionRow[]>([]);
  const [filtered, setFiltered] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get latest market date
        const { data: latestDate } = await supabase
          .from('brvm_actions_daily')
          .select('date_marche')
          .order('date_marche', { ascending: false })
          .limit(1);

        if (!latestDate || latestDate.length === 0) {
          setAllActions([]);
          setFiltered([]);
          setLoading(false);
          return;
        }

        const marketDate = latestDate[0].date_marche;

        const { data: actions } = await supabase
          .from('brvm_actions_daily')
          .select('code, cours_jour, variation_pct, volume, secteur')
          .eq('date_marche', marketDate);

        // Historique ~150 jours : liquidité (30 séances), RSI 14 et volume moyen 20 séances.
        // PAGINÉ : 48 valeurs × ~100 séances dépassent le plafond PostgREST de 1000
        // lignes, et la troncature est silencieuse (voir lib/supabase/paginate.ts).
        const debut = new Date();
        debut.setDate(debut.getDate() - 150);
        const histoRows = await fetchAllRows<{
          code: string; date_marche: string; volume: number | null;
          cours_jour: number | null; valeur_echangee: number | null;
        }>((from, to) =>
          supabase
            .from('brvm_actions_daily')
            .select('code, date_marche, volume, cours_jour, valeur_echangee')
            .gte('date_marche', debut.toISOString().slice(0, 10))
            .order('date_marche', { ascending: true })
            .range(from, to),
        );

        const d30 = new Date();
        d30.setDate(d30.getDate() - 45); // ~30 séances ouvrées sur 45 jours calendaires
        const borne30 = d30.toISOString().slice(0, 10);
        const histo30 = histoRows.filter((r) => r.date_marche >= borne30);
        const seances = new Set(histo30.map((r) => r.date_marche)).size;
        const histoByCode = new Map<string, typeof histo30>();
        for (const r of histo30) {
          const list = histoByCode.get(r.code) ?? [];
          list.push(r);
          histoByCode.set(r.code, list);
        }
        const { data: liqDaily } = await supabase
          .from('liquidity_daily')
          .select('code, score, classe')
          .order('date_marche', { ascending: false })
          .limit(100);
        const liquidityByCode = new Map<string, { score: number; classe: string }>();
        for (const r of (liqDaily ?? []) as { code: string; score: number | null; classe: string | null }[]) {
          if (r.score != null && r.classe != null && !liquidityByCode.has(r.code)) liquidityByCode.set(r.code, { score: r.score, classe: r.classe });
        }
        if (liquidityByCode.size === 0) {
          for (const [code, rows] of histoByCode) {
            const liq = computeLiquidity(rows, seances);
            if (liq) liquidityByCode.set(code, { score: liq.score, classe: liq.classe });
          }
        }

        // Signaux des 10 derniers jours : le scoring porte sur la séance CLOSE, la
        // cotation du jour peut déjà exister en séance. On garde le dernier par valeur.
        const d10 = new Date();
        d10.setDate(d10.getDate() - 10);
        const { data: signals } = await supabase
          .from('signals_daily')
          .select('code, date_marche, score_total')
          .gte('date_marche', d10.toISOString().slice(0, 10));
        const signalByCode = dernierSignalParCode((signals ?? []) as SignalLigne[], marketDate);

        const { data: dividends } = await supabase
          .from('dividends')
          .select('code, montant, exercice');
        const dividendeByCode = dernierDividendeParCode((dividends ?? []) as DividendeLigne[]);

        const rsiByCode = rsiParCode(histoRows);
        const volumeRatioByCode = ratioVolumeParCode(histoRows);

        const enriched: ActionRow[] = (actions || []).map((a) => {
          const sig = signalByCode.get(a.code);
          const div = dividendeByCode.get(a.code);
          return {
            code: a.code,
            cours_jour: a.cours_jour,
            variation_pct: a.variation_pct,
            rsi: rsiByCode.get(a.code) ?? null,
            volume: a.volume,
            // score_total ∈ [−1 ; +1] affiché en points (−100 à +100), seuils de signal à ±60.
            score_signal: sig?.score_total != null ? Math.round(sig.score_total * 100) : null,
            // La colonne `secteur` de la cotation est vide : référentiel curé en repli.
            secteur: a.secteur ?? (SECTEURS as Record<string, string>)[a.code] ?? null,
            rendement_dividende:
              div && a.cours_jour && a.cours_jour > 0 ? (div.montant / a.cours_jour) * 100 : null,
            liquidite_score: liquidityByCode.get(a.code)?.score ?? null,
            liquidite_classe: liquidityByCode.get(a.code)?.classe ?? null,
            volume_ratio: volumeRatioByCode.get(a.code) ?? null,
          };
        });

        setAllActions(enriched);
        setFiltered(enriched);
      } catch (error) {
        console.error('Error fetching screener data:', error);
        setAllActions([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const [exclus, setExclus] = useState(0);
  const handleFilter = (filters: ScreenerPreset['filters']) => {
    setFiltered(applyFilters(allActions, filters));
    setExclus(exclusFauteDeDonnee(allActions, filters));
  };

  // Filtre rapide liquidité (appliqué APRÈS les presets, côté affichage)
  const [liqFilter, setLiqFilter] = useState<'all' | 'ab' | 'no-d'>('all');
  const displayed = filtered.filter((a) => {
    if (liqFilter === 'all') return true;
    const c = a.liquidite_classe;
    if (c == null) return true; // inconnu : jamais exclu silencieusement
    if (liqFilter === 'ab') return c === 'A' || c === 'B';
    return c !== 'D';
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" aria-busy="true">
        <SectionHeader title="Screener multi-critères" subtitle="Filtrez les actions par RSI, volume, score, secteur, dividende" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="h-72 rounded-xl bg-surface border border-border animate-pulse" />
          <div className="lg:col-span-3 h-72 rounded-xl bg-surface border border-border animate-pulse" />
        </div>
      </div>
    );
  }

  if (allActions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <SectionHeader
          title="Screener multi-critères"
          subtitle="Filtrez les actions par RSI, volume, score, secteur, dividende"
        />
        <div className="mt-10">
          <EmptyStatePremium
            title="Aucune séance disponible"
            hint="Lancez le scraper pour alimenter la base de données."
            icon="◈"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        title="Screener multi-critères"
        subtitle="Filtrez les actions par RSI, volume, score, secteur, dividende"
      />
      <ViewTabs tabs={FILTER_TABS} current="/screener" />

      <div className="gold-rule" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <ScreenerFilters isPremium={isPremium} onFilterChange={handleFilter} />
        <div className="min-w-0 lg:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Liquidité :</span>
            {([
              ['all', 'Toutes'],
              ['ab', 'A + B seulement'],
              ['no-d', 'Exclure les très illiquides (D)'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setLiqFilter(val)}
                aria-pressed={liqFilter === val}
                className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors ${
                  liqFilter === val
                    ? 'border-accent bg-accent text-bg'
                    : 'border-border bg-surface text-muted hover:text-ivory'
                }`}
              >
                {label}
              </button>
            ))}
            {liqFilter !== 'all' && (
              <span className="tabular text-xs text-faint">
                {filtered.length - displayed.length} titre(s) masqué(s)
              </span>
            )}
          </div>
          {exclus > 0 && (
            <p className="text-xs text-faint">
              <span className="tabular">{exclus}</span> valeur{exclus > 1 ? 's' : ''} écartée{exclus > 1 ? 's' : ''} faute de donnée sur un critère filtré.
            </p>
          )}
          <ScreenerResults results={displayed} />
        </div>
      </div>
    </div>
  );
}
