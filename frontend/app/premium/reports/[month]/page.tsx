import { createClient } from '@/lib/supabase/server';
import { MonthlyReportViewer } from '@/components/MonthlyReportViewer';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Rapport Mensuel',
};

interface MonthlyReport {
  id: string;
  month: string;
  report_url: string | null;
  report_json: Record<string, any> | null;
  sent_at: string | null;
  created_at: string;
}

export default async function ReportDetailPage({ params }: { params: { month: string } }) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <p className="text-muted">Veuillez vous connecter pour accéder à ce rapport.</p>
      </div>
    );
  }

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(params.month)) {
    notFound();
  }

  // Fetch report for current user
  const { data: report, error } = await supabase
    .from('monthly_reports')
    .select('id, month, report_url, report_json, sent_at, created_at')
    .eq('user_id', user.id)
    .eq('month', params.month)
    .single();

  if (error || !report) {
    notFound();
  }

  const reportData = report as MonthlyReport;
  const monthName = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${params.month}-01`));

  // Handle missing report_json
  if (!reportData.report_json) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-muted mb-8">
            <Link href="/premium/reports" className="hover:text-gold transition">
              Rapports
            </Link>
            <span>/</span>
            <span className="capitalize">{monthName}</span>
          </nav>

          <EmptyStatePremium
            title="Rapport en cours de génération"
            hint="Veuillez patienter quelques instants ou revenir plus tard"
            icon="⏳"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-muted mb-8">
          <Link href="/premium/reports" className="hover:text-gold transition">
            Rapports
          </Link>
          <span>/</span>
          <span className="capitalize">{monthName}</span>
        </nav>

        {/* Page title */}
        <SectionHeader
          kicker="Rapport mensuel"
          title={monthName}
          subtitle="Analyse complète de vos performances et opportunités"
        />

        {/* Report viewer component */}
        <div className="mt-8 sm:mt-12">
          <MonthlyReportViewer
            report={reportData.report_json as any}
            pdfUrl={reportData.report_url || undefined}
          />
        </div>

        {/* Footer navigation */}
        <div className="mt-12 pt-6 border-t border-border flex items-center justify-between">
          <Link href="/premium/reports" className="text-sm text-gold hover:text-gold/80 transition">
            ← Retour à l'archive
          </Link>
          <p className="text-xs text-muted">
            Généré le {new Date(reportData.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>
    </div>
  );
}
