import { NextRequest, NextResponse } from 'next/server';

/**
 * Replay intraday scrape for a specific hour that was missed.
 *
 * Usage: POST /api/cron/intraday-replay
 * Body: { "hour": 10 }  // 10:00-10:59 UTC
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedToken = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    if (!token || !expectedToken || token !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide valid CRON_SECRET.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { hour } = body;

    if (hour === undefined || typeof hour !== 'number' || hour < 0 || hour > 23) {
      return NextResponse.json(
        { error: 'Invalid hour. Must be 0-23.' },
        { status: 400 }
      );
    }

    console.log(`[REPLAY] Starting intraday catch-up for hour ${hour}:00 UTC`);

    // Import scraper CLI
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const proc = spawn('npm', ['run', 'intraday'], {
        cwd: process.cwd() + '/scraper',
        stdio: 'pipe',
        env: {
          ...process.env,
          SUPABASE_URL: process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          LOG_LEVEL: 'info',
          NODE_ENV: 'production',
        },
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`[REPLAY] ✅ Catch-up succeeded for hour ${hour}`);
          resolve(
            NextResponse.json(
              {
                status: 'success',
                hour,
                message: `Intraday scrape replayed for hour ${hour}:00 UTC`,
                output: output.slice(-500), // Last 500 chars
              },
              { status: 200 }
            )
          );
        } else {
          console.error(`[REPLAY] ❌ Catch-up failed for hour ${hour}:`, errorOutput);
          resolve(
            NextResponse.json(
              {
                status: 'error',
                hour,
                message: `Intraday scrape failed for hour ${hour}`,
                error: errorOutput.slice(-500),
              },
              { status: 500 }
            )
          );
        }
      });

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        proc.kill();
        resolve(
          NextResponse.json(
            {
              status: 'error',
              hour,
              message: 'Intraday scrape timed out after 5 minutes',
            },
            { status: 504 }
          )
        );
      }, 5 * 60 * 1000);

      proc.on('close', () => clearTimeout(timeout));
    });
  } catch (error) {
    console.error('[REPLAY] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if manual replay is available
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hour = searchParams.get('hour');

  if (!hour) {
    return NextResponse.json(
      {
        message: 'Manual intraday replay endpoint',
        usage: 'POST /api/cron/intraday-replay with Authorization header',
        body: { hour: '0-23 (UTC)' },
        example: 'curl -X POST http://localhost:3000/api/cron/intraday-replay -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d \'{"hour":10}\'',
      },
      { status: 200 }
    );
  }

  // Optionally support GET-based query
  if (typeof hour === 'string') {
    const h = parseInt(hour, 10);
    if (isNaN(h) || h < 0 || h > 23) {
      return NextResponse.json({ error: 'Invalid hour parameter' }, { status: 400 });
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedToken = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    if (!token || !expectedToken || token !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Redirect to POST
    return NextResponse.redirect(
      new URL('/api/cron/intraday-replay', request.url),
      { status: 307 }
    );
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
