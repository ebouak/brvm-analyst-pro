import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInstrumentReport } from '@/lib/reports';
import type { Period } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const period = (req.nextUrl.searchParams.get('period') ?? '3M') as Period;
  const supabase = createClient();
  const report = await buildInstrumentReport(supabase, decodeURIComponent(params.code), period);
  if (!report) return NextResponse.json({ error: 'no data' }, { status: 404 });
  return NextResponse.json(report);
}
