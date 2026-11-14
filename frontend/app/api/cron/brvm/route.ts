import { NextResponse } from 'next/server';

/**
 * ROUTE RETIRÉE (410 Gone) — audit F-13.
 *
 * Elle lançait `exec('cd scraper && npm run daily:full')` depuis le serveur web.
 * Aucun workflow GitHub ni `vercel.json` ne l'appelait (vérifié) : la collecte
 * tourne dans les workflows `.github/workflows/*.yml`. Une route qui exécute un
 * shell sur le serveur est une surface d'attaque sans usage ; sa suppression
 * pure exige l'accord de l'exploitant, d'où ce 410 documenté en attendant.
 */
const gone = () =>
  NextResponse.json(
    { error: 'Route retirée. La collecte est exécutée par les workflows GitHub Actions.' },
    { status: 410 },
  );

export const GET = gone;
export const POST = gone;
