import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesRecherche } from '@/lib/recherche/donnees';
import { construireInstantane } from '@/lib/recherche/instantane';
import type { Instantane } from '@/lib/recherche/types';

/**
 * Instantané des faits, recalculé au plus une fois par heure. Une absence de
 * données LÈVE (jamais mise en cache) : la route se replie, puis réessaie.
 */
export const chargerInstantane = unstable_cache(
  async (): Promise<Instantane> => {
    const r = await chargerDonneesRecherche(createPublicClient());
    if (!r) throw new Error('donnees_indisponibles');
    return construireInstantane(r.donnees, r.dateSeance);
  },
  ['recherche-societes-instantane-v1'],
  { revalidate: 3600 },
);
