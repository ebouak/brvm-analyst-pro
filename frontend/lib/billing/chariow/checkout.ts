import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { prixDuCycle } from '@/lib/billing/dates';
import { niveauxAchetes, niveauxARemettreAJour } from '@/lib/server/academyAccess';
import { produitParCode } from './catalogue';
import { chariowConfigure, ErreurChariow, initierCheckout } from './client';
import type { CorpsCheckout } from './regles';

/**
 * Démarre un achat Chariow pour l'utilisateur de la SESSION.
 *
 * Ordre, et pourquoi :
 *   1. le produit est lu au catalogue serveur — prix, devise, identifiant
 *      Chariow ne viennent jamais du navigateur ;
 *   2. la transaction `pending` est créée AVANT l'appel à Chariow : son id
 *      voyage dans `custom_metadata` et dans l'URL de retour ;
 *   3. l'identifiant de vente `sal_…` renvoyé par Chariow est rangé sur la
 *      transaction : c'est lui que le webhook retrouvera.
 * Rien n'est accordé ici. Seul le webhook, après relecture de la vente, accorde.
 */

export type ResultatAchat =
  | { ok: true; url: string; transactionId: string }
  | { ok: false; statut: number; message: string };

/** Au-delà, on soupçonne un script ou un double clic frénétique. */
const MAX_INTENTIONS_PAR_HEURE = 6;

export function urlApp(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com').replace(
    /\/+$/,
    '',
  );
}

export async function demarrerAchat(args: {
  userId: string;
  email: string;
  corps: CorpsCheckout;
  ip: string | null;
}): Promise<ResultatAchat> {
  const { userId, email, corps, ip } = args;
  if (!chariowConfigure()) {
    return { ok: false, statut: 503, message: 'Le paiement en ligne est momentanément indisponible.' };
  }
  if (!email) return { ok: false, statut: 400, message: 'Votre compte n’a pas d’adresse email.' };

  const produit = await produitParCode(corps.productCode);
  if (!produit) return { ok: false, statut: 404, message: 'Cette offre n’est pas disponible.' };

  const db = getServiceClient();

  // ── Garde-fous propres au type de produit ──
  if (produit.kind === 'pass') {
    // Le prix affiché sur /pricing vient de subscription_plans : le pass doit
    // coûter EXACTEMENT la même chose, sinon on encaisserait un autre prix que
    // celui que le client a lu.
    const { data: plan } = await db
      .from('subscription_plans')
      .select('price_monthly, price_quarterly, price_yearly, currency')
      .eq('code', produit.planCode ?? '')
      .maybeSingle();
    const prixPlan = plan && produit.cycle ? prixDuCycle(plan, produit.cycle) : null;
    if (prixPlan == null || prixPlan !== produit.montant || (plan?.currency ?? 'XOF') !== produit.devise) {
      console.error('chariow/checkout: prix du pass ≠ subscription_plans', { code: produit.productCode });
      return { ok: false, statut: 409, message: 'Configuration tarifaire invalide. Contactez-nous.' };
    }
  } else if (produit.niveau) {
    const possedes = await niveauxAchetes(userId);
    if (possedes.has(produit.niveau)) {
      return { ok: false, statut: 409, message: 'Vous avez déjà accès à ce niveau.' };
    }
    if (produit.kind === 'upgrade' && !(await niveauxARemettreAJour(userId)).has(produit.niveau)) {
      // Le prix réduit est réservé aux acheteurs rattrapés par une refonte.
      return { ok: false, statut: 403, message: 'Ce tarif est réservé aux acheteurs de la version précédente.' };
    }
  }

  // ── Anti-emballement ──
  const depuis = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', 'chariow')
    .gte('created_at', depuis);
  if ((count ?? 0) >= MAX_INTENTIONS_PAR_HEURE) {
    return { ok: false, statut: 429, message: 'Trop de tentatives. Réessayez dans une heure.' };
  }

  const { data: txn, error: txnErr } = await db
    .from('billing_transactions')
    .insert({
      user_id: userId,
      provider: 'chariow',
      objet: produit.kind === 'pass' ? 'pass' : 'module',
      product_code: produit.productCode,
      amount: produit.montant,
      currency: produit.devise,
      status: 'pending',
    })
    .select('id')
    .single();
  if (txnErr || !txn) {
    console.error('chariow/checkout: création de transaction impossible —', txnErr?.code);
    return { ok: false, statut: 500, message: 'Impossible de préparer le paiement.' };
  }
  const transactionId = String(txn.id);
  const echouer = async () => {
    await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId).eq('status', 'pending');
  };

  try {
    const r = await initierCheckout({
      product_id: produit.chariowProductId,
      email,
      first_name: corps.firstName,
      last_name: corps.lastName,
      phone: { number: corps.phone.number, country_code: corps.phone.countryCode },
      // Simple retour visuel : cette page n'accorde JAMAIS rien.
      redirect_url: `${urlApp()}/paiement/succes?txn=${transactionId}`,
      custom_metadata: { txn: transactionId, code: produit.productCode },
      ...(ip ? { customer_ip: ip } : {}),
    });

    if (r.step === 'already_purchased') {
      await echouer();
      return {
        ok: false,
        statut: 409,
        message: 'Chariow indique que ce produit a déjà été acheté avec cette adresse. Contactez-nous si l’accès manque.',
      };
    }
    const saleId = r.purchase?.id;
    const url = r.payment?.checkout_url;
    if (r.step !== 'payment' || !saleId || !url) {
      await echouer();
      console.error('chariow/checkout: réponse inattendue', { step: r.step, vente: Boolean(saleId), url: Boolean(url) });
      return { ok: false, statut: 502, message: 'Le paiement n’a pas pu être initialisé.' };
    }

    const { error: majErr } = await db
      .from('billing_transactions')
      .update({ provider_sale_id: saleId })
      .eq('id', transactionId);
    if (majErr) {
      // On ne laisse pas partir le client vers un paiement qu'on ne saurait
      // pas relier à sa commande : on s'arrête là.
      await echouer();
      console.error('chariow/checkout: rattachement de la vente impossible —', majErr.code);
      return { ok: false, statut: 500, message: 'Impossible de préparer le paiement.' };
    }

    return { ok: true, url, transactionId };
  } catch (e) {
    await echouer();
    if (e instanceof ErreurChariow) {
      console.error('chariow/checkout: refus Chariow', { statut: e.statut, message: e.message });
      if (e.statut === 422) {
        return { ok: false, statut: 422, message: 'Vérifiez vos informations (nom, téléphone, pays).' };
      }
      if (e.transitoire) {
        return { ok: false, statut: 503, message: 'Service de paiement injoignable. Réessayez dans un instant.' };
      }
    } else {
      console.error('chariow/checkout: erreur', (e as Error).name);
    }
    return { ok: false, statut: 502, message: 'Le paiement n’a pas pu être initialisé.' };
  }
}
