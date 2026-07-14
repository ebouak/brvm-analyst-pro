import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewsletterPrefsClient } from './NewsletterPrefsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Préférences newsletter' };

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

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data } = await supabase
    .from('newsletter_topic_preferences')
    .select('weekly_commodity, daily_market, signals_digest, events_digest')
    .eq('user_id', user.id)
    .maybeSingle();

  const initial: NewsletterPrefs = data
    ? {
        weekly_commodity: Boolean(data.weekly_commodity),
        daily_market: Boolean(data.daily_market),
        signals_digest: Boolean(data.signals_digest),
        events_digest: Boolean(data.events_digest),
      }
    : DEFAULTS;

  return <NewsletterPrefsClient initial={initial} />;
}
