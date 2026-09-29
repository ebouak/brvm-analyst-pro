import { estEvenementVente, lirePulse, verifierVente, type VenteChariow } from './regles';

/**
 * Traitement d'un Pulse Chariow DÉJÀ AUTHENTIFIÉ (signature vérifiée par la
 * route). Toutes les I/O passent par `Deps` : la logique est testée avec des
 * doublures en mémoire (tests/chariow-webhook.test.ts).
 *
 * Garanties :
 *   - IDEMPOTENCE : une livraison (x-pulse-delivery-id) déjà menée à terme
 *     n'écrit plus rien ; l'accord lui-même est idempotent en SQL (verrou +
 *     statut `paid`), donc deux livraisons DISTINCTES de la même vente
 *     n'accordent qu'une fois.
 *   - ORDRE : un `failed`/`abandoned` arrivé après un `successful` ne
 *     rétrograde jamais une transaction payée.
 *   - VÉRITÉ : rien n'est accordé sur la foi du corps ; la vente est relue
 *     chez Chariow et comparée au catalogue.
 *   - RETRY : 500 seulement quand réessayer peut réussir (Chariow ou la base
 *     momentanément indisponibles). Un refus définitif répond 200.
 */

export type StatutEvenement = 'recu' | 'traite' | 'ignore' | 'orphelin' | 'rejete' | 'a_verifier' | 'erreur';
const TERMINAUX: StatutEvenement[] = ['traite', 'ignore', 'orphelin', 'rejete', 'a_verifier'];

export interface TransactionChariow {
  id: string;
  status: string;
  amount: number;
  currency: string;
  product_code: string | null;
  provider_sale_id: string | null;
}

export interface Deps {
  /** Enregistre la livraison ; renvoie son statut si elle existait déjà. */
  journaliser(ev: { deliveryId: string; type: string; saleId: string | null }): Promise<{ nouveau: boolean; statut: StatutEvenement }>;
  conclure(deliveryId: string, statut: StatutEvenement, detail: string | null, txnId: string | null): Promise<void>;
  transactionParVente(saleId: string): Promise<TransactionChariow | null>;
  transactionParId(id: string): Promise<TransactionChariow | null>;
  /** pending → failed, et SEULEMENT depuis pending. */
  marquerEchec(txnId: string): Promise<void>;
  produitChariowId(productCode: string): Promise<string | null>;
  /** Relit la vente ; lève { transitoire } en cas d'échec. */
  lireVente(saleId: string): Promise<VenteChariow>;
  /** accorder_achat(p_transaction, p_sale) — idempotent. */
  accorder(txnId: string, saleId: string): Promise<string>;
  alerter(texte: string): Promise<void>;
}

export interface Reponse {
  http: number;
  statut: StatutEvenement | 'deja';
}

export async function traiterPulse(
  deps: Deps,
  entree: { deliveryId: string; enteteEvenement: string | null; payload: unknown },
): Promise<Reponse> {
  const lu = lirePulse(entree.payload, entree.enteteEvenement);
  const { nouveau, statut: precedent } = await deps.journaliser({
    deliveryId: entree.deliveryId,
    type: lu.evenement,
    saleId: lu.saleId,
  });
  // Livraison déjà menée à terme : on accuse réception sans rien refaire.
  // (`recu`/`erreur` = tentative précédente interrompue : on reprend.)
  if (!nouveau && TERMINAUX.includes(precedent)) return { http: 200, statut: 'deja' };

  const fin = async (statut: StatutEvenement, detail: string | null, txnId: string | null = null, http = 200): Promise<Reponse> => {
    await deps.conclure(entree.deliveryId, statut, detail, txnId);
    return { http, statut };
  };

  if (!estEvenementVente(lu.evenement)) {
    if (lu.evenement === 'license.revoked') {
      // Seul signal approchant un remboursement ; il ne porte pas l'identifiant
      // de vente, donc on ne révoque rien automatiquement.
      await deps.alerter('licence révoquée — vérifier un éventuel remboursement et révoquer l’accès si besoin.');
      return fin('a_verifier', 'licence révoquée');
    }
    return fin('ignore', null);
  }
  if (!lu.saleId) return fin('rejete', 'vente sans identifiant');

  // Retrouver NOTRE transaction : par la vente, sinon par notre id renvoyé
  // dans custom_metadata (cas d'un Pulse arrivé avant le rattachement).
  let txn = await deps.transactionParVente(lu.saleId);
  if (!txn && lu.txnMeta) {
    const parMeta = await deps.transactionParId(lu.txnMeta);
    if (parMeta && (parMeta.provider_sale_id === null || parMeta.provider_sale_id === lu.saleId)) txn = parMeta;
  }
  if (!txn) {
    if (lu.evenement === 'successful.sale') {
      await deps.alerter(`vente payée ${lu.saleId} sans commande WestBourse correspondante (achat hors site ?).`);
    }
    return fin('orphelin', 'aucune transaction correspondante');
  }

  if (lu.evenement !== 'successful.sale') {
    await deps.marquerEchec(txn.id);
    return fin('traite', lu.evenement, txn.id);
  }

  if (txn.status === 'paid') return fin('traite', 'déjà accordé', txn.id);

  const chariowProductId = txn.product_code ? await deps.produitChariowId(txn.product_code) : null;
  if (!chariowProductId) {
    await deps.alerter(`transaction ${txn.id} : produit ${txn.product_code ?? '∅'} absent du catalogue.`);
    return fin('a_verifier', 'produit inconnu du catalogue', txn.id);
  }

  let vente: VenteChariow;
  try {
    vente = await deps.lireVente(lu.saleId);
  } catch (e) {
    const transitoire = (e as { transitoire?: boolean }).transitoire !== false;
    if (transitoire) return fin('erreur', 'relecture de la vente impossible', txn.id, 500);
    return fin('rejete', 'vente introuvable chez Chariow', txn.id);
  }

  const verdict = verifierVente(vente, {
    saleId: lu.saleId,
    chariowProductId,
    montant: txn.amount,
    devise: txn.currency,
  });
  if (!verdict.ok) {
    // Statut pas encore à jour chez Chariow : un retry plus tard peut réussir.
    if (vente.status === 'awaiting_payment') return fin('erreur', verdict.motif, txn.id, 500);
    await deps.alerter(`vente ${lu.saleId} refusée (${verdict.motif}), transaction ${txn.id}.`);
    return fin('rejete', verdict.motif, txn.id);
  }

  let resultat: string;
  try {
    resultat = await deps.accorder(txn.id, lu.saleId);
  } catch {
    // Paiement vérifié mais écriture impossible : le retry de Chariow nous
    // donne une seconde chance, sinon le client a payé pour rien.
    return fin('erreur', 'accord impossible (base)', txn.id, 500);
  }
  if (resultat === 'module_accorde' || resultat === 'pass_accorde' || resultat === 'deja') {
    return fin('traite', resultat, txn.id);
  }
  await deps.alerter(`transaction ${txn.id} : accord refusé (${resultat}).`);
  return fin('a_verifier', resultat, txn.id);
}
