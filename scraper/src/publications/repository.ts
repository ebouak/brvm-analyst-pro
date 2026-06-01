import { getSupabase } from '../persistence/supabase.js';
import { sha256 } from '../utils/hash.js';
import type { Publication } from './types.js';

export function dedupeHash(code: string, date: string, libelle: string): string {
  return sha256(`${code}|${date}|${libelle}`);
}

export async function upsertPublications(pubs: Publication[]): Promise<number> {
  if (pubs.length === 0) return 0;
  const sb = getSupabase();
  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < pubs.length; i += BATCH) {
    const slice = pubs.slice(i, i + BATCH);
    const { error } = await sb.from('publications').upsert(slice, { onConflict: 'dedupe_hash', ignoreDuplicates: true });
    if (error) throw new Error(`upsert publications batch ${i}: ${error.message}`);
    total += slice.length;
  }
  return total;
}
