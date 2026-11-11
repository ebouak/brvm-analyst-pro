import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildEventReport } from '@/lib/reports';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const window = Number(req.nextUrl.searchParams.get('window') ?? '5');
  const supabase = createClient();
  const report = await buildEventReport(supabase, params.id, window);
  if (!report) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(report);
}
