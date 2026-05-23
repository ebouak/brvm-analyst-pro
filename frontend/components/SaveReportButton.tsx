import { saveSnapshot } from '@/app/dashboard/reports/snapshots/actions';

// Affiché uniquement si `canSave` (utilisateur connecté).
export default function SaveReportButton({
  reportType, title, params, canSave,
}: {
  reportType: string;
  title: string;
  params: Record<string, unknown>;
  canSave: boolean;
}) {
  if (!canSave) return null;
  return (
    <form action={saveSnapshot} className="no-print">
      <input type="hidden" name="report_type" value={reportType} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="params" value={JSON.stringify(params)} />
      <button className="text-xs border border-border rounded px-3 py-1.5 text-muted hover:text-up hover:border-up/50">
        ★ Sauvegarder
      </button>
    </form>
  );
}
