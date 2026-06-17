import { getServiceClient } from './serviceClient';
import type { CheckoutRequest, CheckoutResult, PaymentProvider } from './types';

function instructions(ref: string, amount: number, currency: string): string {
  return (
    `Demande Premium enregistrée (réf. ${ref}). ` +
    `Montant : ${amount.toLocaleString('fr-FR')} ${currency}. ` +
    `Finalisez le paiement par Mobile Money ou contactez-nous — un administrateur ` +
    `confirmera votre accès Premium sous 24 h.`
  );
}

/** Provider « manuel » : enregistre l'intention, l'admin confirme ensuite. */
export const manualProvider: PaymentProvider = {
  code: 'manual',
  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const db = getServiceClient();

    const { data: plan, error: planErr } = await db
      .from('subscription_plans')
      .select('id, price_monthly, price_yearly, currency')
      .eq('code', req.planCode)
      .maybeSingle();
    if (planErr || !plan) return { ok: false, status: 'error', message: 'Plan introuvable.' };

    const amount = req.cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    if (amount == null) {
      return { ok: false, status: 'error', message: 'Tarif indisponible pour ce cycle.' };
    }

    // Idempotence : pas de second abonnement si un pending/active PAYANT existe
    // déjà. L'abonnement « free » (trace du choix gratuit) ne bloque pas l'upgrade.
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
        subscriptionId: existing[0].id as string,
        message: 'Vous avez déjà un abonnement en cours.',
      };
    }

    const { data: sub, error: subErr } = await db
      .from('subscriptions')
      .insert({ user_id: req.userId, plan_id: plan.id, status: 'pending', billing_cycle: req.cycle })
      .select('id')
      .single();
    if (subErr || !sub) return { ok: false, status: 'error', message: "Création de l'abonnement impossible." };

    const { data: txn, error: txnErr } = await db
      .from('billing_transactions')
      .insert({
        subscription_id: sub.id,
        user_id: req.userId,
        provider: 'manual',
        amount,
        currency: plan.currency,
        status: 'pending',
      })
      .select('id')
      .single();
    if (txnErr || !txn) return { ok: false, status: 'error', message: 'Création de la transaction impossible.' };

    const ref = txn.id as string;
    return {
      ok: true,
      status: 'created',
      subscriptionId: sub.id as string,
      transactionId: ref,
      reference: ref,
      instructions: instructions(ref, Number(amount), plan.currency as string),
    };
  },
};
