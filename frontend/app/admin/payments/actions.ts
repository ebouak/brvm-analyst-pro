'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { activateSubscription, cancelSubscription } from '@/lib/billing/activate';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { confirmerPlaceFormation, rejeterPlaceFormation } from '@/lib/formations/confirmer';
import { rapprocherVente } from '@/lib/billing/chariow/rapprochement';

/**
 * Achat Chariow (niveau de l'Academy ou pass) confirmé À LA MAIN — typiquement
 * quand la notification s'est perdue. Même règle que le webhook : la vente est
 * relue chez Chariow et doit concorder, sinon rien n'est accordé. Un clic
 * d'administrateur ne vaut pas preuve de paiement.
 */
async function confirmerAchatChariow(transactionId: string): Promise<{ ok: boolean; message: string }> {
  // Même rapprochement que la page de retour de paiement : une seule règle.
  const r = await rapprocherVente(transactionId);
  const MESSAGES: Record<string, string> = {
    introuvable: 'Transaction introuvable.',
    sans_vente: 'Aucune vente Chariow rattachée : rien à vérifier, rien accordé.',
    produit_inconnu: 'Produit absent du catalogue.',
    chariow_injoignable: 'Chariow injoignable : réessayez plus tard.',
    erreur_base: 'Accord impossible (base).',
  };
  const message = r.resultat.startsWith('non_conforme')
    ? `Vente non conforme chez Chariow : ${r.resultat.slice('non_conforme: '.length)}.`
    : MESSAGES[r.resultat] ?? r.resultat;
  return { ok: r.ok, message };
}

/**
 * Révoque un achat Chariow remboursé. Chariow n'émet aucun événement de
 * remboursement : c'est ici que l'accès se retire (fonction SQL
 * revoquer_achat, atomique et idempotente).
 */
export async function revoquerAchat(transactionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('billing.refund');
  const db = getServiceClient();
  const { data: t } = await db.from('billing_transactions').select('user_id').eq('id', transactionId).maybeSingle();
  const { data, error } = await db.rpc('revoquer_achat', { p_transaction: transactionId, p_motif: 'remboursement' });
  const ok = !error && ['module_revoque', 'pass_revoque', 'deja'].includes(String(data));
  await recordAudit(ctx, {
    action: 'payment.revoke',
    resourceType: 'billing_transaction',
    resourceId: transactionId,
    targetUserId: (t?.user_id as string | undefined) ?? null,
    severity: 'warning',
    metadata: { ok, resultat: error ? 'erreur' : String(data) },
  });
  revalidatePath('/admin/payments');
  return { ok, message: error ? 'Révocation impossible.' : String(data) };
}

/** user_id de l'abonnement (pour tracer la cible dans l'audit). */
async function subscriptionUserId(subscriptionId: string): Promise<string | null> {
  try {
    const { data } = await getServiceClient()
      .from('subscriptions')
      .select('user_id')
      .eq('id', subscriptionId)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Confirme un encaissement.
 *
 * L'identifiant reçu est celui de la TRANSACTION, pas celui de l'abonnement :
 * une vente de formation n'a pas d'abonnement (`subscription_id` nul), et
 * s'indexer sur lui rendait ces lignes inactionnables dans la console.
 *
 * L'objet de la transaction décide du chemin. Confirmer une formation ne doit
 * JAMAIS activer un abonnement Premium par effet de bord — quelqu'un qui paie
 * un atelier à 1 000 F deviendrait abonné.
 */
export async function confirmPayment(transactionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('subscriptions.write');
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, subscription_id')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };

  if (txn.objet === 'module' || txn.objet === 'pass') {
    const r = await confirmerAchatChariow(transactionId);
    await recordAudit(ctx, {
      action: 'payment.confirm',
      resourceType: 'billing_transaction',
      resourceId: transactionId,
      targetUserId: null,
      severity: r.ok ? 'info' : 'warning',
      metadata: { ok: r.ok, message: r.message },
    });
    revalidatePath('/admin/payments');
    return r;
  }

  if (txn.objet === 'formation') {
    const r = await confirmerPlaceFormation(transactionId);
    await recordAudit(ctx, {
      action: 'payment.confirm',
      resourceType: 'formation_inscription',
      resourceId: transactionId,
      targetUserId: null,
      severity: r.ok ? 'info' : 'warning',
      metadata: { ok: r.ok, message: r.message },
    });
    revalidatePath('/admin/payments');
    return { ok: r.ok, message: r.message };
  }

  const subscriptionId = txn.subscription_id as string | null;
  if (!subscriptionId) return { ok: false, message: 'Cette transaction n’est rattachée à aucun abonnement.' };

  const targetUserId = await subscriptionUserId(subscriptionId);
  const r = await activateSubscription(subscriptionId);
  await recordAudit(ctx, {
    action: 'payment.confirm',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    targetUserId,
    severity: r.ok ? 'info' : 'warning',
    metadata: { ok: r.ok, message: r.message ?? null },
  });
  revalidatePath('/admin/payments');
  return r;
}

/**
 * Rejette un encaissement. Même aiguillage : rejeter une formation libère la
 * place, là où annuler un abonnement inexistant n'aurait rien fait de bon.
 */
export async function rejectPayment(transactionId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('subscriptions.write');
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, subscription_id')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };

  if (txn.objet === 'module' || txn.objet === 'pass') {
    // Une intention Chariow non payée : on la ferme, rien d'autre à défaire.
    await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId).eq('status', 'pending');
    await recordAudit(ctx, {
      action: 'payment.reject',
      resourceType: 'billing_transaction',
      resourceId: transactionId,
      targetUserId: null,
      severity: 'warning',
      metadata: { ok: true },
    });
    revalidatePath('/admin/payments');
    return { ok: true };
  }

  if (txn.objet === 'formation') {
    const r = await rejeterPlaceFormation(transactionId);
    await recordAudit(ctx, {
      action: 'payment.reject',
      resourceType: 'formation_inscription',
      resourceId: transactionId,
      targetUserId: null,
      severity: 'warning',
      metadata: { ok: r.ok, message: r.message },
    });
    revalidatePath('/admin/payments');
    return { ok: r.ok, message: r.message };
  }

  const subscriptionId = txn.subscription_id as string | null;
  if (!subscriptionId) return { ok: false, message: 'Cette transaction n’est rattachée à aucun abonnement.' };

  const targetUserId = await subscriptionUserId(subscriptionId);
  const r = await cancelSubscription(subscriptionId);
  await recordAudit(ctx, {
    action: 'payment.reject',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    targetUserId,
    severity: 'warning',
    metadata: { ok: r.ok, message: r.message ?? null },
  });
  revalidatePath('/admin/payments');
  return r;
}

