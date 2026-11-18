import { createPublicClient } from '@/lib/supabase/public';
import { buildSearchItems } from '@/lib/search-index';
import CommandPalette from '@/components/CommandPalette';

/**
 * Rendu dans le layout RACINE : client SANS cookies obligatoire. Le client lié à
 * la session (`@/lib/supabase/server`) lit `cookies()` et rendait ainsi toutes
 * les routes dynamiques. `brvm_instruments` est en lecture publique.
 */
export default async function CommandPaletteProvider() {
  const supabase = createPublicClient();

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('type', 'action')
    .eq('actif', true)
    .order('code', { ascending: true });

  const items = buildSearchItems({ instruments: instruments ?? [] });

  return <CommandPalette items={items} />;
}
