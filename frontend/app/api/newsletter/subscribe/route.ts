import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/server/rateLimit';
import { sendEmail } from '@/lib/server/email';
import { siteUrl } from '@/lib/email/templates';
import { buildConfirmEmailHtml, CONFIRM_SUBJECT } from '@/lib/newsletter/confirmEmail';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service_role (bypasses RLS); fall back to anon if unavailable
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars manquantes');
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const { allowed } = await checkRateLimit({
      route: 'newsletter-subscribe', ip: getClientIp(req), maxHits: 5, windowSeconds: 600,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 });
    }

    const { email, source = 'landing' } = await req.json() as { email?: string; source?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Insert simple ; un doublon (déjà inscrit) est traité comme un succès.
    // On évite l'upsert ON CONFLICT qui déclenche la policy RLS UPDATE et
    // échoue côté clé anon (fallback sans service_role).
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: email.toLowerCase().trim(), source });

    if (error && error.code !== '23505') {
      console.error('[newsletter] insert error', JSON.stringify(error));
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }

    // Jeton de confirmation : relu séparément (l'insert ne renvoie rien sous la
    // clé anon, faute de policy SELECT). Un doublon déjà confirmé ne reçoit pas
    // de second email — il n'a rien à confirmer.
    const { data: ligne } = await supabase
      .from('newsletter_subscribers')
      .select('confirm_token, confirmed')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    if (!ligne) {
      console.error('[newsletter] jeton de confirmation illisible (clé anon ?) — email non envoyé');
      return NextResponse.json({ ok: true });
    }
    if (ligne.confirmed) return NextResponse.json({ ok: true });
    const base = siteUrl();

    // Email de confirmation via le canal commun (lib/server/email) : même
    // expéditeur (ALERTS_EMAIL_FROM), même clé (table api_keys puis env) que
    // le reste du site. L'ancien appel direct portait son propre repli
    // `noreply@brvm.resend.dev`, jamais vérifié chez Resend : 403 garanti si la
    // variable manquait, et l'échec était avalé. L'inscription reste acquise
    // même si l'email échoue — mais l'échec est désormais journalisé.
    const envoi = await sendEmail({
      to: email,
      subject: CONFIRM_SUBJECT,
      html: buildConfirmEmailHtml({
        confirmUrl: `${base}/api/newsletter/confirm?token=${ligne.confirm_token}`,
        unsubscribeUrl: `${base}/api/newsletter/unsubscribe?token=${ligne.confirm_token}`,
      }),
    }).catch((e: unknown) => ({ ok: false, sent: 0, error: (e as Error).message }));
    if (!envoi.ok) console.error('[newsletter] email de confirmation non envoyé :', envoi.error);
    else {
      // Départ de la fenêtre de rétention (30 j, migration 0133) : seul un
      // envoi réussi la déclenche.
      await supabase.from('newsletter_subscribers')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('confirm_token', ligne.confirm_token);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
