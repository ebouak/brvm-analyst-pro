'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtDateFR } from '@/lib/format';
import PortfolioOverview from '@/components/portfolio/PortfolioOverview';
import PortfolioOptimizer from '@/components/portfolio/PortfolioOptimizer';
import MovementsForm from '@/components/portfolio/MovementsForm';
import { usePortfolioState } from '@/lib/portfolio/queries';

type Tab = 'overview' | 'optimisation' | 'mouvements';

/**
 * Onglet « Analyse & suivi » — entièrement dérivé des positions réelles
 * (source unique de vérité, voir derivePortfolio). Plus de saisie mensuelle
 * manuelle ni de vue positions dupliquée : la performance, la valorisation et la
 * répartition découlent toutes du même état calculé.
 */
export default function PortfolioDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setUserId(user.id); setLastUpdate(new Date()); }
    })();
  }, [supabase]);

  // Re-dérive en réinitialisant l'userId (force le hook à refetch).
  const handleRefetch = useCallback(() => {
    setLastUpdate(new Date());
    setRefreshKey((k) => k + 1);
  }, []);

  const stateQuery = usePortfolioState(userId || '');

  if (!userId) {
    return <div className="p-6 text-center text-muted">Chargement de votre profil…</div>;
  }

  return (
    <div className="px-6 pb-6 space-y-6" key={refreshKey}>
      {/* En-tête */}
      <div className="flex items-center justify-between">
        {lastUpdate ? (
          <p className="text-sm text-muted">Dernière mise à jour : {fmtDateFR(lastUpdate.toISOString().split('T')[0])}</p>
        ) : <span />}
        <button
          type="button"
          onClick={handleRefetch}
          className="px-4 py-2 rounded-lg bg-up/10 text-up hover:bg-up/20 transition text-sm font-medium"
        >
          🔄 Mettre à jour
        </button>
      </div>

      {/* Sous-onglets consolidés (plus de doublon ni de saisie manuelle) */}
      <div className="flex gap-2 border-b border-border">
        <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>📊 Vue d&apos;ensemble</TabBtn>
        <TabBtn active={activeTab === 'optimisation'} onClick={() => setActiveTab('optimisation')}>🎯 Optimisation</TabBtn>
        <TabBtn active={activeTab === 'mouvements'} onClick={() => setActiveTab('mouvements')}>💸 Mouvements</TabBtn>
      </div>

      <div className="space-y-6">
        {activeTab === 'overview' && (
          <PortfolioOverview state={stateQuery.data} isLoading={stateQuery.isLoading} />
        )}
        {activeTab === 'optimisation' && (
          <PortfolioOptimizer userId={userId} />
        )}
        {activeTab === 'mouvements' && (
          <div className="space-y-3">
            <div className="text-xs text-muted bg-bg/40 border border-border rounded-lg px-4 py-2">
              ℹ️ Les apports et retraits ajustent le capital investi. La valorisation et la performance
              sont dérivées automatiquement de vos positions — aucune saisie de solde n’est nécessaire.
            </div>
            <MovementsForm />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 font-medium text-sm transition ${active ? 'text-up border-b-2 border-up' : 'text-muted hover:text-white'}`}
    >
      {children}
    </button>
  );
}
