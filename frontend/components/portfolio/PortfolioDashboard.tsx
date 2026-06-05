'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtDateFR } from '@/lib/format';
import DashboardKPIs from '@/components/portfolio/DashboardKPIs';
import IndexChart from '@/components/portfolio/IndexChart';
import MonthlyPerfChart from '@/components/portfolio/MonthlyPerfChart';
import CashflowChart from '@/components/portfolio/CashflowChart';
import SectorPieChart from '@/components/portfolio/SectorPieChart';
import YearlyPerfTable from '@/components/portfolio/YearlyPerfTable';
import SuiviGlobalForm from '@/components/portfolio/SuiviGlobalForm';
import MovementsForm from '@/components/portfolio/MovementsForm';
import PortfolioPositions from '@/components/portfolio/PortfolioPositions';
import {
  useDashboardStats,
  useMonthlyTracking,
  useTrackingForCharts,
  usePortfolioPositions,
} from '@/lib/portfolio/queries';

type Tab = 'dashboard' | 'suivi-global' | 'mouvements' | 'positions';

/**
 * Tableau de bord d'analyse du portefeuille (indice Base 100, performance Dietz,
 * mouvements). Monté dans l'onglet « Analyse & suivi » de la page Portefeuille.
 */
export default function PortfolioDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const supabase = createClient();

  // Extract userId from auth context on mount
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setLastUpdate(new Date());
      }
    };
    getUser();
  }, [supabase]);

  // Fetch data hooks. Les positions proviennent de la SOURCE UNIFIÉE
  // (portfolios_positions) — identiques à l'onglet « Mon portefeuille ».
  const statsQuery = useDashboardStats(userId || '');
  const trackingQuery = useMonthlyTracking(userId || '');
  const chartDataQuery = useTrackingForCharts(userId || '');
  const positionsQuery = usePortfolioPositions(userId || '');

  // Refetch handler
  const handleRefetch = useCallback(async () => {
    setIsRefetching(true);
    try {
      setLastUpdate(new Date());
      const tempUserId = userId;
      setUserId(null);
      setTimeout(() => setUserId(tempUserId), 100);
    } finally {
      setIsRefetching(false);
    }
  }, [userId]);

  if (!userId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted">
          Chargement de votre profil...
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-6 space-y-6">
      {/* En-tête : date de mise à jour + bouton refetch */}
      <div className="flex items-center justify-between">
        {lastUpdate ? (
          <p className="text-sm text-muted">
            Dernière mise à jour : {fmtDateFR(lastUpdate.toISOString().split('T')[0])}
          </p>
        ) : <span />}
        <button
          onClick={handleRefetch}
          disabled={isRefetching}
          className="px-4 py-2 rounded-lg bg-up/10 text-up hover:bg-up/20 disabled:opacity-50 transition text-sm font-medium"
        >
          {isRefetching ? '⏳ Mise à jour...' : '🔄 Mettre à jour'}
        </button>
      </div>

      {/* Sous-onglets analyse */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-medium text-sm transition ${
            activeTab === 'dashboard'
              ? 'text-up border-b-2 border-up'
              : 'text-muted hover:text-white'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('suivi-global')}
          className={`px-4 py-2 font-medium text-sm transition ${
            activeTab === 'suivi-global'
              ? 'text-up border-b-2 border-up'
              : 'text-muted hover:text-white'
          }`}
        >
          📋 Suivi Global
        </button>
        <button
          onClick={() => setActiveTab('mouvements')}
          className={`px-4 py-2 font-medium text-sm transition ${
            activeTab === 'mouvements'
              ? 'text-up border-b-2 border-up'
              : 'text-muted hover:text-white'
          }`}
        >
          💸 Mouvements
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 font-medium text-sm transition ${
            activeTab === 'positions'
              ? 'text-up border-b-2 border-up'
              : 'text-muted hover:text-white'
          }`}
        >
          📁 Portefeuille
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* État vide : aucune saisie mensuelle → la performance n'est pas calculable. */}
            {!statsQuery.isLoading && (!trackingQuery.data || trackingQuery.data.length === 0) && (
              <div className="border border-warn/30 bg-warn/5 rounded-xl px-4 py-3 space-y-1">
                <p className="text-sm text-warn font-medium">📊 La performance (indice, KPIs, graphiques) n&apos;est pas encore calculée.</p>
                <p className="text-xs text-muted">
                  Ajouter une position met à jour la <span className="text-white">répartition sectorielle</span> et la valorisation,
                  mais l&apos;<span className="text-white">indice Base 100</span> mesure la performance dans le temps : il faut saisir
                  ton solde mensuel.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('suivi-global')}
                  className="text-xs text-up hover:underline font-medium"
                >
                  → Saisir mon premier point dans « Suivi Global »
                </button>
              </div>
            )}

            <DashboardKPIs
              stats={statsQuery.data}
              isLoading={statsQuery.isLoading}
            />

            <IndexChart
              data={chartDataQuery.data}
              isLoading={chartDataQuery.isLoading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MonthlyPerfChart
                data={chartDataQuery.data}
                isLoading={chartDataQuery.isLoading}
              />
              <CashflowChart
                data={chartDataQuery.data}
                isLoading={chartDataQuery.isLoading}
              />
            </div>

            <SectorPieChart
              positions={positionsQuery.data}
              isLoading={positionsQuery.isLoading}
            />

            <YearlyPerfTable
              data={trackingQuery.data}
              isLoading={trackingQuery.isLoading}
            />
          </>
        )}

        {/* Suivi Global Tab */}
        {activeTab === 'suivi-global' && (
          <SuiviGlobalForm userId={userId} />
        )}

        {/* Mouvements Tab */}
        {activeTab === 'mouvements' && (
          <MovementsForm />
        )}

        {/* Positions Tab — lecture seule (édition dans l'onglet « Mon portefeuille ») */}
        {activeTab === 'positions' && (
          <>
            <div className="text-xs text-muted bg-bg/40 border border-border rounded-lg px-4 py-2">
              ℹ️ Vue lecture seule. Pour ajouter ou modifier des positions, utilisez l&apos;onglet
              <span className="text-up font-medium"> 💼 Mon portefeuille</span>.
            </div>
            <PortfolioPositions
              positions={positionsQuery.data}
              isLoading={positionsQuery.isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}
