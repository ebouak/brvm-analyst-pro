import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader } from '@/components/ui/premium';
import ReportBuilderForm from '@/components/reports/ReportBuilderForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Constructeur de rapport — WESTBOURSE' };

export default async function ReportBuilderPage() {
  const sb = createPublicClient();
  const { data: instrRows } = await sb
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .order('designation', { ascending: true });

  const instruments = (instrRows ?? [])
    .filter((i: { designation: string | null }) => i.designation)
    .map((i: { code: string; designation: string }) => ({ code: i.code, designation: i.designation }));

  const sectors = Array.from(
    new Set((instrRows ?? []).map((i: { secteur: string | null }) => i.secteur).filter((s): s is string => !!s)),
  ).sort();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Rapports"
        title="Composer un rapport"
        subtitle="Cochez les blocs à inclure, puis générez un PDF imprimable à partir de vos données réelles."
      />
      {instruments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted">
          Aucune donnée disponible pour composer un rapport pour l’instant.
        </div>
      ) : (
        <ReportBuilderForm instruments={instruments} sectors={sectors} />
      )}
    </div>
  );
}
