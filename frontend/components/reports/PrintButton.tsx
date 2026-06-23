'use client';

/** Bouton « Imprimer / PDF » — masqué à l'impression (classe print:hidden). */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
      🖨️ Imprimer / Enregistrer en PDF
    </button>
  );
}
