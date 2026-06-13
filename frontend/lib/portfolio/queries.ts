'use client';

/**
 * Accès aux données du portefeuille — SOURCE UNIQUE DE VÉRITÉ.
 *
 * Depuis la refonte, une seule entrée : usePortfolioState, qui dérive l'état
 * complet (valorisation, P&L, courbe d'équité, secteurs) des positions réelles
 * + historique de cours via derivePortfolio. Les anciens hooks de saisie
 * mensuelle manuelle ont été retirés (code mort).
 */

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { derivePortfolio, type PortfolioState, type RawPosition, type PricePoint } from './derive';

export const LIQUIDITES_CODE = 'LIQUIDITES';

interface HookState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Dérive l'état complet et cohérent du portefeuille à partir des positions
 * réelles + historique de cours. Alimente toutes les vues d'analyse — plus
 * aucune saisie manuelle. Voir derivePortfolio().
 */
export function usePortfolioState(userId: string): HookState<PortfolioState> {
  const [state, setState] = useState<HookState<PortfolioState>>({ data: null, isLoading: true, error: null });
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) clientRef.current = createClient();
    if (!userId) { setState({ data: null, isLoading: false, error: null }); return; }
    const sb = clientRef.current!;

    (async () => {
      try {
        setState((p) => ({ ...p, isLoading: true, error: null }));

        const { data: raw, error } = await sb
          .from('portfolios_positions')
          .select('id, code, quantite, prix_entree, date_entree')
          .eq('user_id', userId);
        if (error) { setState({ data: null, isLoading: false, error: error.message }); return; }

        const rows = (raw ?? []) as Array<{ code: string; quantite: number; prix_entree: number; date_entree: string | null }>;
        const codes = [...new Set(rows.map((r) => r.code).filter((c) => c && c !== LIQUIDITES_CODE))];

        const [histRes, refRes] = await Promise.all([
          codes.length
            ? sb.from('brvm_actions_daily').select('code, cours_jour, date_marche')
                .in('code', codes).not('cours_jour', 'is', null).order('date_marche', { ascending: true })
            : Promise.resolve({ data: [] as { code: string; cours_jour: number; date_marche: string }[] }),
          sb.from('brvm_reference').select('symbole, secteur'),
        ]);

        const secteurByCode: Record<string, string> = {};
        for (const r of (refRes.data ?? []) as { symbole: string; secteur: string }[]) secteurByCode[r.symbole] = r.secteur;

        const priceHistory = new Map<string, PricePoint[]>();
        for (const r of (histRes.data ?? []) as { code: string; cours_jour: number; date_marche: string }[]) {
          if (!priceHistory.has(r.code)) priceHistory.set(r.code, []);
          priceHistory.get(r.code)!.push({ date: r.date_marche, cours: r.cours_jour });
        }

        const positions: RawPosition[] = rows.map((r) => {
          const isLiq = r.code === LIQUIDITES_CODE;
          return {
            code: r.code,
            quantite: r.quantite,
            prix_entree: r.prix_entree,
            date_entree: r.date_entree,
            secteur: isLiq ? 'Liquidités' : (secteurByCode[r.code] ?? 'Autres'),
            is_liquidites: isLiq,
          };
        });

        const today = new Date().toISOString().slice(0, 10);
        setState({ data: derivePortfolio(positions, priceHistory, today), isLoading: false, error: null });
      } catch (err) {
        setState({ data: null, isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    })();
  }, [userId]);

  return state;
}
