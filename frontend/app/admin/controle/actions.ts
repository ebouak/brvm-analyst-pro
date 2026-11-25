'use server';

import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { PREFIXE_TEST, actualiserAppel, lancerAppelTest } from '@/lib/voix/appel';

/**
 * Appel de test vers le téléphone de l'exploitant (BLAND_NUMERO_EXPLOITANT).
 * Payant : réservé à `settings.write`, une confirmation côté interface, tracé
 * dans `appels_vocaux` et le journal d'audit, compté dans le plafond du jour.
 * Jamais de réessai automatique.
 */
export type RetourTest =
  | { ok: true; appelId: string }
  | { ok: false; message: string; appelId?: string };

export async function lancerAppelDeTest(): Promise<RetourTest> {
  const ctx = await requirePermission('settings.write');
  const r = await lancerAppelTest(ctx.userId);
  await recordAudit(ctx, {
    action: 'voix.appel_test',
    resourceType: 'appel_vocal',
    resourceId: r.ok ? r.appelId : 'aucun',
    severity: r.ok ? 'info' : 'warning',
    metadata: r.ok ? { ok: true } : { ok: false, code: r.code, ...(r.statut ? { statut: r.statut } : {}) },
  });
  if (r.ok) return { ok: true, appelId: r.appelId };
  if (r.statut === 'peut_etre_parti') {
    return { ok: false, appelId: r.appelId, message: `Réponse de Bland non reçue (${r.raison}) : l’appel est PEUT-ÊTRE parti. Ne relancez pas avant d’avoir vérifié votre téléphone.` };
  }
  return { ok: false, message: r.raison, ...(r.appelId ? { appelId: r.appelId } : {}) };
}

export type EtatTest =
  | { ok: true; statut: string; dureeMin: number | null; finPar: string | null; erreur: string | null }
  | { ok: false; message: string };

/** Relit chez Bland un appel de TEST (jamais une vraie alerte ni un rappel de contact). */
export async function lireAppelDeTest(appelId: string): Promise<EtatTest> {
  await requirePermission('settings.write');
  if (!/^[0-9a-f-]{36}$/i.test(appelId)) return { ok: false, message: 'Identifiant invalide.' };
  const db = getServiceClient();
  const { data: l, error } = await db
    .from('appels_vocaux')
    .select('id, source_id')
    .eq('id', appelId)
    .eq('motif', 'alerte_exploitant')
    .maybeSingle();
  if (error) return { ok: false, message: `Lecture impossible (${error.code ?? 'erreur'}).` };
  if (!l || !String(l.source_id).startsWith(PREFIXE_TEST)) return { ok: false, message: 'Appel de test introuvable.' };

  const r = await actualiserAppel(db, appelId);
  const { data: e } = await db
    .from('appels_vocaux')
    .select('statut, duree_min, fin_par, erreur')
    .eq('id', appelId)
    .maybeSingle();
  if (!e) return { ok: false, message: r.ok ? 'Appel relu, mais ligne illisible.' : r.raison };
  return {
    ok: true,
    statut: String(e.statut),
    dureeMin: (e.duree_min as number | null) ?? null,
    finPar: (e.fin_par as string | null) ?? null,
    erreur: r.ok ? ((e.erreur as string | null) ?? null) : r.raison,
  };
}
