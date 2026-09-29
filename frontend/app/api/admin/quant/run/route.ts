import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabase } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  const isAdmin = (profile as {is_admin?:boolean}|null)?.is_admin || user.email==='ebouak@gmail.com';
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(()=>({}));
  const calculationDate = body.calculationDate as string | undefined;
  const dryRun = !!body.dryRun;
  const { runQuantModels } = await import('@/lib/quant/run-model');
  try{
    const res = await runQuantModels({ calculationDate, dryRun });
    return NextResponse.json({ ok: true, ...res });
  }catch(e: unknown){
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status: 500 });
  }
}
