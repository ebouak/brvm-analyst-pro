'use client';

import { useEffect, useRef } from 'react';

export const INTERVALLE_DETECTION_MS = 4000;
/** Durée de validité d'un code (PAIRING_TTL_MINUTES) : au-delà, plus rien ne peut arriver. */
const DUREE_MAX_MS = 15 * 60_000;

/**
 * Tant que `actif`, relit l'état toutes les 4 s pour détecter la liaison créée
 * par le webhook, sans que la personne ait à cliquer « J'ai envoyé le code ».
 * S'arrête à la première détection, après la durée de validité du code, ou au
 * démontage. Onglet masqué → pas de requête (rien ne sert de lire pour personne).
 * Une erreur de lecture est ignorée : le tour suivant réessaie, et le bouton
 * manuel reste disponible.
 */
export function useDetectionLiaison<T>(
  actif: boolean,
  verifier: () => Promise<T | null>,
  surLiaison: (resultat: T) => void,
): void {
  const v = useRef(verifier);
  const s = useRef(surLiaison);
  v.current = verifier;
  s.current = surLiaison;

  useEffect(() => {
    if (!actif) return;
    const debut = Date.now();
    let fini = false;
    let enCours = false;
    const id = setInterval(async () => {
      if (fini || enCours || document.hidden) return;
      if (Date.now() - debut > DUREE_MAX_MS) {
        fini = true;
        clearInterval(id);
        return;
      }
      enCours = true;
      try {
        const r = await v.current();
        if (r !== null && !fini) {
          fini = true;
          clearInterval(id);
          s.current(r);
        }
      } catch {
        /* tour suivant */
      } finally {
        enCours = false;
      }
    }, INTERVALLE_DETECTION_MS);
    return () => {
      fini = true;
      clearInterval(id);
    };
  }, [actif]);
}
