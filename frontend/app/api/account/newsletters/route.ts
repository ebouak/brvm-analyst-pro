// GET  /api/account/newsletters  — lit les préférences
// PUT  /api/account/newsletters  — sauvegarde les préférences
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface NewsletterPrefs {
  weekly_commodity: boolean;
  daily_market: boolean;
  signals_digest: boolean;
  events_digest: boolean;
}

const DEFAULTS: NewsletterPrefs = {
  weekly_commodity: false,
  daily_market: false,
  signals_digest: false,
  events_digest: false,
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('newsletter_topic_preferences')
    .select('weekly_commodity, daily_market, signals_digest, events_digest')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prefs: NewsletterPrefs = data
    ? {
        weekly_commodity: Boolean(data.weekly_commodity),
        daily_market: Boolean(data.daily_market),
        signals_digest: Boolean(data.signals_digest),
        events_digest: Boolean(data.events_digest),
      }
    : DEFAULTS;

  return NextResponse.json(prefs);
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const prefs: NewsletterPrefs = {
    weekly_commodity: Boolean(b.weekly_commodity),
    daily_market: Boolean(b.daily_market),
    signals_digest: Boolean(b.signals_digest),
    events_digest: Boolean(b.events_digest),
  };

  const { error } = await supabase
    .from('newsletter_topic_preferences')
    .upsert(
      { user_id: user.id, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
