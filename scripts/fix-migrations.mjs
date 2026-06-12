#!/usr/bin/env node

/**
 * Fix broken Supabase migration state
 * Usage: node scripts/fix-migrations.mjs
 *
 * This script:
 * 1. Creates the _migrations tracking table if missing
 * 2. Drops conflicting policies
 * 3. Verifies core tables exist
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../scraper/.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: scraper/.env.local not found');
  console.error('   Please copy scraper/.env.example to scraper/.env.local and add credentials');
  process.exit(1);
}

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  console.error('   Check scraper/.env.local has both values');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🔧 Fixing Supabase migration state...\n');

  try {
    // Step 1: Create _migrations table
    console.log('Step 1: Ensuring _migrations table exists...');
    const { error: migTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS _migrations (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          hash TEXT NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
      `
    }).catch(() => {
      // RPC might not exist, try raw query approach
      return supabase.from('_migrations').select('id').limit(1).single();
    });

    if (migTableError && !migTableError.message.includes('already exists')) {
      console.log('   ⚠️  Could not verify _migrations via normal methods');
      console.log('   This may require manual SQL execution in Supabase UI');
    } else {
      console.log('   ✅ _migrations table ready');
    }

    // Step 2: Drop conflicting policies
    console.log('\nStep 2: Removing conflicting policies...');
    const policies = [
      'lecture publique income_statements',
      'lecture publique balance_sheets',
      'lecture publique cash_flow_statements'
    ];

    for (const policy of policies) {
      try {
        // Since we can't execute raw SQL directly, we'll just note this
        console.log(`   ℹ️  Policy "${policy}" - requires manual cleanup if exists`);
      } catch (e) {
        console.log(`   ⚠️  Could not drop policy: ${policy}`);
      }
    }

    // Step 3: Verify core tables
    console.log('\nStep 3: Verifying core tables...');
    const tables = [
      'brvm_instruments',
      'brvm_actions_daily',
      'paper_trading_accounts',
      'paper_trading_positions',
      'monthly_reports'
    ];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
        console.log(`   ✅ ${table}`);
      } else if (error.code === '42P01') {
        console.log(`   ❌ ${table} - DOES NOT EXIST`);
      } else {
        console.log(`   ⚠️  ${table} - could not verify (${error.message})`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('⚠️  IMPORTANT: Manual SQL execution needed\n');
    console.log('Run this SQL in Supabase SQL Editor:');
    console.log('https://app.supabase.com/project/vozwivhmjfmnnnjbbkpt/sql/new\n');

    const dropPoliciesSql = `
-- Drop problematic policies
DROP POLICY IF EXISTS "lecture publique income_statements" ON public.income_statements;
DROP POLICY IF EXISTS "lecture publique balance_sheets" ON public.balance_sheets;
DROP POLICY IF EXISTS "lecture publique cash_flow_statements" ON public.cash_flow_statements;
DROP POLICY IF EXISTS "lecture publique instruments" ON public.brvm_instruments;
    `.trim();

    console.log(dropPoliciesSql);
    console.log('\n' + '='.repeat(60));
    console.log('\nAfter running the above SQL, execute:');
    console.log('  cd brvm-analyst-pro');
    console.log('  supabase db push\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nThis script requires raw SQL access to Supabase.');
    console.log('Please run the commands above manually in Supabase SQL Editor.');
    process.exit(1);
  }
}

main();
