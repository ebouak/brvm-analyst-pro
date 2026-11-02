import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { createClient as createSupabase } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const g = await requireAdminApi('settings.write');
  if ('error' in g) return g.error;
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
