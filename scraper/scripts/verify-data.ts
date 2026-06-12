/**
 * Vérifications post-run pour les workflows GitHub Actions.
 * Remplace les scripts inline `tsx -e` (top-level await impossible en mode eval CJS).
 *
 * Usage : npx tsx scripts/verify-data.ts <mode> [arg]
 * Modes :
 *   intraday          — bloquant : ≥ 10 cotations pour la séance du jour
 *   watchdog          — non bloquant : émet needsRetrigger=true/false (GITHUB_OUTPUT)
 *   daily             — bloquant : ≥ 1 cotation pour la séance du jour
 *   monthly <YYYY-MM> — informatif : nb de rapports générés pour le mois
 *   paper             — informatif : nb de positions ouvertes aujourd'hui
 */
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';

function setOutput(key: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${key}=${value}\n`);
  console.log(`[output] ${key}=${value}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
    process.exit(1);
  }
  const client = createClient(url, key);
  const today = new Date().toISOString().split('T')[0];

  switch (mode) {
    case 'intraday': {
      const { count, error } = await client
        .from('brvm_actions_daily')
        .select('*', { count: 'exact', head: true })
        .eq('date_marche', today);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      if ((count ?? 0) < 10) {
        console.error(`❌ Seulement ${count ?? 0} cotations pour ${today} (< 10 attendu)`);
        process.exit(1);
      }
      console.log(`✅ ${count} cotations en base pour la séance du ${today}`);
      break;
    }

    case 'watchdog': {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await client
        .from('brvm_actions_daily')
        .select('updated_at')
        .gte('updated_at', thirtyMinAgo)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      if (!data || data.length === 0) {
        console.log('🔴 STALE : aucune mise à jour depuis 30 min');
        setOutput('needsRetrigger', 'true');
        return;
      }
      const minutes = Math.floor((Date.now() - new Date(data[0].updated_at).getTime()) / 60000);
      const stale = minutes > 20;
      console.log(stale ? `⚠️ STALE : données vieilles de ${minutes} min` : `✅ FRESH : mise à jour il y a ${minutes} min`);
      setOutput('needsRetrigger', stale ? 'true' : 'false');
      break;
    }

    case 'daily': {
      const { count, error } = await client
        .from('brvm_actions_daily')
        .select('*', { count: 'exact', head: true })
        .eq('date_marche', today);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      if ((count ?? 0) === 0) {
        console.error(`❌ Aucune cotation insérée pour ${today}`);
        process.exit(1);
      }
      console.log(`✅ ${count} cotations pour la séance du ${today}`);
      break;
    }

    case 'monthly': {
      const month = process.argv[3];
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        console.error('Usage: verify-data.ts monthly <YYYY-MM>');
        process.exit(1);
      }
      const { count, error } = await client
        .from('monthly_reports')
        .select('*', { count: 'exact', head: true })
        .eq('month', month);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      console.log(`ℹ️ ${count ?? 0} rapport(s) généré(s) pour ${month}`);
      break;
    }

    case 'paper': {
      const { count, error } = await client
        .from('paper_trading_positions')
        .select('*', { count: 'exact', head: true })
        .eq('entry_date', today);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      console.log(`ℹ️ ${count ?? 0} position(s) ouverte(s) le ${today} (0 = aucun signal fort, normal)`);
      break;
    }

    default:
      console.error(`Mode inconnu: ${mode}. Modes: intraday | watchdog | daily | monthly | paper`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
