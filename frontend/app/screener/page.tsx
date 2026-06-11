'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import ScreenerFilters from '@/components/ScreenerFilters';
import ScreenerResults from '@/components/ScreenerResults';
import { applyFilters, type ActionRow } from '@/lib/screener/filters';
import type { ScreenerPreset } from '@/lib/screener/presets';

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

        // Combine into ActionRow with signals
        const enriched: ActionRow[] = (actions || []).map((a) => {
          const sig = signalMap[a.code];
          return {
            code: a.code,
            cours_jour: a.cours_jour,
            variation_pct: a.variation_pct,
            rsi: sig?.score_rsi ?? null,
            volume: a.volume,
            score_signal: sig?.score_total ?? null,
            secteur: a.secteur,
            rendement_dividende: latestDividendByCode[a.code] ?? null,
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-muted text-sm">Chargement du screener...</div>
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

      <div className="gold-rule" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <ScreenerFilters isPremium={isPremium} onFilterChange={handleFilter} />
        <div className="lg:col-span-3">
          <ScreenerResults results={filtered} />
        </div>
      </div>
    </div>
  );
}
