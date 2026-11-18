/**
 * Attente des polices avant d'afficher le bandeau cookies.
 *
 * Pourquoi : le bandeau est fixé en bas de l'écran. Affiché avec la police de
 * repli, il perdait ~20 px de hauteur quand Geist arrivait (le texte se
 * replie sur moins de lignes) ; son bord haut descendait, et ce décalage
 * pesait l'essentiel du CLS de l'accueil (0,040 sur 0,045 à 1440 px, polices
 * retardées de 2,5 s). Un élément `fixed` qui APPARAÎT ne décale rien : on le
 * montre donc une fois les polices chargées, et sa hauteur ne bouge plus.
 *
 * Le consentement n'est pas touché : tant qu'aucun choix n'est enregistré, les
 * traceurs non essentiels restent bloqués, bandeau affiché ou non. Un plafond
 * garantit que le bandeau finit toujours par paraître, même si une police
 * n'arrive jamais (au pire, on retrouve l'ancien décalage).
 */

/** Sous-ensemble de `FontFaceSet` utile ici (testable sans navigateur). */
export interface EnsemblePolices {
  status: 'loading' | 'loaded';
  ready: Promise<unknown>;
}

export const PLAFOND_ATTENTE_POLICES_MS = 3000;

/**
 * Appelle `pret` une seule fois : tout de suite si les polices sont déjà
 * chargées (ou si l'API manque), sinon à `ready` ou au plafond, au premier des
 * deux. Retourne une fonction d'annulation (démontage du composant).
 */
export function quandPolicesPretes(
  polices: EnsemblePolices | undefined | null,
  pret: () => void,
  plafondMs: number = PLAFOND_ATTENTE_POLICES_MS,
  minuteur: {
    lancer: (fn: () => void, ms: number) => unknown;
    annuler: (id: unknown) => void;
  } = {
    lancer: (fn, ms) => setTimeout(fn, ms),
    annuler: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
): () => void {
  let fini = false;
  let id: unknown;
  const marquer = () => {
    if (fini) return;
    fini = true;
    minuteur.annuler(id);
    pret();
  };

  if (!polices || polices.status === 'loaded') {
    pret();
    return () => {};
  }

  id = minuteur.lancer(marquer, plafondMs);
  polices.ready.then(marquer, marquer);
  return () => {
    fini = true;
    minuteur.annuler(id);
  };
}
