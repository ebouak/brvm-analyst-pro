import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInstrumentReport } from '@/lib/reports';
import type { Period } from '@/lib/types';

export async function GET(req: NextRequest, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const period = (req.nextUrl.searchParams.get('period') ?? '3M') as Period;
  const supabase = createClient();
  const report = await buildInstrumentReport(supabase, decodeURIComponent(params.code), period);
  if (!report) return NextResponse.json({ error: 'no data' }, { status: 404 });
  return NextResponse.json(report);
}
