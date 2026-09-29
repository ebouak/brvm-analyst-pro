import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Règles Chariow PURES : aucune I/O, aucune variable d'environnement.
 * Tout ce qui décide d'accorder de l'argent ou un accès vit ici, testé
 * (tests/chariow-regles.test.ts). Doc : docs/CHARIOW_PAYMENTS.md.
 */

// ── Signature des Pulses ─────────────────────────────────────────────────────

/**
 * Vérifie `x-chariow-signature: sha256=<hex>` = HMAC-SHA256(corps BRUT, secret
 * du Pulse `whsec_…`). Contrat : chariow.dev/en/guides/pulse-security.
 *
 * Le corps doit être celui reçu, octet pour octet : Chariow échappe les « / »
 * et les non-ASCII (\uXXXX), qu'un JSON.stringify ne reproduirait pas.
 * Pas d'horodatage par conception : le rejeu est traité par l'identifiant de
 * livraison, pas ici.
 */
export function signatureValide(corpsBrut: string, entete: string | null, secret: string | undefined): boolean {
  if (!secret || !entete || !entete.startsWith('sha256=')) return false;
  const attendu = 'sha256=' + createHmac('sha256', secret).update(corpsBrut, 'utf8').digest('hex');
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(entete, 'utf8');
  // timingSafeEqual lève sur des longueurs différentes : on compare d'abord.
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Lecture défensive d'un Pulse ─────────────────────────────────────────────

export type EvenementVente = 'successful.sale' | 'failed.sale' | 'abandoned.sale';

export interface PulseLu {
  evenement: string;
  saleId: string | null;
  /** Notre identifiant de transaction, renvoyé dans custom_metadata. */
  txnMeta: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extrait le strict nécessaire d'un Pulse. Ne renvoie jamais email, nom ni téléphone. */
export function lirePulse(payload: unknown, enteteEvenement: string | null): PulseLu {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const sale = (p.sale && typeof p.sale === 'object' ? p.sale : {}) as Record<string, unknown>;
  const meta = (sale.custom_metadata && typeof sale.custom_metadata === 'object'
    ? sale.custom_metadata
    : {}) as Record<string, unknown>;
  const evenement = String(p.event ?? enteteEvenement ?? '').slice(0, 60);
  const saleId = typeof sale.id === 'string' && /^sal_[A-Za-z0-9]{3,100}$/.test(sale.id) ? sale.id : null;
  const txn = typeof meta.txn === 'string' && UUID.test(meta.txn) ? meta.txn : null;
  return { evenement, saleId, txnMeta: txn };
}

export function estEvenementVente(e: string): e is EvenementVente {
  return e === 'successful.sale' || e === 'failed.sale' || e === 'abandoned.sale';
}

// ── Contrôle d'une vente relue chez Chariow ─────────────────────────────────

export interface VenteChariow {
  id?: string;
  status?: string;
  amount?: { value?: number | string; currency?: string } | null;
  product?: { id?: string; slug?: string } | null;
}

export interface Attendu {
  saleId: string;
  chariowProductId: string;
  montant: number;
  devise: string;
}

export type Verdict = { ok: true } | { ok: false; motif: string };

/**
 * Une vente n'ouvre un accès que si TOUT concorde avec ce que NOUS attendions.
 * Le corps du Pulse ne suffit pas : la vente est relue par GET /v1/sales/{id},
 * et c'est cette relecture qui passe ici.
 *
 * - statut `completed` ou `settled` (fonds reversés, donc payée) ;
 * - même produit que le catalogue (sinon : payer un produit à 500 F et se voir
 *   accorder celui à 50 000) ;
 * - même devise, et montant ≥ attendu (sinon : payer 5 F pour un pass).
 */
export function verifierVente(v: VenteChariow | null | undefined, att: Attendu): Verdict {
  if (!v) return { ok: false, motif: 'vente illisible' };
  if (v.id !== att.saleId) return { ok: false, motif: 'identifiant de vente différent' };
  if (v.status !== 'completed' && v.status !== 'settled') {
    return { ok: false, motif: `statut ${String(v.status ?? 'absent')}` };
  }
  const prod = v.product ?? {};
  if (prod.id !== att.chariowProductId && prod.slug !== att.chariowProductId) {
    return { ok: false, motif: 'produit différent du catalogue' };
  }
  const devise = String(v.amount?.currency ?? '');
  if (devise !== att.devise) return { ok: false, motif: `devise ${devise || 'absente'}` };
  const paye = Number(v.amount?.value);
  if (!Number.isFinite(paye) || paye < att.montant) return { ok: false, motif: 'montant insuffisant' };
  return { ok: true };
}

// ── Droit d'accès à un niveau de l'Academy ──────────────────────────────────

export interface DroitNiveau {
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

const DOUZE_MOIS_MS = 365 * 24 * 3600 * 1000;

/**
 * Règle produit (2026-09-29, option 2) : un niveau acheté l'est à vie, SAUF
 * une refonte majeure publiée plus de 12 mois après l'achat. Le certificat
 * obtenu reste acquis (il vit dans une autre table) ; seul le contenu refondu
 * demande un rachat à prix réduit.
 */
export function droitNiveauValide(d: DroitNiveau, refonteLe: string | null, maintenant: Date = new Date()): boolean {
  if (d.revoked_at) return false;
  if (d.expires_at && new Date(d.expires_at).getTime() <= maintenant.getTime()) return false;
  if (refonteLe) {
    const refonte = new Date(refonteLe).getTime();
    const achat = new Date(d.granted_at).getTime();
    if (refonte > achat + DOUZE_MOIS_MS) return false;
  }
  return true;
}

// ── Formulaire de paiement ───────────────────────────────────────────────────

/**
 * Ce que le navigateur a le droit d'envoyer : un CODE produit et l'identité
 * exigée par Chariow. Ni prix, ni identifiant Chariow, ni plan, ni rôle.
 * `.strict()` : un champ en trop (amount, product_id…) fait échouer la requête.
 */
export const corpsCheckout = z
  .object({
    productCode: z.string().regex(/^[a-z0-9:_-]{3,60}$/),
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    phone: z
      .object({
        number: z.string().regex(/^\d{6,15}$/, 'Numéro : chiffres uniquement'),
        countryCode: z.string().regex(/^[A-Z]{2}$/),
      })
      .strict(),
  })
  .strict();

export type CorpsCheckout = z.infer<typeof corpsCheckout>;

/** Retire espaces, points, tirets et un éventuel « + » / « 00 » de tête. */
export function normaliserTelephone(brut: string): string {
  return brut.replace(/[\s.\-()]/g, '').replace(/^\+/, '').replace(/^00/, '');
}
