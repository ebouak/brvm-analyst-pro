#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const scraper = path.resolve(rootDir, 'scraper');

// Load environment from scraper/.env.local
const envPath = path.resolve(scraper, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: scraper/.env.local not found');
  process.exit(1);
}

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scraper/.env.local');
  process.exit(1);
}

// Create admin client with service role key (has direct DB access)
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🔧 Dropping conflicting policies...\n');

  try {
    // We need to use the Postgres client to execute raw SQL
    // The JS client doesn't support raw SQL execution directly
    // However, we can use a workaround with postgres.js library

    // First, extract connection details from Supabase URL
    const url = new URL(SUPABASE_URL);
    const projectRef = url.hostname.split('.')[0];

    console.log(`Project: ${projectRef}`);
    console.log(`URL: ${SUPABASE_URL}`);

    // Since we can't execute raw SQL via the JS client directly,
    // we'll need to use a different approach.

    // Option 1: Use psql if available
    console.log('\n📌 Attempting SQL execution...');

    // The service_role_key is an API token, not a database password
    // We need to use Supabase's pg connection or extract the password

    console.log('⚠️  Note: Cannot execute raw SQL via Supabase JS client alone.');
    console.log('    This requires direct PostgreSQL access.\n');

    console.log('Fallback: Use Supabase SQL Editor manually');
    console.log('URL: https://app.supabase.com/project/vozwivhmjfmnnnjbbkpt/sql/new\n');

    console.log('Run this SQL:');
    console.log('─'.repeat(60));
    console.log(`
DROP POLICY IF EXISTS "lecture publique income_statements" ON public.income_statements;
DROP POLICY IF EXISTS "lecture publique balance_sheets" ON public.balance_sheets;
DROP POLICY IF EXISTS "lecture publique cash_flow_statements" ON public.cash_flow_statements;
    `.trim());
    console.log('─'.repeat(60));
    console.log('\nThen retry: supabase db push');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
