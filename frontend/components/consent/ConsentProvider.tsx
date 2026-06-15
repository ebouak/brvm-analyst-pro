'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CONSENT_STORAGE_KEY, type ConsentCategoryId } from '@/lib/consent/registry';
import {
  type ConsentChoice,
  parse,
  serialize,
  has as hasCategory,
} from '@/lib/consent/state';

interface ConsentContextValue {
  choice: ConsentChoice | null;
  needsChoice: boolean;
  open: () => void;
  close: () => void;
  isPrefsOpen: boolean;
  save: (choice: ConsentChoice) => void;
  has: (id: ConsentCategoryId) => boolean;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isPrefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    try {
      setChoice(parse(localStorage.getItem(CONSENT_STORAGE_KEY)));
    } catch {
      setChoice(null);
    }
    setHydrated(true);
  }, []);

  const save = useCallback((next: ConsentChoice) => {
    setChoice(next);
    setPrefsOpen(false);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, serialize(next));
    } catch {
      // localStorage indisponible (navigation privée stricte) : on ignore.
    }
  }, []);

  const value: ConsentContextValue = {
    choice,
    needsChoice: hydrated && choice === null,
    open: () => setPrefsOpen(true),
    close: () => setPrefsOpen(false),
    isPrefsOpen,
    save,
    has: (id) => hasCategory(choice, id),
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent doit être utilisé dans <ConsentProvider>');
  return ctx;
}
