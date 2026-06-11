'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const KEY = 'brvm_beginner_mode';

interface BeginnerCtx {
  beginner: boolean;
  toggle: () => void;
}

const Ctx = createContext<BeginnerCtx>({ beginner: false, toggle: () => {} });

export function BeginnerModeProvider({ children, initial = false }: { children: ReactNode; initial?: boolean }) {
  const [beginner, setBeginner] = useState(initial);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(KEY);
    if (stored !== null) setBeginner(stored === 'true');
    else setBeginner(initial);
  }, [initial]);

  function toggle() {
    setBeginner((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  }

  // Always render provider to avoid context errors in children
  // Use initial default value when not mounted to prevent hydration mismatch
  return (
    <Ctx.Provider value={mounted ? { beginner, toggle } : { beginner: initial, toggle: () => {} }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBeginnerMode() {
  return useContext(Ctx);
}
