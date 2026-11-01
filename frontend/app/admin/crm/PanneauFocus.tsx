'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Déplace le focus sur le titre du panneau à l'ouverture ; Échap ferme (navigation vers l'URL sans `fiche`). */
export default function PanneauFocus({ fermer, titreId }: { fermer: string; titreId: string }) {
  const router = useRouter();
  useEffect(() => {
    document.getElementById(titreId)?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') router.replace(fermer, { scroll: false }); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [fermer, titreId, router]);
  return null;
}
