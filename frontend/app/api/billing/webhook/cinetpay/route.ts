import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { activateSubscription } from '@/lib/billing/activate';
import { cinetPayConfig } from '@/lib/billing/cinetPayProvider';

export const dynamic = 'force-dynamic';

/**
 * Webhook CinetPay (`notify_url`). C'est LA porte d'entrée de l'argent — et donc
 * la cible la plus attaquée de l'application.
 *
 * ── Trois règles, chacune protège d'une attaque réelle ──
 *
 * 1. NE JAMAIS CROIRE LE CORPS DE LA REQUÊTE.
 *    N'importe qui peut POSTer ici `{status: "ACCEPTED", amount: 50000}`. On
 *    RAPPELLE CinetPay (`/v2/payment/check`) pour lui demander l'état réel de la
 *    transaction. Seule cette réponse fait foi. Le corps ne sert qu'à savoir
 *    QUELLE transaction vérifier.
 *
 * 2. VÉRIFIER LE MONTANT PAYÉ CONTRE CELUI ATTENDU.
 *    Sans ce contrôle, un attaquant paie 5 FCFA pour un abonnement à 25 000 :
 *    la transaction est authentiquement « ACCEPTED » chez CinetPay, la signature
 *    est valide… et il obtient le Premium. Le montant est le seul rempart.
 *
 * 3. IDEMPOTENCE.
 *    CinetPay réémet ses notifications (retries, doublons réseau). Or
 *    `activateSubscription` réécrit `renews_at` : rejouée, elle PROLONGERAIT
 *    l'abonnement gratuitement. On sort donc immédiatement si la transaction est
 *    déjà `paid`.
 *
 * On répond TOUJOURS 200 après traitement — même sur refus. Un non-200 pousse
 * CinetPay à réessayer en boucle, ce qui n'apporte rien sur un rejet définitif.
 */

const CHECK_API = 'https://api-checkout.cinetpay.com/v2/payment/check';

/** Vérifie le HMAC `x-token` envoyé par CinetPay. */
function verifySignature(raw: string, token: string | null, secret: string | undefined): boolean {
  // Sans secret configuré, on NE PEUT PAS authentifier l'appelant. On refuse :
  // la vérification auprès de CinetPay (règle 1) resterait notre filet, mais un
  // webhook non signé ouvre la porte au rejeu et au déni de service.
  if (!secret || !token) return false;
  try {
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(token, 'utf8');
    // Comparaison à temps constant : une comparaison naïve fuit le secret,
    // caractère par caractère, par mesure du temps de réponse.
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const cfg = cinetPayConfig();
  if (!cfg) {
    console.error('cinetpay/webhook: provider non configuré');
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const raw = await req.text();
  const token = req.headers.get('x-token');

  if (!verifySignature(raw, token, process.env.CINETPAY_SECRET_KEY)) {
    console.error('cinetpay/webhook: signature invalide — requête ignorée');
    // 403 ici : ce n'est PAS une notification légitime, inutile que CinetPay
    // (ou l'attaquant) croie qu'on a accepté.
    return NextResponse.json({ error: 'signature invalide' }, { status: 403 });
  }

  // Le corps est en form-urlencoded.
  const body = new URLSearchParams(raw);
  const transactionId = body.get('cpm_trans_id');
  if (!transactionId) {
    console.error('cinetpay/webhook: cpm_trans_id absent');
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, subscription_id, user_id, amount, currency, status')
    .eq('id', transactionId)
    .maybeSingle();

  if (!txn) {
    console.error('cinetpay/webhook: transaction inconnue', transactionId);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  // RÈGLE 3 — déjà traitée. On sort AVANT toute écriture.
  if (txn.status === 'paid') {
    return NextResponse.json({ ok: true, deja_traite: true }, { status: 200 });
  }

  // RÈGLE 1 — on demande à CinetPay l'état RÉEL. Le corps du webhook ne prouve rien.
  let check: { code?: string; data?: { status?: string; amount?: number | string; currency?: string } };
  try {
    const resp = await fetch(CHECK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        apikey: cfg.apiKey,
        site_id: cfg.siteId,
        transaction_id: transactionId,
      }),
    });
    check = (await resp.json()) as typeof check;
  } catch (e) {
    console.error('cinetpay/webhook: vérification impossible —', (e as Error).message);
    // 500 : ici un RETRY de CinetPay est souhaitable — le paiement est peut-être
    // valide, c'est NOTRE vérification qui a échoué. On ne veut pas perdre un
    // paiement réel sur une panne réseau passagère.
    return NextResponse.json({ error: 'verification indisponible' }, { status: 500 });
  }

  const statut = check?.data?.status;
  if (statut !== 'ACCEPTED') {
    console.warn('cinetpay/webhook: paiement non accepté', { transactionId, statut });
    await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId);
    return NextResponse.json({ ok: true, statut }, { status: 200 });
  }

  // RÈGLE 2 — le montant payé doit correspondre à celui attendu. Sans ce contrôle,
  // payer 5 FCFA suffirait à décrocher un abonnement à 25 000.
  const paye = Number(check?.data?.amount);
  const attendu = Number(txn.amount);
  if (!Number.isFinite(paye) || paye < attendu) {
    console.error('cinetpay/webhook: MONTANT INSUFFISANT', { transactionId, paye, attendu });
    await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId);
    return NextResponse.json({ ok: true, motif: 'montant insuffisant' }, { status: 200 });
  }

  const devise = String(check?.data?.currency ?? '');
  if (devise && devise !== String(txn.currency)) {
    // Payer 25 000 dans une devise faible ne vaut pas 25 000 XOF.
    console.error('cinetpay/webhook: DEVISE INATTENDUE', { transactionId, devise, attendu: txn.currency });
    await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId);
    return NextResponse.json({ ok: true, motif: 'devise inattendue' }, { status: 200 });
  }

  const r = await activateSubscription(String(txn.subscription_id));
  if (!r.ok) {
    console.error('cinetpay/webhook: activation échouée —', r.message);
    // 500 : le paiement EST valide et vérifié. Un retry de CinetPay nous donne
    // une seconde chance d'activer — sinon le client a payé pour rien.
    return NextResponse.json({ error: 'activation echouee' }, { status: 500 });
  }

  console.info('cinetpay/webhook: abonnement activé', { transactionId, subscription: txn.subscription_id });
  return NextResponse.json({ ok: true }, { status: 200 });
}
