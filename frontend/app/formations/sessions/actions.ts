// frontend/app/formations/sessions/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { prixApplicable, placeDisponible, type SessionTarif } from '@/lib/formations/regles';

export interface ResultatReservation {
  ok: boolean;
  message: string;
}

/**
 * Réserve une place. Exige un compte : c'est ce qui fait de la formation un
 * moteur d'acquisition plutôt qu'une liste de contacts.
 *
 * L'ordre compte : on crée la transaction AVANT l'inscription, pour qu'une
 * inscription ne puisse jamais exister sans trace d'encaissement attendu.
 * Si l'inscription échoue (séance pleine : la contrainte de base tranche), la
 * transaction est supprimée — sinon elle traînerait dans /admin/payments.
 */
export async function reserverPlace(sessionId: string): Promise<ResultatReservation> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: 'Connectez-vous pour réserver une place.' };

  const db = getServiceClient();
  const { data: session } = await db
    .from('formation_sessions')
    .select('id, titre, prix, prix_abonne, places, places_prises, statut')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { ok: false, message: 'Séance introuvable.' };
  if (!placeDisponible(session as unknown as SessionTarif)) {
    return { ok: false, message: 'Cette séance est complète ou n’est plus ouverte.' };
  }

  const { data: profil } = await db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  const montant = prixApplicable(session as unknown as SessionTarif, Boolean(profil?.is_premium));
  if (montant == null) return { ok: false, message: 'Tarif indisponible pour cette séance.' };

  const { data: deja } = await db
    .from('formation_inscriptions')
    .select('id, statut')
    .eq('session_id', sessionId).eq('user_id', user.id).maybeSingle();
  if (deja && deja.statut !== 'annulee') return { ok: false, message: 'Vous êtes déjà inscrit à cette séance.' };

  const { data: txn, error: errTxn } = await db
    .from('billing_transactions')
    .insert({
      user_id: user.id, subscription_id: null, objet: 'formation',
      provider: 'manual', status: 'pending', amount: montant, currency: 'XOF',
    })
    .select('id').single();
  if (errTxn || !txn) return { ok: false, message: 'Réservation impossible pour le moment.' };

  const { error: errIns } = await db
    .from('formation_inscriptions')
    .insert({ session_id: sessionId, user_id: user.id, statut: 'reservee', transaction_id: txn.id });
  if (errIns) {
    await db.from('billing_transactions').delete().eq('id', txn.id);
    return { ok: false, message: 'Cette séance vient d’être complète.' };
  }

  revalidatePath('/formations/sessions');
  revalidatePath('/account/formations');
  return { ok: true, message: 'Place réservée. Elle sera confirmée dès réception du paiement.' };
}
