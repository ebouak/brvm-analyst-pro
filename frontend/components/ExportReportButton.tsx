'use client';

// Export PDF via l'impression navigateur (sans dépendance lourde).
// Le lien de la page est lui-même partageable.
export default function ExportReportButton({ title }: { title?: string }) {
  return (
    <div className="flex items-center gap-2 no-print">
      <button
        onClick={() => window.print()}
        className="text-xs border border-border rounded px-3 py-1.5 text-muted hover:text-up hover:border-up/50"
        title="Exporter en PDF via l'impression"
      >
        Exporter PDF
      </button>
      <button
        onClick={() => {
          if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
        }}
        className="text-xs border border-border rounded px-3 py-1.5 text-muted hover:text-up hover:border-up/50"
        title={title ?? 'Copier le lien partageable'}
      >
        Copier le lien
      </button>
    </div>
  );
}
