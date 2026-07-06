import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewsCategory, NewsSignal } from './newsSignals';

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000; // 30 jours — un litige ou un changement de dirigeant ne se périme pas vite

const CATEGORY_QUERY: Record<NewsCategory, (designation: string) => string> = {
  litiges: (d) => `${d} BRVM litige poursuite judiciaire`,
  insiders: (d) => `${d} BRVM dirigeant démission actionnaire majoritaire`,
  concentration_client: (d) => `${d} BRVM client principal dépendance contrat`,
};

interface TavilyResult {
  title: string;
  url: string;
  published_date?: string;
}

async function tavilySearch(query: string, apiKey: string): Promise<TavilyResult[]> {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 3, search_depth: 'basic' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
  const json = (await resp.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

/**
 * Complète les catégories sans signal de veille interne via Tavily (repli),
 * avec cache 30 jours dans diagnostic_search_cache. No-op silencieux si
 * TAVILY_API_KEY absente. Échec réseau/API traité comme "rien trouvé", jamais bloquant.
 */
export async function findWebSignals(
  sb: SupabaseClient,
  code: string,
  designation: string,
  categoriesSansResultat: NewsCategory[],
): Promise<Partial<Record<NewsCategory, NewsSignal[]>>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || categoriesSansResultat.length === 0) return {};

  const out: Partial<Record<NewsCategory, NewsSignal[]>> = {};

  for (const category of categoriesSansResultat) {
    try {
      const { data: cached } = await sb
        .from('diagnostic_search_cache')
        .select('results, fetched_at')
        .eq('code', code)
        .eq('category', category)
        .maybeSingle();

      if (cached && Date.now() - new Date(cached.fetched_at as string).getTime() < CACHE_TTL_MS) {
        out[category] = cached.results as NewsSignal[];
        continue;
      }

      const query = CATEGORY_QUERY[category](designation);
      const results = await tavilySearch(query, apiKey);
      const signals: NewsSignal[] = results.map((r) => ({
        titre: r.title,
        source: new URL(r.url).hostname,
        date: r.published_date ?? new Date().toISOString().slice(0, 10),
        url: r.url,
      }));

      await sb.from('diagnostic_search_cache').upsert(
        { code, category, results: signals, fetched_at: new Date().toISOString() },
        { onConflict: 'code,category' },
      );
      out[category] = signals;
    } catch {
      out[category] = [];
    }
  }
  return out;
}
