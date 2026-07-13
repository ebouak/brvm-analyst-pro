import 'server-only';
import { getServiceClient } from './serviceClient';
import type { CheckoutRequest, CheckoutResult, PaymentProvider } from './types';

/**
 * CinetPay — paiement Mobile Money UEMOA (Orange, MTN, Moov, Wave) + cartes.
 *
 * Flux :
 *   1. createCheckout  -> on crée la subscription `pending` + la transaction
 *                         `pending` EN BASE, puis on demande une URL de paiement
 *                         à CinetPay. L'utilisateur y est redirigé.
 *   2. l'utilisateur paie sur la page CinetPay.
 *   3. CinetPay appelle notre webhook (`notify_url`).
 *   4. le webhook RE-VÉRIFIE le paiement auprès de CinetPay, puis active.
 *
 * ── Pourquoi la transaction est créée AVANT l'appel à CinetPay ──
 * Le `transaction_id` que nous envoyons doit être le NÔTRE : c'est la seule
 * chose qui nous permettra, au retour du webhook, de savoir quel abonnement
 * activer. Le créer après serait impossible.
 *
 * ── Le montant en XOF ──
 * CinetPay exige un montant multiple de 5 pour le franc CFA. On refuse un
 * montant non conforme plutôt que de l'arrondir en silence : arrondir, c'est
 * facturer un prix que le client n'a pas vu.
 */

const API = 'https://api-checkout.cinetpay.com/v2/payment';

interface CinetPayConfig {
  apiKey: string;
  siteId: string;
  siteUrl: string;
}

/** Config lue à l'appel (jamais au chargement du module : ça casserait le build). */
export function cinetPayConfig(): CinetPayConfig | null {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) return null;
  return {
    apiKey,
    siteId,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com',
  };
}

export const cinetPayProvider: PaymentProvider = {
  code: 'cinetpay',

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const cfg = cinetPayConfig();
    if (!cfg) {
      // Échec explicite : mieux vaut un message clair qu'une redirection vers
      // une page de paiement cassée.
      return {
        ok: false,
        status: 'error',
        message: 'Paiement en ligne indisponible pour le moment. Contactez-nous.',
      };
    }

    const db = getServiceClient();

    const { data: plan, error: planErr } = await db
      .from('subscription_plans')
      .select('id, name, price_monthly, price_yearly, currency')
      .eq('code', req.planCode)
      .maybeSingle();
    if (planErr || !plan) return { ok: false, status: 'error', message: 'Plan introuvable.' };

    const amount = Number(req.cycle === 'yearly' ? plan.price_yearly : plan.price_monthly);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, status: 'error', message: 'Tarif indisponible pour ce cycle.' };
    }

    const currency = String(plan.currency ?? 'XOF');
    // Refus explicite plutôt qu'arrondi silencieux : le client doit payer le prix
    // qu'il a vu, au franc près.
    if (currency === 'XOF' && amount % 5 !== 0) {
      console.error(`cinetpay: montant ${amount} XOF non multiple de 5 (plan ${req.planCode})`);
      return {
        ok: false,
        status: 'error',
        message: 'Configuration tarifaire invalide. Contactez-nous.',
      };
    }

    // Idempotence : même règle que le provider manuel — pas de second abonnement
    // payant si un pending/active existe déjà.
    const { data: existing } = await db
      .from('subscriptions')
      .select('id, subscription_plans!inner(code)')
      .eq('user_id', req.userId)
      .in('status', ['pending', 'active'])
      .neq('subscription_plans.code', 'free')
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        ok: true,
        status: 'existing',
        subscriptionId: (existing[0] as { id: string }).id,
        message: 'Vous avez déjà un abonnement en cours.',
      };
    }

    const { data: sub, error: subErr } = await db
      .from('subscriptions')
      .insert({ user_id: req.userId, plan_id: plan.id, status: 'pending', billing_cycle: req.cycle })
      .select('id')
      .single();
    if (subErr || !sub) {
      return { ok: false, status: 'error', message: "Création de l'abonnement impossible." };
    }

    const { data: txn, error: txnErr } = await db
      .from('billing_transactions')
      .insert({
        subscription_id: sub.id,
        user_id: req.userId,
        provider: 'cinetpay',
        amount,
        currency,
        status: 'pending',
      })
      .select('id')
      .single();
    if (txnErr || !txn) {
      return { ok: false, status: 'error', message: 'Création de la transaction impossible.' };
    }

    const transactionId = String(txn.id);

    try {
      const resp = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          apikey: cfg.apiKey,
          site_id: cfg.siteId,
          transaction_id: transactionId,
          amount,
          currency,
          description: `WESTBOURSE — ${plan.name ?? req.planCode} (${req.cycle === 'yearly' ? 'annuel' : 'mensuel'})`,
          // notify_url : appelé SERVEUR à SERVEUR. C'est la seule source de vérité.
          notify_url: `${cfg.siteUrl}/api/billing/webhook/cinetpay`,
          // return_url : simple retour visuel. Un utilisateur peut l'atteindre
          // sans avoir payé (en forgeant l'URL) — on n'y active JAMAIS rien.
          return_url: `${cfg.siteUrl}/account/billing?retour=1`,
          channels: 'ALL',
          customer_email: req.email,
          metadata: JSON.stringify({ subscriptionId: sub.id, userId: req.userId }),
        }),
      });

      const json = (await resp.json()) as {
        code?: string;
        message?: string;
        data?: { payment_url?: string; payment_token?: string };
      };

      // CinetPay renvoie « 201 » (chaîne) en cas de succès.
      const url = json?.data?.payment_url;
      if (json?.code !== '201' || !url) {
        console.error('cinetpay: création refusée —', json?.code, json?.message);
        await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId);
        return {
          ok: false,
          status: 'error',
          message: 'Le paiement n’a pas pu être initialisé. Réessayez ou contactez-nous.',
        };
      }

      return {
        ok: true,
        status: 'created',
        subscriptionId: String(sub.id),
        transactionId,
        reference: transactionId,
        redirectUrl: url,
      };
    } catch (e) {
      console.error('cinetpay: appel API échoué —', (e as Error).message);
      await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId);
      return {
        ok: false,
        status: 'error',
        message: 'Service de paiement injoignable. Réessayez dans un instant.',
      };
    }
  },
};
