import { unstable_cache } from 'next/cache';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { parcoursDepuis, type NiveauParcours } from './landingPur';

/**
 * Nombre de leçons par niveau. Le contenu des cours n'est pas lisible à la clé publique :
 * lecture côté serveur (clé service, jamais exposée), mise en cache 24 h (≈ 745 ko lus).
 * Null sur erreur (ex. CI sans clé) : la ligne du parcours disparaît.
 */
const lireParcours = unstable_cache(
  async (): Promise<NiveauParcours[] | null> => {
    try {
      const { data, error } = await getServiceClient()
        .from('academy_courses')
        .select('niveau, content')
        .eq('published', true)
        .like('slug', 'academy-niveau-%');
      if (error || !data) return null;
      return parcoursDepuis(data as { niveau: string | null; content: { lessons?: unknown } | null }[]);
    } catch {
      return null;
    }
  },
  ['vitrine-apprendre-parcours'],
  { revalidate: 86400 },
);

export async function chargerParcours(): Promise<NiveauParcours[] | null> {
  return lireParcours();
}
