'use client';

import { useState, type ReactNode } from 'react';
import PortfolioDashboard from './PortfolioDashboard';

type Tab = 'mon-portefeuille' | 'analyse';

/**
 * Onglets de la page Portefeuille.
 *
 * Fusionne l'existant (positions PRU/P&L, watchlists multiples, alertes — rendu
 * côté serveur et passé via `children`) avec le nouveau tableau de bord d'analyse
 * (indice Base 100, performance Dietz, mouvements — composant client).
 */
export default function PortfolioTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('mon-portefeuille');

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-6 px-6 pt-6">
        <TabButton active={tab === 'mon-portefeuille'} onClick={() => setTab('mon-portefeuille')}>
          💼 Mon portefeuille
        </TabButton>
        <TabButton active={tab === 'analyse'} onClick={() => setTab('analyse')}>
          📊 Analyse &amp; suivi
        </TabButton>
      </div>

      {/* Onglet existant (positions, watchlist, alertes) — toujours monté pour
          préserver l'état serveur ; masqué via CSS quand inactif. */}
      <div className={tab === 'mon-portefeuille' ? 'block' : 'hidden'}>{children}</div>

      {/* Onglet dashboard d'analyse — monté à la demande. */}
      {tab === 'analyse' && <PortfolioDashboard />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 font-medium text-sm transition ${
        active ? 'text-up border-b-2 border-up' : 'text-muted hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
