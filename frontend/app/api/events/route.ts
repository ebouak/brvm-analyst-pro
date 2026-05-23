import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/events?type=&source=&code=&from=&to=&importance=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supabase = createClient();
  let q = supabase.from('market_events').select('*').order('event_date', { ascending: false }).limit(200);

  if (sp.get('type')) q = q.eq('event_type', sp.get('type'));
  if (sp.get('source')) q = q.eq('source_type', sp.get('source'));
  if (sp.get('code')) q = q.eq('instrument_code', sp.get('code'));
  if (sp.get('from')) q = q.gte('event_date', sp.get('from')!);
  if (sp.get('to')) q = q.lte('event_date', sp.get('to')!);
  if (sp.get('importance')) q = q.gte('importance_level', Number(sp.get('importance')));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
