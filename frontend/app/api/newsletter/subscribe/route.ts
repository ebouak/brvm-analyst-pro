import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email, source = 'landing' } = await req.json() as { email?: string; source?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }

    const supabase = createClient();

    // Upsert: si déjà inscrit, on renvoie OK sans erreur (pas de doublon visible)
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email: email.toLowerCase().trim(), source }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) {
      console.error('[newsletter] upsert error', error);
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
          subject: '📊 Bienvenue sur BRVM Analyst Pro — Confirmez votre inscription',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1a1a2e">
              <h2 style="color:#c9a227">Bienvenue sur BRVM Analyst Pro</h2>
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
