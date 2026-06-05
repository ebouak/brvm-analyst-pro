/**
 * Pousse les fondamentaux extraits par analyse LLM (output/fundamentals/*.json)
 * vers Supabase. Les JSON sont en MILLIONS de FCFA ; la table `fundamentals`
 * stocke en FCFA bruts → conversion ×1 000 000. Le nombre d'actions va dans
 * brvm_instruments.shares. Marqué is_manual=true (fiable, non écrasé par l'auto).
 *
 * Usage : node --env-file=.env.local push_extracted.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DIR = 'output/fundamentals';
const M = 1_000_000; // millions -> FCFA

function mToFcfa(v) {
  return v == null ? null : Math.round(v * M);
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  let okF = 0, okS = 0;
  for (const file of files) {
    const d = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
    if (!d.symbol || !d.year) { console.warn('skip', file, '(symbol/year manquant)'); continue; }

    // 1) Fondamentaux (millions -> FCFA).
    const row = {
      code: d.symbol,
      year: d.year,
      revenue: mToFcfa(d.revenue),
      net_income: mToFcfa(d.net_income),
      equity: mToFcfa(d.equity),
      debt: mToFcfa(d.debt_total),
      cash: mToFcfa(d.cash),
      source: 'pdf-llm',
      is_manual: true,
    };
    const { error: ef } = await sb.from('fundamentals').upsert(row, { onConflict: 'code,year' });
    if (ef) console.error('fundamentals', d.symbol, ef.message);
    else okF += 1;

    // 2) Nombre d'actions (si présent et non déjà manuel).
    if (d.shares_outstanding) {
      const { error: es } = await sb
        .from('brvm_instruments')
        .update({ shares: d.shares_outstanding, shares_source: 'pdf-llm' })
        .eq('code', d.symbol);
      if (es) console.error('shares', d.symbol, es.message);
      else okS += 1;
    }
    console.log(`✓ ${d.symbol} ${d.year} : CA=${row.revenue} RN=${row.net_income} shares=${d.shares_outstanding ?? '—'}`);
  }
  console.log(`\nFondamentaux poussés : ${okF}/${files.length} | shares : ${okS}`);
}

main();
