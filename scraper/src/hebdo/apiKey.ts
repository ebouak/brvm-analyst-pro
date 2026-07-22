/**
 * Résolution d'une clé LLM côté scraper : table api_keys (comme le frontend),
 * avec priorité aux variables d'environnement.
 */
import { getSupabase } from '../persistence/supabase.js';

export async function resolveApiKeyForScraper(provider: string): Promise<string | null> {
  const env = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (env) return env;
  try {
    const { data } = await getSupabase()
      .from('api_keys')
      .select('api_key')
      .eq('provider', provider)
      .maybeSingle();
    return (data as { api_key?: string } | null)?.api_key ?? null;
  } catch {
    return null;
  }
}
