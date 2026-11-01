'use client';

export default function ImprimerRapport() {
  return (
    <button type="button" className="ra-bouton" onClick={() => window.print()}>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
