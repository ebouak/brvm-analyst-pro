import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { signatureValide } from '@/lib/billing/chariow/regles';
import { lireVente } from '@/lib/billing/chariow/client';
import { produitParCode } from '@/lib/billing/chariow/catalogue';
import { alerterExploitant } from '@/lib/billing/chariow/alerte';
import { traiterPulse, type Deps, type StatutEvenement, type TransactionChariow } from '@/lib/billing/chariow/traiterPulse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pulses Chariow (webhooks). Contrat : chariow.dev/en/guides/pulse-security.
 *
 *   1. corps BRUT lu avant tout parsing, signature HMAC-SHA256 vérifiée à temps
 *      constant avec CHARIOW_WEBHOOK_SECRET (whsec_…) → 401 sinon ;
 *   2. `x-pulse-delivery-id` = clé d'idempotence (absent = événement de TEST
 *      du tableau de bord : accusé, rien d'écrit) ;
 *   3. traitement : lib/billing/chariow/traiterPulse.ts.
 *
 * Journaux : jamais le corps (il porte email, nom et téléphone du client).
 */

const COLS_TXN = 'id, status, amount, currency, product_code, provider_sale_id';

function versTxn(r: Record<string, unknown> | null): TransactionChariow | null {
  if (!r) return null;
  return {
    id: String(r.id),
    status: String(r.status),
    amount: Number(r.amount),
    currency: String(r.currency),
    product_code: (r.product_code as string | null) ?? null,
    provider_sale_id: (r.provider_sale_id as string | null) ?? null,
  };
}

function depsSupabase(): Deps {
  const db = getServiceClient();
  return {
    async journaliser({ deliveryId, type, saleId }) {
      const { data, error } = await db
        .from('payment_webhook_events')
        .upsert(
          { provider: 'chariow', delivery_id: deliveryId, event_type: type || 'inconnu', sale_id: saleId },
          { onConflict: 'provider,delivery_id', ignoreDuplicates: true },
        )
        .select('id');
      if (error) throw error;
      if (data && data.length > 0) return { nouveau: true, statut: 'recu' };
      const { data: ex } = await db
        .from('payment_webhook_events')
        .select('status, attempts')
        .eq('provider', 'chariow')
        .eq('delivery_id', deliveryId)
        .single();
      await db
        .from('payment_webhook_events')
        .update({ attempts: Number(ex?.attempts ?? 1) + 1 })
        .eq('provider', 'chariow')
        .eq('delivery_id', deliveryId);
      return { nouveau: false, statut: (ex?.status ?? 'recu') as StatutEvenement };
    },
    async conclure(deliveryId, statut, detail, txnId) {
      await db
        .from('payment_webhook_events')
        .update({
          status: statut,
          detail: detail ? detail.slice(0, 500) : null,
          transaction_id: txnId,
          processed_at: new Date().toISOString(),
        })
        .eq('provider', 'chariow')
        .eq('delivery_id', deliveryId);
    },
    async transactionParVente(saleId) {
      const { data } = await db
        .from('billing_transactions')
        .select(COLS_TXN)
        .eq('provider', 'chariow')
        .eq('provider_sale_id', saleId)
        .maybeSingle();
      return versTxn(data);
    },
    async transactionParId(id) {
      const { data } = await db
        .from('billing_transactions')
        .select(COLS_TXN)
        .eq('provider', 'chariow')
        .eq('id', id)
        .maybeSingle();
      return versTxn(data);
    },
    async marquerEchec(txnId) {
      await db.from('billing_transactions').update({ status: 'failed' }).eq('id', txnId).eq('status', 'pending');
    },
    async produitChariowId(code) {
      // Actif ou non : une vente conclue avant la désactivation d'un produit reste due.
      return (await produitParCode(code, false))?.chariowProductId ?? null;
    },
    lireVente,
    async accorder(txnId, saleId) {
      const { data, error } = await db.rpc('accorder_achat', { p_transaction: txnId, p_sale: saleId });
      if (error) throw error;
      return String(data);
    },
    alerter: alerterExploitant,
  };
}

export async function POST(req: Request) {
  const brut = await req.text();

  if (!signatureValide(brut, req.headers.get('x-chariow-signature'), process.env.CHARIOW_WEBHOOK_SECRET)) {
    console.warn('chariow/webhook: signature invalide ou secret absent — requête refusée');
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 });
  }

  const deliveryId = req.headers.get('x-pulse-delivery-id');
  if (!deliveryId) {
    // Événement de test envoyé depuis le tableau de bord Chariow.
    return NextResponse.json({ ok: true, test: true });
  }
  if (deliveryId.length > 200) return NextResponse.json({ error: 'identifiant invalide' }, { status: 400 });

  let payload: unknown;
  try {
    payload = JSON.parse(brut);
  } catch {
    // Signé mais illisible : réessayer ne changerait rien.
    console.error('chariow/webhook: corps signé mais non-JSON', { deliveryId });
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    const r = await traiterPulse(depsSupabase(), {
      deliveryId,
      enteteEvenement: req.headers.get('x-pulse-event'),
      payload,
    });
    console.info('chariow/webhook', { deliveryId, statut: r.statut });
    return NextResponse.json({ ok: r.http < 400, statut: r.statut }, { status: r.http });
  } catch (e) {
    // Base injoignable au journal : 500 → Chariow réessaiera (jusqu'à ~3 h).
    console.error('chariow/webhook: échec de traitement —', (e as { code?: string }).code ?? (e as Error).name);
    return NextResponse.json({ error: 'traitement impossible' }, { status: 500 });
  }
}
