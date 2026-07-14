import 'server-only';
import { cache } from 'react';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { getEntitlements, type Entitlements } from './entitlements';

/**
 * Contrôle d'accès piloté par la BASE, jamais par le code.
 *
 * Le niveau requis de chaque fonctionnalité vit dans `feature_flags.acces` et
 * s'édite depuis /admin/features. Aucune page ne décide « ceci est premium » :
 * elle demande seulement « cet utilisateur a-t-il le droit ? ». Rendre le Screener
 * gratuit pour une opération marketing = une case à cocher, plus un déploiement.
 *
 * ── Le seul défaut qui subsiste, et pourquoi ──
 * Si une fonctionnalité n'est PAS déclarée en base (ligne absente, migration non
 * appliquée, base injoignable), il faut bien décider quelque chose. On refuse
 * (= premium). Ce n'est pas une politique figée : c'est un filet. Ouvrir par
 * défaut ferait fuir le revenu au premier incident réseau ; refuser est
 * réversible et VISIBLE (l'admin signale les flags non déclarés).
 */

export type Access = 'free' | 'premium' | 'pro' | 'disabled';

/** Filet de sécurité pour une fonctionnalité NON DÉCLARÉE. Voir plus haut. */
const UNDECLARED: Access = 'premium';

export interface AccessDecision {
  allowed: boolean;
  /** Niveau exigé, tel que lu en base. */
  required: Access;
  /** Droits de l'utilisateur courant. */
  ent: Entitlements;
  /** La fonctionnalité n'existe pas en base : à déclarer dans /admin/features. */
  undeclared: boolean;
}

/**
 * Charge TOUS les flags en une fois, mémorisé pour la durée de la requête
 * (`cache` de React). Une page qui vérifie trois fonctionnalités ne fait donc
 * qu'un seul aller-retour vers la base.
 */
const loadFlags = cache(async (): Promise<Map<string, Access>> => {
  try {
    const db = getServiceClient();
    const { data, error } = await db.from('feature_flags').select('code, acces');
    if (error) throw error;
    const m = new Map<string, Access>();
    for (const r of (data ?? []) as { code: string; acces: string }[]) {
      m.set(r.code, r.acces as Access);
    }
    return m;
  } catch {
    // Base injoignable : map vide → tout est « non déclaré » → refusé (filet).
    return new Map();
  }
});

/** Niveau requis pour une fonctionnalité, lu en base. */
export async function requiredAccess(code: string): Promise<{ required: Access; undeclared: boolean }> {
  const flags = await loadFlags();
  const found = flags.get(code);
  return found ? { required: found, undeclared: false } : { required: UNDECLARED, undeclared: true };
}

/**
 * L'utilisateur courant a-t-il accès à cette fonctionnalité ?
 *
 * `disabled` = coupé pour TOUT LE MONDE (kill switch), y compris les abonnés.
 * C'est volontaire : un kill switch qui épargne les payants ne coupe rien le jour
 * où une fonctionnalité produit des résultats faux.
 */
export async function canAccess(code: string): Promise<AccessDecision> {
  const [{ required, undeclared }, ent] = await Promise.all([
    requiredAccess(code),
    getEntitlements(),
  ]);

  let allowed: boolean;
  switch (required) {
    case 'free':
      allowed = true;
      break;
    case 'premium':
      allowed = ent.isPremium;
      break;
    case 'pro':
      allowed = ent.isPro;
      break;
    case 'disabled':
      allowed = false;
      break;
    default:
      allowed = ent.isPremium;
  }

  return { allowed, required, ent, undeclared };
}

/** Niveau à afficher sur l'écran de blocage (« Passer à Premium/Platinium »). */
export function gateTier(required: Access): 'premium' | 'pro' {
  return required === 'pro' ? 'pro' : 'premium';
}
