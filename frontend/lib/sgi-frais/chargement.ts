import 'server-only';
import { cache } from 'react';
import { getSgiDirectory, getSgiFrais } from './queries';
import { statistiquesSgi } from './identite';

/**
 * Une seule lecture par requête pour toutes les sections du comparateur
 * (bandeau, navigation, module) : `cache` déduplique les appels du rendu.
 */
export const chargerSgi = cache(async () => {
  const [directory, frais] = await Promise.all([getSgiDirectory(), getSgiFrais()]);
  return { directory, frais, stats: statistiquesSgi(directory, frais) };
});
