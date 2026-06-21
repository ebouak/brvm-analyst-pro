'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';

type R = { ok: boolean; message?: string };

const TYPES = ['cours', 'conference', 'webinaire'];
const NIVEAUX = ['debutant', 'intermediaire', 'avance'];

function num(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clean(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length ? t : null;
}

/** Crée (id=null) ou édite une formation. */
export async function upsertFormation(id: string | null, fields: Record<string, string>): Promise<R> {
  const ctx = await requirePermission('content.write');
  const titre = (fields.titre ?? '').trim();
  if (!titre) return { ok: false, message: 'Titre requis.' };
  const type = TYPES.includes(fields.type ?? '') ? fields.type : 'cours';
  const niveau = NIVEAUX.includes(fields.niveau ?? '') ? fields.niveau : null;

  const payload = {
    titre,
    description: clean(fields.description),
    type,
    niveau,
    date_evenement: clean(fields.date_evenement),
    duree_min: num(fields.duree_min),
    cover_url: clean(fields.cover_url),
    replay_url: clean(fields.replay_url),
    support_url: clean(fields.support_url),
    published: fields.published === 'true',
    updated_at: new Date().toISOString(),
  };

  const sb = getServiceClient();
  const { error } = id
    ? await sb.from('formations').update(payload).eq('id', id)
    : await sb.from('formations').insert(payload);
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: id ? 'formation.update' : 'formation.create',
    resourceType: 'formation', resourceId: id ?? titre, severity: 'info',
  });
  revalidatePath('/admin/formations');
  revalidatePath('/formations');
  return { ok: true };
}

export async function setPublished(id: string, published: boolean): Promise<R> {
  const ctx = await requirePermission('content.write');
  const { error } = await getServiceClient().from('formations')
    .update({ published, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: published ? 'formation.publish' : 'formation.unpublish', resourceType: 'formation', resourceId: id, severity: 'info' });
  revalidatePath('/admin/formations');
  revalidatePath('/formations');
  return { ok: true };
}

export async function deleteFormation(id: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const { error } = await getServiceClient().from('formations').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'formation.delete', resourceType: 'formation', resourceId: id, severity: 'warning' });
  revalidatePath('/admin/formations');
  revalidatePath('/formations');
  return { ok: true };
}
