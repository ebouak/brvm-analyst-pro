'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  const open = useCallback(() => setPrefsOpen(true), []);
  const close = useCallback(() => setPrefsOpen(false), []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      choice,
      needsChoice: hydrated && choice === null,
      open,
      close,
      isPrefsOpen,
      save,
      has: (id) => hasCategory(choice, id),
    }),
    [choice, hydrated, isPrefsOpen, save, open, close],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent doit être utilisé dans <ConsentProvider>');
  return ctx;
}
