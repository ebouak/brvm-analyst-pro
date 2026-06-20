// GET /api/cron/advisor-snapshot
// Calcule les recommandations du jour et les enregistre dans advisor_history,
// puis renvoie les BASCULES vs le snapshot précédent (base des alertes).
// Protégé par CRON_SECRET. Vercel Cron injecte automatiquement
// `Authorization: Bearer <CRON_SECRET>` ; déclenchement manuel possible via
// header x-cron-secret ou ?secret=. Planifié dans vercel.json (jours ouvrés,
// après la séance).
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createPublicClient } from '@/lib/supabase/public';
import { getAdvisorRecommendations } from '@/lib/advisor/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const provided =
    bearer ?? req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const pub = createPublicClient();
  const { data: lastRow } = await pub
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = lastRow?.[0]?.date_marche ?? null;
  if (!date) return NextResponse.json({ error: 'Aucune séance.' }, { status: 404 });

  const recos = await getAdvisorRecommendations();

  // Snapshot précédent (dernière date < date du jour) pour détecter les bascules.
  const { data: prevDates } = await pub
    .from('advisor_history')
    .select('date_marche')
    .lt('date_marche', date)
    .order('date_marche', { ascending: false })
    .limit(1);
  const prevDate = prevDates?.[0]?.date_marche ?? null;
  const prevByCode = new Map<string, string>();
  if (prevDate) {
    const { data: prev } = await pub.from('advisor_history').select('code, action').eq('date_marche', prevDate);
    for (const r of (prev ?? []) as { code: string; action: string }[]) prevByCode.set(r.code, r.action);
  }

  const flips = recos
    .filter((r) => prevByCode.has(r.code) && prevByCode.get(r.code) !== r.result.action)
    .map((r) => ({ code: r.code, from: prevByCode.get(r.code)!, to: r.result.action, conviction: r.result.conviction }));

  // Upsert du snapshot du jour (service_role).
  const admin = getServiceClient();
  const rows = recos.map((r) => ({
    date_marche: date,
    code: r.code,
    action: r.result.action,
    conviction: r.result.conviction,
    score: r.result.score,
  }));
  const { error } = await admin.from('advisor_history').upsert(rows, { onConflict: 'date_marche,code' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ date, stored: rows.length, prevDate, flips });
}
