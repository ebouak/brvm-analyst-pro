'use client';

import { useEffect, useRef } from 'react';
import { useConsent } from '@/components/consent/ConsentProvider';

/**
 * PostHog (product analytics) — STRICTEMENT conditionné au consentement
 * « Mesure d'audience » du bandeau cookies (RGPD by design) :
 * - pas de clé NEXT_PUBLIC_POSTHOG_KEY → composant inerte ;
 * - consentement absent ou refusé → aucun script chargé, aucune requête ;
 * - consentement retiré après coup → opt-out immédiat + purge des données locales.
 * Import dynamique : posthog-js ne pèse rien tant que non consenti.
 */
export default function PostHogInit() {
  const { has, choice } = useConsent();
  const loadedRef = useRef(false);
  const granted = has('analytics');

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    if (granted && !loadedRef.current) {
      loadedRef.current = true;
      import('posthog-js').then(({ default: posthog }) => {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
          persistence: 'localStorage',
          capture_pageview: true,
          capture_pageleave: true,
          autocapture: true,
          respect_dnt: true,
          // Session replay : masque toutes les saisies par défaut (prudence RGPD).
          session_recording: { maskAllInputs: true },
        });
      });
    } else if (!granted && loadedRef.current) {
      // Consentement retiré : stop + purge (droit de retrait effectif).
      import('posthog-js').then(({ default: posthog }) => {
        posthog.opt_out_capturing();
        posthog.reset();
      });
      loadedRef.current = false;
    }
  }, [granted, choice]);

  return null;
}
