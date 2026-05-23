import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const supabase = createClient();
  const code = decodeURIComponent(params.code);
  const { data, error } = await supabase
    .from('market_events').select('*')
    .eq('instrument_code', code).order('event_date', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code, events: data ?? [] });
}
