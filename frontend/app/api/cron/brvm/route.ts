import { exec } from 'child_process';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  // Verify Authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    console.log('[CRON] Starting daily BRVM scrape at', new Date().toISOString());

    // Execute scraper daily run
    const { stdout, stderr } = await execAsync(
      'cd scraper && npm run daily:full',
      { timeout: 3600000 }, // 1 hour timeout
    );

    console.log('[CRON] Scraper output:', stdout);
    if (stderr) console.warn('[CRON] Warnings:', stderr);

    return NextResponse.json(
      {
        status: 'success',
        message: 'Daily BRVM scrape completed',
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[CRON] Scrape failed:', errorMsg);

    return NextResponse.json(
      {
        status: 'failed',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
