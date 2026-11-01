// frontend/app/admin/crm/reglages/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { validerReglages, type Reglages } from '@/lib/crm/reglages';
import { chargerReglages } from '@/lib/crm/reglagesServeur';

type Retour = { ok: boolean; message: string };

/** FormData (formulaire) ou objet simple : mêmes champs, mêmes contrôles. */
function lire(form: FormData | Record<string, unknown>): Record<string, unknown> {
  if (form instanceof FormData) return Object.fromEntries(form.entries());
  return form && typeof form === 'object' ? form : {};
}

/**
 * Enregistre les réglages (ligne unique id = 1). Autorisation d'abord, validation
 * ensuite. Les bornes sont celles des CHECK de 0177 : un refus ici évite un rejet
 * de la base, qui reste l'ultime garde. L'audit porte les valeurs avant/après,
 * jamais de donnée personnelle.
 */
export async function enregistrerReglages(form: FormData | Record<string, unknown>): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const v = validerReglages(lire(form));
  if (!v.ok) return { ok: false, message: v.message };

  const avant = await chargerReglages();
  const { error } = await getServiceClient().from('crm_reglages')
    .update({ ...v.reglages, modifie_par: ctx.userId, modifie_le: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    console.error('[crm] réglages non enregistrés :', error.code ?? error.message);
    return { ok: false, message: 'Réglages non enregistrés.' };
  }

  const changes: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const k of Object.keys(v.reglages) as (keyof Reglages)[]) {
    if (avant[k] !== v.reglages[k]) changes[k] = { avant: avant[k], apres: v.reglages[k] };
  }
  await recordAudit(ctx, { action: 'crm.reglages', resourceType: 'crm_reglages', resourceId: '1', severity: v.reglages.mode_sequences === 'actif' ? 'warning' : 'info', metadata: { changes } });
  revalidatePath('/admin/crm');
  return { ok: true, message: 'Réglages enregistrés.' };
}
