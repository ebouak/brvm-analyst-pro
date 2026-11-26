import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { suspensionActive, type Decision } from './decisions';

/**
 * Suspension du Premium — lue par le résolveur de droits (lib/server/entitlements.ts)
 * à chaque requête d'un compte Premium. Module minimal : ce chemin est emprunté
 * par toutes les pages.
 */
/**
 * Le Premium est-il suspendu pour ce compte ? Échec de lecture = NON : une
 * sanction ne s'applique jamais sur une base illisible.
 */
export async function premiumSuspendu(userId: string, maintenant: Date = new Date()): Promise<boolean> {
  try {
    const { data, error } = await getServiceClient()
      .from('securite_decisions')
      .select('type, jusqu_au, created_at')
      .eq('user_id', userId)
      .in('type', ['suspension', 'levee'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return false;
    return suspensionActive((data ?? []) as Decision[], maintenant) !== null;
  } catch {
    return false;
  }
}

/**
 * Premium EFFECTIF pour les routes qui lisent `profiles.is_premium` sans passer
 * par `getEntitlements` (assistant, diagnostic, recherche, WhatsApp) : sans ce
 * filtre, une suspension laisserait l'IA Premium ouverte.
 */
export async function premiumEffectif(userId: string, isPremium: boolean): Promise<boolean> {
  return isPremium && !(await premiumSuspendu(userId));
}
