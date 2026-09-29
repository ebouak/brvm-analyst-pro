import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { Niveau } from '@/lib/academy/types';
import type { BillingCycle } from '@/lib/billing/types';

/**
 * Catalogue Chariow, lu dans `chariow_products` (migration 0146) par le
 * SERVEUR. C'est la seule source du prix, de la devise et de l'identifiant
 * Chariow : le navigateur ne transmet qu'un `product_code`.
 */

export type TypeProduit = 'module' | 'upgrade' | 'pass';

export interface ProduitChariow {
  productCode: string;
  kind: TypeProduit;
  libelle: string;
  chariowProductId: string;
  niveau: Niveau | null;
  planCode: string | null;
  cycle: BillingCycle | null;
  montant: number;
  devise: string;
}

const COLONNES = 'product_code, kind, libelle, chariow_product_id, niveau, plan_code, cycle, amount, currency';

interface Ligne {
  product_code: string;
  kind: TypeProduit;
  libelle: string;
  chariow_product_id: string | null;
  niveau: Niveau | null;
  plan_code: string | null;
  cycle: BillingCycle | null;
  amount: number | string;
  currency: string;
}

function versProduit(l: Ligne): ProduitChariow | null {
  const montant = Number(l.amount);
  // Un produit sans identifiant Chariow ou sans prix exploitable n'est pas vendable.
  if (!l.chariow_product_id || !Number.isFinite(montant) || montant <= 0) return null;
  return {
    productCode: l.product_code,
    kind: l.kind,
    libelle: l.libelle,
    chariowProductId: l.chariow_product_id,
    niveau: l.niveau,
    planCode: l.plan_code,
    cycle: l.cycle,
    montant,
    devise: l.currency,
  };
}

/** Produit, actif ou non (le webhook doit pouvoir honorer une vente d'un produit désactivé depuis). */
export async function produitParCode(code: string, actifSeulement = true): Promise<ProduitChariow | null> {
  try {
    let q = getServiceClient().from('chariow_products').select(COLONNES).eq('product_code', code);
    if (actifSeulement) q = q.eq('active', true);
    const { data } = await q.maybeSingle();
    return data ? versProduit(data as Ligne) : null;
  } catch {
    return null;
  }
}

/** Tous les produits actifs, pour l'affichage des offres. Vide si rien n'est configuré. */
export async function produitsActifs(kind?: TypeProduit): Promise<ProduitChariow[]> {
  try {
    let q = getServiceClient().from('chariow_products').select(COLONNES).eq('active', true);
    if (kind) q = q.eq('kind', kind);
    const { data } = await q.order('amount', { ascending: true });
    return ((data ?? []) as Ligne[]).map(versProduit).filter((p): p is ProduitChariow => p !== null);
  } catch {
    return [];
  }
}

/** Code produit d'un niveau de l'Academy (et de son rachat après refonte). */
export function codeNiveau(niveau: Niveau, upgrade = false): string {
  return `academy:${niveau}${upgrade ? ':upgrade' : ''}`;
}
