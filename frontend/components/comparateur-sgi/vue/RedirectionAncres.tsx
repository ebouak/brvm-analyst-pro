'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Les anciennes ancres de /comparateur-sgi (calculateur et questionnaire,
 * aujourd'hui sur leur propre page) circulent dans des liens partagés. Le
 * fragment n'atteint jamais le serveur : seule la page peut le relire.
 */
const ANCRES: Record<string, string> = {
  '#calculateur-cout': '/comparateur-sgi/simuler',
  '#moteur-sgi': '/comparateur-sgi/trouver',
};

export function RedirectionAncres() {
  const router = useRouter();
  useEffect(() => {
    const cible = ANCRES[window.location.hash];
    // Le scénario éventuel (capital, durée…) suit la redirection.
    if (cible) router.replace(`${cible}${window.location.search}`);
  }, [router]);
  return null;
}
