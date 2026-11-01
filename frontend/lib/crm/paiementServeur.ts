import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const MESSAGE_PAIEMENT_SURVENU = "Paiement confirmé à l'instant : relance annulée.";

/**
 * Dernier garde avant tout envoi (spec CRM v2 §2.1) : entre le chargement du
 * dossier et l'envoi, la personne a pu payer. Requête DIRECTE (pas le dossier
 * déjà en mémoire) : un paiement `paid` créé ou confirmé après `depuisIso`, ou
 * un compte devenu Premium, annule la relance. Échec fermé : si la vérification
 * échoue, on n'envoie rien. Sans compte (prospect), il n'y a rien à vérifier.
 * Réutilisable par les séquences automatiques (SP3).
 */
export async function verifierPaiementAvantEnvoi(userId: string | null, depuisIso: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!userId) return { ok: true };
  try {
    const sb = getServiceClient();
    const [paye, profil] = await Promise.all([
      sb.from('billing_transactions').select('id').eq('user_id', userId).eq('status', 'paid').or(`created_at.gt.${depuisIso},paid_at.gt.${depuisIso}`).limit(1),
      sb.from('profiles').select('is_premium').eq('id', userId).maybeSingle(),
    ]);
    if (paye.error || profil.error) {
      console.error('[crm] vérification du paiement impossible :', paye.error?.code ?? profil.error?.code ?? 'inconnue');
      return { ok: false, message: 'Vérification du paiement impossible : relance annulée.' };
    }
    if ((paye.data ?? []).length > 0 || profil.data?.is_premium === true) return { ok: false, message: MESSAGE_PAIEMENT_SURVENU };
    return { ok: true };
  } catch (e) {
    console.error('[crm] vérification du paiement impossible :', (e as Error).name);
    return { ok: false, message: 'Vérification du paiement impossible : relance annulée.' };
  }
}
