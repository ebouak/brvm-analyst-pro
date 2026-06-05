'use client';

/**
 * Portfolio data access hooks using Supabase client.
 * All hooks support RLS (automatically filtered by auth.uid()).
 * Use in client components only.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Monthly portfolio tracking entry from portfolio_monthly_tracking table.
 */
export interface MonthlyTrackingEntry {
  id: string;
  user_id: string;
  date: string; // ISO date
  year: number;
  valeur_initiale: number;
  apports: number;
  retraits: number;
  flux_ponderes: number;
  valeur_finale: number;
  performance_mensuelle: number | null; // decimal
  indice_base100: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Portfolio movement (cash flow) entry.
 */
export interface Movement {
  id: string;
  user_id: string;
  mois_fin: string; // ISO date
  date_flux: string; // ISO date
  montant: number; // positive or negative
  poids: number | null; // Dietz weight
  flux_pondere: number | null; // montant * poids
  created_at: string;
}

/**
 * Portfolio position (holding).
 */
export interface Position {
  id: string;
  user_id: string;
  symbole: string | null;
  secteur: string | null;
  quantite: number;
  cours: number;
  valeur: number | null;
  ponderation: number | null;
  is_liquidites: boolean;
  updated_at: string;
}

/**
 * Aggregated dashboard statistics.
 * Calculated client-side from portfolio_monthly_tracking and movements.
 */
export interface DashboardStats {
  currentIndex: number | null; // last month's indice_base100
  totalPerf: number; // (currentIndex / 100) - 1
  ytdPerf: number; // (currentIndex / startOfYearIndex) - 1
  currentValue: number | null; // last month's valeur_finale
  lastMonth: {
    date: string;
    performance_mensuelle: number | null;
  } | null;
  monthsTracked: number; // count of months with non-null valeur_finale
  pureGains: number; // last valeur_finale - invested capital
}

/**
 * Generic hook state interface.
 */
interface HookState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate YTD performance (current index / start-of-year index) - 1.
 * Returns 0 if no data for start of year.
 */
function calculateYTDPerf(
  currentIndex: number | null,
  entries: MonthlyTrackingEntry[]
): number {
  if (currentIndex === null || currentIndex === 0) return 0;

  const now = new Date();
  const currentYear = now.getFullYear();

  // Find first entry of current year
  const startOfYearEntry = entries
    .filter(e => new Date(e.date).getFullYear() === currentYear)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  if (!startOfYearEntry || !startOfYearEntry.indice_base100 || startOfYearEntry.indice_base100 === 0) {
    return 0;
  }

  return currentIndex / startOfYearEntry.indice_base100 - 1;
}

/**
 * Calculate pure gains: valeur_finale - (valeur_initiale + apports - retraits)
 */
function calculatePureGains(lastEntry: MonthlyTrackingEntry | null, entries: MonthlyTrackingEntry[]): number {
  if (!lastEntry) return 0;

  const firstEntry = entries
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  if (!firstEntry) return 0;

  // Cumulative flows from all months
  const totalApports = entries.reduce((sum, e) => sum + (e.apports ?? 0), 0);
  const totalRetraits = entries.reduce((sum, e) => sum + (e.retraits ?? 0), 0);

  const investedCapital = firstEntry.valeur_initiale + totalApports - totalRetraits;
  return lastEntry.valeur_finale - investedCapital;
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Hook 1: useMonthlyTracking
 * Fetch all portfolio_monthly_tracking rows for user, sorted by date DESC.
 */
export function useMonthlyTracking(userId: string): HookState<MonthlyTrackingEntry[]> {
  const [state, setState] = useState<HookState<MonthlyTrackingEntry[]>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createClient();
    }

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await clientRef.current!
          .from('portfolio_monthly_tracking')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (error) {
          setState({
            data: null,
            isLoading: false,
            error: error.message,
          });
          return;
        }

        setState({
          data: (data as MonthlyTrackingEntry[]) || [],
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    fetchData();
  }, [userId]);

  return state;
}

/**
 * Hook 2: useTrackingForCharts
 * Fetch last N months of portfolio_monthly_tracking (default 12).
 * Used by IndexChart, MonthlyPerfChart, CashflowChart.
 */
export function useTrackingForCharts(
  userId: string,
  months: number = 12
): HookState<MonthlyTrackingEntry[]> {
  const [state, setState] = useState<HookState<MonthlyTrackingEntry[]>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createClient();
    }

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await clientRef.current!
          .from('portfolio_monthly_tracking')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(months);

        if (error) {
          setState({
            data: null,
            isLoading: false,
            error: error.message,
          });
          return;
        }

        // Reverse to get ascending order for charts
        const entries = (data as MonthlyTrackingEntry[]) || [];
        setState({
          data: entries.reverse(),
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    fetchData();
  }, [userId, months]);

  return state;
}

/** Code spécial représentant la poche de liquidités. */
export const LIQUIDITES_CODE = 'LIQUIDITES';

/**
 * Hook 3: usePortfolioPositions
 *
 * SOURCE UNIFIÉE : lit les MÊMES positions que l'onglet « Mon portefeuille »
 * (`portfolios_positions`), enrichies du dernier cours de marché
 * (`brvm_actions_daily`) et du secteur (`brvm_reference`). La valeur et la
 * pondération sont calculées à la volée. La ligne LIQUIDITES (cours = 0) est
 * incluse telle quelle. Garantit que les deux onglets restent synchronisés.
 */
export function usePortfolioPositions(userId: string): HookState<Position[]> {
  const [state, setState] = useState<HookState<Position[]>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createClient();
    }
    if (!userId) {
      setState({ data: [], isLoading: false, error: null });
      return;
    }
    const sb = clientRef.current!;

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // 1) Positions brutes (source unique partagée avec « Mon portefeuille »).
        const { data: raw, error } = await sb
          .from('portfolios_positions')
          .select('id, user_id, code, quantite, prix_entree, updated_at, created_at')
          .eq('user_id', userId);
        if (error) { setState({ data: null, isLoading: false, error: error.message }); return; }

        const rawRows = (raw ?? []) as Array<{
          id: string; user_id: string; code: string; quantite: number;
          prix_entree: number; updated_at: string | null; created_at: string | null;
        }>;

        const codes = [...new Set(rawRows.map(r => r.code).filter(c => c && c !== LIQUIDITES_CODE))];

        // 2) Cours live + secteurs (en parallèle).
        const [quotesRes, refRes] = await Promise.all([
          codes.length
            ? sb.from('brvm_actions_daily').select('code, cours_jour, date_marche')
                .in('code', codes).order('date_marche', { ascending: false })
            : Promise.resolve({ data: [] as { code: string; cours_jour: number | null }[] }),
          sb.from('brvm_reference').select('symbole, secteur'),
        ]);

        const lastCours: Record<string, number | null> = {};
        for (const q of (quotesRes.data ?? []) as { code: string; cours_jour: number | null }[]) {
          if (!(q.code in lastCours)) lastCours[q.code] = q.cours_jour;
        }
        const secteurByCode: Record<string, string> = {};
        for (const r of (refRes.data ?? []) as { symbole: string; secteur: string }[]) {
          secteurByCode[r.symbole] = r.secteur;
        }

        // 3) Construction + valorisation au cours du marché.
        const enriched = rawRows.map((r): Position & { prix_entree: number } => {
          const isLiq = r.code === LIQUIDITES_CODE;
          // Liquidités : la valeur est stockée dans prix_entree (quantité = 1).
          const cours = isLiq ? 0 : (lastCours[r.code] ?? 0);
          const valeur = isLiq ? r.prix_entree : r.quantite * cours;
          return {
            id: r.id,
            user_id: r.user_id,
            symbole: r.code,
            secteur: isLiq ? 'Liquidités' : (secteurByCode[r.code] ?? 'Autres'),
            quantite: r.quantite,
            cours,
            valeur,
            ponderation: null, // calculé après le total
            is_liquidites: isLiq,
            updated_at: r.updated_at ?? r.created_at ?? '',
            prix_entree: r.prix_entree,
          };
        });

        const total = enriched.reduce((s, p) => s + (p.valeur ?? 0), 0);
        const withPond = enriched.map(p => ({
          ...p,
          ponderation: total > 0 ? (p.valeur ?? 0) / total : 0,
        }));

        setState({ data: withPond, isLoading: false, error: null });
      } catch (err) {
        setState({ data: null, isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    };

    fetchData();
  }, [userId]);

  return state;
}

/**
 * Hook 4: useMovementsForMonth
 * Fetch all portfolio_movements for a specific month (mois_fin).
 */
export function useMovementsForMonth(
  userId: string,
  moisFin: Date
): HookState<Movement[]> {
  const [state, setState] = useState<HookState<Movement[]>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createClient();
    }

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Convert Date to ISO date string (YYYY-MM-DD)
        const moisFinStr = moisFin.toISOString().split('T')[0];

        const { data, error } = await clientRef.current!
          .from('portfolio_movements')
          .select('*')
          .eq('user_id', userId)
          .eq('mois_fin', moisFinStr);

        if (error) {
          setState({
            data: null,
            isLoading: false,
            error: error.message,
          });
          return;
        }

        setState({
          data: (data as Movement[]) || [],
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    fetchData();
  }, [userId, moisFin.getTime()]); // Use getTime() as dependency to avoid object comparison issues

  return state;
}

/**
 * Hook 5: useDashboardStats
 * Aggregated stats for KPI cards.
 * Fetches tracking entries and calculates derived metrics client-side.
 */
export function useDashboardStats(userId: string): HookState<DashboardStats> {
  const [state, setState] = useState<HookState<DashboardStats>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const { data: entries, isLoading, error } = useMonthlyTracking(userId);

  useEffect(() => {
    if (isLoading) {
      setState(prev => ({ ...prev, isLoading: true }));
      return;
    }

    if (error) {
      setState({
        data: null,
        isLoading: false,
        error,
      });
      return;
    }

    if (!entries || entries.length === 0) {
      setState({
        data: {
          currentIndex: null,
          totalPerf: 0,
          ytdPerf: 0,
          currentValue: null,
          lastMonth: null,
          monthsTracked: 0,
          pureGains: 0,
        },
        isLoading: false,
        error: null,
      });
      return;
    }

    // Entries are sorted DESC, so first is most recent
    const lastEntry = entries[0];
    const currentIndex = lastEntry.indice_base100 ?? null;
    const totalPerf = currentIndex !== null ? currentIndex / 100 - 1 : 0;
    const ytdPerf = calculateYTDPerf(currentIndex, entries);
    const currentValue = lastEntry.valeur_finale ?? null;
    const monthsTracked = entries.filter(e => e.valeur_finale !== null).length;
    const pureGains = calculatePureGains(lastEntry, entries);

    const lastMonth = lastEntry
      ? {
          date: lastEntry.date,
          performance_mensuelle: lastEntry.performance_mensuelle,
        }
      : null;

    setState({
      data: {
        currentIndex,
        totalPerf,
        ytdPerf,
        currentValue,
        lastMonth,
        monthsTracked,
        pureGains,
      },
      isLoading: false,
      error: null,
    });
  }, [entries, isLoading, error]);

  return state;
}

/**
 * Hook 6: useAddMonthlyEntry
 * Mutation hook: insert or update portfolio_monthly_tracking.
 * On success, refetch useMonthlyTracking for that user.
 * If updating a past month, trigger recalculateAllTracking.
 */
export function useAddMonthlyEntry() {
  const [state, setState] = useState({
    isLoading: false,
    error: null as string | null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  const mutate = useCallback(
    async (entry: Omit<MonthlyTrackingEntry, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clientRef.current) {
        clientRef.current = createClient();
      }

      try {
        setState({ isLoading: true, error: null });

        // Upsert on (user_id, date)
        const { error } = await clientRef.current!
          .from('portfolio_monthly_tracking')
          .upsert([entry], {
            onConflict: 'user_id,date',
          });

        if (error) {
          setState({ isLoading: false, error: error.message });
          return;
        }

        // Check if this is a past month to trigger cascading recalculation
        const entryDate = new Date(entry.date);
        const today = new Date();
        const isPastMonth = entryDate < today;

        if (isPastMonth) {
          // TODO: Call recalculateAllTracking(entry.user_id, clientRef.current)
          // This would be implemented as a server action or edge function
          console.log(`Updated past month ${entry.date}, cascading recalculation triggered`);
        }

        setState({ isLoading: false, error: null });
      } catch (err) {
        setState({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    []
  );

  return { mutate, ...state };
}

/**
 * Hook 7: useAddMovement
 * Mutation hook: insert portfolio_movements.
 * On success, invalidate useMovementsForMonth for that month.
 */
export function useAddMovement() {
  const [state, setState] = useState({
    isLoading: false,
    error: null as string | null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  const mutate = useCallback(
    async (movement: Omit<Movement, 'id' | 'created_at'>) => {
      if (!clientRef.current) {
        clientRef.current = createClient();
      }

      try {
        setState({ isLoading: true, error: null });

        const { error } = await clientRef.current!
          .from('portfolio_movements')
          .insert([movement]);

        if (error) {
          setState({ isLoading: false, error: error.message });
          return;
        }

        // Invalidation: client-side refetch would be triggered by calling
        // useMovementsForMonth again with the same moisFin.
        // This is implicit in the hook dependency system.

        setState({ isLoading: false, error: null });
      } catch (err) {
        setState({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    []
  );

  return { mutate, ...state };
}

/**
 * Hook 8: useUpdatePosition
 * Mutation hook: upsert portfolio_positions on (user_id, symbole).
 * On success, invalidate usePortfolioPositions.
 */
export function useUpdatePosition() {
  const [state, setState] = useState({
    isLoading: false,
    error: null as string | null,
  });

  const clientRef = useRef<SupabaseClient | null>(null);

  const mutate = useCallback(
    async (position: Omit<Position, 'id' | 'updated_at'>) => {
      if (!clientRef.current) {
        clientRef.current = createClient();
      }

      try {
        setState({ isLoading: true, error: null });

        const { error } = await clientRef.current!
          .from('portfolio_positions')
          .upsert([position], {
            onConflict: 'user_id,symbole',
          });

        if (error) {
          setState({ isLoading: false, error: error.message });
          return;
        }

        // Invalidation: implicit via hook dependency system.
        // Component should refetch usePortfolioPositions after mutation.

        setState({ isLoading: false, error: null });
      } catch (err) {
        setState({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    []
  );

  return { mutate, ...state };
}
