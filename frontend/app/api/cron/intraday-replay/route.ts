import { NextRequest, NextResponse } from 'next/server';

/**
 * Relance manuelle du scrape intraday.
 *
 * Le frontend ne scrape jamais lui-même (découplage : il ne lit que Supabase).
 * Cette route déclenche le workflow GitHub Actions `intraday.yml` via
 * l'API GitHub (workflow_dispatch), qui exécute le scraper.
 *
 * Usage : POST /api/cron/intraday-replay
 *   Header : Authorization: Bearer <CRON_SECRET>
 *
 * Variables d'environnement requises (Vercel) :
 *   CRON_SECRET            — jeton d'autorisation de cette route
 *   GITHUB_DISPATCH_TOKEN  — PAT GitHub avec scope `actions:write` (optionnel ;
 *                            sans lui la route répond 501)
 */

const GITHUB_REPO = 'ebouak/brvm-analyst-pro';
const WORKFLOW_FILE = 'intraday.yml';

function checkAuth(request: NextRequest): NextResponse | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const expectedToken = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (!token || !expectedToken || token !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide valid CRON_SECRET.' },
      { status: 401 }
    );
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = checkAuth(request);
  if (authError) return authError;

  const ghToken = process.env.GITHUB_DISPATCH_TOKEN;
  if (!ghToken) {
    return NextResponse.json(
      {
        error: 'GITHUB_DISPATCH_TOKEN non configuré sur Vercel.',
        alternative: `Déclencher manuellement : https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`,
      },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({
        status: 'success',
        message: `Workflow ${WORKFLOW_FILE} déclenché. Suivi : https://github.com/${GITHUB_REPO}/actions`,
      });
    }

    const detail = await res.text();
    return NextResponse.json(
      { status: 'error', message: `GitHub API ${res.status}`, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Relance manuelle du scrape intraday (via GitHub Actions)',
    usage: 'POST /api/cron/intraday-replay avec header Authorization: Bearer <CRON_SECRET>',
    workflow: `https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`,
  });
}
