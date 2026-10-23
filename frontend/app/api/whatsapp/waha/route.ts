import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { estConversationPrivee, lireEvenementWaha, verifierSignatureWaha } from '@/lib/whatsapp/waha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhooks de la passerelle WhatsApp non officielle (WAHA, serveur westbourse-wa).
 * Spec : docs/superpowers/specs/2026-10-23-whatsapp-passerelle-design.md §5.
 *
 *   1. corps BRUT lu avant tout parsing ; HMAC-SHA512 vérifié à temps constant
 *      (en-tête X-Webhook-Hmac, clé WAHA_WEBHOOK_HMAC_KEY) → 401 sinon ;
 *   2. session.status hors WORKING → alerte Telegram immédiate : une passerelle
 *      non officielle peut se déconnecter ou être bannie sans autre signal ;
 *   3. message → seules les conversations privées d'un tiers ; déduplication par
 *      identifiant (WAHA réessaie sans accusé). En P0, simple accusé : le
 *      traitement (contact, agent) arrive en P1/P2 — rien n'est stocké ici.
 *
 * Journaux : jamais le corps, ni le texte, ni l'expéditeur.
 */

const FENETRE_DEDUP_S = 60 * 60;
/** États normaux d'une session qui démarre ou fonctionne : pas d'alerte. */
const ETATS_SAINS = new Set(['WORKING', 'STARTING']);

async function dejaTraite(idMessage: string): Promise<boolean> {
  // L'identifiant WAHA contient le numéro de l'expéditeur : on n'en garde qu'une empreinte.
  const secret = process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha';
  const cle = createHmac('sha256', secret).update(idMessage).digest('hex');
  const { allowed } = await checkRateLimit({ route: 'waha-msg-dedupe', ip: cle, maxHits: 1, windowSeconds: FENETRE_DEDUP_S });
  return !allowed;
}

export async function POST(req: Request) {
  const corpsBrut = await req.text();
  if (!verifierSignatureWaha(corpsBrut, req.headers.get('x-webhook-hmac'), process.env.WAHA_WEBHOOK_HMAC_KEY)) {
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = JSON.parse(corpsBrut);
  } catch {
    return NextResponse.json({ error: 'Corps illisible.' }, { status: 400 });
  }

  const ev = lireEvenementWaha(corps);
  if (!ev) return NextResponse.json({ ok: true, ignore: true });

  if (ev.type === 'session.status') {
    if (!ETATS_SAINS.has(ev.statut)) {
      await alerterExploitant(
        `session « ${ev.session ?? '?'} » au statut ${ev.statut}. Déconnexion ou bannissement possible : ` +
          `vérifier https://wa.westbourse.com (et relancer l'association si besoin).`,
        '📵 WhatsApp',
      );
    }
    return NextResponse.json({ ok: true });
  }

  // Message : ni nos propres envois, ni groupes, statuts ou Chaînes.
  if (ev.deMoi || !estConversationPrivee(ev.de)) return NextResponse.json({ ok: true, ignore: true });
  if (await dejaTraite(ev.id)) return NextResponse.json({ ok: true, doublon: true });

  // P0 : réception prouvée, aucun traitement ni stockage. P1 branchera ici le contact.
  return NextResponse.json({ ok: true, recu: true });
}
