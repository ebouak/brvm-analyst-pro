/** Inspection rapide des données du jour (indices, résumé marché, événements). */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main(): Promise<void> {
  const c = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: idx } = await c
    .from('brvm_indices_daily')
    .select('code, date_marche')
    .order('date_marche', { ascending: false })
    .limit(6);
  console.log('INDICES (derniers):', JSON.stringify(idx));
  const { data: ms } = await c
    .from('brvm_market_summary')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(1);
  console.log('MARKET_SUMMARY:', JSON.stringify(ms));
  const { count: ev } = await c
    .from('market_events')
    .select('*', { count: 'exact', head: true })
    .gte('event_date', '2026-06-01');
  console.log('EVENTS depuis 01/06:', ev);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
