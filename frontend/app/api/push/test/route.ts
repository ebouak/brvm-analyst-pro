import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import webpush from 'web-push';

// Configure VAPID à la première requête (singleton lazy)
let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error('Variables VAPID manquantes (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function POST() {
  try {
    ensureVapid();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Configuration VAPID invalide' },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: subs, error: dbError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id);

  if (dbError) {
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'Aucune souscription trouvée pour cet utilisateur' }, { status: 404 });
  }

  const payload = JSON.stringify({
    title: 'BRVM Analyst Pro',
    body: 'Test de notification push — tout fonctionne correctement !',
    url: '/dashboard',
    tag: 'brvm-test',
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  const ok = results.length - failed;

  return NextResponse.json({ sent: ok, failed });
}
