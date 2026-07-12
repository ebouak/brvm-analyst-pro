'use client';

import { useState } from 'react';
import { IncomeStatement as IS, BalanceSheet as BS, CashFlowStatement as CFS } from '@/lib/financials/types';
import type { Famille } from '@/lib/financials/sectors';
import IncomeStatement from './IncomeStatement';
import BalanceSheet from './BalanceSheet';
import CashFlowStatement from './CashFlowStatement';

interface Props {
  incomeStatements: IS[];
  balanceSheets: BS[];
  cashFlowStatements: CFS[];
  /** Famille comptable de l'émetteur : pilote la cascade des tableaux. */
  famille: Famille;
}

type Tab = 'income' | 'balance' | 'cashflow';
type Periode = 'annuel' | 'trimestriel';

/** Le libellé de l'onglet suit la convention du secteur (compte d'exploitation bancaire). */
function tabsFor(famille: Famille) {
  const income =
    famille === 'banque'
      ? "Compte de résultat (bancaire)"
      : famille === 'assurance'
        ? 'Compte de résultat (technique)'
        : 'Compte de résultat';
  return [
    { id: 'income' as Tab, label: income },
    { id: 'balance' as Tab, label: 'Bilan' },
    { id: 'cashflow' as Tab, label: 'Liquidités' },
  ];
}

export default function FinancialTabs({
  incomeStatements,
  balanceSheets,
  cashFlowStatements,
  famille,
}: Props) {
  const TABS = tabsFor(famille);
  const [activeTab, setActiveTab] = useState<Tab>('income');
  const [periode, setPeriode] = useState<Periode>('annuel');

  const filteredIncome = incomeStatements.filter((s) => s.type_periode === periode);
  const filteredBalance = balanceSheets.filter((s) => s.type_periode === periode);
  const filteredCashflow = cashFlowStatements.filter((s) => s.type_periode === periode);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-up/20 text-up border border-up/30'
                  : 'text-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['annuel', 'trimestriel'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriode(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                periode === p
                  ? 'bg-surface border border-border text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              {p === 'annuel' ? 'Annuel' : 'Trimestriel'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'income' && <IncomeStatement statements={filteredIncome} famille={famille} />}
      {activeTab === 'balance' && <BalanceSheet statements={filteredBalance} famille={famille} />}
      {activeTab === 'cashflow' && <CashFlowStatement statements={filteredCashflow} />}
    </div>
  );
}
