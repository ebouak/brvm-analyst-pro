'use client';

/** Imprime la revue sur demande : jamais d'ouverture automatique de la boîte de dialogue. */
export default function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent-ink print:hidden"
    >
      Imprimer ou enregistrer en PDF
    </button>
  );
}
