'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import ScreenerFilters from '@/components/ScreenerFilters';
import ViewTabs from '@/components/ViewTabs';
import { FILTER_TABS } from '@/lib/filterTabs';
import ScreenerResults from '@/components/ScreenerResults';
import { applyFilters, type ActionRow } from '@/lib/screener/filters';
import type { ScreenerPreset } from '@/lib/screener/presets';
import { computeLiquidity } from '@/lib/liquidity';

export default function ScreenerPage() {
  const [allActions, setAllActions] = useState<ActionRow[]>([]);
  const [filtered, setFiltered] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user and premium status
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', authData.user.id)
            .maybeSingle();
          setIsPremium(profile?.is_premium ?? false);
        }

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

        // Fetch actions with signals
        const { data: actions } = await supabase
          .from('brvm_actions_daily')
          .select('code, cours_jour, variation_pct, volume, secteur')
          .eq('date_marche', marketDate);

        // Liquidité : ~30 dernières séances (présence + valeur échangée moyenne)
        const d30 = new Date();
        d30.setDate(d30.getDate() - 45); // ~30 séances ouvrées sur 45 jours calendaires
        const { data: histo } = await supabase
          .from('brvm_actions_daily')
          .select('code, date_marche, volume, cours_jour, valeur_echangee')
          .gte('date_marche', d30.toISOString().slice(0, 10));

        const histoRows = (histo ?? []) as {
          code: string; date_marche: string; volume: number | null;
          cours_jour: number | null; valeur_echangee: number | null;
        }[];
        const seances = new Set(histoRows.map((r) => r.date_marche)).size;
        const histoByCode = new Map<string, typeof histoRows>();
        for (const r of histoRows) {
          const list = histoByCode.get(r.code) ?? [];
          list.push(r);
          histoByCode.set(r.code, list);
        }
        const liquidityByCode = new Map<string, { score: number; classe: string }>();
        for (const [code, rows] of histoByCode) {
          const liq = computeLiquidity(rows, seances);
          if (liq) liquidityByCode.set(code, { score: liq.score, classe: liq.classe });
        }

        const { data: signals } = await supabase
          .from('signals_daily')
          .select('code, score_total, score_rsi')
          .eq('date_marche', marketDate);

        // Fetch dividends for all actions
        const { data: dividends } = await supabase
          .from('dividends')
          .select('code, montant, exercice');

        // Build signal map
        const signalMap: Record<string, any> = {};
        (signals || []).forEach((s) => {
          signalMap[s.code] = s;
        });

        // Calculate average volume per code
        const volumeByCode: Record<string, number[]> = {};
        (actions || []).forEach((a) => {
          if (!volumeByCode[a.code]) volumeByCode[a.code] = [];
          if (a.volume) volumeByCode[a.code].push(a.volume);
        });

        const avgVolumeByCode: Record<string, number> = {};
        Object.entries(volumeByCode).forEach(([code, vols]) => {
          avgVolumeByCode[code] = vols.reduce((a, b) => a + b, 0) / vols.length;
        });

        // Calculate dividend yield (latest dividend / current price)
        const latestDividendByCode: Record<string, number> = {};
        if (dividends && dividends.length > 0) {
          // Group by code and find latest
          const divByCode: Record<string, any> = {};
          dividends.forEach((d) => {
            if (!divByCode[d.code] || d.exercice > divByCode[d.code].exercice) {
              divByCode[d.code] = d;
            }
          });

          // Calculate yield for actions
          (actions || []).forEach((a) => {
            if (divByCode[a.code] && a.cours_jour && a.cours_jour > 0) {
              latestDividendByCode[a.code] = (divByCode[a.code].montant / a.cours_jour) * 100;
            }
          });
        }

        // Combine into ActionRow with signals.
        // Échelles : score_rsi et score_total sont des sous-scores ∈ [-1, +1]
        // (cf. scoring §9 : score_rsi = clamp((50 − RSI)/20)). Les filtres et
        // presets attendent un RSI 0-100 et un score en % — on convertit ici,
        // sinon aucun preset ne matche jamais (bug corrigé 2026-06-13).
        const enriched: ActionRow[] = (actions || []).map((a) => {
          const sig = signalMap[a.code];
          const rsiEstime =
            sig?.score_rsi != null
              ? Math.max(0, Math.min(100, 50 - 20 * sig.score_rsi))
              : null;
          return {
            code: a.code,
            cours_jour: a.cours_jour,
            variation_pct: a.variation_pct,
            rsi: rsiEstime,
            volume: a.volume,
            score_signal: sig?.score_total != null ? Math.round(sig.score_total * 100) : null,
            secteur: a.secteur,
            rendement_dividende: latestDividendByCode[a.code] ?? null,
            liquidite_score: liquidityByCode.get(a.code)?.score ?? null,
            liquidite_classe: liquidityByCode.get(a.code)?.classe ?? null,
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

  const handleFilter = (filters: ScreenerPreset['filters']) => {
    setFiltered(applyFilters(allActions, filters));
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
        <SectionHeader kicker="Outils" title="Screener multi-critères" subtitle="Filtrez les actions par RSI, volume, score, secteur, dividende" />
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
          kicker="Outils"
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
        kicker="Outils"
        title="Screener multi-critères"
        subtitle="Filtrez les actions par RSI, volume, score, secteur, dividende"
      />
      <ViewTabs tabs={FILTER_TABS} current="/screener" />

      <div className="gold-rule" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <ScreenerFilters isPremium={isPremium} onFilterChange={handleFilter} />
        <div className="lg:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted">Liquidité :</span>
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
          <ScreenerResults results={displayed} />
        </div>
      </div>
    </div>
  );
}
