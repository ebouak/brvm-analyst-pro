'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeadLevel } from '@/lib/leads';

const LEVEL_KEY = 'brvm_level';
const SEEN_KEY = 'brvm_level_seen';

export interface LevelState {
  /** Hydraté côté client (évite tout flash SSR). */
  ready: boolean;
  /** Niveau choisi, ou null si jamais répondu / ignoré. */
  level: LeadLevel | null;
  /** true si l'utilisateur a déjà vu/répondu à la modale (one-time). */
  seen: boolean;
  /** Enregistre le niveau + marque comme vu. */
  setLevel: (level: LeadLevel) => void;
  /** Marque comme vu sans choisir de niveau (fermeture). */
  dismiss: () => void;
}

function readLevel(): LeadLevel | null {
  const v = localStorage.getItem(LEVEL_KEY);
  return v === 'debutant' || v === 'intermediaire' || v === 'confirme' ? v : null;
}

/**
 * État partagé du niveau visiteur, persistant dans localStorage (one-time :
 * une fois `seen`, la modale ne réapparaît plus). Aucune donnée personnelle —
 * juste une préférence d'affichage, donc pas de consentement requis.
 */
export function useLevelModal(): LevelState {
  const [ready, setReady] = useState(false);
  const [level, setLevelState] = useState<LeadLevel | null>(null);
  const [seen, setSeen] = useState(true); // défaut sûr : ne pas montrer avant hydratation

  useEffect(() => {
    try {
      setLevelState(readLevel());
      setSeen(localStorage.getItem(SEEN_KEY) === '1');
    } catch {
      /* localStorage indisponible (mode privé strict) : on n'insiste pas. */
    }
    setReady(true);
  }, []);

  const setLevel = useCallback((next: LeadLevel) => {
    try {
      localStorage.setItem(LEVEL_KEY, next);
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* noop */
    }
    setLevelState(next);
    setSeen(true);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* noop */
    }
    setSeen(true);
  }, []);

  return { ready, level, seen, setLevel, dismiss };
}
