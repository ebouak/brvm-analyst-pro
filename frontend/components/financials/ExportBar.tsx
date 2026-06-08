'use client';
import { useState } from 'react';
import { generateXlsxBlob } from '@/lib/export/xlsx';
import type { IncomeStatement, BalanceSheet, CashFlowStatement, FundamentalRatios } from '@/lib/financials/types';

interface Props {
  code: string;
  designation: string | null;
  secteur: string | null;
  ratios: FundamentalRatios;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
}

export default function ExportBar({ code, designation, secteur, ratios, incomeStatements, balanceSheets, cashFlowStatements }: Props) {
  const [loadingXls, setLoadingXls] = useState(false);

  async function handleXls() {
    setLoadingXls(true);
    try {
      const blob = await generateXlsxBlob({ code, designation, secteur, ratios, incomeStatements, balanceSheets, cashFlowStatements });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${code}_financials_${new Date().getFullYear()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingXls(false);
    }
  }

  function handlePdf() {
    window.open(`/actions/${code}/print`, '_blank');
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleXls}
        disabled={loadingXls}
        aria-label="Télécharger les données financières au format Excel"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-up/40 transition-all active:scale-95 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-up/50"
      >
        <span aria-hidden="true">⬇</span>
        {loadingXls ? 'Génération…' : 'Excel (.xlsx)'}
      </button>
      <button
        type="button"
        onClick={handlePdf}
        aria-label="Ouvrir la version imprimable (PDF)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-up/40 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-up/50"
      >
        <span aria-hidden="true">🖨</span>
        PDF (imprimer)
      </button>
    </div>
  );
}
