'use client';

import { useEffect } from 'react';

/**
 * Publie la hauteur réelle du widget au site hôte.
 *
 * FACULTATIF : l'iframe fonctionne sans (hauteur fixe conseillée). Le snippet
 * hôte documenté sur /developers DOIT valider `event.origin` — sans ce
 * contrôle, n'importe quelle autre iframe de leur page pourrait redimensionner
 * la nôtre.
 *
 * Aucun cookie, aucun traceur : uniquement un postMessage de hauteur.
 */
export default function AutoHeight() {
  useEffect(() => {
    const send = (h: number) =>
      window.parent?.postMessage({ type: 'wb-resize', height: Math.ceil(h) }, '*');
    send(document.body.scrollHeight);
    const ro = new ResizeObserver(([e]) => {
      if (e) send(e.contentRect.height);
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  return null;
}
