import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSectorReport } from '@/lib/reports';
import type { Period } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: { sector: string } }) {
  const period = (req.nextUrl.searchParams.get('period') ?? '3M') as Period;
  const supabase = createClient();
  const report = await buildSectorReport(supabase, decodeURIComponent(params.sector), period);
  if (!report) return NextResponse.json({ error: 'no data' }, { status: 404 });
  return NextResponse.json(report);
}
