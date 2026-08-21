// frontend/lib/marketDate.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dernière date de séance disponible dans brvm_actions_daily. Extrait de
 * app/page.tsx et lib/whatsappAgent/watchlistContext.ts pour éviter que les
 * deux copies divergent silencieusement (même paquet TypeScript, contrairement
 * au précédent scraper/hebdo qui duplique entre deux runtimes séparés — ici
 * rien ne justifie de dupliquer plutôt que partager).
 */
export async function getLastMarketDate(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.date_marche as string | undefined) ?? null;
}
