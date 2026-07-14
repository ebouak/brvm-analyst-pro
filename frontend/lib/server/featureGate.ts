import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { ADMIN_EMAILS } from './admin-emails';

/**
 * Garde unique des fonctionnalités : accès (free / premium / désactivée) ET
 * quota journalier par utilisateur.
 *
 * Pourquoi : le diagnostic IA vérifiait « l'utilisateur est premium » mais
 * jamais « combien de fois aujourd'hui » — un seul compte pouvait lancer des
 * centaines d'analyses et vider le budget LLM. Le compteur est en base (un
 * compteur en mémoire ne survit pas au serverless).
 *
 * L'état vit dans `feature_flags`, pilotable depuis /admin/features sans
 * redéploiement (et donc utilisable comme kill switch).
 */

export type FeatureCode =
  | 'diagnostic_ia'
  | 'assistant_ia'
  | 'backtest'
  | 'paper_trading'
  | 'dcf';

export interface FeatureFlag {
  code: string;
  label: string;
  acces: 'free' | 'premium' | 'pro' | 'disabled';
  quota_free: number | null;
  quota_premium: number | null;
  description: string | null;
}

export type GateResult =
  | { allowed: true; used: number; quota: number | null }
  | { allowed: false; status: 403 | 429; reason: string };

/** Lit un flag. `null` si inconnu (une feature non déclarée n'est pas gatée). */
export async function getFlag(code: FeatureCode): Promise<FeatureFlag | null> {
  const db = getServiceClient();
  const { data } = await db
    .from('feature_flags')
    .select('code, label, acces, quota_free, quota_premium, description')
    .eq('code', code)
    .maybeSingle();
  return (data as FeatureFlag) ?? null;
}

/**
 * Autorise (ou non) l'usage d'une feature par un utilisateur, et CONSOMME une
 * unité de quota si c'est autorisé.
 *
 * @param consume  false pour un simple test d'accès (affichage d'un bouton),
 *                 sans décompter — sinon afficher une page consommerait le quota.
 */
export async function checkFeature(
  code: FeatureCode,
  user: { id: string; email?: string | null; isPremium: boolean },
  opts: { consume?: boolean } = {},
): Promise<GateResult> {
  const { consume = true } = opts;

  // Les super-admins ne sont ni bloqués ni décomptés (support et diagnostic).
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return { allowed: true, used: 0, quota: null };
  }

  const flag = await getFlag(code);
  // Feature non déclarée : on ne bloque pas (évite qu'un oubli de seed coupe
  // une fonctionnalité en production).
  if (!flag) return { allowed: true, used: 0, quota: null };

  if (flag.acces === 'disabled') {
    return {
      allowed: false,
      status: 403,
      reason: `« ${flag.label} » est temporairement indisponible.`,
    };
  }

  if (flag.acces === 'premium' && !user.isPremium) {
    return {
      allowed: false,
      status: 403,
      reason: `« ${flag.label} » est réservé aux comptes premium.`,
    };
  }

  // `pro` = Platinium uniquement. Sans ce cas, un admin qui bascule une
  // fonctionnalité en « Pro » la laisserait ouverte à tous les Premium : le
  // réglage n'aurait AUCUN effet, en silence.
  if (flag.acces === 'pro') {
    const { getEntitlements } = await import('./entitlements');
    const ent = await getEntitlements();
    if (!ent.isPro) {
      return {
        allowed: false,
        status: 403,
        reason: `« ${flag.label} » est réservé au plan Platinium.`,
      };
    }
  }

  const quota = user.isPremium ? flag.quota_premium : flag.quota_free;

  // null = illimité.
  if (quota === null || quota === undefined) {
    if (consume) await increment(user.id, code);
    return { allowed: true, used: 0, quota: null };
  }

  // Quota à 0 = interdit (ex. gratuit sur une feature premium).
  if (quota === 0) {
    return {
      allowed: false,
      status: 403,
      reason: `« ${flag.label} » n'est pas inclus dans votre formule.`,
    };
  }

  const db = getServiceClient();

  if (!consume) {
    const { data } = await db
      .from('feature_usage')
      .select('compteur')
      .eq('user_id', user.id)
      .eq('feature_code', code)
      .eq('jour', new Date().toISOString().slice(0, 10))
      .maybeSingle();
    const used = (data?.compteur as number) ?? 0;
    return used >= quota
      ? { allowed: false, status: 429, reason: quotaMessage(flag.label, quota) }
      : { allowed: true, used, quota };
  }

  const used = await increment(user.id, code);
  if (used > quota) {
    return { allowed: false, status: 429, reason: quotaMessage(flag.label, quota) };
  }
  return { allowed: true, used, quota };
}

function quotaMessage(label: string, quota: number): string {
  return `Quota atteint pour « ${label} » : ${quota} par jour. Il se réinitialise à minuit.`;
}

/** Incrément atomique côté base (deux appels simultanés ne s'écrasent pas). */
async function increment(userId: string, code: FeatureCode): Promise<number> {
  const db = getServiceClient();
  const { data, error } = await db.rpc('feature_usage_increment', {
    p_user_id: userId,
    p_feature: code,
  });
  if (error) {
    // On ne coupe pas le service pour un incident de comptage, mais on le trace.
    console.error('feature_usage_increment a échoué :', error.message);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}
