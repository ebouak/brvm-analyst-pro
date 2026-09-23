// frontend/lib/formations/confirmer.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { transitionAutorisee, type StatutInscription } from './regles';

/**
 * Confirme l'encaissement d'une place de formation.
 *
 * Volontairement SÉPARÉ de `activateSubscription` : confirmer une formation ne
 * doit jamais activer un abonnement Premium par effet de bord. C'est la raison
 * d'être de la colonne `billing_transactions.objet`.
 */
export async function confirmerPlaceFormation(transactionId: string): Promise<{ ok: boolean; message: string }> {
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, status')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };
  if (txn.objet !== 'formation') return { ok: false, message: 'Cette transaction n’est pas une formation.' };

  const { data: inscription } = await db
    .from('formation_inscriptions')
    .select('id, statut')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (!inscription) return { ok: false, message: 'Aucune inscription liée à cette transaction.' };
  if (!transitionAutorisee(inscription.statut as StatutInscription, 'payee')) {
    return { ok: false, message: `Une inscription « ${inscription.statut} » ne peut pas passer à « payée ».` };
  }

  const { error: e1 } = await db
    .from('billing_transactions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (e1) return { ok: false, message: 'Mise à jour de la transaction refusée.' };

  const { error: e2 } = await db
    .from('formation_inscriptions')
    .update({ statut: 'payee' })
    .eq('id', inscription.id);
  if (e2) return { ok: false, message: 'Mise à jour de l’inscription refusée.' };

  return { ok: true, message: 'Place confirmée.' };
}

/**
 * Rejette le paiement d'une place : la transaction passe à `failed` et
 * l'inscription à `annulee`, ce qui libère la place (le déclencheur en base
 * décrémente `places_prises`).
 *
 * Sans cette fonction, le bouton « Rejeter » de la console appellerait
 * l'annulation d'ABONNEMENT sur une transaction de formation — un identifiant
 * qui ne correspond à aucun abonnement.
 */
export async function rejeterPlaceFormation(transactionId: string): Promise<{ ok: boolean; message: string }> {
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };
  if (txn.objet !== 'formation') return { ok: false, message: 'Cette transaction n’est pas une formation.' };

  const { data: inscription } = await db
    .from('formation_inscriptions')
    .select('id, statut')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  const { error: e1 } = await db.from('billing_transactions').update({ status: 'failed' }).eq('id', transactionId);
  if (e1) return { ok: false, message: 'Mise à jour de la transaction refusée.' };

  if (inscription) {
    if (!transitionAutorisee(inscription.statut as StatutInscription, 'annulee')) {
      return { ok: false, message: `Une inscription « ${inscription.statut} » ne peut plus être annulée.` };
    }
    const { error: e2 } = await db.from('formation_inscriptions').update({ statut: 'annulee' }).eq('id', inscription.id);
    if (e2) return { ok: false, message: 'Annulation de l’inscription refusée.' };
  }

  return { ok: true, message: 'Paiement rejeté, place libérée.' };
}
