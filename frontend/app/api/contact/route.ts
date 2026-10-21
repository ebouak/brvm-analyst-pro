import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCUSE_FENETRE_SECONDES, accuseReception, normaliserEmail } from '@/lib/contact/accuse';
import { sendEmail } from '@/lib/server/email';
import { checkRateLimit, getClientIp } from '@/lib/server/rateLimit';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Encart « Salut, on se parle ? » — relais email vers la boîte support, puis
 * accusé de réception au visiteur (texte fixe, voir lib/contact/accuse.ts).
 * RGPD : le message est conservé dans `contact_messages` (migration 0158,
 * service_role seul) pour qu'il reçoive une réponse — finalité : répondre à la
 * demande ; conservation 12 mois après la dernière activité. Une empreinte
 * SHA-256 de l'adresse est aussi écrite dans rate_limit_hits pour limiter les
 * accusés (purgée après 24 h). Aucun contenu de message n'est journalisé.
 * Voir docs/RGPD.md.
 */
export async function POST(req: NextRequest) {
  try {
    const { allowed } = await checkRateLimit({
      route: 'contact', ip: getClientIp(req), maxHits: 5, windowSeconds: 600,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 });
    }

    const { prenom = '', email = '', message = '', page = '' } = (await req.json()) as {
      prenom?: string;
      email?: string;
      message?: string;
      page?: string;
    };

    // Champs mono-ligne (prénom, email, page) : retire TOUT caractère de
    // contrôle, CR/LF inclus — défense en profondeur contre l'injection
    // d'en-têtes email via le sujet. Le message autorise les retours-ligne
    // mais retire les autres caractères de contrôle.
    // eslint-disable-next-line no-control-regex
    const stripCtl = (s: string) => String(s).replace(/[\x00-\x1f\x7f]/g, ' ');
    // eslint-disable-next-line no-control-regex
    const stripCtlKeepNl = (s: string) => String(s).replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ');
    const oneLine = (s: string, max: number) => stripCtl(s).trim().slice(0, max);

    const p = oneLine(prenom, 80);
    const e = oneLine(email, 160);
    const pageLabel = oneLine(page, 200);
    const m = stripCtlKeepNl(String(message)).trim().slice(0, 1200);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }
    if (m.length < 2) {
      return NextResponse.json({ error: 'Message trop court.' }, { status: 400 });
    }

    const to = process.env.CONTACT_EMAIL_TO ?? 'ebouak@gmail.com';
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Conservé AVANT l'envoi : sans trace en base, 4 visiteurs sur 7 n'ont
    // jamais eu la réponse promise (relevé du 2026-10-21). Un échec
    // d'enregistrement ne bloque pas l'email — le message ne se perd jamais à
    // cause de la base — mais l'email le signale.
    let messageId: string | null = null;
    try {
      const { data, error } = await getServiceClient()
        .from('contact_messages')
        .insert({ prenom: p || null, email: normaliserEmail(e), page: pageLabel || null, message: m })
        .select('id')
        .single();
      if (error) console.warn('[contact] message non enregistré :', error.code ?? error.message);
      else messageId = (data as { id: string }).id;
    } catch (err) {
      console.warn('[contact] message non enregistré :', (err as Error).message);
    }
    const lienConsole = messageId
      ? `<p><a href="https://www.westbourse.com/admin/contact/${messageId}" style="color:#2a8aa8;font-weight:bold">Répondre depuis la console →</a></p>`
      : `<p style="color:#b42318"><strong>Non enregistré en base</strong> — répondez depuis cet email.</p>`;

    const result = await sendEmail({
      to,
      // « Répondre » dans la boîte support écrit directement au visiteur.
      replyTo: e,
      subject: `💬 Contact WESTBOURSE — ${p || 'visiteur'}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e">
          <h2 style="color:#2a8aa8">Nouveau message depuis l'encart de contact</h2>
          ${lienConsole}
          <p><strong>Prénom :</strong> ${esc(p) || '—'}</p>
          <p><strong>Email :</strong> ${esc(e)}</p>
          <p><strong>Page :</strong> ${esc(pageLabel) || '—'}</p>
          <p><strong>Message :</strong></p>
          <p style="white-space:pre-wrap;border-left:3px solid #56d7fd;padding-left:12px">${esc(m)}</p>
        </div>
      `,
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'Envoi indisponible pour le moment.' }, { status: 502 });
    }

    // Accusé de réception — seulement si le message est bien parti au support
    // (sinon on promettrait une réponse à un message perdu), et au plus un par
    // adresse et par 24 h. La clé de limite est une empreinte de l'adresse :
    // l'adresse elle-même n'est jamais écrite en base. Son échec ne fait pas
    // échouer la requête (le message, lui, est arrivé) et n'est journalisé
    // qu'avec la raison, jamais avec l'adresse.
    const cle = createHash('sha256').update(`contact-accuse:${normaliserEmail(e)}`).digest('hex');
    const { allowed: accuseAutorise } = await checkRateLimit({
      route: 'contact-accuse', ip: cle, maxHits: 1, windowSeconds: ACCUSE_FENETRE_SECONDES,
    });
    if (accuseAutorise) {
      const accuse = await sendEmail({ to: e, ...accuseReception() });
      if (!accuse.ok) console.warn('[contact] accusé de réception non envoyé :', accuse.error);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
