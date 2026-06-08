import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { user_email: string; action: 'activate' | 'deactivate' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { user_email, action } = body;
  if (!user_email || !action) {
    return NextResponse.json({ error: 'user_email and action required' }, { status: 400 });
  }

  const is_premium = action === 'activate';
  const premium_since = is_premium ? new Date().toISOString() : null;

  const { error } = await serviceClient
    .from('profiles')
    .update({ is_premium, premium_since, updated_at: new Date().toISOString() })
    .eq('email', user_email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_email, is_premium });
}
