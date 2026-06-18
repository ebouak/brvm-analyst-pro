import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/server/email';

/**
 * Encart « Salut, on se parle ? » — relais email vers la boîte support.
 * RGPD : minimisation. Aucune donnée persistée en base ; le message est
 * uniquement transmis par email (finalité = contact, base légale = consentement
 * par envoi volontaire). Voir docs/RGPD.md.
 */
export async function POST(req: NextRequest) {
  try {
    const { prenom = '', email = '', message = '', page = '' } = (await req.json()) as {
      prenom?: string;
      email?: string;
      message?: string;
      page?: string;
    };

    const clean = (s: string, max: number) => String(s).trim().slice(0, max);
    const p = clean(prenom, 80);
    const e = clean(email, 160);
    const m = clean(message, 1200);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }
    if (m.length < 2) {
      return NextResponse.json({ error: 'Message trop court.' }, { status: 400 });
    }

    const to = process.env.CONTACT_EMAIL_TO ?? 'ebouak@gmail.com';
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const result = await sendEmail({
      to,
      subject: `💬 Contact WESTBOURSE — ${p || 'visiteur'}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e">
          <h2 style="color:#2a8aa8">Nouveau message depuis l'encart de contact</h2>
          <p><strong>Prénom :</strong> ${esc(p) || '—'}</p>
          <p><strong>Email :</strong> ${esc(e)}</p>
          <p><strong>Page :</strong> ${esc(page) || '—'}</p>
          <p><strong>Message :</strong></p>
          <p style="white-space:pre-wrap;border-left:3px solid #56d7fd;padding-left:12px">${esc(m)}</p>
        </div>
      `,
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'Envoi indisponible pour le moment.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
