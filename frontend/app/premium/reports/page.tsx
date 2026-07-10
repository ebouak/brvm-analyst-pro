import { createClient } from '@/lib/supabase/server';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import { fmtFcfa, fmtNumber, fmtDateFR } from '@/lib/format';
import Link from 'next/link';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';

export const metadata = {
  title: 'Archive Rapports | WESTBOURSE',
};

interface MonthlyReport {
  id: string;
  month: string;
  report_url: string | null;
  report_json: {
    kpis: {
      pnlTotal: number;
      pnlPct: number;
    };
  };
  sent_at: string | null;
  created_at: string;
}

export default async function ReportsArchivePage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <p className="text-muted">Veuillez vous connecter pour accéder à vos rapports.</p>
      </div>
    );
  }

  // Fetch all reports for current user, ordered by month (descending)
  const { data: reports, error } = await supabase
    .from('monthly_reports')
    .select('id, month, report_url, report_json, sent_at, created_at')
    .eq('user_id', user.id)
    .order('month', { ascending: false });

  if (error) {
    console.error('Error fetching reports:', error);
  }

  const reportList = (reports || []) as MonthlyReport[];

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <SectionHeader
          kicker="Gestion de portefeuille"
          title="Archive des rapports"
          subtitle="Consultez tous vos rapports mensuels WESTBOURSE"
        />
        <div className="mt-4">
          <ViewTabs tabs={REPORT_TABS} current="/premium/reports" />
        </div>

        {reportList.length === 0 ? (
          <div className="mt-8">
            <EmptyStatePremium
              title="Aucun rapport disponible"
              hint="Vos rapports mensuels apparaîtront ici après la première génération"
              icon="📊"
            />
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {reportList.map((report) => {
              const data = report.report_json as any;
              const monthName = new Intl.DateTimeFormat('fr-FR', {
                month: 'long',
                year: 'numeric',
              }).format(new Date(`${report.month}-01`));

              const pnlTotal = data?.kpis?.pnlTotal || 0;
              const pnlPct = data?.kpis?.pnlPct || 0;
              const isPositive = pnlTotal >= 0;

              return (
                <Link
                  key={report.id}
                  href={`/premium/reports/${report.month}`}
                  className="group block rounded-card border border-border bg-surface p-4 sm:p-5 hover:border-gold/30 hover:bg-surface/80 transition-all duration-200"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-ivory capitalize truncate group-hover:text-gold transition-colors">
                        {monthName}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {report.report_json ? (
                          <>Généré le {fmtDateFR(report.sent_at ?? report.created_at)}</>
                        ) : (
                          <>En cours de génération...</>
                        )}
                      </p>
                    </div>

                    {/* Metrics row */}
                    <div className="flex items-center gap-4 sm:gap-6 text-xs">
                      <div className="text-center">
                        <p className="text-muted text-[10px] mb-0.5">P&L</p>
                        <p
                          className={`tabular font-semibold ${
                            isPositive ? 'text-up' : 'text-down'
                          }`}
                        >
                          {fmtFcfa(pnlTotal)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-muted text-[10px] mb-0.5">Rendement</p>
                        <p
                          className={`tabular font-semibold ${
                            isPositive ? 'text-up' : 'text-down'
                          }`}
                        >
                          {pnlPct >= 0 ? '+' : ''}{fmtNumber(pnlPct, 2)}%
                        </p>
                      </div>

                      {report.report_url && (
                        <div>
                          <a
                            href={report.report_url}
                            download={`rapport-${report.month}.pdf`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
                            title="Télécharger le PDF"
                          >
                            <span className="text-xs">↓</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
