'use client';

/**
 * Bouton d'impression du relevé. Même rôle que `ImprimerDossier` : le relevé
 * se consulte à l'écran, ouvrir la boîte d'impression sans qu'on l'ait demandé
 * serait hostile. Masqué à l'impression (`.rl-actions`).
 */
export default function ImprimerReleve() {
  return (
    <button type="button" className="rl-bouton" onClick={() => window.print()}>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
