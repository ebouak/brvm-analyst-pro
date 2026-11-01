import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { lireEvenement, signatureResendValide, statutsRemplacables } from '@/lib/contact/livraison';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhooks Resend : statut de livraison des réponses du formulaire de contact
 * (migration 0159). Contrat : protocole Svix — voir lib/contact/livraison.ts.
 *
 *   1. corps BRUT lu avant tout parsing ; signature vérifiée à temps constant
 *      avec RESEND_WEBHOOK_SECRET (whsec_…), horodatage à ±5 min → 401 sinon ;
 *   2. seuls les emails dont l'id figure dans contact_messages.resend_id ou
 *      crm_actions.resend_id (relances CRM, migration 0177) sont concernés ; les autres (alertes, dossiers…) sont accusés et ignorés ;
 *   3. mise à jour CONDITIONNELLE : le statut ne recule jamais. Un événement
 *      rejoué (Resend réessaie tant qu'il n'a pas reçu 2xx) ou arrivé dans le
 *      désordre ne change rien — l'opération est idempotente par construction.
 *
 * Journaux : jamais le corps (il porte l'adresse du destinataire).
 */
export async function POST(req: Request) {
  const corpsBrut = await req.text();
  const valide = signatureResendValide(
    corpsBrut,
    {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    },
    process.env.RESEND_WEBHOOK_SECRET,
  );
  if (!valide) return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });

  let corps: unknown;
  try {
    corps = JSON.parse(corpsBrut);
  } catch {
    return NextResponse.json({ error: 'Corps illisible.' }, { status: 400 });
  }

  const ev = lireEvenement(corps);
  if (!ev) return NextResponse.json({ ok: true, ignore: true });

  const remplacables = statutsRemplacables(ev.statut);
  const filtre = remplacables.length
    ? `livraison.is.null,livraison.in.(${remplacables.join(',')})`
    : 'livraison.is.null';

  // Même mise à jour monotone sur les deux journaux : réponses de contact ET relances CRM.
  // Un email_id n'existe que dans l'un des deux (ou aucun : alertes, dossiers…).
  const sb = getServiceClient();
  const maj = { livraison: ev.statut, livraison_at: new Date().toISOString(), livraison_detail: ev.detail };
  const [contact, crm] = await Promise.all([
    sb.from('contact_messages').update(maj).eq('resend_id', ev.emailId).or(filtre).select('id'),
    sb.from('crm_actions').update(maj).eq('resend_id', ev.emailId).or(filtre).select('id'),
  ]);

  const erreur = contact.error ?? crm.error;
  if (erreur) {
    // 500 : Resend réessaiera (idempotent). Aucune donnée du corps dans le journal.
    console.error('[webhook resend] mise à jour impossible :', erreur.code ?? erreur.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mis_a_jour: (contact.data ?? []).length + (crm.data ?? []).length });
}
