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
        background: '#0c1d2e', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        animation: 'wslogo-splash-out .35s ease .6s forwards',
      }}
    >
      <AnimatedLogo size={104} variant="lockup" animate loop={false} background={false} />
    </div>
  );
}
