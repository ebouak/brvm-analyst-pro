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
  useUpdatePosition,
  type Position,
} from '@/lib/portfolio/queries';

type Tab = 'dashboard' | 'suivi-global' | 'mouvements' | 'positions';

export default function PortfolioPage() {
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

  // Fetch data hooks
  const statsQuery = useDashboardStats(userId || '');
  const trackingQuery = useMonthlyTracking(userId || '');
  const chartDataQuery = useTrackingForCharts(userId || '');
  const positionsQuery = usePortfolioPositions(userId || '');
  const { mutate: updatePosition } = useUpdatePosition();

  // Handle position update
  const handleUpdatePosition = useCallback(async (position: Position) => {
    if (!userId) return;
    try {
      await updatePosition({
        ...position,
        user_id: userId,
      });
      // Refetch positions after update
      setTimeout(() => {
        const tempUserId = userId;
        setUserId(null);
        setTimeout(() => setUserId(tempUserId), 50);
      }, 200);
    } catch (err) {
      console.error('Failed to update position:', err);
    }
  }, [userId, updatePosition]);

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tableau de bord portefeuille</h1>
          {lastUpdate && (
            <p className="text-sm text-muted mt-1">
              Dernière mise à jour: {fmtDateFR(lastUpdate.toISOString().split('T')[0])}
            </p>
          )}
        </div>
        <button
          onClick={handleRefetch}
          disabled={isRefetching}
          className="px-4 py-2 rounded-lg bg-up/10 text-up hover:bg-up/20 disabled:opacity-50 transition text-sm font-medium"
        >
          {isRefetching ? '⏳ Mise à jour...' : '🔄 Mettre à jour'}
        </button>
      </div>

      {/* Tabs */}
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

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <PortfolioPositions
            positions={positionsQuery.data}
            onUpdate={handleUpdatePosition}
            isLoading={positionsQuery.isLoading}
          />
        )}
      </div>
    </div>
  );
}
