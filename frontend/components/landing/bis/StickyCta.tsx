'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Barre discrète qui apparaît après ~35 % de défilement : une phrase, un
 * bouton. Pas de popup, pas de blocage, refermable ; l'état « fermée » ne
 * survit pas au rechargement (aucun stockage). Respecte prefers-reduced-motion
 * via la CSS (transition désactivée).
 */
export function StickyCta({ seuil = 0.35 }: { seuil?: number }) {
  const [visible, setVisible] = useState(false);
  const [fermee, setFermee] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setVisible(max > 0 && window.scrollY / max >= seuil);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [seuil]);

  if (fermee) return null;
  return (
    <div className={`sticky-cta${visible ? ' on' : ''}`} role="complementary" aria-label="Créer un compte" aria-hidden={!visible}>
      <span>Prêt à commencer ?</span>
      <Link href="/signup" className="btn btn-ink btn-sm" tabIndex={visible ? 0 : -1}>Créer mon compte gratuit <span aria-hidden="true">→</span></Link>
      <button type="button" onClick={() => setFermee(true)} aria-label="Fermer" tabIndex={visible ? 0 : -1}>×</button>
    </div>
  );
}
