/**
 * Vérifications post-run pour les workflows GitHub Actions.
 * Remplace les scripts inline `tsx -e` (top-level await impossible en mode eval CJS).
 *
 * Usage : npx tsx scripts/verify-data.ts <mode> [arg]
 * Modes :
 *   intraday          — bloquant : ≥ 10 cotations pour la séance du jour
 *   watchdog          — non bloquant : émet needsRetrigger=true/false (GITHUB_OUTPUT)
 *   daily             — bloquant : ≥ 1 cotation pour la séance du jour
 *   score             — bloquant : ≥ 1 signal calculé pour la séance du jour
 *   monthly <YYYY-MM> — informatif : nb de rapports générés pour le mois
 *   paper             — informatif : nb de positions ouvertes aujourd'hui
 *   events            — informatif : nb d'événements ingérés dans les dernières 24h
 *   dividends         — informatif : nb de dividendes ingérés dans les dernières 24h
 *   alerts            — informatif : nb de notifications d'alertes envoyées dans les dernières 24h
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

    case 'score': {
      // runScoring calcule sur la dernière date disponible dans mv_signal_inputs,
      // qui peut être en retard d'une séance (week-end, refresh de la vue) —
      // on tolère donc une fenêtre de 4 jours plutôt que d'exiger date_marche = today.
      const since = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { count, error } = await client
        .from('signals_daily')
        .select('*', { count: 'exact', head: true })
        .gte('date_marche', since);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      if ((count ?? 0) === 0) {
        console.error(`❌ Aucun signal calculé depuis ${since}`);
        process.exit(1);
      }
      console.log(`✅ ${count} signaux calculés depuis ${since}`);
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

    case 'events': {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await client
        .from('market_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      console.log(`ℹ️ ${count ?? 0} événement(s) ingéré(s) sur les dernières 24h (0 = aucune annonce, normal)`);
      break;
    }

    case 'dividends': {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await client
        .from('dividends')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      console.log(`ℹ️ ${count ?? 0} dividende(s) ingéré(s) sur les dernières 24h (0 = hors saison, normal)`);
      break;
    }

    case 'alerts': {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await client
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      console.log(`ℹ️ ${count ?? 0} notification(s) d'alerte envoyée(s) sur les dernières 24h (0 = aucun déclenchement, normal)`);
      break;
    }

    default:
      console.error(`Mode inconnu: ${mode}. Modes: intraday | watchdog | daily | score | monthly | paper | events | dividends | alerts`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
