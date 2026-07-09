'use client';

import { useEffect, useState } from 'react';
import { AnimatedLogo } from './AnimatedLogo';

const KEY = 'ws_splash_seen';

export default function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(KEY)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sessionStorage.setItem(KEY, '1');
    if (reduce) return; // no splash for reduced-motion users
    setShow(true);
    // Court : le splash ne doit jamais donner une impression de lenteur.
    const t = setTimeout(() => setShow(false), 1000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        // CRITIQUE : le splash est purement décoratif. S'il traîne (thread
        // principal saturé au montage du dashboard : Realtime + charts + requêtes),
        // il ne doit JAMAIS intercepter les clics — sinon toute la navigation
        // paraît morte jusqu'à ce qu'il disparaisse. pointer-events:none garantit
        // que les clics passent au travers quelle que soit sa durée d'affichage.
        pointerEvents: 'none',
        background: '#0c1d2e', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        animation: 'wslogo-splash-out .35s ease .6s forwards',
      }}
    >
      <AnimatedLogo size={104} variant="lockup" animate loop={false} background={false} />
    </div>
  );
}
