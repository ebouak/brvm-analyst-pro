'use client';

/**
 * Bouton d'impression du dossier.
 *
 * Distinct de `components/reports/PrintButton` : celui-là porte les classes
 * Tailwind du thème sombre, qui n'ont pas cours dans la feuille `.dv`. Et
 * distinct de `PrintTrigger`, qui déclenche l'impression tout seul : ce dossier
 * se consulte aussi à l'écran, ouvrir une boîte de dialogue sans qu'on l'ait
 * demandé serait hostile.
 */
export default function ImprimerDossier() {
  return (
    <button type="button" className="dv-bouton" onClick={() => window.print()}>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
