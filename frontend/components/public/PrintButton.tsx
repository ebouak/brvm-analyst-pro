'use client';

/** Bouton d'export PDF : impression navigateur (pattern existant du projet). */
export default function PrintButton({ label = 'Télécharger en PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden px-4 py-2 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors text-sm font-medium active:scale-95"
    >
      {label}
    </button>
  );
}
