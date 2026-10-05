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
  /** Trimestres et semestres, tenus à part des exercices (voir FinancialsData). */
  incomeInterim?: IS[];
  balanceInterim?: BS[];
  /** Famille comptable de l'émetteur : pilote la cascade des tableaux. */
  famille: Famille;
}

type Tab = 'income' | 'balance' | 'cashflow';
type Periode = 'annuel' | 'intermediaire';

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
  incomeInterim = [],
  balanceInterim = [],
  famille,
}: Props) {
  const TABS = tabsFor(famille);
  const [activeTab, setActiveTab] = useState<Tab>('income');
  const [periode, setPeriode] = useState<Periode>('annuel');

  const aIntermediaire = incomeInterim.length > 0 || balanceInterim.length > 0;
  const intermediaire = periode === 'intermediaire';
  const filteredIncome = intermediaire ? incomeInterim : incomeStatements.filter((s) => s.type_periode === 'annuel');
  const filteredBalance = intermediaire ? balanceInterim : balanceSheets.filter((s) => s.type_periode === 'annuel');
  // Les rapports d'activités ne publient pas de tableau de flux de trésorerie.
  const filteredCashflow = intermediaire ? [] : cashFlowStatements.filter((s) => s.type_periode === 'annuel');

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
        {aIntermediaire && <div className="flex gap-1">
          {(['annuel', 'intermediaire'] as const).map((p) => (
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
              {p === 'annuel' ? 'Annuel' : 'Trimestres et semestres'}
            </button>
          ))}
        </div>}
      </div>

      {intermediaire && (
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Comptes intermédiaires : montants cumulés depuis le début de l’exercice (T1 = 3 mois, S1 = 6 mois,
          T3 = 9 mois), non audités — tout au plus revus de façon limitée par les commissaires aux comptes. Seules
          les lignes publiées dans les rapports d’activités sont renseignées. Ils sont remplacés par les comptes de
          l’exercice dès leur publication.
        </p>
      )}
      {activeTab === 'income' && <IncomeStatement statements={filteredIncome} famille={famille} />}
      {activeTab === 'balance' && <BalanceSheet statements={filteredBalance} famille={famille} />}
      {activeTab === 'cashflow' && <CashFlowStatement statements={filteredCashflow} />}
    </div>
  );
}
