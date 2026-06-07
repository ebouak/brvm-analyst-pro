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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/actions/${code}`}
            className="text-muted hover:text-white text-sm transition-colors"
          >
            ← {code}
          </Link>
          <span className="text-muted">/</span>
          <h1 className="text-lg font-semibold">Données financières</h1>
        </div>

        {/* Company name */}
        {data.instrument.designation && (
          <p className="text-muted text-sm">{data.instrument.designation}</p>
        )}

        {/* 52-week range */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <WeekRange52
            bas={ratios.cours_bas_52s}
            haut={ratios.cours_haut_52s}
            actuel={ratios.cours_actuel}
          />
        </div>

        {/* Fundamental analysis */}
        <FundamentalAnalysis ratios={ratios} />

        {/* Financial statement tabs */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <FinancialTabs
            incomeStatements={data.incomeStatements}
            balanceSheets={data.balanceSheets}
            cashFlowStatements={data.cashFlowStatements}
          />
        </div>
      </div>
    </div>
  );
}
