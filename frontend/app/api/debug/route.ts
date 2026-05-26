// GET /api/debug — endpoint temporaire de diagnostic connexion Supabase
// À supprimer après résolution du problème.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'MISSING';

  let count: number | null = null;
  let error: string | null = null;

  try {
    const supabase = createClient();
    const res = await supabase
      .from('brvm_instruments')
      .select('*', { count: 'exact', head: true });
    count = res.count;
    error = res.error?.message ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    supabase_url: url.slice(0, 40) + '…',
    key_prefix: key.slice(0, 20) + '…',
    brvm_instruments_count: count,
    supabase_error: error,
  });
}
