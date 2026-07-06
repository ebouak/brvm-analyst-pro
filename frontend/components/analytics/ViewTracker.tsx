'use client';

import { useEffect } from 'react';
import { phCapture } from '@/lib/analytics/posthogClient';

/**
 * Capture un événement produit nommé au montage — pour les pages serveur où
 * l'on veut un event propre (ex. 'diagnostic_viewed' + code du titre) plutôt
 * que de retrouver l'information dans l'URL du $pageview automatique.
 * Aucun rendu (retourne null).
 */
export function ViewTracker({ event, properties }: { event: string; properties?: Record<string, unknown> }) {
  useEffect(() => {
    void phCapture(event, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capturé une fois par montage, pas à chaque changement de référence d'objet
  }, [event]);
  return null;
}
