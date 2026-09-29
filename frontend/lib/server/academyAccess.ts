import 'server-only';
import { cache } from 'react';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { canAccess, type AccessDecision } from '@/lib/server/featureAccess';
import { droitNiveauValide, type DroitNiveau } from '@/lib/billing/chariow/regles';
import { NIVEAUX, type Niveau } from '@/lib/academy/types';

/**
 * Accès à l'Academy : l'abonnement premium ouvre TOUT (feature flag
 * `formations`, inchangé) ; un niveau acheté à l'unité via Chariow n'ouvre QUE
 * ce niveau — ses cours, son examen, son certificat.
 *
 * Les droits sont lus par le service_role en filtrant sur l'utilisateur de la
 * SESSION (jamais sur un identifiant venu du navigateur).
 */

interface LigneDroit extends DroitNiveau {
  product_code: string;
  niveau: Niveau | null;
}

/** Date de refonte majeure par niveau (la plus récente des cours publiés). */
const refontesParNiveau = cache(async (): Promise<Map<Niveau, string>> => {
  const m = new Map<Niveau, string>();
  try {
    const { data } = await getServiceClient()
      .from('academy_courses')
      .select('niveau, refonte_majeure_le')
      .eq('published', true)
      .not('refonte_majeure_le', 'is', null);
    for (const r of (data ?? []) as { niveau: Niveau | null; refonte_majeure_le: string }[]) {
      if (!r.niveau) continue;
      const prev = m.get(r.niveau);
      if (!prev || r.refonte_majeure_le > prev) m.set(r.niveau, r.refonte_majeure_le);
    }
  } catch {
    /* colonne absente (migration non appliquée) : aucune refonte connue */
  }
  return m;
});

async function droitsDe(userId: string): Promise<LigneDroit[]> {
  try {
    const { data } = await getServiceClient()
      .from('user_entitlements')
      .select('product_code, niveau, granted_at, expires_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null);
    return (data ?? []) as LigneDroit[];
  } catch {
    // Table absente ou base injoignable : aucun droit acheté (le premium,
    // lui, continue de fonctionner par son propre chemin).
    return [];
  }
}

/** Niveaux achetés et encore valides (révocation, expiration, refonte > 12 mois). */
export async function niveauxAchetes(userId: string): Promise<Set<Niveau>> {
  const [droits, refontes] = await Promise.all([droitsDe(userId), refontesParNiveau()]);
  const ok = new Set<Niveau>();
  for (const d of droits) {
    if (!d.niveau || !d.product_code.startsWith('academy:')) continue;
    if (droitNiveauValide(d, refontes.get(d.niveau) ?? null)) ok.add(d.niveau);
  }
  return ok;
}

/**
 * Niveaux dont l'achat a été rattrapé par une refonte majeure : l'utilisateur
 * peut racheter à prix réduit (`academy:<niveau>:upgrade`).
 */
export async function niveauxARemettreAJour(userId: string): Promise<Set<Niveau>> {
  const [droits, refontes, valides] = await Promise.all([
    droitsDe(userId),
    refontesParNiveau(),
    niveauxAchetes(userId),
  ]);
  const out = new Set<Niveau>();
  for (const d of droits) {
    if (!d.niveau || !d.product_code.startsWith('academy:') || valides.has(d.niveau)) continue;
    const refonte = refontes.get(d.niveau) ?? null;
    // Écarté À CAUSE de la refonte seulement (pas d'une expiration).
    if (refonte && !droitNiveauValide(d, refonte) && droitNiveauValide(d, null)) out.add(d.niveau);
  }
  return out;
}

/**
 * Droit actif sur un code produit.
 *   - `academy:<niveau>` : niveau acheté et valide (achat initial OU rachat) ;
 *   - `premium` / `platinium` : abonnement actif et non échu ;
 *   - autre code : droit non révoqué et non expiré.
 */
export async function hasActiveEntitlement(userId: string, productCode: string): Promise<boolean> {
  const m = /^academy:([a-z]+)(?::upgrade)?$/.exec(productCode);
  if (m) {
    const niveau = m[1] as Niveau;
    if (!(NIVEAUX as readonly string[]).includes(niveau)) return false;
    return (await niveauxAchetes(userId)).has(niveau);
  }

  if (productCode === 'premium' || productCode === 'platinium') {
    try {
      const { data } = await getServiceClient()
        .from('subscriptions')
        .select('renews_at, subscription_plans!inner(code)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('subscription_plans.code', productCode);
      const now = Date.now();
      return ((data ?? []) as { renews_at: string | null }[]).some(
        (s) => !s.renews_at || new Date(s.renews_at).getTime() > now,
      );
    } catch {
      return false;
    }
  }

  const now = new Date();
  return (await droitsDe(userId)).some(
    (d) => d.product_code === productCode && (!d.expires_at || new Date(d.expires_at) > now),
  );
}

export interface AccesAcademy {
  userId: string | null;
  /** Décision du feature flag `formations` (abonnement). */
  abonnement: AccessDecision;
  /** Niveaux ouverts par achat à l'unité. */
  niveaux: Set<Niveau>;
}

/** Tout ce qu'une page de l'Academy doit savoir, en un appel par requête. */
export const accesAcademy = cache(async (): Promise<AccesAcademy> => {
  const abonnement = await canAccess('formations');
  const userId = abonnement.ent.userId;
  // Coupure générale (`disabled`) : elle vaut aussi pour les achats à l'unité.
  const niveaux =
    userId && !abonnement.allowed && abonnement.required !== 'disabled'
      ? await niveauxAchetes(userId)
      : new Set<Niveau>();
  return { userId, abonnement, niveaux };
});

/** L'utilisateur courant peut-il suivre ce niveau ? */
export async function peutSuivreNiveau(niveau: string | null): Promise<{ allowed: boolean; acces: AccesAcademy }> {
  const acces = await accesAcademy();
  if (acces.abonnement.allowed) return { allowed: true, acces };
  const ok = !!niveau && acces.niveaux.has(niveau as Niveau);
  return { allowed: ok, acces };
}

/** Client de session exporté pour les routes qui ont besoin de l'email. */
export async function utilisateurSession() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user;
}
