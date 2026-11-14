'use client';

/** Bouton d'impression de la Revue : même rôle que celui du Dossier, jamais d'ouverture automatique. */
export default function ImprimerRevue() {
  return (
    <button type="button" className="rv-bouton" onClick={() => window.print()}>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
