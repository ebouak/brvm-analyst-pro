import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import WeekRange52 from '@/components/financials/WeekRange52';
import FundamentalAnalysis from '@/components/financials/FundamentalAnalysis';
import FinancialTabs from '@/components/financials/FinancialTabs';

interface Props {
  params: { code: string };
}

export default async function FinancialsPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const data = await loadCompanyFinancials(code);
  if (!data) notFound();

  const latestIncome = data.incomeStatements[0] ?? null;
  const prevIncome = data.incomeStatements[1] ?? null;
  const latestBalance = data.balanceSheets[0] ?? null;
  const latestCashflow = data.cashFlowStatements[0] ?? null;

  const ratios = calculateFundamentals({
    coursActuel: data.latestDaily?.cours_jour ?? null,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: latestIncome,
    incomePrev: prevIncome,
    balance: latestBalance,
    cashflow: latestCashflow,
  });

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/actions" className="text-muted hover:text-white transition-colors">Marché</Link>
          <span className="text-faint">/</span>
          <Link href={`/actions/${code}`} className="text-muted hover:text-white transition-colors">{code}</Link>
          <span className="text-faint">/</span>
          <span className="text-white">Données financières</span>
        </div>

        {/* Page header */}
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{code}</h1>
          {data.instrument.designation && (
            <p className="text-sm text-muted">{data.instrument.designation}</p>
          )}
          {data.instrument.secteur && (
            <p className="text-xs text-faint">{data.instrument.secteur}</p>
          )}
        </div>

        {/* 52-week range */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <WeekRange52
            bas={ratios.cours_bas_52s}
            haut={ratios.cours_haut_52s}
            actuel={ratios.cours_actuel}
          />
        </div>

        {/* Fundamental analysis */}
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">Ratios fondamentaux</p>
          <FundamentalAnalysis ratios={ratios} />
        </div>

        {/* Financial statement tabs */}
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">États financiers</p>
          <div className="bg-surface border border-border rounded-xl p-5">
            <FinancialTabs
              incomeStatements={data.incomeStatements}
              balanceSheets={data.balanceSheets}
              cashFlowStatements={data.cashFlowStatements}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
