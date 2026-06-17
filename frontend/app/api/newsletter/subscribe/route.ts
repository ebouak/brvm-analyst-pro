import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service_role (bypasses RLS); fall back to anon if unavailable
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars manquantes');
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
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

    // Envoi email de confirmation via Resend (optionnel — dégrade gracieusement)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.ALERTS_EMAIL_FROM ?? 'noreply@brvm.resend.dev',
          to: email,
          subject: '📊 Bienvenue sur WESTBOURSE — Confirmez votre inscription',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1a1a2e">
              <h2 style="color:#c9a227">Bienvenue sur WESTBOURSE</h2>
              <p>Vous êtes bien inscrit(e) à notre newsletter hebdomadaire sur les marchés BRVM.</p>
              <p>Vous recevrez chaque semaine :</p>
              <ul>
                <li>Le résumé de marché (top hausses/baisses)</li>
                <li>Les signaux d'opportunité détectés</li>
                <li>La note de conjoncture</li>
              </ul>
              <p style="color:#888;font-size:12px">Pour vous désabonner, répondez à cet email.</p>
            </div>
          `,
        }),
      }).catch(() => null); // Ne bloque pas si Resend KO
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
