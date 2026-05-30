import { createClient } from '@/lib/supabase/server';
import { buildSearchItems } from '@/lib/search-index';
import CommandPalette from '@/components/CommandPalette';

export default async function CommandPaletteProvider() {
  const supabase = createClient();

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('type', 'action')
    .eq('actif', true)
    .order('code', { ascending: true });

  const items = buildSearchItems({ instruments: instruments ?? [] });

  return <CommandPalette items={items} />;
}
