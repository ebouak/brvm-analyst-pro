import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { lireVente } from './client';
import { produitParCode } from './catalogue';
import { verifierVente } from './regles';

/**
 * Rapproche UNE transaction de sa vente Chariow, sans attendre le webhook.
 *
 * Constat du 2026-10-19 : vente « Terminée » chez Chariow, mais aucun Pulse
 * reçu — l'achat restait « en attente » chez nous. Le webhook reste la voie
 * normale ; ce rapprochement est le filet : la vente est RELUE chez Chariow
 * (GET /sales/{id}) et doit concorder exactement comme pour le webhook —
 * statut terminé, même produit que le catalogue, même devise, montant au moins
 * égal. Rien de ce qui vient du navigateur n'entre dans la décision.
 * accorder_achat est idempotent : rapprochement et webhook peuvent se croiser
 * sans jamais accorder deux fois.
 */
export async function rapprocherVente(transactionId: string): Promise<{ ok: boolean; resultat: string }> {
  const db = getServiceClient();
  const { data: t } = await db
    .from('billing_transactions')
    .select('id, provider, status, provider_sale_id, product_code, amount, currency')
    .eq('id', transactionId)
    .maybeSingle();
  if (!t) return { ok: false, resultat: 'introuvable' };
  if (t.status === 'paid') return { ok: true, resultat: 'deja' };
  if (t.provider !== 'chariow' || !t.provider_sale_id || !t.product_code) return { ok: false, resultat: 'sans_vente' };

  const produit = await produitParCode(String(t.product_code), false);
  if (!produit) return { ok: false, resultat: 'produit_inconnu' };

  let vente;
  try {
    vente = await lireVente(String(t.provider_sale_id));
  } catch {
    return { ok: false, resultat: 'chariow_injoignable' };
  }
  const v = verifierVente(vente, {
    saleId: String(t.provider_sale_id),
    chariowProductId: produit.chariowProductId,
    montant: Number(t.amount),
    devise: String(t.currency),
  });
  if (!v.ok) return { ok: false, resultat: `non_conforme: ${v.motif}` };

  const { data, error } = await db.rpc('accorder_achat', {
    p_transaction: transactionId,
    p_sale: String(t.provider_sale_id),
  });
  if (error) return { ok: false, resultat: 'erreur_base' };
  const r = String(data);
  return { ok: ['module_accorde', 'pass_accorde', 'deja'].includes(r), resultat: r };
}
