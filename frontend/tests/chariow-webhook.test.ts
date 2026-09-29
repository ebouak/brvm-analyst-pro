import { beforeEach, describe, expect, it } from 'vitest';
import { traiterPulse, type Deps, type StatutEvenement, type TransactionChariow } from '@/lib/billing/chariow/traiterPulse';
import type { VenteChariow } from '@/lib/billing/chariow/regles';

/**
 * Doublure en mémoire de la base et de Chariow. `accorder` reproduit la
 * fonction SQL accorder_achat : idempotente (statut `paid` + un droit par vente).
 */
function monde() {
  const journal = new Map<string, { statut: StatutEvenement; detail: string | null; tentatives: number }>();
  const txns = new Map<string, TransactionChariow>();
  const droits = new Map<string, string>(); // source_ref → txn
  const alertes: string[] = [];
  const ventes = new Map<string, VenteChariow>();
  let chariowEnPanne = false;
  let accords = 0;

  const deps: Deps = {
    async journaliser({ deliveryId }) {
      const ex = journal.get(deliveryId);
      if (ex) {
        ex.tentatives++;
        return { nouveau: false, statut: ex.statut };
      }
      journal.set(deliveryId, { statut: 'recu', detail: null, tentatives: 1 });
      return { nouveau: true, statut: 'recu' };
    },
    async conclure(deliveryId, statut, detail) {
      journal.set(deliveryId, { ...journal.get(deliveryId)!, statut, detail });
    },
    async transactionParVente(saleId) {
      return [...txns.values()].find((t) => t.provider_sale_id === saleId) ?? null;
    },
    async transactionParId(id) {
      return txns.get(id) ?? null;
    },
    async marquerEchec(id) {
      const t = txns.get(id)!;
      if (t.status === 'pending') t.status = 'failed';
    },
    async produitChariowId(code) {
      return code === 'academy:debutant' ? 'prd_niv1' : null;
    },
    async lireVente(saleId) {
      if (chariowEnPanne) throw Object.assign(new Error('503'), { transitoire: true });
      const v = ventes.get(saleId);
      if (!v) throw Object.assign(new Error('404'), { transitoire: false });
      return v;
    },
    async accorder(txnId, saleId) {
      const t = txns.get(txnId)!;
      if (t.status === 'paid') return 'deja';
      t.status = 'paid';
      t.provider_sale_id ??= saleId;
      if (!droits.has(saleId)) {
        droits.set(saleId, txnId);
        accords++;
      }
      return 'module_accorde';
    },
    async alerter(texte) {
      alertes.push(texte);
    },
  };

  return {
    deps,
    journal,
    txns,
    droits,
    alertes,
    ventes,
    panne: (v: boolean) => (chariowEnPanne = v),
    accords: () => accords,
  };
}

const TXN = '0b8f1c1e-1234-4abc-9def-001122334455';
const pulse = (event: string, saleId = 'sal_ok1', txn: string | null = TXN) => ({
  event,
  sale: { id: saleId, custom_metadata: txn ? { txn } : {} },
});

describe('traiterPulse', () => {
  let m: ReturnType<typeof monde>;

  beforeEach(() => {
    m = monde();
    m.txns.set(TXN, {
      id: TXN,
      status: 'pending',
      amount: 15000,
      currency: 'XOF',
      product_code: 'academy:debutant',
      provider_sale_id: 'sal_ok1',
    });
    m.ventes.set('sal_ok1', {
      id: 'sal_ok1',
      status: 'completed',
      amount: { value: 15000, currency: 'XOF' },
      product: { id: 'prd_niv1' },
    });
  });

  it('accorde une vente vérifiée', async () => {
    const r = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r).toEqual({ http: 200, statut: 'traite' });
    expect(m.txns.get(TXN)!.status).toBe('paid');
    expect(m.accords()).toBe(1);
  });

  it('IDEMPOTENCE : la même livraison rejouée n’écrit plus rien', async () => {
    await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    const r = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r.statut).toBe('deja');
    expect(m.accords()).toBe(1);
    expect(m.journal.get('d1')!.tentatives).toBe(2);
  });

  it('IDEMPOTENCE : deux livraisons distinctes de la même vente n’accordent qu’une fois', async () => {
    await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    await traiterPulse(m.deps, { deliveryId: 'd2-rejeu', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(m.accords()).toBe(1);
    expect(m.droits.size).toBe(1);
  });

  it('ORDRE : un échec arrivé après le succès ne rétrograde pas la transaction', async () => {
    await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    await traiterPulse(m.deps, { deliveryId: 'd2', enteteEvenement: null, payload: pulse('failed.sale') });
    expect(m.txns.get(TXN)!.status).toBe('paid');
  });

  it('ORDRE : un abandon avant paiement marque la transaction en échec, un succès ultérieur l’accorde', async () => {
    await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('abandoned.sale') });
    expect(m.txns.get(TXN)!.status).toBe('failed');
    await traiterPulse(m.deps, { deliveryId: 'd2', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(m.txns.get(TXN)!.status).toBe('paid');
  });

  it('retrouve la transaction par custom_metadata si la vente n’était pas encore rattachée', async () => {
    m.txns.get(TXN)!.provider_sale_id = null;
    const r = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r.statut).toBe('traite');
    expect(m.txns.get(TXN)!.provider_sale_id).toBe('sal_ok1');
  });

  it('refuse une métadonnée qui désigne la transaction d’une AUTRE vente', async () => {
    m.ventes.set('sal_autre', { ...m.ventes.get('sal_ok1')!, id: 'sal_autre' });
    const r = await traiterPulse(m.deps, {
      deliveryId: 'd1',
      enteteEvenement: null,
      payload: pulse('successful.sale', 'sal_autre'),
    });
    expect(r.statut).toBe('orphelin');
    expect(m.accords()).toBe(0);
    expect(m.alertes).toHaveLength(1);
  });

  it('montant insuffisant : rejet, aucun accès, alerte exploitant', async () => {
    m.ventes.set('sal_ok1', { ...m.ventes.get('sal_ok1')!, amount: { value: 5, currency: 'XOF' } });
    const r = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r).toEqual({ http: 200, statut: 'rejete' });
    expect(m.accords()).toBe(0);
    expect(m.alertes[0]).toMatch(/montant insuffisant/);
  });

  it('vente encore « awaiting_payment » : 500 pour que Chariow réessaie', async () => {
    m.ventes.set('sal_ok1', { ...m.ventes.get('sal_ok1')!, status: 'awaiting_payment' });
    const r = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r.http).toBe(500);
    // Le retry, une fois la vente payée, aboutit.
    m.ventes.set('sal_ok1', { ...m.ventes.get('sal_ok1')!, status: 'completed' });
    const r2 = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r2.statut).toBe('traite');
    expect(m.accords()).toBe(1);
  });

  it('Chariow injoignable : 500 et reprise au retry', async () => {
    m.panne(true);
    const r = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r.http).toBe(500);
    m.panne(false);
    const r2 = await traiterPulse(m.deps, { deliveryId: 'd1', enteteEvenement: null, payload: pulse('successful.sale') });
    expect(r2.statut).toBe('traite');
  });

  it('licence révoquée : à vérifier + alerte, rien de révoqué automatiquement', async () => {
    const r = await traiterPulse(m.deps, { deliveryId: 'd9', enteteEvenement: 'license.revoked', payload: { event: 'license.revoked' } });
    expect(r.statut).toBe('a_verifier');
    expect(m.alertes).toHaveLength(1);
  });

  it('événement non géré : ignoré', async () => {
    const r = await traiterPulse(m.deps, { deliveryId: 'd9', enteteEvenement: null, payload: { event: 'affiliate.joined' } });
    expect(r.statut).toBe('ignore');
  });
});
